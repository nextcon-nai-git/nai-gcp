import { NextRequest, NextResponse } from "next/server";
import { auth } from "googleapis/build/src/apis/oauth2";
import { AuthError } from "@/lib/auth/errors";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { syncEsocialMessages } from "@/services/esocial/messaging";
import { monitorOperation } from "@/services/operational-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new AuthError("Agendador não autorizado.", 401);
    const email = process.env.ESOCIAL_SYNC_INVOKER_EMAIL,
      audience = process.env.ESOCIAL_SYNC_AUDIENCE;
    if (!email || !audience || process.env.ESOCIAL_SYNC_ENABLED !== "true")
      throw new AuthError("Consulta automática eSocial ainda não configurada.", 503);
    try {
      const ticket = await new auth.OAuth2().verifyIdToken({ idToken: token, audience });
      const claims = ticket.getPayload();
      if (claims?.email !== email || claims.email_verified !== true)
        throw new Error("Invalid invoker");
    } catch {
      throw new AuthError("Agendador não autorizado.", 401);
    }
    // Only queries already transmitted records; each submitter's current access is rechecked.
    return NextResponse.json(await monitorOperation("esocial-query", syncEsocialMessages), {
      headers: privateHeaders,
    });
  } catch (error) {
    return privateFailure(error);
  }
}
