import "server-only";
import { createHash } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import {
  FINANCIAL_ACTION_IMPORT_MAX_BYTES,
  FinancialActionImportSchema,
  FinancialActionListQuerySchema,
  FinancialActionPatchSchema,
  SavedFinancialActionBatchSchema,
  SavedFinancialActionSchema,
  type FinancialActionList,
  type SavedFinancialActionBatch,
} from "@/lib/financial/actions";

// The default-deny Storage Rules cover this prefix. Corporate finance never writes
// to companies/tasks and no signed URL or Firebase download token is created.
const prefix = "financial-actions/v1/";
const bucket = () => getStorage().bucket(firebaseConfig.storageBucket);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const codeOf = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? Number(error.code) : 0;
const conflict = () =>
  new AuthError(
    "Esta ação foi atualizada em outra sessão. Atualize os cards e revise a alteração.",
    409
  );
function path(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw badRequest("Lote de ações inválido.");
  return `${prefix}${id}.json`;
}
async function read(id: string) {
  const name = path(id);
  try {
    const [metadata] = await bucket().file(name).getMetadata();
    const generation = String(metadata.generation || "");
    if (!/^\d+$/.test(generation)) throw new Error("Missing object generation");
    // Pin the read to the generation used for compare-and-swap, so a concurrent
    // write cannot pair a new payload with an old precondition (or vice versa).
    const [bytes] = await bucket().file(name, { generation }).download();
    const batch = SavedFinancialActionBatchSchema.parse(JSON.parse(bytes.toString()));
    if (
      batch.id !== id ||
      batch.actions.some(
        (action) => action.batchId !== id || action.id !== hash(`${id}:${action.key}`)
      )
    )
      throw new Error("Invalid financial action record");
    return { batch, generation };
  } catch (error) {
    if (codeOf(error) === 404)
      throw new AuthError("Lote de ações não encontrado. Atualize a consulta.", 404);
    throw error;
  }
}

export async function listFinancialActions(
  user: AuthContext,
  input: unknown = {}
): Promise<FinancialActionList> {
  requireFinancialAccess(user);
  const query = FinancialActionListQuerySchema.safeParse(input);
  if (!query.success) throw badRequest("Consulta de ações inválida.");
  const [files, next] = await bucket().getFiles({
    prefix,
    maxResults: 20,
    autoPaginate: false,
    ...(query.data.cursor ? { pageToken: query.data.cursor } : {}),
  });
  const batches: SavedFinancialActionBatch[] = [];
  for (const file of files) {
    const id = file.name.slice(prefix.length).replace(/\.json$/, "");
    if (file.name === `${prefix}${id}.json` && /^[a-f0-9]{64}$/.test(id))
      batches.push((await read(id)).batch);
  }
  return {
    schemaVersion: 1,
    batches: batches.sort(
      (a, b) => b.importedAt.localeCompare(a.importedAt) || a.id.localeCompare(b.id)
    ),
    nextCursor: next?.pageToken || null,
  };
}

export async function importFinancialActions(user: AuthContext, payload: unknown) {
  requireFinancialAccess(user);
  const parsed = FinancialActionImportSchema.safeParse(payload);
  if (!parsed.success)
    throw badRequest("Arquivo de ações inválido: " + parsed.error.issues[0]?.message);
  const data = parsed.data;
  const canonical = JSON.stringify(data);
  if (Buffer.byteLength(canonical, "utf8") > FINANCIAL_ACTION_IMPORT_MAX_BYTES)
    throw badRequest("O arquivo de ações excede o limite de 2 MB.");
  const id = hash(`nai-financial-actions:v1:${data.idempotencyKey}`);
  const importHash = hash(canonical);
  const now = new Date().toISOString();
  const batch: SavedFinancialActionBatch = {
    ...data,
    id,
    importHash,
    version: 1,
    importedAt: now,
    importedBy: user.uid,
    updatedAt: now,
    updatedBy: user.uid,
    actions: data.actions.map((action) => ({
      ...action,
      id: hash(`${id}:${action.key}`),
      batchId: id,
      version: 1,
      updatedAt: now,
      updatedBy: user.uid,
    })),
  };
  let alreadySaved = false;
  try {
    // A batch is a single atomic object: interrupted retries never leave half an import.
    await bucket()
      .file(path(id))
      .save(JSON.stringify(batch), {
        resumable: false,
        contentType: "application/json",
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { cacheControl: "private, no-store" },
      });
  } catch (error) {
    if (codeOf(error) !== 412) throw error;
    alreadySaved = true;
  }
  // Read back the persisted state. A retry preserves subsequent status/checklist edits.
  const confirmed = (await read(id)).batch;
  if (confirmed.importHash !== importHash)
    throw new AuthError(
      "Esta chave de importação já pertence a outro conteúdo. O lote existente foi preservado; use uma nova chave para uma nova revisão.",
      409
    );
  return { batch: confirmed, alreadySaved };
}

export async function updateFinancialAction(user: AuthContext, payload: unknown) {
  requireFinancialAccess(user);
  const parsed = FinancialActionPatchSchema.safeParse(payload);
  if (!parsed.success) throw badRequest("Alteração inválida: " + parsed.error.issues[0]?.message);
  const patch = parsed.data;
  const { batch, generation } = await read(patch.batchId);
  const index = batch.actions.findIndex((action) => action.id === patch.actionId);
  if (index === -1) throw new AuthError("Ação não encontrada neste lote.", 404);
  const current = batch.actions[index];
  if (current.version !== patch.expectedVersion) throw conflict();
  const checks = new Map(patch.checklist?.map((item) => [item.id, item.checked]) || []);
  if ([...checks.keys()].some((id) => !current.checklist.some((item) => item.id === id)))
    throw badRequest("O checklist contém um item que não pertence a esta ação.");
  const now = new Date().toISOString();
  const candidate = SavedFinancialActionSchema.safeParse({
    ...current,
    status: patch.status || current.status,
    checklist: current.checklist.map((item) => ({
      ...item,
      checked: checks.has(item.id) ? checks.get(item.id)! : item.checked,
    })),
    version: current.version + 1,
    updatedAt: now,
    updatedBy: user.uid,
  });
  if (!candidate.success) throw badRequest(candidate.error.issues[0]?.message || "Ação inválida.");
  const updated: SavedFinancialActionBatch = {
    ...batch,
    version: batch.version + 1,
    updatedAt: now,
    updatedBy: user.uid,
    actions: batch.actions.map((action, actionIndex) =>
      actionIndex === index ? candidate.data : action
    ),
  };
  try {
    await bucket()
      .file(path(batch.id))
      .save(JSON.stringify(updated), {
        resumable: false,
        contentType: "application/json",
        preconditionOpts: { ifGenerationMatch: generation },
        metadata: { cacheControl: "private, no-store" },
      });
  } catch (error) {
    if (codeOf(error) === 412) throw conflict();
    throw error;
  }
  const confirmed = (await read(batch.id)).batch;
  const action = confirmed.actions.find((record) => record.id === patch.actionId);
  if (!action || action.version < candidate.data.version)
    throw new Error("Update confirmation failed");
  return { batch: confirmed, action };
}
