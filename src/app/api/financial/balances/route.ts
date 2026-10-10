import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { listBalances, saveBalance } from "@/services/financial-balance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof AuthError
          ? e.message
          : "Não foi possível acessar os balanços. Tente novamente.",
    },
    { status: e instanceof AuthError ? e.status : 503, headers }
  );
}
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      { balances: await listBalances(await requireAuth(request)) },
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
    if (Number(request.headers.get("content-length") || "0") > 11 * 1024 * 1024)
      throw badRequest("Limite de upload excedido.");
    const form = await request.formData();
    const source = form.get("source");
    if (!(source instanceof File) || source.size > 10 * 1024 * 1024)
      throw badRequest("Selecione um PDF de até 10 MB.");
    return NextResponse.json(
      await saveBalance(user, source.name, Buffer.from(await source.arrayBuffer())),
      { headers }
    );
  } catch (e) {
    return failure(e);
  }
}
