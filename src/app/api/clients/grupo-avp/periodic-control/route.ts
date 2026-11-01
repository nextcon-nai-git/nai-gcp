import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { readAvpPeriodicSnapshot } from "@/services/avp-periodic-sync";
import { adminDb } from "@/lib/firebase-admin";
import { projectAvpWorkflowProgress } from "@/lib/avp-workflow-progress";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireAvpAccess(user);
    if (!canAccessAvpEvidence(user))
      throw new AuthError("Controle disponível à equipe interna da operação AVP.", 403);
    const [snapshot, cases] = await Promise.all([
      readAvpPeriodicSnapshot(req.nextUrl.searchParams.get("force") === "1"),
      adminDb
        .collection("webhook_deliveries")
        .doc("grupo-avp-workflow")
        .collection("cases")
        .limit(10001)
        .get(),
    ]);
    if (cases.size > 10000)
      throw new AuthError("Esteira excede o limite de consulta. Contate o suporte.", 503);
    return NextResponse.json(
      {
        ...snapshot,
        people: projectAvpWorkflowProgress(
          snapshot.people,
          cases.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        ),
      },
      {
        headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
      }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      const response = handleAuthError(error);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    return NextResponse.json(
      {
        error:
          "Não foi possível consultar a campanha e a rede AVP. Tente novamente; os dados da fonte foram preservados.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
