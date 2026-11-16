import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessAvpEvidence, requireAvpAccess } from "@/lib/auth/avp-access";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, forbidden, handleAuthError } from "@/lib/auth/errors";
import { limitedBytes } from "@/lib/http/private-api";
import { getAvpSnapshot, patchAvpQueue, syncAvpSource } from "@/services/avp-sheet-sync";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireAvpAccess(user);
    await syncAvpSource(req.nextUrl.searchParams.get("force") === "1", user.uid);
    const snapshot = await getAvpSnapshot();
    // The source refresh can outlive suspension or removal from the AVP portfolio.
    requireAvpAccess(await requireAuth(req));
    return NextResponse.json(snapshot, {
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
function requireQueueEditor(user: AuthContext) {
  requireAvpAccess(user);
  if (!["SUPER_ADMIN", "ADMIN", "OPERATIONS", "CLIENT_ADMIN", "RH", "HR"].includes(user.role))
    throw forbidden("Seu perfil pode consultar, mas não editar esta fila.");
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireQueueEditor(user);
    let text: string;
    try {
      text = req.body ? new TextDecoder().decode(await limitedBytes(req, 500000)) : "";
    } catch (error) {
      if (error instanceof AuthError && error.status === 413)
        return NextResponse.json({ error: "Alterações excedem o limite." }, { status: 413 });
      throw error;
    }
    if (Buffer.byteLength(text) > 500000)
      return NextResponse.json({ error: "Alterações excedem o limite." }, { status: 413 });
    const body = JSON.parse(text);
    const current = await requireAuth(req);
    requireQueueEditor(current);
    if (
      !canAccessAvpEvidence(current) &&
      Array.isArray(body?.changes) &&
      body.changes.some((change: { fields?: Record<string, unknown> } | null) =>
        Object.keys(change?.fields || {}).some((field) =>
          ["valorAso", "cnpjClinica", "chavePix", "pixRealizado"].includes(field)
        )
      )
    )
      return NextResponse.json(
        { error: "A edição de valores, CNPJ e Pix exige acesso financeiro da operação AVP." },
        { status: 403 }
      );
    const revision = await patchAvpQueue(body.revision, body.changes, user.uid);
    return NextResponse.json({ success: true, revision });
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    if (error instanceof Error && error.message === "AMBIGUOUS_IDENTITY")
      return NextResponse.json(
        {
          error:
            "Há solicitações com a mesma identificação. Diferencie os pedidos na planilha antes de editar.",
        },
        { status: 409 }
      );
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
