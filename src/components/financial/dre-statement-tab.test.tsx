import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  calculateDreTotals,
  DRE_DATA_2026,
  DRE_MARGIN_2026,
  DRE_TOTALS_2026,
  DreStatementTab,
} from "./dre-statement-tab";

describe("DRE histórica de janeiro a agosto de 2026", () => {
  it("soma os meses em centavos, corrigindo os acumulados sem alterar a base mensal", () => {
    expect(DRE_DATA_2026.map((month) => month.mesAbrev)).toEqual([
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
    ]);
    expect(DRE_TOTALS_2026).toEqual({
      receitaBruta: 1159556.54,
      impostos: -165989.68,
      receitasFinanceiras: 628.56,
      custoServicos: -360817.6,
      recuperacaoDespesas: 100.43,
      despesasPessoal: -298026.58,
      despesasAdmin: -44446.52,
      despesasFinanceiras: -1517.85,
      despesasVendasMkt: -58370.55,
      totalGeral: 231116.75,
    });
    expect(DRE_MARGIN_2026).toBeCloseTo(0.19931477, 8);
    for (const { mes, mesAbrev, totalGeral, ...accounts } of DRE_DATA_2026) {
      const accountTotalCents = Object.values(accounts).reduce(
        (sum, amount) => sum + Math.round(amount * 100),
        0
      );
      expect(accountTotalCents, `${mesAbrev}: ${mes}`).toBe(Math.round(totalGeral * 100));
    }
  });

  it("deriva os totais apenas dos meses recebidos e mantém sinais e centavos", () => {
    const months = [
      { ...DRE_DATA_2026[0], receitaBruta: 0.1, impostos: -0.1, totalGeral: -0.1 },
      { ...DRE_DATA_2026[1], receitaBruta: 0.2, impostos: -0.2, totalGeral: 0.2 },
    ];
    expect(calculateDreTotals(months)).toMatchObject({
      receitaBruta: 0.3,
      impostos: -0.3,
      totalGeral: 0.1,
    });
    expect(Object.values(calculateDreTotals([]))).toEqual(Array(10).fill(0));
  });

  it("identifica a fonte e a conciliação pendente na tela e no CSV exportado", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    let csv = "";
    let filename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      csv = decodeURI(this.href);
      filename = this.download;
    });

    try {
      await act(async () => root.render(<DreStatementTab />));
      expect(container.textContent).toContain(
        "Base histórica Nextcon de janeiro a agosto de 2026, pendente de conciliação com o Omie."
      );
      expect(container.textContent).not.toMatch(/oficial|atualizado|setembro/i);
      const exportButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Exportar CSV")
      );
      expect(exportButton).toBeDefined();
      await act(async () => exportButton!.click());

      expect(filename).toBe("NAI_DRE_Historica_Jan_Ago_2026_Pendente_Conciliacao.csv");
      expect(csv).toContain("Fonte;Base histórica Nextcon cadastrada");
      expect(csv).toContain("Período;Janeiro a agosto de 2026");
      expect(csv).toContain("Situação;Conciliação com o Omie pendente");
      expect(csv).toContain("Agosto/2026;Total Jan–Ago/2026");
      expect(csv).toContain(";-165989.68\n");
      expect(csv).toContain(";231116.75");
      expect(csv).not.toContain("Setembro");
    } finally {
      await act(async () => root.unmount());
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
