// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ config: vi.fn(), read: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/integrations/soc", () => ({ socConfiguration: m.config }));
vi.mock("@/lib/integrations/soc-monitor", () => ({ monitoredSocRead: m.read }));
import { getAvpWorkforce } from "./avp-workforce";
const historical = { records: 5685, observedOn: "2026-10-16", source: "manual" };
const checkedAt = "2026-11-17T01:00:00Z";
beforeEach(() => {
  vi.resetAllMocks();
  m.config.mockReturnValue({
    companyIds: ["2306171"],
    resources: { employees: { configured: true } },
  });
});
it("uses only the authorized roster's aggregate and observation day in Brasília", async () => {
  m.read.mockResolvedValue({
    data: [
      { id: "01", name: "PRIVATE" },
      { id: "02", name: "PRIVATE" },
    ],
    checkedAt,
  });
  expect(await getAvpWorkforce()).toEqual({
    records: 2,
    observedOn: "2026-11-16",
    source: "connector",
  });
  expect(m.read).toHaveBeenCalledWith("employees", { companyId: "2306171" }, "dashboard");
});
it("keeps a verified zero", async () => {
  m.read.mockResolvedValue({ data: [], checkedAt });
  expect(await getAvpWorkforce()).toMatchObject({ records: 0, source: "connector" });
});
it("keeps the manual reference dated when the provider fails or returns duplicate employee codes", async () => {
  m.read
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ data: [{ id: "01" }, { id: "01" }], checkedAt });
  expect(await getAvpWorkforce()).toEqual(historical);
  expect(await getAvpWorkforce()).toEqual(historical);
});
it("does not call the connector outside its allowlist", async () => {
  m.config.mockReturnValue({ companyIds: ["999"], resources: { employees: { configured: true } } });
  expect(await getAvpWorkforce()).toEqual(historical);
  expect(m.read).not.toHaveBeenCalled();
});
