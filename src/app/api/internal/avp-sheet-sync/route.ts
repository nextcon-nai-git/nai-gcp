import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { syncAvpSource } from "@/services/avp-sheet-sync";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Agendador não autorizado." }, { status: 401 });
  const email = process.env.AVP_SYNC_INVOKER_EMAIL;
  const audience = process.env.AVP_SYNC_AUDIENCE;
  if (!email || !audience)
    return NextResponse.json(
      { error: "Agendamento de servidor ainda não configurado." },
      { status: 503 }
    );
  try {
    const ticket = await new google.auth.OAuth2().verifyIdToken({ idToken: token, audience });
    const claims = ticket.getPayload();
    if (claims?.email !== email || claims.email_verified !== true)
      return NextResponse.json({ error: "Agendador não autorizado." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Agendador não autorizado." }, { status: 401 });
  }
  try {
    const result = await syncAvpSource(true, email);
    return NextResponse.json(result, { status: "error" in result ? 503 : 200 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível executar a sincronização. A fila anterior foi preservada." },
      { status: 503 }
    );
  }
}
