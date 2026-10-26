import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess, canAccessAvpEvidence } from "@/lib/auth/avp-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { periodicPatchSchema } from "@/lib/avp-periodic-workflow";
import {
  readPeriodicWork,
  patchPeriodicWork,
  readPeriodicHistory,
} from "@/services/avp-periodic-workflow";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function authorized(req: NextRequest) {
  const user = await requireAuth(req);
  requireAvpAccess(user);
  if (!canAccessAvpEvidence(user))
    throw new AuthError("Fila disponível à equipe interna AVP.", 403);
  return user;
}
function failure(error: unknown) {
  if (error instanceof AuthError) {
    const response = handleAuthError(error);
    response.headers.set("Cache-Control", headers["Cache-Control"]);
    return response;
  }
  return NextResponse.json(
    { error: "Não foi possível acessar a fila de trabalho. Atualize e tente novamente." },
    { status: 503, headers }
  );
}
export async function GET(req: NextRequest) {
  try {
    await authorized(req);
    const id = req.nextUrl.searchParams.get("id");
    if (id && !/^periodico-2026-\d+$/.test(id)) throw new AuthError("Card inválido.", 400);
    return NextResponse.json(
      id ? { history: await readPeriodicHistory(id) } : await readPeriodicWork(),
      { headers }
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const user = await authorized(req);
    if (Number(req.headers.get("content-length")) > 6000)
      throw new AuthError("Requisição muito grande.", 413);
    const raw = await req.text();
    if (raw.length > 6000) throw new AuthError("Requisição muito grande.", 413);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new AuthError("JSON inválido.", 400);
    }
    const parsed = periodicPatchSchema.safeParse(input);
    if (!parsed.success)
      throw new AuthError(
        "Preencha responsável, etapa, referência da evidência e data válida.",
        400
      );
    await patchPeriodicWork(parsed.data, user.uid);
    return NextResponse.json({ saved: true }, { headers });
  } catch (e) {
    return failure(e);
  }
}
