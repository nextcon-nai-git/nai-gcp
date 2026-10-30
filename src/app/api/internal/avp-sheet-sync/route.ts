import { NextRequest, NextResponse } from "next/server";
import { auth as googleAuth } from "googleapis/build/src/apis/oauth2";
import { syncAvpSource } from "@/services/avp-sheet-sync";
import { syncAvpPeriodicControl } from "@/services/avp-periodic-sync";

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
    const ticket = await new googleAuth.OAuth2().verifyIdToken({ idToken: token, audience });
    const claims = ticket.getPayload();
    if (claims?.email !== email || claims.email_verified !== true)
      return NextResponse.json({ error: "Agendador não autorizado." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Agendador não autorizado." }, { status: 401 });
  }
  try {
    const [queue, periodic] = await Promise.allSettled([
      syncAvpSource(true, email),
      syncAvpPeriodicControl({ scheduled: true }),
    ]);
    const result =
      queue.status === "fulfilled" ? queue.value : { error: "Falha na atualização da fila." };
    const periodicResult =
      periodic.status === "fulfilled"
        ? periodic.value
        : { error: "Falha na atualização dos periódicos." };
    return NextResponse.json(
      { ...result, periodic: periodicResult },
      {
        status: "error" in result || "error" in periodicResult ? 503 : 200,
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível executar a sincronização. A fila anterior foi preservada." },
      { status: 503 }
    );
  }
}
