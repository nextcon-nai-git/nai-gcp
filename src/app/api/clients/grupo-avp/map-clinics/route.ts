import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { readAvpMapClinicSource } from "@/services/avp-map-clinics";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireAvpAccess(user);
    if (!canAccessAvpEvidence(user))
      throw new AuthError("Custos disponíveis à equipe interna da operação AVP.", 403);
    return NextResponse.json(await readAvpMapClinicSource(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const response = handleAuthError(error);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    return NextResponse.json(
      {
        error:
          "Não foi possível atualizar as clínicas do mapa. Tente novamente.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
