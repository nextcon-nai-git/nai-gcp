// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { calcularFaturamentoAlocacaoComFeriados as calcular } from "./holiday-billing-calculator";

afterEach(() => vi.unstubAllGlobals());

it("abate cada dia útil uma vez e identifica a origem do abatimento", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const base = await calcular(2026, 12, 200, 5);
  const result = await calcular(2026, 12, 200, 5, [
    "2026-12-24",
    "2026-12-24",
    "2026-12-25",
    "2026-12-26",
    "2027-01-02",
  ]);
  expect(base).toMatchObject({ diasFaturaveisLiquidos: 22, valorLiquidoFaturavel: 22000 });
  expect(await calcular(2026, 12, 200, 5, ["2026-12-24"])).toMatchObject({
    diasFaturaveisLiquidos: 21,
    valorLiquidoFaturavel: 21000,
    totalFeriadosNacionais: 1,
    horasFaturaveisPorProfissional: 168,
  });
  expect(result.valorLiquidoFaturavel).toBe(21000);
  expect(
    result.feriadosNoMes.map(({ date, origem, eDiaUtil }) => [date, origem, eDiaUtil])
  ).toEqual([
    ["2026-12-24", "contrato", true],
    ["2026-12-25", "calendario", true],
    ["2026-12-26", "contrato", false],
  ]);
});

it("só desconta o Carnaval previsto no contrato e recusa datas impossíveis", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect((await calcular(2026, 2)).diasFaturaveisLiquidos).toBe(20);
  expect((await calcular(2026, 2, 200, 5, ["2026-02-17"])).diasFaturaveisLiquidos).toBe(19);
  await expect(calcular(2026, 2, 200, 5, ["2026-02-31"])).rejects.toThrow("datas");
});
