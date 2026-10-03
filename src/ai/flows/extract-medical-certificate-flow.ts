"use server";
/**
 * @fileOverview Fluxo NAI para extração de dados estruturados de atestados médicos.
 *
 * - extractMedicalCertificate - Função que analisa o texto e extrai entidades para o eSocial.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const ExtractCertificateInputSchema = z
  .string()
  .describe("O texto bruto extraído do atestado médico (via OCR ou cópia).");

const ExtractCertificateOutputSchema = z.object({
  nomePaciente: z
    .string()
    .describe("Nome completo do paciente localizado no documento em CAIXA ALTA."),
  cid: z.string().optional().describe("Código CID-10 identificado (Ex: M54.5)."),
  diasAfastamento: z.number().describe("Quantidade de dias de repouso/afastamento recomendados."),
  dataAtestado: z.string().describe("Data de emissão do atestado no formato ISO (YYYY-MM-DD)."),
});

export type ExtractCertificateOutput = z.infer<typeof ExtractCertificateOutputSchema>;

/**
 * Função wrapper para chamar o fluxo de extração de atestados.
 */
export async function extractMedicalCertificate(
  rawText: string
): Promise<ExtractCertificateOutput> {
  return extractMedicalCertificateFlow(rawText);
}

/**
 * Definição do fluxo Genkit para processamento de atestados médicos.
 */
const extractMedicalCertificateFlow = ai.defineFlow(
  {
    name: "extractMedicalCertificateFlow",
    inputSchema: ExtractCertificateInputSchema,
    outputSchema: ExtractCertificateOutputSchema,
  },
  async (rawText) => {
    const { output } = await ai.generate({
      prompt: `Você é a NAI, a assistente de IA da NextCon especializada em auditoria de documentos médicos.
      Sua missão é ler o seguinte texto de um atestado médico e extrair os dados necessários para lançamento no eSocial.

      TEXTO DO ATESTADO:
      """
      ${rawText}
      """

      REGRAS:
      1. Normalize o Nome do Paciente para MAIÚSCULAS.
      2. Se o CID não estiver explícito, deixe o campo em branco (null).
      3. Extraia apenas o valor numérico dos dias de afastamento.
      4. Formate a data como YYYY-MM-DD.
      5. Seja extremamente preciso, este dado alimenta o firewall do governo.`,
      output: { schema: ExtractCertificateOutputSchema },
    });

    if (!output) throw new Error("A NAI não conseguiu interpretar os dados deste atestado.");
    return output;
  }
);
