import { getAllowedAgentsForUser } from "@/lib/agent-access-control";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { limitedBytes, privateHeaders } from "@/lib/http/private-api";
import { aiFailureCode } from "@/lib/ai-failure";
import { NextRequest, NextResponse } from "next/server";
import { processSesmtAgentRequest, AgentRole } from "@/ai/flows/sesmt-agents-flow";
import { z } from "zod/v3";

export const dynamic = "force-dynamic";
const headers = privateHeaders;
const input = z.object({
  agentRole: z.string().max(80),
  userPrompt: z.string().trim().min(1).max(20000),
  companyContext: z
    .object({
      companyName: z.string().max(500).optional(),
      industrySector: z.string().max(500).optional(),
      employeeCount: z.number().finite().int().nonnegative().optional(),
      specificRisk: z.string().max(10000).optional(),
    })
    .optional(),
});
const validRoles = [
  "engenheiro_seguranca",
  "tecnico_seguranca",
  "enfermeiro_trabalho",
  "ergonomista",
  "medico_trabalho",
] as const satisfies readonly AgentRole[];
function isSupportedAgentRole(value: string): value is (typeof validRoles)[number] {
  return validRoles.some((role) => role === value);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const bytes = await limitedBytes(req, 256 * 1024);
    let body: unknown;
    try {
      body = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw badRequest("JSON inválido.");
    }
    const parsed = input.safeParse(body);
    if (!parsed.success) throw badRequest("Informe agente, pergunta e contexto válidos.");
    const { agentRole, userPrompt, companyContext } = parsed.data;

    if (!isSupportedAgentRole(agentRole)) {
      return NextResponse.json(
        { error: `Agente inválido. Opções válidas: ${validRoles.join(", ")}` },
        { status: 400, headers }
      );
    }

    if (!getAllowedAgentsForUser({ userRole: user.role }).allowedRoles.includes(agentRole))
      return NextResponse.json({ error: "Agente não autorizado." }, { status: 403, headers });

    const result = await processSesmtAgentRequest({
      agentRole,
      userPrompt,
      companyContext,
    });

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        agent: result,
      },
      { headers }
    );
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: err.message }, { status: err.status, headers });
    console.error("[API AI Agents Error]", aiFailureCode(err));
    return NextResponse.json(
      { error: "Não foi possível concluir a consulta do agente de IA. Tente novamente." },
      { status: 500, headers }
    );
  }
}
