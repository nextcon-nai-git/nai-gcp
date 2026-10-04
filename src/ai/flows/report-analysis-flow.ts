"use server";
/**
 * @fileOverview NAI Legal & Technical Analysis - Analisador forense de laudos.
 * Converte documentos técnicos em pareceres jurídicos e resumos estratégicos.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const ReportAnalysisInputSchema = z.object({
  content: z.string().describe("Conteúdo textual ou metadados do documento."),
  docType: z.string().optional().describe("Tipo do documento (PGR, LTCAT, etc)."),
});

const ReportAnalysisOutputSchema = z.object({
  resumo_executivo: z.string().describe("Resumo técnico em linguagem simples para o gestor."),
  analise_juridica: z
    .string()
    .describe("Análise de vulnerabilidade perante o MTE e Ministério Público."),
  riscos_normativos: z
    .array(z.string())
    .describe("Lista de NRs afetadas ou itens de descumprimento."),
  conclusao_prescritiva: z.string().describe("Ação recomendada para blindagem imediata."),
});

export type ReportAnalysisOutput = z.infer<typeof ReportAnalysisOutputSchema>;

/**
 * Função principal para análise estratégica de documentos SST.
 */
export async function analyzeSafetyReport(
  input: z.infer<typeof ReportAnalysisInputSchema>
): Promise<ReportAnalysisOutput> {
  const result = await analyzeSafetyReportFlow(input);
  if (!result) throw new Error("A NAI não conseguiu processar o parecer jurídico deste laudo.");
  return result;
}

const analyzeSafetyReportFlow = ai.defineFlow(
  {
    name: "analyzeSafetyReportFlow",
    inputSchema: ReportAnalysisInputSchema,
    outputSchema: ReportAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `Você é um Consultor Jurídico de SST e Engenheiro de Segurança da Nextcon.
      Analise os dados deste documento (${input.docType || "SST"}) e gere um parecer forense.
      
      DIRETRIZES:
      1. RESUMO: Extraia o "coração" técnico do documento.
      2. JURÍDICO: Identifique onde a empresa corre risco de ser multada ou perder processos trabalhistas.
      3. NORMAS: Cite especificamente os itens das NRs que estão em jogo.
      4. PRESCRIÇÃO: O que o dono da empresa deve fazer hoje?

      DADOS DO DOCUMENTO:
      ${input.content}`,
      output: { schema: ReportAnalysisOutputSchema },
    });

    return output!;
  }
);
