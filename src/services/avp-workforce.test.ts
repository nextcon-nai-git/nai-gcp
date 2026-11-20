// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ config: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/integrations/soc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/soc")>()),
  socConfiguration: m.config,
}));
vi.mock("@/lib/integrations/soc-monitor", () => ({ monitoredSocRead: m.read }));
const historical = { records: 5685, observedOn: "2026-10-16" };
const checkedAt = "2026-11-17T01:00:00.000Z";
const row = (id: string, status: string, unitId = "286") => ({
  id,
  status,
  unitId,
  companyId: "2306171",
  name: "PRIVATE",
  registration: "SAME",
});
let getAvpWorkforce: typeof import("./avp-workforce").getAvpWorkforce;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(checkedAt));
  vi.stubEnv("SOC_EMPLOYEES_CODE", "155091");
  m.config.mockReturnValue({
    companyIds: ["2306171"],
    resources: { employees: { configured: true } },
  });
  ({ getAvpWorkforce } = await import("./avp-workforce"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("counts explicit status per vínculo, including two codes for one registration, and flags unmapped units", async () => {
  m.read.mockResolvedValue({
    data: [
      row("01", " ATIVO "),
      row("02", "Ativo", "300"),
      row("03", "Férias"),
      row("04", "Afastado"),
      row("05", "DEMITIDO"),
      row("06", "Inativo"),
      row("07", "Pendente"),
      row("08", "1", "246"),
      row("09", "", ""),
    ],
    checkedAt,
  });
  const workforce = await getAvpWorkforce();
  expect(workforce).toEqual({
    historical,
    source: "connector",
    issue: null,
    reading: {
      checkedAt,
      records: 9,
      active: 2,
      other: 5,
      unknown: 2,
      observedUnits: ["286", "300"],
      unmappedUnitRecords: 2,
    },
  });
  expect(m.read).toHaveBeenCalledWith("employees", { companyId: "2306171" }, "dashboard");
});
it("keeps a confirmed empty roster at zero and shares just the aggregate until the one-hour boundary", async () => {
  m.read.mockResolvedValue({ data: [], checkedAt });
  const [first, concurrent] = await Promise.all([getAvpWorkforce(), getAvpWorkforce()]);
  expect(first).toEqual(concurrent);
  expect(first).toMatchObject({
    source: "connector",
    reading: { active: 0, other: 0, unknown: 0 },
  });
  vi.advanceTimersByTime(3599999);
  expect(await getAvpWorkforce()).toMatchObject({ source: "cache", reading: { checkedAt } });
  expect(m.read).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  m.read.mockRejectedValueOnce(new Error("offline"));
  expect(await getAvpWorkforce()).toEqual({
    historical,
    source: "manual",
    reading: null,
    issue: "provider",
  });
  m.read.mockResolvedValueOnce({ data: [row("1", "Ativo")], checkedAt: new Date().toISOString() });
  expect(await getAvpWorkforce()).toMatchObject({ source: "connector", reading: { active: 1 } });
});
it.each([
  [row("01", "Ativo"), row("01", "Ativo", "300")],
  [row("", "Ativo")],
  [row("abc", "Ativo")],
  [{ ...row("01", "Ativo"), companyId: "999" }],
])("rejects inconsistent employee codes or a foreign company before counting", async (...rows) => {
  m.read.mockResolvedValue({ data: rows, checkedAt });
  expect(await getAvpWorkforce()).toEqual({
    historical,
    source: "manual",
    issue: "integrity",
    reading: null,
  });
});
it("checks report, allowlist and availability before returning even a cached count", async () => {
  m.read.mockResolvedValue({ data: [], checkedAt });
  await getAvpWorkforce();
  vi.stubEnv("SOC_EMPLOYEES_CODE", "99");
  expect(await getAvpWorkforce()).toMatchObject({ issue: "configuration", reading: null });
  vi.stubEnv("SOC_EMPLOYEES_CODE", "155091");
  m.config.mockReturnValue({ companyIds: ["999"], resources: { employees: { configured: true } } });
  expect(await getAvpWorkforce()).toMatchObject({ issue: "configuration", reading: null });
  m.config.mockReturnValue({
    companyIds: ["2306171"],
    resources: { employees: { configured: false } },
  });
  expect(await getAvpWorkforce()).toMatchObject({ issue: "configuration", reading: null });
  expect(m.read).toHaveBeenCalledOnce();
});
