import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { brazilToday } from "@/lib/financial/treasury";
import {
  SupplierBook,
  SupplierCommand,
  SupplierDocument,
  requireSupplierAccess,
  accessApplication,
  applySupplierCommand,
  supplierView,
} from "@/lib/suppliers/qualification";
import { privateBucket, readPrivate, writePrivate } from "./private-json-store";
const path = "supplier-qualification/v1/book.json";
const hash = (s: Buffer | string) => createHash("sha256").update(s).digest("hex");
export async function readSupplierBook(u: AuthContext) {
  requireSupplierAccess(u);
  return readPrivate(path, SupplierBook, () =>
    SupplierBook.parse({ version: 0, applications: [], audit: [] })
  );
}
export async function getSuppliers(u: AuthContext) {
  return supplierView((await readSupplierBook(u)).value, u, brazilToday());
}
export async function saveSupplier(u: AuthContext, data: unknown) {
  requireSupplierAccess(u);
  const parsed = SupplierCommand.safeParse(data);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || "Dados inválidos.");
  const c = parsed.data;
  const { value, generation } = await readSupplierBook(u);
  const next = applySupplierCommand(value, c, u, new Date().toISOString(), hash(JSON.stringify(c)));
  if (next !== value) await writePrivate(path, next, generation);
  return getSuppliers(u);
}
export const UploadInfo = z
  .object({
    applicationId: z.string().uuid(),
    requirementId: z.string().uuid(),
    requestId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(180),
    expires: SupplierDocument.shape.expires,
    mime: SupplierDocument.shape.mime,
  })
  .strict();
export function validateSupplierBytes(bytes: Buffer, mime: string) {
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw badRequest("Documento deve ter até 8 MiB.");
  const valid =
    mime === "application/pdf"
      ? bytes.subarray(0, 5).toString() === "%PDF-"
      : mime === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : false;
  if (!valid) throw badRequest("Conteúdo incompatível. Envie PDF, PNG ou JPEG válido.");
}
export async function uploadSupplierDocument(u: AuthContext, input: unknown, bytes: Buffer) {
  requireSupplierAccess(u);
  const parsed = UploadInfo.safeParse(input);
  if (!parsed.success) throw badRequest("Metadados do documento inválidos.");
  const info = parsed.data;
  validateSupplierBytes(bytes, info.mime);
  const { value: b, generation } = await readSupplierBook(u);
  const a = accessApplication(b, info.applicationId, u);
  const fingerprint = hash(JSON.stringify(info) + hash(bytes));
  const prior = b.audit.find((e) => e.id === info.requestId);
  if (prior) {
    if (prior.actor !== u.uid || prior.hash !== fingerprint)
      throw new AuthError("Identificador utilizado por outro envio.", 409);
    return getSuppliers(u);
  }
  if (a.version !== info.expectedVersion)
    throw new AuthError("Processo alterado. Atualize antes de anexar.", 409);
  if (!["draft", "changes"].includes(a.status))
    throw new AuthError("Processo precisa estar aberto para anexar documentos.", 409);
  if (!a.requirements.some((r) => r.id === info.requirementId))
    throw badRequest("Requisito não encontrado.");
  const name = `supplier-qualification/v1/documents/${a.id}/${info.requestId}`;
  const file = privateBucket().file(name);
  try {
    await file.save(bytes, {
      resumable: false,
      contentType: info.mime,
      metadata: { cacheControl: "private, no-store", metadata: { sha256: hash(bytes) } },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  } catch (e) {
    if (!e || typeof e !== "object" || !("code" in e) || Number(e.code) !== 412) throw e;
    const [existing] = await file.download();
    if (hash(existing) !== hash(bytes))
      throw new AuthError("Documento conflitante. Atualize a consulta.", 409);
  }
  const now = new Date().toISOString();
  a.documents.push({
    id: info.requestId,
    requirementId: info.requirementId,
    name: info.name,
    mime: info.mime,
    size: bytes.length,
    sha256: hash(bytes),
    expires: info.expires,
    uploadedAt: now,
    uploadedBy: u.uid,
    review: "pending",
    reviewer: null,
    reason: "",
  });
  a.version++;
  a.updatedAt = now;
  a.lastEditedBy = u.uid;
  b.version++;
  b.audit.push({
    id: info.requestId,
    applicationId: a.id,
    actor: u.uid,
    at: now,
    action: "upload",
    hash: fingerprint,
    details: JSON.stringify(info),
  });
  await writePrivate(path, SupplierBook.parse(b), generation);
  return getSuppliers(u);
}
export async function downloadSupplierDocument(
  u: AuthContext,
  applicationId: string,
  documentId: string
) {
  const { value } = await readSupplierBook(u);
  const a = accessApplication(value, applicationId, u);
  const d = a.documents.find((d) => d.id === documentId);
  if (!d) throw new AuthError("Documento não encontrado.", 404);
  const [bytes] = await privateBucket()
    .file(`supplier-qualification/v1/documents/${a.id}/${d.id}`)
    .download();
  if (hash(bytes) !== d.sha256)
    throw new AuthError("Documento não passou na verificação de integridade.", 503);
  return { bytes, document: d };
}
