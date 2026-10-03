"use server";
/**
 * @fileOverview NAI Report Analysis - Analisador técnico de vistorias e laudos.
 * Converte dados brutos em resumos executivos para o gestor.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ReportAnalysisInputSchema = z
  .any()
  .describe("Os dados brutos do relatório ou vistoria técnica.");
const ReportAnalysisOutputSchema = z.string().describe("O resumo executivo gerado pela IA.");

/**
 * Função principal para analisar riscos em relatórios SST.
 */
export async function analyzeSafetyReport(input: any): Promise<string> {
  return analyzeSafetyReportFlow(input);
}

const analyzeSafetyReportFlow = ai.defineFlow(
  {
    name: "analyzeSafetyReportFlow",
    inputSchema: ReportAnalysisInputSchema,
    outputSchema: ReportAnalysisOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      prompt: `Você é um Engenheiro de Segurança do Trabalho sênior da Nextcon.
      Sua missão é analisar os dados de uma visita técnica e gerar um resumo executivo de alta performance.
      
      DIRETRIZES:
      1. Foque nos riscos críticos identificados.
      2. Sugira recomendações imediatas baseadas nas NRs vigentes.
      3. Utilize um tom profissional, técnico e consultivo.
      4. O resumo deve ser conciso e focado em evitar passivos trabalhistas.

      DADOS DO RELATÓRIO:
      ${JSON.stringify(input)}`,
    });

    return text;
  }
);
