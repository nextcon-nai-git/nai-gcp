import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { getClientCenter, createClientRequest } from "@/services/client-center";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json(
    {
      error: error instanceof AuthError ? error.message : "Serviço indisponível. Tente novamente.",
    },
    { status: error instanceof AuthError ? error.status : 503, headers }
  );
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return NextResponse.json(
      await getClientCenter(user, request.nextUrl.searchParams.get("company") || "all"),
      { headers }
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const text = await request.text();
    if (text.length > 12000) throw new AuthError("Solicitação acima do limite.", 413);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new AuthError("Solicitação inválida.", 400);
    }
    return NextResponse.json(await createClientRequest(user, input), { status: 201, headers });
  } catch (error) {
    return failure(error);
  }
}
