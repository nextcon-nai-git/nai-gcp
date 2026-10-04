"use server";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getAllowedAgentsForUser } from "@/lib/agent-access-control";

import {
  processSesmtAgentRequest,
  AgentRole,
  SesmtAgentOutput,
} from "@/ai/flows/sesmt-agents-flow";

export async function askSesmtAgentAction(
  agentRole: AgentRole,
  userPrompt: string,
  companyContext?: {
    companyName?: string;
    industrySector?: string;
    employeeCount?: number;
    specificRisk?: string;
  },
  token = ""
): Promise<{ success: boolean; data?: SesmtAgentOutput; error?: string }> {
  try {
    const user = await requireAuth(
      new NextRequest("https://nai.local", { headers: { authorization: `Bearer ${token}` } })
    );
    if (!getAllowedAgentsForUser({ userRole: user.role }).allowedRoles.includes(agentRole))
      return { success: false, error: "Agente não autorizado para seu perfil." };
    if (!userPrompt || userPrompt.trim().length === 0) {
      return { success: false, error: "Por favor, digite uma pergunta ou solicitação." };
    }

    const result = await processSesmtAgentRequest({
      agentRole,
      userPrompt,
      companyContext,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err: any) {
    console.error(`[SESMT Agent Action Error - ${agentRole}]`, err);
    return {
      success: false,
      error: err.message || "Ocorreu um erro ao consultar o Agente de IA de Segurança do Trabalho.",
    };
  }
}
