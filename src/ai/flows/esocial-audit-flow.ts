"use server";
/**
 * @fileOverview Analisador de conformidade eSocial (S-2240 vs S-2220) usando Gemini.
 *
 * - runEsocialAudit - Função que audita inconsistências entre riscos e exames.
 * - EsocialAuditInput - Entrada: Lista de riscos e exames encontrados.
 * - EsocialAuditOutput - Saída: Relatório de gaps e impacto jurídico.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";

const EsocialAuditInputSchema = z.object({
  riskList: z.array(z.string()).describe("Lista de perigos/riscos identificados no PGR."),
  examList: z.array(z.string()).describe("Lista de exames médicos realizados no PCMSO."),
  sector: z.string().describe("Setor ou GHE analisado."),
});
export type EsocialAuditInput = z.infer<typeof EsocialAuditInputSchema>;

const EsocialAuditOutputSchema = z.object({
  complianceScore: z.number().describe("Score de conformidade de 0 a 100."),
  criticalGaps: z
    .array(
      z.object({
        description: z.string(),
        legalImpact: z.string(),
        recommendation: z.string(),
      })
    )
    .describe("Lista de inconsistências críticas encontradas."),
  aiInsight: z.string().describe("Resumo estratégico da IA para o gestor."),
});
export type EsocialAuditOutput = z.infer<typeof EsocialAuditOutputSchema>;

const prompt = ai.definePrompt({
  name: "esocialAuditPrompt",
  input: { schema: EsocialAuditInputSchema },
  output: { schema: EsocialAuditOutputSchema },
  prompt: `Você é um auditor sênior de SST e eSocial da NEXTCON. Analise o cruzamento entre os Riscos do PGR e os Exames do PCMSO para o setor {{{sector}}}.

DADOS:
- Riscos Identificados: 
{{#each riskList}} 
- {{this}} 
{{/each}}

- Exames Encontrados: 
{{#each examList}} 
- {{this}} 
{{/each}}

INSTRUÇÕES:
1. Verifique se os riscos identificados (Ruído, Poeira, Fumos, etc) possuem os exames médicos correspondentes exigidos pela NR-07.
2. Se faltar um exame obrigatório para um risco específico, liste como um gap crítico.
3. Estipule o impacto jurídico baseado nas multas do eSocial.
4. Forneça um Insight Estratégico para o gestor de SST.
5. Calcule o Score de Compliance (0-100).`,
});

export async function runEsocialAudit(input: EsocialAuditInput): Promise<EsocialAuditOutput> {
  const { output } = await prompt(input);
  if (!output) {
    throw new Error("A IA não retornou um relatório válido.");
  }
  return output;
}

ai.defineFlow(
  {
    name: "esocialAuditFlow",
    inputSchema: EsocialAuditInputSchema,
    outputSchema: EsocialAuditOutputSchema,
  },
  async (input) => {
    return runEsocialAudit(input);
  }
);
