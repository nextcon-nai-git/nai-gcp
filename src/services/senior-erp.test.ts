import { afterEach, describe, expect, it, vi } from "vitest";
import { SeniorErpService } from "./senior-erp";

afterEach(() => vi.unstubAllGlobals());

describe("Senior integration availability", () => {
  it.each([
    [
      "credential validation",
      () =>
        SeniorErpService.validateConnection({ tenant: "test", appKey: "test", appSecret: "test" }),
    ],
    ["employee synchronization", () => SeniorErpService.syncEmployees("test-company")],
    ["payroll values", () => SeniorErpService.fetchPayrollRubrics("test-company", "2026-10")],
  ] as const)(
    "does not report synthetic success for %s when the transport is unavailable",
    async (_operation, run) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const result = await run();
      expect(result.sucesso).toBe(false);
      expect(result.mensagem).toContain("indisponível");
      expect(result.dados).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
});
