import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { readClinicalAsoOriginal } from "@/services/clinical-aso-completion";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const input = z
      .object({
        companyId: z.string().min(1).max(128),
        cardId: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(Object.fromEntries(request.nextUrl.searchParams));
    const original = await readClinicalAsoOriginal(user, input);
    return new NextResponse(original.bytes, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline; filename=aso-original",
        "Content-Type": original.mime,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Confira o documento e a empresa selecionados." },
        { status: 400 }
      );
    return NextResponse.json(
      { error: "Não foi possível carregar o original do ASO." },
      { status: 503 }
    );
  }
}
