import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { getExecutiveDashboard } from "@/services/executive-dashboard";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const dashboard = await getExecutiveDashboard(
      user,
      request.nextUrl.searchParams.get("company") || "all"
    );
    return NextResponse.json(dashboard, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    console.error(
      "Dashboard source read failed",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json(
      { error: "Não foi possível consultar os dados. Tente novamente." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
