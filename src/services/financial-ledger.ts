import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import {
  LedgerSchema,
  summarizeLedger,
  type SavedLedger,
  type LedgerSummary,
} from "@/lib/financial/ledger";
import { AuthError, badRequest } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
// This prefix is denied by Storage Rules. Access is only through the authenticated server.
const prefix = "financial-ledgers/v1/";
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const codeOf = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number(e.code) : 0);
function path(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw badRequest("Livro inválido.");
  return `${prefix}${id}/`;
}
export function bookSummary(book: SavedLedger): LedgerSummary {
  const { rows, ...meta } = book;
  const s = summarizeLedger(rows);
  return {
    ...meta,
    rowCount: rows.length,
    entryCount: s.entryCount,
    debit: s.debit,
    credit: s.credit,
    unbalanced: s.unbalanced.length,
  };
}
export async function listLedgers(user: AuthContext) {
  requireFinancialAccess(user);
  const [files] = await bucket().getFiles({ prefix });
  const summaries: LedgerSummary[] = [];
  for (const file of files.filter((f) => f.name.endsWith("/book.json"))) {
    const [bytes] = await file.download();
    summaries.push(bookSummary(JSON.parse(bytes.toString()) as SavedLedger));
  }
  return summaries.sort(
    (a, b) => b.periodStart.localeCompare(a.periodStart) || b.importedAt.localeCompare(a.importedAt)
  );
}
export async function readLedger(user: AuthContext, id: string): Promise<SavedLedger> {
  requireFinancialAccess(user);
  try {
    const [data] = await bucket()
      .file(`${path(id)}book.json`)
      .download();
    return JSON.parse(data.toString());
  } catch (e) {
    if (codeOf(e) === 404) throw new AuthError("Livro não encontrado.", 404);
    throw e;
  }
}
export async function readLedgerPdf(user: AuthContext, id: string) {
  await readLedger(user, id);
  const [data] = await bucket()
    .file(`${path(id)}source.pdf`)
    .download();
  return data;
}
export async function saveLedger(user: AuthContext, payload: unknown, pdf: Buffer) {
  requireFinancialAccess(user);
  const parsed = LedgerSchema.safeParse(payload);
  if (!parsed.success)
    throw badRequest("Arquivo estruturado inválido: " + parsed.error.issues[0]?.message);
  const data = parsed.data;
  if (
    pdf.length > 10 * 1024 * 1024 ||
    pdf.subarray(0, 5).toString() !== "%PDF-" ||
    hash(pdf) !== data.sourceSha256
  )
    throw badRequest("O PDF não corresponde ao arquivo estruturado deste livro.");
  const id = hash(
    `${data.cnpj}|${data.periodStart}|${data.periodEnd}|${data.bookNumber}|${data.sourceSha256}`
  );
  const source = bucket().file(`${path(id)}source.pdf`);
  const json = bucket().file(`${path(id)}book.json`);
  const book: SavedLedger = {
    ...data,
    id,
    importedAt: new Date().toISOString(),
    importedBy: user.uid,
  };
  const opts = {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { cacheControl: "private, no-store" },
  };
  try {
    await source.save(pdf, { ...opts, contentType: "application/pdf" });
  } catch (e) {
    if (codeOf(e) !== 412) throw e;
  }
  try {
    await json.save(JSON.stringify(book), { ...opts, contentType: "application/json" });
  } catch (e) {
    if (codeOf(e) !== 412) throw e;
    const existing = await readLedger(user, id);
    const canonical = LedgerSchema.parse(existing);
    if (JSON.stringify(canonical) !== JSON.stringify(data))
      throw new AuthError(
        "Este PDF já foi importado com outra extração. A versão existente foi preservada.",
        409
      );
    return { book: bookSummary(existing), alreadySaved: true };
  }
  return { book: bookSummary(book), alreadySaved: false };
}
