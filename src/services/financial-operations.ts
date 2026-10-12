import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { verifyOmieTitleReference } from "@/services/omie-financial";
import { AuthError, badRequest } from "@/lib/auth/errors";
import {
  FinanceBookSchema,
  FinanceCommandSchema,
  FinanceConflict,
  emptyFinanceBook,
  applyFinanceCommand,
} from "@/lib/financial/operations";

// Server-only prefix, denied by existing Storage Rules. No download tokens or public URLs.
const objectName = "financial-operations/v1/nextcon.json";
const MAX_BYTES = 16 * 1024 * 1024;
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number(e.code) : 0);
async function readBook() {
  let metadata;
  try {
    [metadata] = await bucket().file(objectName).getMetadata();
  } catch (error) {
    if (code(error) === 404) return { book: emptyFinanceBook(), generation: "0" };
    throw error;
  }
  const generation = String(metadata.generation || "");
  if (!/^\d+$/.test(generation) || Number(metadata.size) > MAX_BYTES)
    throw new Error("Invalid financial book metadata");
  // A missing generation after a concurrent write is a conflict, never an empty ledger.
  let bytes: Buffer;
  try {
    [bytes] = await bucket().file(objectName, { generation }).download();
  } catch (error) {
    if (code(error) === 404)
      throw new AuthError("Atualização concorrente. Consulte novamente.", 409);
    throw error;
  }
  if (bytes.length > MAX_BYTES) throw new Error("Financial book exceeds limit");
  return { book: FinanceBookSchema.parse(JSON.parse(bytes.toString("utf8"))), generation };
}
export async function getFinanceBook(user: AuthContext) {
  requireFinancialAccess(user);
  return (await readBook()).book;
}
export async function saveFinanceCommand(user: AuthContext, payload: unknown) {
  requireFinancialAccess(user);
  const parsed = FinanceCommandSchema.safeParse(payload);
  if (!parsed.success) throw badRequest("Operação inválida: " + parsed.error.issues[0]?.message);
  const command = parsed.data;
  const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  const { book, generation } = await readBook();
  let next;
  try {
    next = applyFinanceCommand(book, command, user.uid, new Date().toISOString(), hash);
  } catch (error) {
    if (error instanceof FinanceConflict) throw new AuthError(error.message, error.status);
    throw error;
  }
  if (next === book) return book;
  // Linking is read-only in Omie. Never silently mutate the provider's financial titles.
  const touched =
    command.action === "reference" || command.action === "editTitle"
      ? next.titles.filter((t) => t.id === command.id && t.externalReference)
      : command.action === "title" || command.action === "installments"
        ? next.titles.filter(
            (t) => !book.titles.some((old) => old.id === t.id) && t.externalReference
          )
        : [];
  for (const title of touched) {
    if (
      next.titles.some(
        (t) =>
          t.id !== title.id &&
          t.kind === title.kind &&
          t.externalReference === title.externalReference &&
          t.status !== "cancelled"
      )
    )
      throw new AuthError("Esta referência Omie já está vinculada a outro título.", 409);
    await verifyOmieTitleReference(user, title, title.externalReference);
  }
  const json = JSON.stringify(next);
  if (Buffer.byteLength(json) > MAX_BYTES)
    throw new AuthError(
      "Acervo atingiu o limite operacional. Preserve a exportação e solicite particionamento antes de novos registros.",
      413
    );
  try {
    await bucket()
      .file(objectName)
      .save(json, {
        resumable: false,
        contentType: "application/json",
        preconditionOpts: { ifGenerationMatch: generation },
        metadata: { cacheControl: "private, no-store" },
      });
  } catch (error) {
    if (code(error) === 412)
      throw new AuthError(
        "Outra sessão gravou alterações. Atualize e revise antes de salvar.",
        409
      );
    throw error;
  }
  return (await readBook()).book;
}
