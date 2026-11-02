import { NextRequest, NextResponse } from "next/server";
import { auth } from "googleapis/build/src/apis/oauth2";
import { adminDb } from "@/lib/firebase-admin";
import { parseClaims } from "@/lib/auth/claims";
import { AuthError } from "@/lib/auth/errors";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { requireAsoFlowAccess } from "@/services/aso-flow";
import { syncAsoFlowMail } from "@/services/aso-flow-mail";
import { monitorOperation } from "@/services/operational-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new AuthError("Agendador não autorizado.", 401);
    const email = process.env.ASO_MAIL_SYNC_INVOKER_EMAIL,
      audience = process.env.ASO_MAIL_SYNC_AUDIENCE,
      operator = process.env.ASO_MAIL_OPERATOR_UID;
    if (!email || !audience || !operator || operator.includes("/") || operator.length > 128)
      throw new AuthError("Monitor de e-mail ainda não configurado no servidor.", 503);
    try {
      const ticket = await new auth.OAuth2().verifyIdToken({ idToken: token, audience });
      const claims = ticket.getPayload();
      if (claims?.email !== email || claims.email_verified !== true)
        throw new Error("invalid invoker");
    } catch {
      throw new AuthError("Agendador não autorizado.", 401);
    }
    // No synthetic privileged user: recheck the configured operator's current permissions.
    const profile = (await adminDb.collection("users").doc(operator).get()).data();
    if (!profile || profile.accessEnabled === false)
      throw new AuthError("Operador do monitor indisponível.", 403);
    const claims = parseClaims(profile);
    const user = {
      uid: operator,
      email: typeof profile.email === "string" ? profile.email : "",
      role: claims.role,
      tenantId: claims.tenantId || null,
      permissions: claims.permissions || [],
      servedCompanies: claims.servedCompanies || [],
    };
    requireAsoFlowAccess(user);
    const result = await monitorOperation("aso-mail", () => syncAsoFlowMail(user));
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
