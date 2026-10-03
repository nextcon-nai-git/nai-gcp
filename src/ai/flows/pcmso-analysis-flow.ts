"use server";
/**
 * @fileOverview NAI PCMSO Scanner - Analisador de documentos PCMSO (PDF).
 *
 * - analyzePcmsoPdf - Extrai o cronograma de exames e protocolos médicos.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const PcmsoAnalysisInputSchema = z.object({
  pdfDataUri: z.string().describe("O arquivo PCMSO em formato PDF codificado em Base64."),
  fileName: z.string().optional(),
});
export type PcmsoAnalysisInput = z.infer<typeof PcmsoAnalysisInputSchema>;

const PcmsoAnalysisOutputSchema = z.object({
  companyInfo: z.object({
    name: z.string(),
    validity: z.string(),
    responsibleDoctor: z.string(),
  }),
  examProtocol: z.array(
    z.object({
      examName: z.string().describe("Nome do exame (ASO, Audiometria, etc)."),
      periodicity: z.string().describe("Periodicidade (Semestral, Anual, etc)."),
      targetGroup: z.string().describe("GHE ou Setor destinado."),
    })
  ),
  medicalGuidelines: z.array(z.string()).describe("Principais orientações médicas do documento."),
  aiInsight: z.string().describe("Resumo estratégico para o RH sobre o controle de saúde."),
});
export type PcmsoAnalysisOutput = z.infer<typeof PcmsoAnalysisOutputSchema>;

export async function analyzePcmsoPdf(input: PcmsoAnalysisInput): Promise<PcmsoAnalysisOutput> {
  return pcmsoAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: "pcmsoAnalysisPrompt",
  input: { schema: PcmsoAnalysisInputSchema },
  output: { schema: PcmsoAnalysisOutputSchema },
  prompt: `Você é a NAI, médica do trabalho virtual da Nextcon.
Analise o PCMSO (Programa de Controle Médico de Saúde Ocupacional) em anexo.

INSTRUÇÕES:
1. Identifique a empresa e o médico coordenador.
2. Liste todos os exames previstos no cronograma, sua periodicidade e para quais setores/GHEs se aplicam.
3. Extraia orientações críticas (como vacinação ou monitoramento biológico).
4. Gere um insight para o gestor focado em evitar exames vencidos.

Documento: {{media url=pdfDataUri contentType="application/pdf"}}`,
});

const pcmsoAnalysisFlow = ai.defineFlow(
  {
    name: "pcmsoAnalysisFlow",
    inputSchema: PcmsoAnalysisInputSchema,
    outputSchema: PcmsoAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu processar este PCMSO.");
    return output;
  }
);
