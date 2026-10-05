import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { getAvpSnapshot, patchAvpQueue, syncAvpSource } from "@/services/avp-sheet-sync";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireAvpAccess(user);
    await syncAvpSource(req.nextUrl.searchParams.get("force") === "1", user.uid);
    return NextResponse.json(await getAvpSnapshot(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { error: "Não foi possível carregar a fila compartilhada." },
      { status: 503 }
    );
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireAvpAccess(user);
    if (!["SUPER_ADMIN", "ADMIN", "OPERATIONS", "CLIENT_ADMIN", "RH", "HR"].includes(user.role))
      return NextResponse.json(
        { error: "Seu perfil pode consultar, mas não editar esta fila." },
        { status: 403 }
      );
    const text = await req.text();
    if (Buffer.byteLength(text) > 500000)
      return NextResponse.json({ error: "Alterações excedem o limite." }, { status: 413 });
    const body = JSON.parse(text);
    const revision = await patchAvpQueue(body.revision, body.changes, user.uid);
    return NextResponse.json({ success: true, revision });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    if (error instanceof Error && error.message === "CONFLICT")
      return NextResponse.json(
        { error: "A fila mudou. Atualize e revise a alteração antes de salvar." },
        { status: 409 }
      );
    return NextResponse.json(
      { error: "Não foi possível salvar a alteração da fila." },
      { status: 422 }
    );
  }
}
