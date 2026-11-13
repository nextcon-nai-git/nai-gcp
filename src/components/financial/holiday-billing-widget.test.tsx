// @vitest-environment jsdom
import React, { act } from "react";
import { expect, it, vi } from "vitest";
import { calcularFaturamentoAlocacaoComFeriados as calcular } from "@/actions/holiday-billing-calculator";
import { deferred, ui } from "../../../tests/ui/harness";
import { HolidayBillingWidget } from "./holiday-billing-widget";

vi.mock("@/actions/holiday-billing-calculator", () => ({
  calcularFaturamentoAlocacaoComFeriados: vi.fn(),
}));

it("mantém na tela o cálculo das datas mais recentes e retira o valor se a data for inválida", async () => {
  const view = ui();
  const anterior = deferred<Awaited<ReturnType<typeof calcular>>>();
  const { calcularFaturamentoAlocacaoComFeriados: real } = await vi.importActual<
    typeof import("@/actions/holiday-billing-calculator")
  >("@/actions/holiday-billing-calculator");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("offline")));
  vi.mocked(calcular)
    .mockImplementationOnce(() => anterior.promise)
    .mockImplementation(real);
  try {
    await view.render(<HolidayBillingWidget />);
    await view.input("label input", "2026-02-17, 2026-02-17");
    expect(calcular).toHaveBeenLastCalledWith(2026, 2, 200, 5, ["2026-02-17", "2026-02-17"]);
    expect(view.container.textContent).toContain("19.000,00");
    await act(async () => anterior.resolve(await real(2026, 2, 200, 5)));
    expect(view.container.textContent).toContain("19.000,00");
    await view.input("label input", "2026-02-31");
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("AAAA-MM-DD");
    expect(view.container.textContent).not.toContain("19.000,00");
  } finally {
    await view.cleanup();
    vi.unstubAllGlobals();
  }
});
