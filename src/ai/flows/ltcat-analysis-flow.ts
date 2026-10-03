"use server";
/**
 * @fileOverview NAI LTCAT Scanner - Analisador de laudos LTCAT (PDF).
 *
 * - analyzeLtcatPdf - Extrai dados de exposição e enquadramento previdenciário.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const LtcatAnalysisInputSchema = z.object({
  pdfDataUri: z.string().describe("O arquivo LTCAT em formato PDF codificado em Base64."),
  fileName: z.string().optional(),
});
export type LtcatAnalysisInput = z.infer<typeof LtcatAnalysisInputSchema>;

const LtcatAnalysisOutputSchema = z.object({
  companyInfo: z.object({
    name: z.string().describe("Nome da empresa."),
    cnpj: z.string().describe("CNPJ identificado."),
    date: z.string().describe("Data do laudo."),
  }),
  hazards: z.array(
    z.object({
      agent: z.string().describe("Agente nocivo (Ruído, Calor, Químico, etc)."),
      intensity: z.string().describe("Intensidade ou concentração medida."),
      limit: z.string().describe("Limite de tolerância NR-15."),
      specialRetirement: z.boolean().describe("Indica se há direito a aposentadoria especial."),
    })
  ),
  recommendations: z.array(z.string()).describe("Medidas de controle sugeridas."),
  aiInsight: z.string().describe("Resumo jurídico-previdenciário para o cliente."),
});
export type LtcatAnalysisOutput = z.infer<typeof LtcatAnalysisOutputSchema>;

export async function analyzeLtcatPdf(input: LtcatAnalysisInput): Promise<LtcatAnalysisOutput> {
  return ltcatAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: "ltcatAnalysisPrompt",
  input: { schema: LtcatAnalysisInputSchema },
  output: { schema: LtcatAnalysisOutputSchema },
  prompt: `Você é a NAI, especialista em Higiene Ocupacional e Direito Previdenciário.
Analise o LTCAT (Laudo Técnico das Condições Ambientais de Trabalho) em anexo.

INSTRUÇÕES:
1. Extraia os dados da empresa.
2. Identifique os agentes nocivos e suas respectivas medições.
3. Verifique se a exposição ultrapassa o limite de tolerância e se gera direito à Aposentadoria Especial (Enquadramento Decreto 3.048/99).
4. Gere um insight focado no custo tributário (GFIP/RAT) para a empresa.

Documento: {{media url=pdfDataUri contentType="application/pdf"}}`,
});

const ltcatAnalysisFlow = ai.defineFlow(
  {
    name: "ltcatAnalysisFlow",
    inputSchema: LtcatAnalysisInputSchema,
    outputSchema: LtcatAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu processar este LTCAT.");
    return output;
  }
);
