// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./soc-monitor", () => ({ monitoredSocRead: mocks.read }));
import { monitorSocBatch, monitoringPeriod, planSocMonitoring } from "./soc-scheduled-batch";
const input = { companyId: "101", start: "2026-09-26", end: "2026-10-26", offset: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SOC_ALLOWED_COMPANY_IDS", "101,102,103,104,105,106");
});
afterEach(() => vi.unstubAllEnvs());
function source(count: number) {
  mocks.read.mockImplementation(async (resource: string) => ({
    recorded: true,
    data:
      resource === "companies"
        ? [{ id: "101", active: "1" }]
        : resource === "employees"
          ? Array.from({ length: count }, (_, i) => ({ id: String(i + 1), name: "PRIVATE" }))
          : [{ id: "aso" }],
  }));
}
it("plans more than five companies without reading employees or assuming missing clients are inactive", async () => {
  mocks.read.mockResolvedValue({
    recorded: true,
    data: [1, 2, 3, 4, 5, 6].map((i) => ({ id: String(100 + i), active: "1" })),
  });
  expect(await planSocMonitoring()).toMatchObject({
    activeCompanies: 6,
    dueDatesVerified: false,
    stalledCasesVerified: false,
  });
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it("reports absent and unknown-status companies as coverage gaps", async () => {
  mocks.read.mockResolvedValue({
    recorded: true,
    data: [
      { id: "101", active: "1" },
      { id: "102", active: "?" },
      { id: "103", active: "0" },
    ],
  });
  expect(await planSocMonitoring()).toMatchObject({
    companyIds: ["101"],
    unknownActivityCompanies: ["102"],
    missingAuthorizedCompanies: ["104", "105", "106"],
  });
});
it("reads at most 150 employees in 50-code ASO chunks and resumes without repeating a slice", async () => {
  source(151);
  const first = await monitorSocBatch(input);
  expect(first).toMatchObject({ employeesInBatch: 150, nextOffset: 150, issuedAsosInBatch: 3 });
  const ids = mocks.read.mock.calls
    .filter((c) => c[0] === "asos")
    .flatMap((c) => c[1].employeeIds.split(","));
  const second = await monitorSocBatch({ ...input, offset: 150, rosterHash: first.rosterHash });
  expect(second).toMatchObject({ employeesInBatch: 1, nextOffset: null });
  expect(new Set([...ids, ...mocks.read.mock.calls.at(-1)![1].employeeIds.split(",")]).size).toBe(
    151
  );
  expect(JSON.stringify(first)).not.toContain("PRIVATE");
});
it("fails changed rosters instead of skipping newly added employees", async () => {
  source(151);
  const first = await monitorSocBatch(input);
  source(152);
  await expect(
    monitorSocBatch({ ...input, offset: 150, rosterHash: first.rosterHash })
  ).rejects.toMatchObject({ code: "ROSTER_CHANGED" });
});
it("rejects inactive companies before reading people", async () => {
  mocks.read.mockResolvedValue({ recorded: true, data: [{ id: "101", active: "0" }] });
  await expect(monitorSocBatch(input)).rejects.toMatchObject({ code: "COMPANY_NOT_ACTIVE" });
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it("does not convert an audit failure or invalid cursor into a completed batch", async () => {
  mocks.read.mockResolvedValue({ recorded: false, data: [] });
  await expect(monitorSocBatch(input)).rejects.toMatchObject({ code: "AUDIT_UNAVAILABLE" });
  await expect(monitorSocBatch({ ...input, offset: 1 })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
});
it("allows an empty confirmed roster and keeps due dates unknown", async () => {
  source(0);
  expect(await monitorSocBatch(input)).toMatchObject({
    totalEmployees: 0,
    nextOffset: null,
    issuedAsosInBatch: 0,
    dueDatesVerified: false,
  });
});
it("uses the Brazilian day at UTC midnight and queries exactly 31 inclusive days", () => {
  expect(monitoringPeriod(new Date("2026-10-26T01:00:00Z"))).toEqual({
    start: "2026-09-25",
    end: "2026-10-25",
  });
});
