// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  OPERATIONS,
  operationConfiguration,
  operationEvidence,
  parseOperationRun,
  summarizeOperation,
  type OperationId,
  type OperationRun,
} from "./operational-status";

const now = Date.parse("2026-11-01T16:00:00.000Z");
const run = (change: Partial<OperationRun> = {}): OperationRun => ({
  schemaVersion: 1,
  operation: "esocial-query",
  runId: "b1111111-2222-4333-a444-555555555555",
  startedAt: new Date(now - 1000).toISOString(),
  finishedAt: new Date(now).toISOString(),
  durationMs: 1000,
  outcome: "completed",
  counters: { checked: 0, waiting: 0, unavailable: 0 },
  ...change,
});

describe("minimal operation evidence", () => {
  it.each([
    ["esocial-query", { checked: 2, waiting: 0, unavailable: 0 }, "completed"],
    ["esocial-query", { checked: 1, waiting: 0, unavailable: 1 }, "partial"],
    ["esocial-query", { checked: 1, waiting: 1, unavailable: 0 }, "partial"],
    ["esocial-query", { checked: 0, waiting: 0, unavailable: 1 }, "partial"],
    ["aso-mail", { saved: 1, skipped: 0, examined: 1, hasMore: false }, "completed"],
    ["aso-mail", { saved: 1, skipped: 0, examined: 1, hasMore: true }, "partial"],
    ["webhook-deliveries", { examined: 0 }, "completed"],
    ["avp-sheets", { started: false, periodic: { started: false } }, "completed"],
    [
      "avp-sheets",
      { started: true, rowCount: 10, periodic: { started: true, sourceRows: 20 } },
      "completed",
    ],
    ["avp-sheets", { error: "private", periodic: { started: false } }, "partial"],
    ["avp-sheets", { error: "private", periodic: { error: "private" } }, "failed"],
  ])("summarizes %s without confusing partial work with completion", (id, value, outcome) => {
    const result = summarizeOperation(id as OperationId, {
      ...(value as object),
      token: "secret",
      names: ["private"],
    });
    expect(result.outcome).toBe(outcome);
    expect(JSON.stringify(result)).not.toMatch(/secret|private|token|names/);
  });
  it.each([
    ["esocial-query", { checked: -1, waiting: "0", unavailable: 0 }],
    ["webhook-deliveries", { examined: Infinity }],
    ["aso-mail", { saved: 0, skipped: 0, examined: 0, hasMore: 2 }],
    ["avp-sheets", { started: true, periodic: { started: false } }],
  ])("does not confirm a malformed result for %s", (id, value) => {
    expect(summarizeOperation(id as OperationId, value).outcome).toBe("unverified");
  });
  it("does not infer external provider success from an empty worker result", () => {
    expect(summarizeOperation("webhook-deliveries", undefined)).toEqual({
      outcome: "unverified",
      counters: {},
    });
    expect(
      summarizeOperation("esocial-query", { checked: 0, waiting: 0, unavailable: 0 }).counters
        .checked
    ).toBe(0);
  });
  it("keeps only typed fields when reading a database record", () => {
    const parsed = parseOperationRun(
      "esocial-query",
      {
        ...run(),
        token: "secret",
        counters: { ...run().counters, cpf: "private", payload: "private" },
      },
      now
    );
    expect(parsed).toEqual(run());
    expect(JSON.stringify(parsed)).not.toMatch(/secret|private|token|cpf|payload/);
  });
  it.each([
    { schemaVersion: 2 },
    { operation: "aso-mail" },
    { runId: "------------------------------------" },
    { startedAt: "invalid" },
    { finishedAt: "invalid" },
    { durationMs: 999 },
    { finishedAt: new Date(now - 2000).toISOString() },
    { finishedAt: new Date(now + 61_000).toISOString(), durationMs: 62_000 },
    { startedAt: new Date(now - 86_400_001).toISOString(), durationMs: 86_400_001 },
    { outcome: "healthy" },
    { counters: { checked: "0", waiting: 0, unavailable: 0 } },
  ])("rejects invalid or misleading stored evidence %j", (change) => {
    expect(parseOperationRun("esocial-query", { ...run(), ...change }, now)).toBeNull();
  });
  it("separates missing, invalid, stale and failed evidence", () => {
    expect(operationEvidence("esocial-query", undefined, now).state).toBe("unobserved");
    expect(operationEvidence("esocial-query", { latest: {} }, now).state).toBe("invalid");
    expect(operationEvidence("esocial-query", { latest: run() }, now).state).toBe("completed");
    expect(operationEvidence("esocial-query", { latest: run() }, now + 21 * 60_000).state).toBe(
      "stale"
    );
    expect(
      operationEvidence("esocial-query", { latest: run({ outcome: "failed", counters: {} }) }, now)
        .state
    ).toBe("failed");
    expect(operationEvidence("esocial-query", { lastFailure: run() }, now).lastFailure).toBeNull();
  });
  it.each([
    ["esocial-query", { checked: 1, waiting: 0, unavailable: 1 }],
    ["esocial-query", { checked: 1, waiting: 1, unavailable: 0 }],
    ["aso-mail", { saved: 1, skipped: 0, examined: 1, hasMore: 1 }],
    ["avp-sheets", { queueUpdated: 1, periodicUpdated: 0 }],
    ["avp-sheets", { queueUpdated: 0, periodicUpdated: 1 }],
  ])("rejects a stored completion claim contradicted by %s counters", (operation, counters) => {
    expect(
      parseOperationRun(operation as OperationId, { ...run(), operation, counters }, now)
    ).toBeNull();
  });
  it("reports configuration separately and never returns credential values", () => {
    const env = {
      ESOCIAL_SYNC_ENABLED: "true",
      ESOCIAL_SYNC_INVOKER_EMAIL: "private@example.test",
      ESOCIAL_SYNC_AUDIENCE: "https://private.example.test/worker",
    };
    expect(operationConfiguration("esocial-query", env)).toEqual({ present: true, missing: [] });
    expect(operationEvidence("esocial-query", undefined, now).state).toBe("unobserved");
    expect(
      operationConfiguration("esocial-query", { ...env, ESOCIAL_SYNC_ENABLED: "TRUE" }).present
    ).toBe(false);
    for (const operation of OPERATIONS) {
      const result = operationConfiguration(operation.id, {});
      expect(result.present).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toContain("private");
    }
  });
});
