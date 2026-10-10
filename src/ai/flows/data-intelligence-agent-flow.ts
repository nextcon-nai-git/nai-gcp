"use server";
import { requireAiAction, FINANCIAL_AI_ROLES } from "@/lib/auth/ai-action";
/**
 * @fileOverview NAI Data Intelligence Agent - Especialista em OCR e Visão Computacional.
 * Realiza extração de entidades de documentos e análise de riscos em fotos de incidentes.
 *
 * - processDataIntelligence - Função master para processamento multimodal.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const DataIntelligenceInputSchema = z.object({
  mediaDataUri: z.string().describe("A imagem ou PDF codificado em Base64."),
  contextType: z
    .enum(["DOCUMENT", "FIELD_PHOTO", "INCIDENT"])
    .describe("O tipo de contexto para análise."),
});
export type DataIntelligenceInput = z.infer<typeof DataIntelligenceInputSchema>;

const DataIntelligenceOutputSchema = z.object({
  classification: z
    .string()
    .describe("Tipo detectado (ex: ASO, EPI_Check, Risco_Ambiental, Incidente_NearMiss)."),
  jsonPayload: z.any().describe("Payload estruturado com os dados extraídos."),
  aiConfidence: z.number().min(0).max(100),
  criticalAlert: z.string().optional().describe("Alerta imediato se detectado risco grave."),
});
export type DataIntelligenceOutput = z.infer<typeof DataIntelligenceOutputSchema>;

export async function processDataIntelligence(
  input: DataIntelligenceInput,
  idToken?: string
): Promise<DataIntelligenceOutput> {
  await requireAiAction(idToken, FINANCIAL_AI_ROLES, [input]);

  return dataIntelligenceFlow(input);
}

const prompt = ai.definePrompt({
  name: "dataIntelligencePrompt",
  input: { schema: DataIntelligenceInputSchema },
  output: { schema: DataIntelligenceOutputSchema },
  prompt: `Você é o Agente Analista de Dados da Nextcon, especialista em OCR avançado e SST.
Analise a mídia em anexo baseando-se no contexto: {{{contextType}}}.

SE FOR 'INCIDENT':
1. Identifique o tipo de perigo na foto (ex: empilhadeira em local indevido, falta de guarda-corpo).
2. Extraia a gravidade visual do incidente (BAIXO, MÉDIO, ALTO).
3. Retorne no 'jsonPayload' um objeto com 'hazard_type', 'visual_severity', 'detected_objects'.

SE FOR 'DOCUMENT':
1. Extraia: Nome do Médico, CRM, Data do Exame, Tipo de ASO e Resultado (Apto/Inapto).
2. Retorne os dados no 'jsonPayload' com chaves como doctor_name, crm, exam_date, result.

SE FOR 'FIELD_PHOTO':
1. Identifique anomalias de segurança (fios expostos, falta de EPI, ausência de proteção coletiva).
2. Se encontrar algo grave, preencha o 'criticalAlert'.
3. Retorne no 'jsonPayload' uma lista de 'findings' com descrição e gravidade.

REGRAS:
- Sua saída DEVE ser estritamente o JSON definido.
- normalize nomes para MAIÚSCULAS.

MÍDIA: {{media url=mediaDataUri}}`,
});

const dataIntelligenceFlow = ai.defineFlow(
  {
    name: "dataIntelligenceFlow",
    inputSchema: DataIntelligenceInputSchema,
    outputSchema: DataIntelligenceOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (!output) throw new Error("A NAI não conseguiu processar os dados da mídia.");
      return output;
    } catch (error: any) {
      console.error("Genkit Flow Error:", error);
      if (error.message?.includes("API key not valid")) {
        throw new Error("A chave de API Gemini (Genkit) expirou ou é inválida para este projeto.");
      }
      throw error;
    }
  }
);
