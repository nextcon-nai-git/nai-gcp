import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { requirePgrRole } from "@/lib/auth/require-pgr-access";
import { PGR_MAX_FILE_BYTES } from "@/lib/pgr-schema";
import { preparePgrDraft } from "@/services/pgr-workspace";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    requirePgrRole(user);
    if (Number(request.headers.get("content-length")) > PGR_MAX_FILE_BYTES + 65536)
      return NextResponse.json({ error: "Arquivo acima de 12 MB." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > PGR_MAX_FILE_BYTES)
      return NextResponse.json({ error: "Selecione um arquivo de até 12 MB." }, { status: 413 });
    return NextResponse.json(
      await preparePgrDraft(
        user,
        new Uint8Array(await file.arrayBuffer()),
        file.type || "application/pdf",
        file.name
      ),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof AuthError) return handleAuthError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível analisar o documento." },
      { status: 422 }
    );
  }
}
