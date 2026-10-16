// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ collection: () => ({ doc: () => ({ set: mocks.set }) }) }),
    }),
  },
}));
vi.mock("./soc", async (original) => ({
  ...(await original<typeof import("./soc")>()),
  socRead: mocks.read,
  socCompanyIds: () => ["101"],
}));
import { monitoredSocRead } from "./soc-monitor";
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
it("never records rejected arbitrary input or provider error text", async () => {
  mocks.read.mockRejectedValue(new SocError(400, "INVALID_QUERY", "private-provider-message"));
  await expect(
    monitoredSocRead("employees", { companyId: "private-input" }, "manual")
  ).rejects.toThrow();
  const recorded = mocks.set.mock.calls[0][0];
  expect(recorded).toMatchObject({ code: "INVALID_QUERY", companyId: "" });
  expect(JSON.stringify(recorded)).not.toContain("private");
});
it("reports unavailable audit storage without claiming the query was recorded", async () => {
  mocks.read.mockResolvedValue([]);
  mocks.set.mockRejectedValue(new Error("database unavailable"));
  expect(await monitoredSocRead("employees", { companyId: "101" }, "manual")).toMatchObject({
    recorded: false,
    data: [],
  });
});
