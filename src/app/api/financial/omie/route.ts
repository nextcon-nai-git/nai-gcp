import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { connectOmie, disconnectOmie, listOmie, omieStatus } from "@/services/omie-financial";
import { OmieUpstreamError } from "@/lib/financial/omie-errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
function failure(e: unknown) {
  return NextResponse.json(
    {
      ...(e instanceof OmieUpstreamError ? { code: e.code, retryAfter: e.retryAfter } : {}),
      error:
        e instanceof AuthError
          ? e.message
          : "Não foi possível acessar a integração Omie. Tente novamente.",
    },
    {
      status: e instanceof AuthError ? e.status : 503,
      headers: {
        ...headers,
        ...(e instanceof OmieUpstreamError && e.retryAfter
          ? { "Retry-After": String(e.retryAfter) }
          : {}),
      },
    }
  );
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const p = request.nextUrl.searchParams;
    return NextResponse.json(
      p.get("view") === "titles"
        ? await listOmie(user, Object.fromEntries(p))
        : await omieStatus(user),
      { headers }
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    const body = await request.text();
    if (body.length > 2048) throw badRequest("Solicitação muito grande.");
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw badRequest("Dados inválidos.");
    }
    return NextResponse.json(await connectOmie(user, data), { headers });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    return NextResponse.json(await disconnectOmie(await requireAuth(request)), { headers });
  } catch (e) {
    return failure(e);
  }
}
