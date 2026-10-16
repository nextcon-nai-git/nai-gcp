// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: () => ({ doc: () => ({}) }), runTransaction: mocks.transaction },
}));
vi.mock("@/lib/integrations/soc-monitor", () => ({ monitoredSocRead: mocks.read }));
import { POST } from "./route";
const secret = "test-only-secret-with-at-least-32-characters";
const req = (token = secret) =>
  new NextRequest("https://nai.test/api/integrations/soc/monitor", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SOC_MONITOR_SECRET", secret);
  vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", "101");
});
afterEach(() => vi.unstubAllEnvs());
it("rejects invalid monitor credentials before locking or querying", async () => {
  expect((await POST(req("wrong"))).status).toBe(401);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("rejects unconfigured scope", async () => {
  vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", "");
  expect((await POST(req())).status).toBe(503);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("does not repeat a locked monitoring job", async () => {
  mocks.transaction.mockResolvedValue(false);
  expect((await POST(req())).status).toBe(429);
  expect(mocks.read).not.toHaveBeenCalled();
});
it("returns only counters, never employee data, to the scheduler", async () => {
  mocks.transaction.mockResolvedValue(true);
  mocks.read.mockResolvedValue({
    data: [{ name: "Private Person" }],
    summary: { code: "OK", records: 1, needsReview: 0 },
    recorded: true,
  });
  const result = await POST(req());
  expect(result.status).toBe(200);
  expect(await result.text()).not.toContain("Private Person");
});
it("does not report success if monitoring was not recorded", async () => {
  mocks.transaction.mockResolvedValue(true);
  mocks.read.mockResolvedValue({
    summary: { code: "OK", records: 1, needsReview: 0 },
    recorded: false,
  });
  const result = await POST(req());
  expect(result.status).toBe(502);
  expect(await result.text()).toContain("AUDIT_UNAVAILABLE");
});
