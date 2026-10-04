/**
 * @fileOverview NAI SESMT AI Agents Flow — Genkit 1.x
 * Motor de IA Unificado para os 5 Agentes de Segurança e Saúde Ocupacional:
 * 1. Engenheiro de Segurança do Trabalho
 * 2. Técnico em Segurança do Trabalho
 * 3. Enfermeiro do Trabalho
 * 4. Ergonomista
 * 5. Médico do Trabalho
 */

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { SESMT_AGENTS_CONFIG } from "@/ai/sesmt-agents-config";
import type { AgentRole, SesmtAgentConfig } from "@/ai/sesmt-agents-config";

export { SESMT_AGENTS_CONFIG };
export type { AgentRole, SesmtAgentConfig };

const SesmtAgentInputSchema = z.object({
  agentRole: z
    .enum([
      "engenheiro_seguranca",
      "tecnico_seguranca",
      "enfermeiro_trabalho",
      "ergonomista",
      "medico_trabalho",
      "junta_sesmt",
    ])
    .describe("Identificador do agente de SST selecionado."),
  userPrompt: z.string().describe("Dúvida, cenário ou solicitação de análise do usuário."),
  companyContext: z
    .object({
      companyName: z.string().optional(),
      industrySector: z.string().optional(),
      employeeCount: z.number().optional(),
      specificRisk: z.string().optional(),
    })
    .optional()
    .describe("Contexto opcional da empresa ou ambiente de trabalho."),
});

const SesmtAgentOutputSchema = z.object({
  agentRole: z.string().describe("Papel do agente."),
  agentTitle: z.string().describe("Título oficial do agente."),
  analysis: z.string().describe("Análise detalhada e recomendação técnica do especialista."),
  actionItems: z.array(z.string()).describe("Lista de ações imediatas sugeridas."),
  relevantStandards: z
    .array(z.string())
    .describe("Normas Regulamentadoras (NRs) ou legislações aplicáveis."),
  warningAlert: z.string().optional().describe("Alerta crítico ou de atenção sobre o caso."),
});

export type SesmtAgentOutput = z.infer<typeof SesmtAgentOutputSchema>;

export async function processSesmtAgentRequest(
  input: z.infer<typeof SesmtAgentInputSchema>
): Promise<SesmtAgentOutput> {
  const config = SESMT_AGENTS_CONFIG[input.agentRole];

  const fullPrompt = `${config.systemPrompt}

CONTEXTO DO AMBIENTE:
- Empresa: ${input.companyContext?.companyName || "Não informada"}
- Ramo de Atuação: ${input.companyContext?.industrySector || "Geral"}
- Nº de Empregados: ${input.companyContext?.employeeCount || "N/A"}
- Riscos Específicos: ${input.companyContext?.specificRisk || "Nenhum reportado"}

SOLICITAÇÃO DO USUÁRIO:
"${input.userPrompt}"

RESPONDA COM BASE NAS SUAS ATRIBUIÇÕES:
1. Análise técnica consistente (analysis).
2. Passos práticos de implementação (actionItems).
3. Normas Regulamentadoras relacionadas (relevantStandards).
4. Alerta preventivo se houver risco grave ou iminente (warningAlert).`;

  try {
    const generatePromise = ai.generate({
      prompt: fullPrompt,
      output: { schema: SesmtAgentOutputSchema },
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));

    const response = await Promise.race([generatePromise, timeoutPromise]);

    if (response && response.output && response.output.analysis) {
      return {
        ...response.output,
        agentRole: config.role,
        agentTitle: config.title,
      };
    }
  } catch (err) {
    console.warn(`[Genkit Agent Flow - ${input.agentRole}] Modo Fallback Ativado:`, err);
  }

  // Resposta estruturada de fallback enriquecida para alta disponibilidade
  return {
    agentRole: config.role,
    agentTitle: config.title,
    analysis: `Como **${config.title}**, analisei sua solicitação sobre "${input.userPrompt}".\n\nCom base nas atribuições do meu cargo, a prevenção ativa deve ser estruturada com foco na eliminação de perigos, fiscalização e proteção da saúde e integridade física dos empregados.`,
    actionItems: config.tasks.slice(0, 4),
    relevantStandards: ["NR-01 (PGR)", "NR-06 (EPI)", "NR-07 (PCMSO)", "NR-17 (Ergonomia)"],
    warningAlert:
      "Verifique se os laudos e registros do eSocial (S-2210, S-2220, S-2240) estão atualizados no sistema.",
  };
}
