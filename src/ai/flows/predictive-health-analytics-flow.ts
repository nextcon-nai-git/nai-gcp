/**
 * NextCon Intelligence (NAI) - Genkit AI Predictive Health Analytics Flow
 * Analisa histórico de CIDs, Atestados e Riscos do PGR para prever riscos de absenteísmo e lesões.
 */

import { ai } from "../genkit";
import { z } from "zod";

export const PredictiveHealthInputSchema = z.object({
  companyId: z.string(),
  department: z.string(),
  totalEmployees: z.number(),
  absenteeismDaysLastQuarter: z.number(),
  topCidCodes: z.array(z.string()),
  environmentalRisks: z.array(z.string()),
});

export const PredictiveHealthOutputSchema = z.object({
  riskLevel: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
  predictedAbsenteeismIncreasePercentage: z.number(),
  primaryRiskFactor: z.string(),
  preventiveRecommendations: z.array(
    z.object({
      category: z.string(),
      action: z.string(),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      estimatedImpactDaysSaved: z.number(),
    })
  ),
});

export const predictiveHealthAnalyticsFlow = ai.defineFlow(
  {
    name: "predictiveHealthAnalyticsFlow",
    inputSchema: PredictiveHealthInputSchema,
    outputSchema: PredictiveHealthOutputSchema,
  },
  async (input) => {
    const prompt = `
      Você é um especialista em Medicina do Trabalho e Epidemiologia Ocupacional.
      Avalie o seguinte cenário do setor "${input.department}" com ${input.totalEmployees} colaboradores:

      - Dias de afastamento no último trimestre: ${input.absenteeismDaysLastQuarter}
      - Principais CIDs registrados: ${input.topCidCodes.join(", ")}
      - Agentes e Riscos Ambientais do PGR: ${input.environmentalRisks.join(", ")}

      Calcule a projeção preditiva de risco de absenteísmo para o próximo trimestre, indicando o principal fator causador e ações preventivas práticas recomendadas para a Engenharia de Segurança e Medicina do Trabalho.
    `;

    const { output } = await ai.generate({
      prompt,
      output: { schema: PredictiveHealthOutputSchema },
    });

    if (!output) {
      throw new Error("Falha ao calcular análise preditiva de saúde.");
    }

    return output;
  }
);
