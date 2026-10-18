import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";

/** Compatibility response for the retired classifier. Document processing lives in NAI importa. */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    // Never read or forward the old payload: its caller had no working persistence flow.
    return NextResponse.json(
      {
        success: false,
        code: "ENDPOINT_RETIRED",
        error:
          "Este classificador foi substituído pelo NAI importa. Abra o módulo para analisar, revisar e salvar o documento. Nenhum arquivo foi processado ou salvo aqui.",
        destinationRoute: "/nai-importa",
      },
      { status: 410, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { success: false, error: "Não foi possível verificar o acesso. Tente novamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const GET = POST;
