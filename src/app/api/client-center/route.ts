import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { getClientCenter, createClientRequest } from "@/services/client-center";
import { limitedBytes } from "@/lib/http/private-api";
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
    // Keep the existing character limit while bounding the UTF-8 stream first.
    const text = (await limitedBytes(request, 48000)).toString("utf8");
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
