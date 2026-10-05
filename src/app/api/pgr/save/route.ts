import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { requirePgrRole } from "@/lib/auth/require-pgr-access";
import { PGR_MAX_FILE_BYTES } from "@/lib/pgr-schema";
import { savePgrDraft } from "@/services/pgr-workspace";
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
      return NextResponse.json(
        { error: "O original de até 12 MB é necessário para integrar." },
        { status: 413 }
      );
    return NextResponse.json(
      await savePgrDraft(
        user,
        {
          draftId: String(form.get("draftId") || ""),
          companyId: String(form.get("companyId") || ""),
          createCompany: form.get("createCompany") === "true",
          confirmed: form.get("confirmed") === "true",
          dueDate: String(form.get("dueDate") || ""),
        },
        new Uint8Array(await file.arrayBuffer())
      ),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof AuthError) return handleAuthError(e);
    return NextResponse.json(
      {
        error:
          "A gravação não foi concluída. Confira conexão e permissões de armazenamento; a análise permanece para nova tentativa.",
      },
      { status: 503 }
    );
  }
}
