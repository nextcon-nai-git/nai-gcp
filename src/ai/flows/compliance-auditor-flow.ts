"use server";
import { requireAiAction, DOCUMENT_AI_ROLES } from "@/lib/auth/ai-action";
/**
 * @fileOverview NAI Compliance Auditor - Especialista em Legislação Trabalhista (NRs) e eSocial.
 *
 * - runComplianceAudit - Avalia riscos legais e gera planos de ação 5W2H.
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";

const ComplianceInputSchema = z.object({
  analysisPayload: z.any().describe("O payload JSON gerado pelo Agente Analista de Dados."),
  context: z.string().describe("Contexto da auditoria (ex: Quase-Acidente, Inventário PGR)."),
});
export type ComplianceInput = z.infer<typeof ComplianceInputSchema>;

const ComplianceOutputSchema = z.object({
  legalRiskLevel: z.enum(["BAIXO", "MÉDIO", "ALTO", "CRÍTICO"]),
  applicableNrs: z.array(z.string()).describe("Lista de NRs afetadas."),
  findings: z.array(
    z.object({
      description: z.string(),
      legalBasis: z.string().describe("Item específico da NR ou legislação."),
      consequence: z.string().describe("Impacto jurídico ou multa eSocial."),
    })
  ),
  actionPlan5W2H: z.array(
    z.object({
      what: z.string().describe("O que deve ser feito."),
      why: z.string().describe("Justificativa legal."),
      where: z.string().describe("Local da aplicação."),
      who: z.string().describe("Responsável técnico."),
      when: z.string().describe("Prazo sugerido."),
      how: z.string().describe("Método de execução."),
      howMuch: z.string().describe("Estimativa de custo/recurso."),
    })
  ),
  preventiveAlerts: z.array(z.string()).describe("Alertas de vencimento ou prazos governamentais."),
});
export type ComplianceOutput = z.infer<typeof ComplianceOutputSchema>;

export async function runComplianceAudit(
  input: ComplianceInput,
  idToken?: string
): Promise<ComplianceOutput> {
  await requireAiAction(idToken, DOCUMENT_AI_ROLES, [input]);

  return complianceAuditorFlow(input);
}

const prompt = ai.definePrompt({
  name: "complianceAuditorPrompt",
  input: { schema: ComplianceInputSchema },
  output: { schema: ComplianceOutputSchema },
  prompt: `Você é o Auditor de Compliance Sênior da Nextcon, autoridade máxima em NRs e eSocial.
Analise o payload JSON abaixo referente a um(a) {{{context}}}.

PAYLOAD:
{{json analysisPayload}}

SUA MISSÃO:
1. Identifique todas as violações às Normas Regulamentadoras (NR-01 a NR-38).
2. Determine o nível de risco legal (CRÍTICO se houver risco de vida ou multas pesadas).
3. Para cada falha, gere um plano de ação no formato rigoroso 5W2H.
4. Cite os itens específicos das NRs para embasar o relatório.
5. Se for um "Quase-Acidente", foque na prevenção de reincidência e retroalimentação do PGR.

REGRAS:
- Seja extremamente técnico e objetivo.
- Use o tom de um perito do Ministério do Trabalho.
- Garanta que o plano 5W2H seja prático e exequível.`,
});

const complianceAuditorFlow = ai.defineFlow(
  {
    name: "complianceAuditorFlow",
    inputSchema: ComplianceInputSchema,
    outputSchema: ComplianceOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output)
      throw new Error("O Auditor NAI não conseguiu processar a conformidade deste registro.");
    return output;
  }
);
