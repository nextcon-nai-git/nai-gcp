import { NextRequest, NextResponse } from "next/server";
import { auth as googleAuth } from "googleapis/build/src/apis/oauth2";
import { processWebhookQueue } from "@/services/webhooks/webhook-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^***;
  if (!token)
    return NextResponse.json({ error: "Agendador não autorizado." }, { status: 401, headers });
  const email = process.env.WEBHOOK_INVOKER_EMAIL;
  const audience = process.env.WEBHOOK_WORKER_AUDIENCE;
  if (!email || !audience)
    return NextResponse.json({ error: "Agendamento não configurado." }, { status: 503, headers });
  try {
    const ticket = await new googleAuth.OAuth2().verifyIdToken({ idToken: token, audience });
    const claims = ticket.getPayload();
    if (claims?.email !== email || claims.email_verified !== true)
      return NextResponse.json({ error: "Agendador não autorizado." }, { status: 403, headers });
  } catch {
    return NextResponse.json({ error: "Agendador não autorizado." }, { status: 401, headers });
  }
  try {
    return NextResponse.json(await processWebhookQueue(), { headers });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível concluir o processamento. A fila foi preservada." },
      { status: 503, headers }
    );
  }
}
