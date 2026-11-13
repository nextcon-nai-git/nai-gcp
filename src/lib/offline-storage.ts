import { openDB, type DBSchema } from "idb";

export interface PendingOfflineItem {
  id: string;
  type: "FIELD_INSPECTION" | "CHECKLIST_NR" | "EPI_DELIVERY";
  data: any;
  timestamp: string;
  status: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
}

export interface OfflineScope {
  userId: string;
  companyId: string;
}
type Sealed = { iv: Uint8Array<ArrayBuffer>; bytes: ArrayBuffer };
type StoredItem = Omit<PendingOfflineItem, "data"> & { scope: string; data: Sealed };
interface DeviceStore extends DBSchema {
  keys: { key: string; value: CryptoKey };
  drafts: { key: string; value: Sealed };
  queue: { key: [string, string]; value: StoredItem; indexes: { scope: string } };
}

function scoped(scope?: OfflineScope) {
  return scope?.userId?.trim() &&
    scope.companyId?.trim() &&
    !["all", "unauthorized"].includes(scope.companyId)
    ? JSON.stringify([scope.userId, scope.companyId])
    : null;
}

function openDeviceStore() {
  return openDB<DeviceStore>("nai-offline-private", 1, {
    upgrade(db) {
      db.createObjectStore("keys");
      db.createObjectStore("drafts");
      db.createObjectStore("queue", { keyPath: ["scope", "id"] }).createIndex("scope", "scope");
    },
  });
}
let opening: ReturnType<typeof openDeviceStore> | undefined;
function database() {
  return (opening ??= openDeviceStore().catch((error) => {
    opening = undefined;
    throw error;
  }));
}

async function deviceKey(scope: string) {
  const db = await database();
  const existing = await db.get("keys", scope);
  if (existing) return existing;
  const generated = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  // Competing tabs can generate keys. Serialize the final choice before encrypting.
  const tx = db.transaction("keys", "readwrite");
  const winner = await tx.store.get(scope);
  if (!winner) await tx.store.add(generated, scope);
  await tx.done;
  return winner ?? generated;
}
function context(scope: string, record: string) {
  return new TextEncoder().encode(JSON.stringify([scope, record]));
}
async function seal(scope: string, record: string, value: unknown): Promise<Sealed> {
  const key = await deviceKey(scope);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: context(scope, record) },
    key,
    new TextEncoder().encode(JSON.stringify(value))
  );
  return { iv, bytes };
}
async function unseal(scope: string, record: string, value: Sealed) {
  const key = await (await database()).get("keys", scope);
  if (!key) throw Error("Chave da cópia local indisponível.");
  const bytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: value.iv, additionalData: context(scope, record) },
    key,
    value.bytes
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}

export interface InspectionDraft {
  location: string;
  notes: string;
  image: string | null;
  gps: { latitude: number; longitude: number; accuracy: number } | null;
}
async function readDraft(scope: OfflineScope): Promise<InspectionDraft | null> {
  const key = scoped(scope);
  if (!key) return null;
  const db = await database();
  const legacyKey = JSON.stringify(["nai-field-inspection", scope.userId, scope.companyId]);
  const raw = localStorage.getItem(legacyKey);
  if (raw !== null) {
    const value = await seal(key, "draft", JSON.parse(raw));
    const tx = db.transaction("drafts", "readwrite");
    if ((await tx.store.getKey(key)) === undefined) await tx.store.add(value, key);
    await tx.done;
    if (localStorage.getItem(legacyKey) === raw) localStorage.removeItem(legacyKey);
  }
  const draft = await db.get("drafts", key);
  return draft ? unseal(key, "draft", draft) : null;
}

async function saveDraft(scope: OfflineScope, draft: InspectionDraft) {
  const key = scoped(scope);
  if (!key) throw Error("Selecione uma conta e empresa.");
  const db = await database();
  if (!draft.location && !draft.notes && !draft.image && !draft.gps) await db.delete("drafts", key);
  else await db.put("drafts", await seal(key, "draft", draft), key);
}

// A remount or rapid sequence of edits must observe earlier writes in this tab.
const pendingDrafts = new Map<string, Promise<void>>();
function afterDraftWrites<T>(scope: OfflineScope, run: () => Promise<T>): Promise<T> {
  const key = JSON.stringify([scope.userId, scope.companyId]);
  const result = (pendingDrafts.get(key) ?? Promise.resolve()).then(run);
  const done = result.then(
    () => {},
    () => {}
  );
  pendingDrafts.set(key, done);
  void done.then(() => {
    if (pendingDrafts.get(key) === done) pendingDrafts.delete(key);
  });
  return result;
}

async function migrateQueue(scope: OfflineScope, key: string) {
  const legacyKey = `nai_offline_queue_v2:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.companyId)}`;
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return;
  }
  if (
    !Array.isArray(rows) ||
    !rows.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        ["PENDING", "SYNCING", "SYNCED", "ERROR"].includes(row.status) &&
        ["FIELD_INSPECTION", "CHECKLIST_NR", "EPI_DELIVERY"].includes(row.type)
    )
  )
    return;
  const db = await database();
  for (const row of rows) {
    const data = await seal(key, row.id, row.data);
    const tx = db.transaction("queue", "readwrite");
    if ((await tx.store.getKey([key, row.id])) === undefined)
      await tx.store.add({
        scope: key,
        id: row.id,
        timestamp: row.timestamp,
        status: row.status,
        type: row.type,
        data,
      });
    await tx.done;
  }
  if (localStorage.getItem(legacyKey) === raw) localStorage.removeItem(legacyKey);
}
async function queueRows(scope?: OfflineScope) {
  const key = scoped(scope);
  if (!scope || !key) return [];
  await migrateQueue(scope, key);
  return (await database()).getAllFromIndex("queue", "scope", key);
}
export const offlineStorage = {
  readDraft: (scope: OfflineScope) => afterDraftWrites(scope, () => readDraft(scope)),
  saveDraft: (scope: OfflineScope, draft: InspectionDraft) =>
    afterDraftWrites(scope, () => saveDraft(scope, draft)),
  async getQueue(scope?: OfflineScope): Promise<PendingOfflineItem[]> {
    const rows = await queueRows(scope);
    return Promise.all(
      rows
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map(async ({ scope, data, ...row }) => ({
          ...row,
          data: await unseal(scope, row.id, data),
        }))
    );
  },
  async addItem(type: PendingOfflineItem["type"], data: unknown, scope: OfflineScope) {
    const key = scoped(scope);
    if (!key) throw Error("Selecione uma conta e empresa para salvar a cópia local.");
    await migrateQueue(scope, key);
    const item: PendingOfflineItem = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: new Date().toISOString(),
      status: "PENDING",
    };
    const db = await database();
    await db.add("queue", { ...item, scope: key, data: await seal(key, item.id, data) });
    return item;
  },
  async removeItem(id: string, scope?: OfflineScope) {
    const key = scoped(scope);
    if (!scope || !key) return;
    await migrateQueue(scope, key);
    await (await database()).delete("queue", [key, id]);
  },
  async clearQueue(scope?: OfflineScope) {
    const key = scoped(scope);
    if (!scope || !key) return;
    await migrateQueue(scope, key);
    const tx = (await database()).transaction("queue", "readwrite");
    for (const id of await tx.store.index("scope").getAllKeys(key)) await tx.store.delete(id);
    await tx.done;
  },
  async getPendingCount(scope?: OfflineScope) {
    return (await queueRows(scope)).filter((item) => item.status === "PENDING").length;
  },
};
