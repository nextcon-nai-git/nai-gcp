"use server";
/**
 * @fileOverview NAI Safety Copilot - Cérebro de análise de riscos.
 *
 * - analyzeSafetyContext: Analisa ambientes e sugere riscos eSocial.
 * - predictAccidentRisk: Calcula probabilidade de sinistro baseado em dados.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const SafetyCopilotInputSchema = z.object({
  environmentDescription: z.string().describe("Descrição detalhada do local de trabalho."),
  industrySegment: z.string().describe("Segmento da empresa (ex: Metalurgia, Hospitalar)."),
  absenteeismHistory: z.array(z.string()).optional().describe("Histórico de CIDs reportados."),
});

const SafetyCopilotOutputSchema = z.object({
  suggestedRiskIds: z
    .array(z.string())
    .describe("IDs do catálogo de riscos eSocial identificados."),
  accidentProbability: z.number().describe("Score de risco de 0 a 100."),
  mitigationStrategy: z.string().describe("Plano estratégico de contenção."),
  complianceInsight: z.string().describe("Análise de conformidade com as NRs 2026."),
});

export type SafetyCopilotOutput = z.infer<typeof SafetyCopilotOutputSchema>;

const prompt = ai.definePrompt({
  name: "safetyCopilotPrompt",
  input: { schema: SafetyCopilotInputSchema },
  output: { schema: SafetyCopilotOutputSchema },
  prompt: `Você é o Safety Copilot da NextCon Platform, um engenheiro de segurança sênior com foco em IA Preditiva.
  
CONTEXTO:
- Segmento: {{{industrySegment}}}
- Ambiente: {{{environmentDescription}}}
- Histórico de Doenças: {{#each absenteeismHistory}}{{this}}, {{/each}}

TAREFAS:
1. Mapeie os riscos ocupacionais (Físicos, Químicos, Biológicos, Ergonômicos ou de Acidente).
2. Estipule uma probabilidade de acidente (accidentProbability) baseada na periculosidade do ambiente citado.
3. Se houver histórico de absenteísmo, correlacione com os riscos ambientais.
4. Forneça uma 'mitigationStrategy' técnica focada em EPCs e Gestão.
5. Retorne os códigos prováveis do eSocial (Tabela 24).`,
});

export async function runSafetyCopilot(
  input: z.infer<typeof SafetyCopilotInputSchema>
): Promise<SafetyCopilotOutput> {
  const { output } = await prompt(input);
  if (!output) throw new Error("Falha na análise da IA");
  return output;
}

ai.defineFlow(
  {
    name: "safetyCopilotFlow",
    inputSchema: SafetyCopilotInputSchema,
    outputSchema: SafetyCopilotOutputSchema,
  },
  async (input) => {
    return runSafetyCopilot(input);
  }
);
