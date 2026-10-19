import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { normalizeCnpj } from "@/lib/cnpj";
import {
  BookSchema,
  CommandSchema,
  SourceSchema,
  ProductionError,
  applyCommand,
  emptyBook,
} from "@/lib/production/model";
import { getFinanceBook } from "./financial-operations";
import { checkCycleFinance, receiptIndex } from "@/lib/production/finance";
import type { z } from "zod";
const objectName = "financial-operations/v1/production-central.json";
const MAX_BYTES = 16 * 1024 * 1024;
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? Number(e.code) : 0);
async function readBook() {
  let metadata;
  try {
    [metadata] = await bucket().file(objectName).getMetadata();
  } catch (e) {
    if (code(e) === 404) return { book: emptyBook(), generation: "0" };
    throw e;
  }
  const generation = String(metadata.generation || "");
  if (!/^\d+$/.test(generation) || Number(metadata.size) > MAX_BYTES)
    throw new Error("Invalid central metadata");
  let bytes: Buffer;
  try {
    [bytes] = await bucket().file(objectName, { generation }).download();
  } catch (e) {
    if (code(e) === 404) throw new AuthError("Atualização concorrente. Atualize a central.", 409);
    throw e;
  }
  if (bytes.length > MAX_BYTES) throw new Error("Central exceeds limit");
  return { book: BookSchema.parse(JSON.parse(bytes.toString("utf8"))), generation };
}
export async function getProductionBook(user: AuthContext) {
  requireFinancialAccess(user);
  return (await readBook()).book;
}
export async function readProductionSource(user: AuthContext, input: unknown) {
  requireFinancialAccess(user);
  const parsed = SourceSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Fonte inválida.");
  const source = parsed.data;
  const file = bucket().file(source.storagePath, { generation: source.generation });
  const [meta] = await file.getMetadata();
  if (
    Number(meta.size) !== source.sizeBytes ||
    meta.contentType !== "application/pdf" ||
    meta.metadata?.sourceSha256 !== source.sha256
  )
    throw badRequest("Fonte divergente.");
  const [bytes] = await file.download();
  if (
    bytes.length !== source.sizeBytes ||
    bytes.subarray(0, 5).toString() !== "%PDF-" ||
    createHash("sha256").update(bytes).digest("hex") !== source.sha256
  )
    throw badRequest("Integridade da fonte não confirmada.");
  return bytes;
}
export async function preserveProductionSource(user: AuthContext, bytes: Buffer) {
  requireFinancialAccess(user);
  if (!bytes.length || bytes.length >= 10 * 1024 * 1024)
    throw new AuthError("Selecione um PDF com menos de 10 MB.", 413);
  if (bytes.subarray(0, 5).toString() !== "%PDF-") throw badRequest("Selecione um PDF válido.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `internos_nextcon/contract-sources/${sha256}`;
  const file = bucket().file(storagePath);
  try {
    await file.save(bytes, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "application/pdf",
        cacheControl: "private, no-store",
        metadata: { sourceSha256: sha256 },
      },
    });
  } catch (error) {
    // An existing immutable source is reused only after full verification below.
    if (code(error) !== 412) throw error;
  }
  const [meta] = await file.getMetadata();
  const parsed = SourceSchema.safeParse({
    sha256,
    storagePath,
    generation: String(meta.generation || ""),
    sizeBytes: bytes.length,
  });
  if (!parsed.success) throw badRequest("Metadados da fonte inválidos.");
  await readProductionSource(user, parsed.data);
  return parsed.data;
}
export async function productionCompanies(user: AuthContext) {
  requireFinancialAccess(user);
  const snap = await adminDb.collection("companies").limit(1001).get();
  if (snap.size > 1000)
    throw new AuthError("Cadastro excede o limite de consulta. Solicite paginação.", 422);
  return snap.docs
    .filter(
      (d) =>
        d.data().active === true &&
        d.data().isDeleted !== true &&
        !d.data().deletedAt &&
        d.data().status !== "archived"
    )
    .map((d) => ({
      id: d.id,
      name: String(d.data().name || d.data().razaoSocial || d.id),
      cnpj: normalizeCnpj(String(d.data().cnpj || "")),
    }));
}
export async function saveProductionCommand(user: AuthContext, payload: unknown) {
  requireFinancialAccess(user);
  const parsed = CommandSchema.safeParse(payload);
  if (!parsed.success) throw badRequest("Operação inválida: " + parsed.error.issues[0]?.message);
  const command = parsed.data;
  const hash = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  const { book, generation } = await readBook();
  // A confirmed replay must not depend on changes to external registries after the original commit.
  if (book.audit.some((a) => a.requestId === command.requestId)) {
    try {
      return applyCommand(book, command, user.uid, new Date().toISOString(), hash);
    } catch (e) {
      if (e instanceof ProductionError) throw new AuthError(e.message, e.status);
      throw e;
    }
  }
  let companyName = "";
  if (command.action === "create") {
    const company = await adminDb.collection("companies").doc(command.companyId).get();
    const data = company.data();
    if (
      !data ||
      data.active !== true ||
      data.isDeleted === true ||
      data.deletedAt ||
      data.status === "archived" ||
      normalizeCnpj(String(data.cnpj || "")) !== command.cnpj
    )
      throw badRequest("Selecione um cliente ativo com CNPJ correspondente ao documento revisado.");
    companyName = String(data.name || data.razaoSocial || command.companyId);
  }
  if ("document" in command && command.document)
    await readProductionSource(user, command.document.source);
  const record = book.records.find((r) => r.id === command.recordId);
  if (command.action === "linkFinance") {
    const finance = await getFinanceBook(user);
    const flow = finance.contractFlows.find((f) => f.contractId === command.financeContractId);
    if (
      !record ||
      !flow ||
      normalizeCnpj(flow.customerDocument) !== record.cnpj ||
      !finance.contracts.some((c) => c.id === command.financeContractId && c.active)
    )
      throw badRequest("O contrato financeiro deve estar ativo e vinculado ao mesmo CNPJ no ERP.");
    if (
      book.records.some(
        (r) => r.id !== record.id && r.financeContractId === command.financeContractId
      )
    )
      throw badRequest("Contrato financeiro já vinculado a outro registro.");
    if (record.cycles.some((c) => c.financeTitleId))
      throw badRequest("Há títulos vinculados; preserve a associação financeira existente.");
  }
  const checkCycles =
    command.action === "billing"
      ? [{ ...command.data, id: command.cycleId }]
      : command.action === "card" &&
          command.card.status === "done" &&
          ["invoice", "receive"].includes(command.card.id)
        ? record?.cycles.filter((c) => c.id === command.cycleId) || []
        : command.action === "active" && !command.active
          ? record?.cycles || []
          : [];
  const linkedCycles = checkCycles.filter((c) => c.financeTitleId);
  const finance = linkedCycles.length ? await getFinanceBook(user) : null;
  const receipts = finance ? receiptIndex(finance) : new Map();
  for (const cycle of linkedCycles) {
    if (!record) throw badRequest("Registro não encontrado.");
    const check = checkCycleFinance(record, cycle, finance!, receipts);
    if (check.status === "divergent") throw badRequest(check.issues[0]);
    if (
      book.records.some((r) =>
        r.cycles.some(
          (c) =>
            !(r.id === command.recordId && c.id === cycle.id) &&
            c.financeTitleId === cycle.financeTitleId
        )
      )
    )
      throw badRequest("Título já vinculado a outro ciclo.");
    const closing =
      command.action === "active" || (command.action === "card" && command.card.id === "receive");
    if (closing && check.receipts?.unreconciledCount) throw badRequest(check.issues.at(-1)!);
  }

  let next;
  try {
    next = applyCommand(book, command, user.uid, new Date().toISOString(), hash, companyName);
  } catch (e) {
    if (e instanceof ProductionError) throw new AuthError(e.message, e.status);
    throw e;
  }
  const json = JSON.stringify(next);
  if (Buffer.byteLength(json) > MAX_BYTES)
    throw new AuthError(
      "Central atingiu o limite operacional. Solicite particionamento antes de novos registros.",
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
  } catch (e) {
    if (code(e) === 412)
      throw new AuthError("Outra sessão gravou alterações. Atualize e revise.", 409);
    throw e;
  }
  const confirmed = (await readBook()).book;
  if (
    !confirmed.audit.some(
      (entry) =>
        entry.requestId === command.requestId && entry.hash === hash && entry.actor === user.uid
    )
  )
    throw new AuthError(
      "Não foi possível confirmar esta gravação. Repita a mesma solicitação ou atualize e confira o histórico.",
      503
    );
  return confirmed;
}
export type ProductionSource = z.infer<typeof SourceSchema>;
