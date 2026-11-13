// @vitest-environment node
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { offlineStorage } from "./offline-storage";
const a = { userId: "account-a", companyId: "company-a" },
  b = { userId: "account-b", companyId: "company-a" },
  c = { userId: "account-a", companyId: "company-b" };
beforeEach(async () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  for (const scope of [a, b, c]) await offlineStorage.clearQueue(scope);
});
describe("scoped offline drafts", () => {
  it("encrypts records and keeps each account and company separate", async () => {
    const rows = await Promise.all(
      [a, b, c].map((s, i) =>
        offlineStorage.addItem("FIELD_INSPECTION", { note: "private" + i }, s)
      )
    );
    for (const [i, scope] of [a, b, c].entries()) {
      expect((await offlineStorage.getQueue(scope)).map((x) => x.data.note)).toEqual([
        "private" + i,
      ]);
      expect(await offlineStorage.getPendingCount(scope)).toBe(1);
    }
    const db = await openDB("nai-offline-private");
    const key = JSON.stringify([a.userId, a.companyId]);
    const raw = await db.get("queue", [key, rows[0].id]);
    expect(raw.data.bytes.byteLength).toBeGreaterThan(16);
    expect(raw.data.note).toBeUndefined();
    expect((await db.get("keys", key)).extractable).toBe(false);
    db.close();
    await offlineStorage.removeItem(rows[0].id, a);
    expect(await offlineStorage.getQueue(a)).toEqual([]);
    expect(await offlineStorage.getQueue(b)).toHaveLength(1);
  });
  it.each([
    undefined,
    { userId: "", companyId: "a" },
    { userId: "a", companyId: "all" },
    { userId: "a", companyId: "unauthorized" },
  ])("rejects missing scope", async (scope) => {
    expect(await offlineStorage.getQueue(scope)).toEqual([]);
    await expect(offlineStorage.addItem("FIELD_INSPECTION", {}, scope!)).rejects.toThrow();
  });
  it("migrates legacy copies after durable writes and preserves the latest draft", async () => {
    const oldKey = JSON.stringify(["nai-field-inspection", a.userId, a.companyId]);
    const queueKey = "nai_offline_queue_v2:account-a:company-a";
    const draft = {
      location: "Setor 1",
      notes: "texto",
      image: null,
      gps: { latitude: 1, longitude: 2, accuracy: 8 },
    };
    localStorage.setItem(oldKey, JSON.stringify(draft));
    localStorage.setItem(
      queueKey,
      JSON.stringify([
        {
          id: "legacy",
          status: "PENDING",
          type: "FIELD_INSPECTION",
          data: draft,
          timestamp: "2026-11-13",
        },
      ])
    );
    expect(await offlineStorage.readDraft(a)).toEqual(draft);
    expect((await offlineStorage.getQueue(a))[0].data).toEqual(draft);
    expect(localStorage.getItem(oldKey)).toBeNull();
    expect(localStorage.getItem(queueKey)).toBeNull();
    await Promise.all([
      offlineStorage.saveDraft(a, draft),
      offlineStorage.saveDraft(a, { ...draft, notes: "mais recente" }),
    ]);
    expect((await offlineStorage.readDraft(a))?.notes).toBe("mais recente");
    expect(await offlineStorage.readDraft(b)).toBeNull();
  });
  it("persists GPS only in an encrypted draft and clears it when emptied", async () => {
    const draft = {
      location: "Setor B",
      notes: "",
      image: null,
      gps: { latitude: -1, longitude: 2, accuracy: 3 },
    };
    await offlineStorage.saveDraft(c, draft);
    const db = await openDB("nai-offline-private");
    const raw = await db.get("drafts", JSON.stringify([c.userId, c.companyId]));
    expect(Object.keys(raw).sort()).toEqual(["bytes", "iv"]);
    expect(raw.bytes.byteLength).toBeGreaterThan(16);
    expect(await offlineStorage.readDraft(c)).toEqual(draft);
    expect(
      localStorage.getItem(JSON.stringify(["nai-field-inspection", c.userId, c.companyId]))
    ).toBeNull();
    await offlineStorage.saveDraft(c, { location: "", notes: "", image: null, gps: null });
    expect(await offlineStorage.readDraft(c)).toBeNull();
    db.close();
  });
  it("clears only the selected scope and preserves older unscoped records", async () => {
    localStorage.setItem("nai_offline_queue_v1", "legacy");
    await offlineStorage.addItem("FIELD_INSPECTION", {}, a);
    await offlineStorage.addItem("FIELD_INSPECTION", {}, b);
    await offlineStorage.clearQueue(a);
    expect(await offlineStorage.getQueue(a)).toEqual([]);
    expect(await offlineStorage.getQueue(b)).toHaveLength(1);
    expect(localStorage.getItem("nai_offline_queue_v1")).toBe("legacy");
  });
  it.each(["broken", "{}", "null", JSON.stringify([null, { id: "x", status: "invalid" }])])(
    "keeps unreadable legacy data available for recovery (%s)",
    async (raw) => {
      const key = "nai_offline_queue_v2:account-a:company-a";
      localStorage.setItem(key, raw);
      expect(await offlineStorage.getQueue(a)).toEqual([]);
      expect(localStorage.getItem(key)).toBe(raw);
    }
  );
});
