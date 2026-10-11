import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, forbidden, handleAuthError } from "@/lib/auth/errors";
import { getPgrAi } from "@/services/pgr-ai-provider";
import { aiFailureCode, aiFailureMessage } from "@/lib/ai-failure";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "SUPER_ADMIN")
      throw forbidden("Diagnóstico disponível para a administração.");
    const runtime = getPgrAi();
    if (!runtime)
      return NextResponse.json({
        ok: false,
        code: "NOT_CONFIGURED",
        message: "Provedor de IA não configurado.",
      });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await runtime.generate({
        prompt: "Responda somente OK. Teste de disponibilidade, sem dados pessoais.",
        config: { maxOutputTokens: 128 },
        abortSignal: controller.signal,
      });
      return NextResponse.json({
        ok: !!result.text?.trim(),
        code: "RESPONDED",
        message:
          "O provedor respondeu ao teste de disponibilidade. Isto não certifica a análise documental.",
      });
    } catch (error) {
      const code = aiFailureCode(error);
      return NextResponse.json({ ok: false, code, message: aiFailureMessage(code) });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { ok: false, code: "UNAVAILABLE", message: "Diagnóstico indisponível." },
      { status: 503 }
    );
  }
}
