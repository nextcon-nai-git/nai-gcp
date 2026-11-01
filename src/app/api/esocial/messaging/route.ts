import { esocialFailure } from "@/services/esocial/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateHeaders } from "@/lib/http/private-api";
import { requireEsocialMessagingAccess } from "@/services/esocial/access";
import { getEsocialWorkspace, mutateEsocialMessage } from "@/services/esocial/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialMessagingAccess(user);
    const params = request.nextUrl.searchParams;
    const summary = params.get("summary");
    if (summary !== null && summary !== "true" && summary !== "false")
      throw badRequest("Consulta de resumo inválida.");
    const result = await getEsocialWorkspace(user, {
      companyId: params.get("companyId") || undefined,
      id: params.get("id") || undefined,
      asoCaseId: params.get("asoCaseId") || undefined,
      summary: summary === "true",
      cursor: params.get("cursor") || undefined,
    });
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (failure) {
    return esocialFailure(failure);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialMessagingAccess(user);
    const body = await limitedJson(request, 256 * 1024);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw badRequest("Informe os dados da operação.");
    return NextResponse.json(await mutateEsocialMessage(user, body), { headers: privateHeaders });
  } catch (failure) {
    return esocialFailure(failure);
  }
}
