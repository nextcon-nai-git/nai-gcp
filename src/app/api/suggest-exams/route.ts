import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v3";
import { suggestExams } from "@/ai/flows/suggest-exams-flow";
import { requireAuth, extractBearerToken } from "@/lib/auth/require-auth";
import { AuthError, forbidden, handleAuthError } from "@/lib/auth/errors";
import { limitedBytes } from "@/lib/http/private-api";

const inputSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  companyRisks: z.array(z.string().trim().min(1).max(500)).min(1).max(50),
  age: z.number().int().min(14).max(100),
});
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL"].includes(user.role))
      throw forbidden();
    // Bound actual UTF-8 bytes even for a streamed request without Content-Length.
    // Preserve the existing character limit and valid multibyte clinical text.
    const raw = (await limitedBytes(request, 120000)).toString("utf8");
    if (raw.length > 30000)
      return NextResponse.json({ error: "Entrada muito extensa." }, { status: 413 });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Informe cargo, riscos e idade válidos." },
        { status: 400 }
      );
    const result = await suggestExams({
      ...parsed.data,
      idToken: extractBearerToken(request) || "",
    });
    return NextResponse.json(
      { sucesso: true, recommendedExams: result.recommendedExams, requiresMedicalReview: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { error: "Não foi possível gerar a sugestão. Tente novamente." },
      { status: 503 }
    );
  }
}
