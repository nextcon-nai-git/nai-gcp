import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { BalanceSummary, SavedBalance } from "@/lib/financial/balance";
import { AuthError, badRequest } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { extractBalancePdf } from "./financial-balance-pdf";

// Denied to direct clients by Storage Rules; served only through authenticated APIs.
const prefix = "financial-balances/v1/";
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const codeOf = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number(e.code) : 0);
function path(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw badRequest("Balanço inválido.");
  return `${prefix}${id}/`;
}
function summary(balance: SavedBalance): BalanceSummary {
  return {
    id: balance.id,
    company: balance.company,
    cnpj: balance.cnpj,
    periodStart: balance.periodStart,
    periodEnd: balance.periodEnd,
    sourceName: balance.sourceName,
    importedAt: balance.importedAt,
    importedBy: balance.importedBy,
  };
}
export async function listBalances(user: AuthContext) {
  requireFinancialAccess(user);
  const [files] = await bucket().getFiles({ prefix });
  const balances: BalanceSummary[] = [];
  for (const file of files.filter((item) => item.name.endsWith("/balance.json"))) {
    const [data] = await file.download();
    balances.push(summary(JSON.parse(data.toString()) as SavedBalance));
  }
  return balances.sort(
    (a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.importedAt.localeCompare(a.importedAt)
  );
}
export async function readBalance(user: AuthContext, id: string): Promise<SavedBalance> {
  requireFinancialAccess(user);
  const object = `${path(id)}balance.json`;
  try {
    const [data] = await bucket().file(object).download();
    return JSON.parse(data.toString());
  } catch (e) {
    if (codeOf(e) === 404) throw new AuthError("Balanço não encontrado.", 404);
    throw e;
  }
}
export async function readBalancePdf(user: AuthContext, id: string) {
  await readBalance(user, id);
  const [data] = await bucket()
    .file(`${path(id)}source.pdf`)
    .download();
  return data;
}
export async function saveBalance(user: AuthContext, sourceName: string, pdf: Buffer) {
  requireFinancialAccess(user);
  if (pdf.length > 10 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== "%PDF-")
    throw badRequest("Selecione um PDF válido de até 10 MB.");
  let data;
  try {
    data = await extractBalancePdf(pdf);
  } catch {
    throw badRequest(
      "Não foi possível conferir este balanço. Use o PDF textual do SPED com Descrição, Saldo Inicial e Saldo Final e confira se Ativo e Passivo total são iguais."
    );
  }
  const id = createHash("sha256").update(pdf).digest("hex");
  const balance: SavedBalance = {
    ...data,
    id,
    sourceName: sourceName.slice(0, 240),
    importedAt: new Date().toISOString(),
    importedBy: user.uid,
  };
  const opts = {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { cacheControl: "private, no-store" },
  };
  try {
    await bucket()
      .file(`${path(id)}source.pdf`)
      .save(pdf, { ...opts, contentType: "application/pdf" });
  } catch (e) {
    if (codeOf(e) !== 412) throw e;
  }
  try {
    await bucket()
      .file(`${path(id)}balance.json`)
      .save(JSON.stringify(balance), { ...opts, contentType: "application/json" });
  } catch (e) {
    if (codeOf(e) !== 412) throw e;
    return { balance: summary(await readBalance(user, id)), alreadySaved: true };
  }
  return { balance: summary(balance), alreadySaved: false };
}
