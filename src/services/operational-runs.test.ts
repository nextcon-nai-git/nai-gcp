// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";

const m = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  transaction: vi.fn(),
  getAll: vi.fn(),
  collection: vi.fn(),
  uuid: vi.fn(),
}));
vi.mock("node:crypto", () => ({ randomUUID: m.uuid }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction, getAll: m.getAll },
}));
import { getOperationalStatus, monitorOperation } from "./operational-runs";

const actor: AuthContext = {
  uid: "synthetic-admin",
  email: "admin@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.records.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T16:00:00.000Z"));
  vi.spyOn(console, "info").mockImplementation(() => {});
  let sequence = 0;
  m.uuid.mockImplementation(
    () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`
  );
  m.collection.mockReturnValue({
    doc: () => ({ collection: () => ({ doc: (id: string) => ({ id }) }) }),
  });
  m.transaction.mockImplementation(async (fn) =>
    fn({
      get: async (ref: { id: string }) => ({ data: () => m.records.get(ref.id) }),
      set: (
        ref: { id: string },
        data: Record<string, unknown>,
        options: { mergeFields: string[] }
      ) => {
        expect(options).toEqual({ mergeFields: Object.keys(data) });
        m.records.set(ref.id, { ...m.records.get(ref.id), ...data });
      },
    })
  );
  m.getAll.mockImplementation(async (...refs: { id: string }[]) =>
    refs.map((ref) => ({ data: () => m.records.get(ref.id) }))
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("authenticated worker observability", () => {
  it.each([
    {
      outcome: "completed",
      counters: { checked: 1, waiting: 0, unavailable: 0 },
      severity: "INFO",
    },
    {
      outcome: "partial",
      counters: { checked: 1, waiting: 0, unavailable: 1 },
      severity: "WARNING",
    },
    {
      outcome: "unverified",
      counters: { checked: "1", waiting: 0, unavailable: 0 },
      severity: "WARNING",
    },
  ])(
    "emits a fixed display message and severity for $outcome without widening the log payload",
    async ({ outcome, counters, severity }) => {
      const result = {
        ...counters,
        message: "private patient name",
        severity: "EMERGENCY",
        error: "token=private credential",
      };
      const work = vi.fn().mockResolvedValue(result);
      expect(await monitorOperation("esocial-query", work)).toBe(result);
      expect(work).toHaveBeenCalledOnce();
      expect(console.info).toHaveBeenCalledOnce();
      const line = vi.mocked(console.info).mock.calls[0][0] as string;
      const log = JSON.parse(line);
      expect(log).toMatchObject({
        event: "nai_worker_run",
        message: "nai_worker_run",
        severity,
        outcome,
        evidencePersistenceConfirmed: true,
      });
      expect(Object.keys(log).sort()).toEqual([
        "counters",
        "durationMs",
        "event",
        "evidencePersistenceConfirmed",
        "finishedAt",
        "message",
        "operation",
        "outcome",
        "runId",
        "schemaVersion",
        "severity",
        "startedAt",
      ]);
      expect(line).not.toMatch(/private|patient|credential|EMERGENCY|token=/);
      expect(JSON.stringify([...m.records])).not.toMatch(/message|severity|private/);
    }
  );
  it("records a bounded safe summary and returns the original result once", async () => {
    const result = { examined: 3, privatePayload: "never-log-me" };
    const work = vi.fn().mockResolvedValue(result);
    expect(await monitorOperation("webhook-deliveries", work)).toBe(result);
    expect(work).toHaveBeenCalledOnce();
    expect(m.collection).toHaveBeenCalledWith("clinic_portal_private");
    expect(m.records.get("webhook-deliveries")).toMatchObject({
      latest: { outcome: "completed", counters: { examined: 3 } },
    });
    expect(JSON.stringify([...m.records])).not.toContain("never-log-me");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("never-log-me");
  });
  it("preserves the original failure, records no provider error text and does not retry work", async () => {
    const failure = new Error("token=private credential clinical-person");
    const work = vi.fn().mockRejectedValue(failure);
    await expect(monitorOperation("aso-mail", work)).rejects.toBe(failure);
    expect(work).toHaveBeenCalledOnce();
    expect(m.records.get("aso-mail")).toMatchObject({
      latest: { outcome: "failed", counters: {} },
      lastFailure: { outcome: "failed" },
    });
    expect(JSON.stringify([...m.records])).not.toContain("clinical-person");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("credential");
    expect(JSON.parse(vi.mocked(console.info).mock.calls[0][0])).toMatchObject({
      message: "nai_worker_run",
      severity: "ERROR",
      outcome: "failed",
    });
  });
  it("telemetry storage failure never converts a completed business operation into a retry", async () => {
    m.transaction.mockRejectedValue(new Error("private database error"));
    const work = vi.fn().mockResolvedValue({ examined: 1 });
    await expect(monitorOperation("webhook-deliveries", work)).resolves.toEqual({ examined: 1 });
    expect(work).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(console.info).mock.calls[0][0])).toMatchObject({
      message: "nai_worker_run",
      severity: "INFO",
      outcome: "completed",
      evidencePersistenceConfirmed: false,
    });
  });
  it("bounds telemetry latency when storage never responds", async () => {
    m.transaction.mockReturnValue(new Promise(() => {}));
    const work = vi.fn().mockResolvedValue({ examined: 0 });
    const pending = monitorOperation("webhook-deliveries", work);
    await vi.advanceTimersByTimeAsync(2500);
    await expect(pending).resolves.toEqual({ examined: 0 });
    expect(work).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(console.info).mock.calls[0][0])).toMatchObject({
      evidencePersistenceConfirmed: false,
    });
  });
  it("never inherits counters omitted by a later AVP invocation", async () => {
    await monitorOperation("avp-sheets", async () => ({
      started: true,
      rowCount: 4,
      periodic: { started: true, sourceRows: 8 },
    }));
    vi.setSystemTime(new Date("2026-11-01T16:01:00.000Z"));
    await monitorOperation("avp-sheets", async () => ({
      started: false,
      periodic: { started: false },
    }));
    expect(m.records.get("avp-sheets")).toMatchObject({
      latest: { counters: { queueUpdated: 0, periodicUpdated: 0 } },
    });
    const latest = m.records.get("avp-sheets")?.latest as { counters: object };
    expect(latest.counters).not.toHaveProperty("rowCount");
    expect(latest.counters).not.toHaveProperty("sourceRows");
  });
  it("uses a stable UUID tiebreaker for starts in the same millisecond", async () => {
    m.uuid
      .mockReturnValueOnce("ffffffff-ffff-4fff-8fff-ffffffffffff")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001");
    await monitorOperation("webhook-deliveries", async () => ({ examined: 2 }));
    await monitorOperation("webhook-deliveries", async () => ({ examined: 1 }));
    expect(m.records.get("webhook-deliveries")).toMatchObject({
      latest: { counters: { examined: 2 } },
    });
  });
  it("returns a successful result even when logging fails", async () => {
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error("logger offline");
    });
    const result = { examined: 1 };
    const work = vi.fn().mockResolvedValue(result);
    expect(await monitorOperation("webhook-deliveries", work)).toBe(result);
    expect(work).toHaveBeenCalledOnce();
  });
  it("preserves the original business error when both persistence and logging fail", async () => {
    m.transaction.mockRejectedValue(new Error("database offline"));
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error("logger offline");
    });
    const original = new Error("original");
    const work = vi.fn().mockRejectedValue(original);
    await expect(monitorOperation("webhook-deliveries", work)).rejects.toBe(original);
    expect(work).toHaveBeenCalledOnce();
  });
  it("does not reinterpret a completed result if a summary accessor fails", async () => {
    const result = {
      get examined() {
        throw new Error("unexpected getter");
      },
    };
    const work = vi.fn().mockResolvedValue(result);
    expect(await monitorOperation("webhook-deliveries", work)).toBe(result);
    expect(work).toHaveBeenCalledOnce();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("a late older invocation cannot replace the evidence of a newer one", async () => {
    let finish!: (value: { examined: number }) => void;
    const first = monitorOperation(
      "webhook-deliveries",
      () =>
        new Promise<{ examined: number }>((resolve) => {
          finish = resolve;
        })
    );
    vi.setSystemTime(new Date("2026-11-01T16:00:01.000Z"));
    await monitorOperation("webhook-deliveries", async () => ({ examined: 2 }));
    vi.setSystemTime(new Date("2026-11-01T16:00:03.000Z"));
    finish({ examined: 1 });
    await first;
    expect(m.records.get("webhook-deliveries")).toMatchObject({
      latest: { counters: { examined: 2 } },
    });
  });
  it("preserves a previous failure when a later empty invocation completes", async () => {
    await expect(
      monitorOperation("esocial-query", async () => {
        throw new Error("private");
      })
    ).rejects.toThrow();
    vi.setSystemTime(new Date("2026-11-01T16:01:00.000Z"));
    await monitorOperation("esocial-query", async () => ({
      checked: 0,
      waiting: 0,
      unavailable: 0,
    }));
    const status = await getOperationalStatus(actor);
    expect(status.operations[0].evidence).toMatchObject({
      state: "completed",
      latest: { counters: { checked: 0 } },
      lastFailure: { outcome: "failed" },
    });
  });
});

describe("administrative status boundary", () => {
  it.each([
    { role: "OPERATIONS", tenantId: null },
    { role: "ADMIN", tenantId: null },
    { role: "CLIENT_ADMIN", tenantId: "client" },
    { role: "SCOPED_PROVIDER", tenantId: null },
    { role: "HR", tenantId: "client" },
  ])("rejects $role/$tenantId before reading any metadata", async (change) => {
    await expect(
      getOperationalStatus({ ...actor, ...change } as AuthContext)
    ).rejects.toMatchObject({ status: 403 });
    expect(m.getAll).not.toHaveBeenCalled();
    expect(m.collection).not.toHaveBeenCalled();
  });
  it("never claims an unobserved scheduler ran and keeps send flags fail closed", async () => {
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "TRUE");
    vi.stubEnv("ASO_CLIENT_EMAIL_SEND_ENABLED", "");
    vi.stubEnv("ESOCIAL_SYNC_ENABLED", "true");
    vi.stubEnv("ESOCIAL_SYNC_INVOKER_EMAIL", "private@example.test");
    vi.stubEnv("ESOCIAL_SYNC_AUDIENCE", "https://private.example.test");
    const status = await getOperationalStatus(actor);
    expect(status.controls).toEqual({ esocialTransmissionBlocked: true, clientEmailBlocked: true });
    expect(status.operations[0]).toMatchObject({
      configuration: { present: true },
      evidence: { state: "unobserved", latest: null },
    });
    expect(m.getAll.mock.calls[0]).toHaveLength(4);
    expect(JSON.stringify(status)).not.toContain("private@example.test");
  });
  it("preserves the established global SUPER_ADMIN role for a legacy internal tenant", async () => {
    const status = await getOperationalStatus({ ...actor, tenantId: "nextcon" });
    expect(status.operations).toHaveLength(4);
    expect(m.getAll).toHaveBeenCalledOnce();
  });
  it("reports explicitly enabled controls without silently changing them", async () => {
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "true");
    vi.stubEnv("ASO_CLIENT_EMAIL_SEND_ENABLED", "true");
    expect((await getOperationalStatus(actor)).controls).toEqual({
      esocialTransmissionBlocked: false,
      clientEmailBlocked: false,
    });
  });
});
