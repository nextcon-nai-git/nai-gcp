import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { listOmieDre } from "@/services/omie-financial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json(
      await listOmieDre(user, Object.fromEntries(request.nextUrl.searchParams)),
      { headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AuthError ? error.message : "Não foi possível consultar a DRE no Omie.",
      },
      { status: error instanceof AuthError ? error.status : 503, headers }
    );
  }
}
