// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), batch: vi.fn(), plan: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({}) }), runTransaction: mocks.transaction },
}));
vi.mock("@/lib/integrations/soc-scheduled-batch", async (original) => ({
  ...(await original<typeof import("@/lib/integrations/soc-scheduled-batch")>()),
  monitorSocBatch: mocks.batch,
  planSocMonitoring: mocks.plan,
}));
vi.mock("@/lib/integrations/soc-monitor", () => ({ monitoredSocRead: vi.fn() }));
import { POST } from "./route";
const secret = "test-only-secret-with-at-least-32-characters";
const req = (body: unknown = { action: "plan" }, token = secret) =>
  new NextRequest("https://nai.test/api/integrations/soc/monitor", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SOC_MONITOR_SECRET", secret);
  vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", "101,102,103,104,105,106");
  vi.stubEnv("SOC_PRINCIPAL_COMPANY_ID", "1005519");
  for (const prefix of ["COMPANIES", "EMPLOYEES", "ASOS"]) {
    vi.stubEnv(`SOC_${prefix}_CODE`, "123");
    vi.stubEnv(`SOC_${prefix}_KEY`, "test-key");
  }
});
afterEach(() => vi.unstubAllEnvs());
it("rejects invalid authentication before reading the plan", async () => {
  expect((await POST(req({}, "wrong"))).status).toBe(401);
  expect(mocks.plan).not.toHaveBeenCalled();
});
it("rejects missing keys before any provider read", async () => {
  vi.stubEnv("SOC_ASOS_KEY", "");
  expect((await POST(req())).status).toBe(503);
  expect(mocks.plan).not.toHaveBeenCalled();
});
it("supports an active-company plan beyond five authorized companies", async () => {
  mocks.plan.mockResolvedValue({ companyIds: ["101"], coverage: "issued_asos_only" });
  expect((await POST(req())).status).toBe(200);
});
it("bounds input and validates scope before acquiring a lock", async () => {
  expect(
    (
      await POST(
        req({
          action: "batch",
          companyId: "999",
          start: "2026-10-01",
          end: "2026-10-26",
          offset: 0,
        })
      )
    ).status
  ).toBe(403);
  expect((await POST(req({ x: "x".repeat(2100) }))).status).toBe(413);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not query a locked company", async () => {
  mocks.transaction.mockResolvedValue(false);
  expect(
    (
      await POST(
        req({
          action: "batch",
          companyId: "101",
          start: "2026-10-01",
          end: "2026-10-26",
          offset: 0,
        })
      )
    ).status
  ).toBe(429);
  expect(mocks.batch).not.toHaveBeenCalled();
});
it("releases its lock after a failed batch and does not claim success", async () => {
  mocks.transaction.mockResolvedValue(true);
  mocks.batch.mockRejectedValue(new Error("private-provider-body"));
  const response = await POST(
    req({ action: "batch", companyId: "101", start: "2026-10-01", end: "2026-10-26", offset: 0 })
  );
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private");
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
});
