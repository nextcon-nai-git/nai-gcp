// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { AvpPeriodicControl } from "@/lib/avp-periodic-control";
type Ref = {
  path: string;
  doc: (name: string) => Ref;
  collection: (name: string) => Ref;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set: (data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<void>;
};
const m = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>();
  const read = vi.fn();
  const beforeSet = vi.fn();
  const put = (path: string, data: Record<string, unknown>, options?: { merge?: boolean }) =>
    docs.set(path, options?.merge ? { ...docs.get(path), ...data } : data);
  const ref = (path: string): Ref => ({
    path,
    doc: (n) => ref(`${path}/${n}`),
    collection: (n) => ref(`${path}/${n}`),
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data, options) => {
      await beforeSet(path);
      put(path, data, options);
    },
  });
  const transaction = async (
    fn: (tx: {
      get: (r: Ref) => ReturnType<Ref["get"]>;
      set: (r: Ref, d: Record<string, unknown>, o?: { merge?: boolean }) => void;
    }) => Promise<unknown>
  ) => {
    const writes: Array<() => unknown> = [];
    const result = await fn({
      get: (r) => r.get(),
      set: (r, d, o) => {
        writes.push(() => put(r.path, d, o));
      },
    });
    writes.forEach((f) => f());
    return result;
  };
  return { docs, read, beforeSet, ref, transaction };
});
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.ref, runTransaction: m.transaction },
}));
vi.mock("./avp-periodic-control", () => ({
  readAvpPeriodicControl: m.read,
  getAvpReaderEmail: async () => "reader@example.test",
}));
import {
  configureAvpPeriodicSources,
  readAvpPeriodicSnapshot,
  syncAvpPeriodicControl,
  getAvpPeriodicSettings,
} from "./avp-periodic-sync";
const path = "clinic_portal_private/avp_periodic_control";
const sources = {
  campaignSpreadsheetId: "a".repeat(30),
  accreditationSpreadsheetId: "b".repeat(30),
};
const fixture = () =>
  ({
    checkedAt: new Date().toISOString(),
    summary: { sourceRows: 205, uniquePeople: 205 },
    people: Array.from({ length: 205 }, (_, i) => ({
      id: String(i),
      name: `Pessoa sintética ${i}`,
    })),
    clinics: [],
    cities: [],
    unmatchedPrices: [],
    mapClinics: [],
    sources: {
      campaignUrl: "https://docs.google.com/spreadsheets/d/" + sources.campaignSpreadsheetId,
      accreditationUrl:
        "https://docs.google.com/spreadsheets/d/" + sources.accreditationSpreadsheetId,
    },
  }) as unknown as AvpPeriodicControl;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T10:10:00Z"));
  m.docs.clear();
  m.read.mockReset();
  m.beforeSet.mockReset();
  m.read.mockImplementation(async () => fixture());
});
afterEach(() => vi.useRealTimers());
it("valida antes de configurar, divide a versão e publica contagens íntegras", async () => {
  await configureAvpPeriodicSources(sources, "", "admin");
  expect(m.read).toHaveBeenCalledWith(sources);
  expect([...m.docs.keys()].filter((k) => /parts\/people-/.test(k))).toHaveLength(3);
  const data = await readAvpPeriodicSnapshot();
  expect(data.people).toHaveLength(205);
  expect(data.sync?.nextCheckAt).toBe("2026-10-30T11:00:00.000Z");
  expect(m.read).toHaveBeenCalledTimes(1);
});
it("executa uma vez por hora e registra a chamada autenticada do agendador", async () => {
  await configureAvpPeriodicSources(sources, "", "admin");
  vi.setSystemTime(new Date("2026-10-30T10:20:00Z"));
  expect(await syncAvpPeriodicControl({ scheduled: true })).toEqual({ started: false });
  expect((await getAvpPeriodicSettings()).schedulerSeenAt).toBe("2026-10-30T10:20:00.000Z");
  vi.setSystemTime(new Date("2026-10-30T11:00:01Z"));
  expect((await syncAvpPeriodicControl({ scheduled: true })).started).toBe(true);
  vi.setSystemTime(new Date("2026-10-30T11:10:01Z"));
  await syncAvpPeriodicControl({ scheduled: true });
  expect(m.read).toHaveBeenCalledTimes(2);
  expect((await getAvpPeriodicSettings()).lastScheduledAt).toBe("2026-10-30T11:00:01.000Z");
});
it("preserva a versão anterior se a fonte ou a escrita de partes falhar", async () => {
  await configureAvpPeriodicSources(sources, "", "admin");
  const version = m.docs.get(path)?.sourceVersion;
  vi.setSystemTime(new Date("2026-10-30T11:00:01Z"));
  m.read.mockRejectedValueOnce(new Error("private credential detail"));
  const result = await syncAvpPeriodicControl();
  expect(result).toHaveProperty("error");
  expect(JSON.stringify(result)).not.toContain("private credential");
  expect(m.docs.get(path)?.sourceVersion).toBe(version);
  expect((await readAvpPeriodicSnapshot()).people).toHaveLength(205);
  vi.setSystemTime(new Date("2026-10-30T11:02:01Z"));
  m.read.mockResolvedValue({ ...fixture(), people: [{ id: "changed" }] });
  m.beforeSet.mockRejectedValueOnce(new Error("Storage unavailable"));
  await syncAvpPeriodicControl();
  expect(m.docs.get(path)?.sourceVersion).toBe(version);
});
it("não publica outra configuração com revisão obsoleta ou fonte inválida", async () => {
  await configureAvpPeriodicSources(sources, "", "admin");
  await expect(
    configureAvpPeriodicSources({ ...sources, campaignSpreadsheetId: "c".repeat(30) }, "", "admin")
  ).rejects.toThrow("CONFLICT");
  const version = m.docs.get(path)?.sourceVersion;
  m.read.mockRejectedValueOnce(new Error("invalid headers"));
  await expect(
    configureAvpPeriodicSources(sources, String(m.docs.get(path)?.configRevision), "admin")
  ).rejects.toThrow();
  expect(m.docs.get(path)?.sourceVersion).toBe(version);
});
it("impede leitura parcial quando uma parte foi perdida", async () => {
  await configureAvpPeriodicSources(sources, "", "admin");
  const part = [...m.docs.keys()].find((k) => k.endsWith("parts/people-1"))!;
  m.docs.delete(part);
  await expect(readAvpPeriodicSnapshot()).rejects.toThrow("Versão incompleta");
});
