"use server";
/**
 * @fileOverview NAI PGR Scanner - Analisador de documentos PGR (PDF).
 *
 * - analyzePgrPdf - Função que extrai dados, riscos e ações de um PDF de PGR.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const PgrAnalysisInputSchema = z.object({
  pdfDataUri: z.string().describe("O arquivo PGR em formato PDF codificado em Base64."),
  fileName: z.string().optional(),
});
export type PgrAnalysisInput = z.infer<typeof PgrAnalysisInputSchema>;

const PgrAnalysisOutputSchema = z.object({
  companyInfo: z.object({
    name: z.string().describe("Nome da empresa identificada."),
    unit: z.string().describe("Unidade ou filial."),
    validity: z.string().describe("Vigência do documento."),
  }),
  identifiedRisks: z.array(
    z.object({
      category: z.string().describe("Físico, Químico, Biológico, Ergonômico ou Acidente."),
      hazard: z.string().describe("O perigo/risco identificado."),
      source: z.string().describe("Fonte geradora."),
    })
  ),
  actionPlan: z.array(
    z.object({
      description: z.string().describe("Ação recomendada."),
      priority: z.enum(["Alta", "Média", "Baixa"]),
      deadline: z.string().describe("Prazo sugerido."),
    })
  ),
  aiInsight: z.string().describe("Resumo estratégico para o gestor."),
});
export type PgrAnalysisOutput = z.infer<typeof PgrAnalysisOutputSchema>;

export async function analyzePgrPdf(input: PgrAnalysisInput): Promise<PgrAnalysisOutput> {
  return pgrAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: "pgrAnalysisPrompt",
  input: { schema: PgrAnalysisInputSchema },
  output: { schema: PgrAnalysisOutputSchema },
  prompt: `Você é a NAI, especialista em Engenharia de Segurança do Trabalho da Nextcon.
Sua tarefa é analisar o documento PGR (Programa de Gerenciamento de Riscos) em anexo.

INSTRUÇÕES:
1. Extraia os dados cadastrais da empresa e a vigência.
2. Identifique os principais riscos ocupacionais citados no inventário de riscos.
3. Liste as ações corretivas e preventivas do Plano de Ação.
4. Gere um 'aiInsight' curto e impactante para o dono da empresa, destacando o maior risco e a ação mais urgente.

Documento: {{media url=pdfDataUri contentType="application/pdf"}}`,
});

const pgrAnalysisFlow = ai.defineFlow(
  {
    name: "pgrAnalysisFlow",
    inputSchema: PgrAnalysisInputSchema,
    outputSchema: PgrAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu ler este PDF corretamente.");
    return output;
  }
);
