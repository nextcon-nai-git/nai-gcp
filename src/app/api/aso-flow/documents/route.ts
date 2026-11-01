import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { ASO_FLOW_MAX_PDF_BYTES } from "@/lib/aso-flow";
import { limitedFormData, privateFailure, privateHeaders } from "@/lib/http/private-api";
import {
  readAsoFlowDocument,
  requireAsoFlowAccess,
  uploadAsoFlowDocument,
} from "@/services/aso-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const id = request.nextUrl.searchParams.get("id") || "",
      kind = request.nextUrl.searchParams.get("kind");
    if (kind !== "kit" && kind !== "aso") throw badRequest("Selecione o documento.");
    const document = await readAsoFlowDocument(user, id, kind);
    return new NextResponse(new Uint8Array(document.bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${kind}.pdf"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      },
    });
  } catch (error) {
    return privateFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireAsoFlowAccess(user);
    const form = await limitedFormData(request, ASO_FLOW_MAX_PDF_BYTES + 20000);
    const file = form.get("file"),
      raw = form.get("metadata");
    if (
      !(file instanceof File) ||
      file.type !== "application/pdf" ||
      typeof raw !== "string" ||
      raw.length > 10000
    )
      throw badRequest("Envie o PDF e os dados de identificação.");
    let metadata;
    try {
      metadata = JSON.parse(raw);
    } catch {
      throw badRequest("Dados de identificação inválidos.");
    }
    const card = await uploadAsoFlowDocument(
      user,
      metadata,
      Buffer.from(await file.arrayBuffer()),
      file.name
    );
    return NextResponse.json({ card }, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
