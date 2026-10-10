import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { readBalance, readBalancePdf } from "@/services/financial-balance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await requireAuth(request);
    const { id } = await context.params;
    if (request.nextUrl.searchParams.get("source") === "1") {
      const pdf = await readBalancePdf(user, id);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="balanco-patrimonial.pdf"',
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return NextResponse.json(await readBalance(user, id), { headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof AuthError ? e.message : "Não foi possível carregar o balanço." },
      { status: e instanceof AuthError ? e.status : 503, headers }
    );
  }
}
