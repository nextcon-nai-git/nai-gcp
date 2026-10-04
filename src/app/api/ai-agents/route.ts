import { getAllowedAgentsForUser } from "@/lib/agent-access-control";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { NextRequest, NextResponse } from "next/server";
import { processSesmtAgentRequest, AgentRole } from "@/ai/flows/sesmt-agents-flow";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const { agentRole, userPrompt, companyContext } = body;

    if (!agentRole || !userPrompt) {
      return NextResponse.json(
        { error: "Parâmetros 'agentRole' e 'userPrompt' são obrigatórios." },
        { status: 400 }
      );
    }

    const validRoles: AgentRole[] = [
      "engenheiro_seguranca",
      "tecnico_seguranca",
      "enfermeiro_trabalho",
      "ergonomista",
      "medico_trabalho",
    ];

    if (!validRoles.includes(agentRole as AgentRole)) {
      return NextResponse.json(
        { error: `Agente inválido. Opções válidas: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    if (!getAllowedAgentsForUser({ userRole: user.role }).allowedRoles.includes(agentRole))
      return NextResponse.json({ error: "Agente não autorizado." }, { status: 403 });

    const result = await processSesmtAgentRequest({
      agentRole: agentRole as AgentRole,
      userPrompt,
      companyContext,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      agent: result,
    });
  } catch (err: any) {
    if (err instanceof AuthError) return handleAuthError(err);
    console.error("[API AI Agents Error]", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao processar a consulta do Agente de IA." },
      { status: 500 }
    );
  }
}
