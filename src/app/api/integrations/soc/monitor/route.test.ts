// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  batch: vi.fn(),
  plan: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({}) }), runTransaction: mocks.transaction },
}));
vi.mock("@/lib/integrations/soc-scheduled-batch", async (original) => ({
  ...(await original<typeof import("@/lib/integrations/soc-scheduled-batch")>()),
  monitorSocBatch: mocks.batch,
  planSocMonitoring: mocks.plan,
}));
vi.mock("@/lib/integrations/soc-monitor", () => ({
  monitoredSocRead: vi.fn(),
  recordSocBatchFailure: mocks.recordFailure,
}));
import { POST } from "./route";
import { SocError } from "@/lib/integrations/soc";
const secret = "test-only-secret-with-at-least-32-characters";
const req = (body: unknown = { action: "plan" }, token = secret) =>
  new NextRequest("https://nai.test/api/integrations/soc/monitor", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const batch = (offset = 0, rosterHash?: string) => ({
  action: "batch",
  companyId: "101",
  start: "2026-10-01",
  end: "2026-10-26",
  offset,
  ...(rosterHash ? { rosterHash } : {}),
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
  mocks.transaction.mockResolvedValue(true);
  mocks.batch.mockResolvedValue({ companyId: "101", nextOffset: null });
  mocks.recordFailure.mockResolvedValue(true);
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
  expect((await POST(req({ ...batch(), companyId: "999" }))).status).toBe(403);
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect((await POST(req({ x: "x".repeat(2100) }))).status).toBe(413);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("does not query or record a locked company", async () => {
  mocks.transaction.mockResolvedValue(false);
  expect((await POST(req(batch()))).status).toBe(429);
  expect(mocks.batch).not.toHaveBeenCalled();
  expect(mocks.recordFailure).not.toHaveBeenCalled();
});
it("records an interruption between batches with company, period and failure reason", async () => {
  mocks.batch.mockResolvedValueOnce({
    companyId: "101",
    start: "2026-10-01",
    end: "2026-10-26",
    offset: 0,
    nextOffset: 150,
    issuedAsosInBatch: 2,
  });
  const first = await POST(req(batch()));
  expect(first.status).toBe(200);

  mocks.batch.mockRejectedValueOnce(
    new SocError(409, "ROSTER_CHANGED", "O cadastro mudou entre lotes.")
  );
  const second = await POST(req(batch(150, "a".repeat(64))));
  expect(second.status).toBe(409);
  expect(mocks.recordFailure).toHaveBeenCalledTimes(1);
  expect(mocks.recordFailure).toHaveBeenCalledWith({
    companyId: "101",
    start: "2026-10-01",
    end: "2026-10-26",
    offset: 150,
    code: "ROSTER_CHANGED",
  });
  expect(await second.text()).not.toContain("clinical");
});
it("records failed queries without exposing provider text", async () => {
  mocks.batch.mockRejectedValueOnce(new Error("private-provider-body-and-secret"));
  const response = await POST(req(batch()));
  expect(response.status).toBe(500);
  expect(mocks.recordFailure).toHaveBeenCalledWith({
    companyId: "101",
    start: "2026-10-01",
    end: "2026-10-26",
    offset: 0,
    code: "INTERNAL_ERROR",
  });
  expect(await response.text()).not.toContain("private-provider");
});
it("does not claim completion when the operational history cannot persist the failure", async () => {
  mocks.batch.mockRejectedValueOnce(new Error("private-provider-body"));
  mocks.recordFailure.mockResolvedValueOnce(false);
  const response = await POST(req(batch()));
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body).toMatchObject({ code: "AUDIT_UNAVAILABLE" });
  expect(JSON.stringify(body)).not.toContain("private-provider");
});
