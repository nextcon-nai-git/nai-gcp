"use server";
/**
 * @fileOverview Gera planos de mitigação de riscos usando IA generativa com base nos riscos identificados e no ambiente.
 *
 * - riskMitigationPlanGenerator - Função que gera um plano de mitigação de riscos.
 * - RiskMitigationPlanInput - Tipo de entrada para a função.
 * - RiskMitigationPlanOutput - Tipo de retorno da função.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const RiskMitigationPlanInputSchema = z.object({
  identifiedRisks: z.string().describe("Uma descrição detalhada dos riscos identificados."),
  environment: z
    .string()
    .describe("Uma descrição do ambiente de trabalho onde os riscos estão presentes."),
});
export type RiskMitigationPlanInput = z.infer<typeof RiskMitigationPlanInputSchema>;

const RiskMitigationPlanOutputSchema = z.object({
  mitigationPlan: z
    .string()
    .describe(
      "Um plano abrangente de mitigação de riscos baseado em melhores práticas e normas brasileiras (NRs)."
    ),
});
export type RiskMitigationPlanOutput = z.infer<typeof RiskMitigationPlanOutputSchema>;

export async function riskMitigationPlanGenerator(
  input: RiskMitigationPlanInput
): Promise<RiskMitigationPlanOutput> {
  return riskMitigationPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: "riskMitigationPlanPrompt",
  input: { schema: RiskMitigationPlanInputSchema },
  output: { schema: RiskMitigationPlanOutputSchema },
  prompt: `Você é um técnico ou engenheiro de segurança do trabalho especialista. Gere um plano de mitigação de riscos seguindo as melhores práticas e as Normas Regulamentadoras (NRs) do Brasil.

Riscos Identificados: {{{identifiedRisks}}}
Ambiente de Trabalho: {{{environment}}}

Plano de Mitigação (inclua medidas administrativas, de engenharia e EPIs se necessário):`,
});

const riskMitigationPlanFlow = ai.defineFlow(
  {
    name: "riskMitigationPlanFlow",
    inputSchema: RiskMitigationPlanInputSchema,
    outputSchema: RiskMitigationPlanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
