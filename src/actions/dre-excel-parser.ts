"use server";

/**
 * @fileOverview NAI Financial DRE Parser & Financial Statement Engine.
 * Converte extratos financeiros e planilhas de receitas/despesas em DRE Ocupacional Gerencial.
 */

import { ActionResult } from "@/types/schema";

export interface DreFinancialStatement {
  periodo: string;
  receitaBrutaSst: number;
  deducoesImpostos: number;
  receitaLiquida: number;
  custosServicosPrestados: {
    examesClinicosCredenciados: number;
    laudosPgrLtcatPcmso: number;
    laboratorioEEquipamentos: number;
    honorariosTecnicos: number;
    totalCustos: number;
  };
  lucroBruto: number;
  despesasOperacionais: {
    administrativasESoftware: number;
    logisticaETreinamentos: number;
    comercialEMarketing: number;
    totalDespesas: number;
  };
  ebitda: number;
  margemEbitdaPercentual: number;
  resultadoLiquido: number;
  lançamentosSugeridos: Array<{
    data: string;
    descricao: string;
    categoria: string;
    valor: number;
    tipo: "RECEITA" | "DESPESA";
  }>;
}

/**
 * Analisa e estrutura linhas de extrato financeiro/planilha em um DRE Ocupacional.
 */
export async function parseExtratoToDre(
  rawContent: string,
  fileName?: string
): Promise<ActionResult<DreFinancialStatement>> {
  // Legacy free-text imports cannot establish a DRE or infer tax/cost values.
  // Keep the action contract explicit for stale clients while the supported Omie flow is used.
  return {
    sucesso: false,
    mensagem:
      "Importação financeira legada desativada. Consulte a DRE pela integração Omie; nenhum valor foi calculado ou salvo.",
  };
}
