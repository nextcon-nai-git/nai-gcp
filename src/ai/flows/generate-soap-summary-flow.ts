"use server";
/**
 * @fileOverview NAI Medical Intel - Gerador de Resumo Clínico SOAP.
 * Analisa a transcrição da teleconsulta e estrutura o prontuário automaticamente.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const SOAPSummaryInputSchema = z.object({
  transcript: z.string().describe("A transcrição completa da consulta médica."),
  patientHistory: z.string().optional().describe("Histórico prévio de alergias e medicamentos."),
});

const SOAPSummaryOutputSchema = z.object({
  subjective: z.string().describe("Sintomas, queixas e relatos do paciente."),
  objective: z.string().describe("Sinais vitais mencionados e observações clínicas do médico."),
  assessment: z.string().describe("Diagnóstico presumido ou definitivo e raciocínio clínico."),
  plan: z.string().describe("Conduta, prescrições, exames solicitados e orientações."),
  cid10: z
    .array(
      z.object({
        code: z.string(),
        description: z.string(),
      })
    )
    .describe("Sugestão de códigos CID-10 baseados na conversa."),
  criticalAlerts: z
    .array(z.string())
    .describe("Alertas de interações medicamentosas ou urgências detectadas."),
});

export type SOAPSummaryOutput = z.infer<typeof SOAPSummaryOutputSchema>;

export async function generateSoapSummary(
  input: z.infer<typeof SOAPSummaryInputSchema>
): Promise<SOAPSummaryOutput> {
  const { output } = await soapPrompt(input);
  if (!output) throw new Error("A NAI não conseguiu processar o resumo SOAP.");
  return output;
}

const soapPrompt = ai.definePrompt({
  name: "generateSoapSummaryPrompt",
  input: { schema: SOAPSummaryInputSchema },
  output: { schema: SOAPSummaryOutputSchema },
  prompt: `Você é a NAI, assistente médica de elite especializada em auditoria e prontuário digital.
Sua tarefa é ler a transcrição de uma teleconsulta e gerar o resumo no formato SOAP.

HISTÓRICO DO PACIENTE:
{{{patientHistory}}}

TRANSCRIÇÃO:
"""
{{{transcript}}}
"""

INSTRUÇÕES:
1. Subjective: Foque na queixa principal e história da doença atual.
2. Objective: Extraia qualquer dado de telemetria ou exame físico visual relatado.
3. Assessment: Use lógica clínica para o diagnóstico.
4. Plan: Liste medicamentos e doses claramente.
5. CID-10: Identifique os códigos mais precisos.
6. ALERTA: Cruze o que foi falado na consulta com o HISTÓRICO. Se o médico prescreveu algo que o paciente tem ALERGIA, liste um alerta crítico.`,
});

ai.defineFlow(
  {
    name: "generateSoapSummaryFlow",
    inputSchema: SOAPSummaryInputSchema,
    outputSchema: SOAPSummaryOutputSchema,
  },
  async (input) => {
    return generateSoapSummary(input);
  }
);
