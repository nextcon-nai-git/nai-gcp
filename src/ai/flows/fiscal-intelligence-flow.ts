"use server";
/**
 * @fileOverview NAI Fiscal Intelligence - Analisador de cenários tributários 2026.
 *
 * - analyzeFiscalScenario - Analisa o impacto de IBS e CBS em contratos de SST.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const FiscalInputSchema = z.object({
  companySegment: z.string().describe("Segmento da empresa (ex: Serviços de SST)."),
  location: z.string().describe("Localização municipal e estadual."),
  monthlyRevenue: z.number().describe("Faturamento mensal médio para cálculo de impacto."),
});
export type FiscalInput = z.infer<typeof FiscalInputSchema>;

const FiscalOutputSchema = z.object({
  analysis: z.string().describe("Análise técnica do cenário fiscal."),
  suggestedRates: z.object({
    ibs: z.number().describe("Alíquota sugerida de IBS (Estadual/Municipal)."),
    cbs: z.number().describe("Alíquota sugerida de CBS (Federal)."),
    iss: z.number().describe("Alíquota residual de ISS, se aplicável."),
  }),
  taxEfficiencyTips: z.array(z.string()).describe("Dicas para otimização fiscal na transição."),
});
export type FiscalOutput = z.infer<typeof FiscalOutputSchema>;

export async function analyzeFiscalScenario(input: FiscalInput): Promise<FiscalOutput> {
  return fiscalFlow(input);
}

const prompt = ai.definePrompt({
  name: "fiscalIntelligencePrompt",
  input: { schema: FiscalInputSchema },
  output: { schema: FiscalOutputSchema },
  prompt: `Você é a NAI, consultora tributária sênior da NextCon especializada na Reforma Tributária Brasileira de 2026.
Analise o cenário fiscal para uma empresa do segmento "{{{companySegment}}}" localizada em "{{{location}}}".

INSTRUÇÕES:
1. Considere o período de transição de 2026 (Produção Restrita).
2. O IBS deve ser calculado com a alíquota de teste de 0,1% e a CBS com 0,9%.
3. Avalie como o ISS municipal interage com os novos tributos no setor de serviços.
4. No campo 'analysis', forneça um resumo executivo para o dono da empresa.
5. No campo 'taxEfficiencyTips', sugira formas de organizar o faturamento para minimizar o impacto do IVA dual.

Faturamento Mensal Estimado: R$ {{{monthlyRevenue}}}`,
});

const fiscalFlow = ai.defineFlow(
  {
    name: "fiscalIntelligenceFlow",
    inputSchema: FiscalInputSchema,
    outputSchema: FiscalOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("A NAI não conseguiu processar o cenário fiscal agora.");
    return output;
  }
);
