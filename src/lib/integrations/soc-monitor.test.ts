// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ collection: () => ({ doc: () => ({ set: mocks.set }) }), set: mocks.set }),
    }),
  },
}));
vi.mock("./soc", async (original) => ({
  ...(await original<typeof import("./soc")>()),
  socRead: mocks.read,
  socCompanyIds: () => ["101"],
}));
import { monitoredSocRead, recordSocBatchFailure } from "./soc-monitor";
import { SocError } from "./soc";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.set.mockResolvedValue(undefined);
});
it("persists only counts and diagnostics, not personal data from a successful response", async () => {
  mocks.read.mockResolvedValue([
    { name: "Private Person", registration: "private-registration", review: "Conferir" },
  ]);
  await monitoredSocRead("employees", { companyId: "101" }, "manual");
  const recorded = mocks.set.mock.calls[0][0];
  expect(recorded).toMatchObject({ records: 1, needsReview: 1, code: "OK", companyId: "101" });
  expect(JSON.stringify(recorded)).not.toContain("Private");
  expect(JSON.stringify(recorded)).not.toContain("private-registration");
});
it("records the requested ASO period and safe reason when a provider query fails", async () => {
  mocks.read.mockRejectedValue(new SocError(504, "TRANSPORT_FAILURE", "private-provider-message"));
  await expect(
    monitoredSocRead(
      "asos",
      { companyId: "101", start: "2026-10-01", end: "2026-10-26", employeeIds: "12" },
      "schedule"
    )
  ).rejects.toThrow();
  const recorded = mocks.set.mock.calls[0][0];
  expect(recorded).toMatchObject({
    resource: "asos",
    companyId: "101",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-26",
    status: "error",
    code: "TRANSPORT_FAILURE",
  });
  expect(JSON.stringify(recorded)).not.toContain("private");
});
it("records an interrupted company batch as partial coverage without clinical or secret data", async () => {
  expect(
    await recordSocBatchFailure({
      companyId: "101",
      start: "2026-10-01",
      end: "2026-10-26",
      offset: 150,
      code: "ROSTER_CHANGED",
    })
  ).toBe(true);
  const recorded = mocks.set.mock.calls[0][0];
  expect(recorded).toMatchObject({
    resource: "asos",
    source: "schedule",
    companyId: "101",
    periodStart: "2026-10-01",
    periodEnd: "2026-10-26",
    batchOffset: 150,
    status: "partial",
    coverage: "partial",
    code: "ROSTER_CHANGED",
    records: null,
  });
  expect(JSON.stringify(recorded)).not.toMatch(/name|cpf|clinical|result|key|token/i);
});
it("refuses to persist malformed company, dates, cursor or diagnostic", async () => {
  expect(
    await recordSocBatchFailure({
      companyId: "private-input",
      start: "2026-10-01",
      end: "2026-10-26",
      offset: 0,
      code: "ROSTER_CHANGED",
    })
  ).toBe(false);
  expect(mocks.set).not.toHaveBeenCalled();
});
it("reports unavailable audit storage without claiming the query was recorded", async () => {
  mocks.read.mockResolvedValue([]);
  mocks.set.mockRejectedValue(new Error("database unavailable"));
  expect(await monitoredSocRead("employees", { companyId: "101" }, "manual")).toMatchObject({
    recorded: false,
    data: [],
  });
});
it("reports an unavailable batch history write", async () => {
  mocks.set.mockRejectedValue(new Error("database unavailable"));
  expect(
    await recordSocBatchFailure({
      companyId: "101",
      start: "2026-10-01",
      end: "2026-10-26",
      offset: 0,
      code: "INTERNAL_ERROR",
    })
  ).toBe(false);
});
