import { esocialFailure } from "@/services/esocial/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { privateHeaders } from "@/lib/http/private-api";
import { requireEsocialMessagingAccess } from "@/services/esocial/access";
import { downloadEsocialDocument } from "@/services/esocial/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialMessagingAccess(user);
    const id = request.nextUrl.searchParams.get("id"),
      type = request.nextUrl.searchParams.get("type");
    if (!id || !["unsigned", "signed", "response"].includes(type || ""))
      throw badRequest("Selecione o evento e o tipo de documento.");
    const document = await downloadEsocialDocument(
      user,
      id,
      type as "unsigned" | "signed" | "response"
    );
    return new NextResponse(document.xml, {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="esocial.xml"; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
      },
    });
  } catch (failure) {
    return esocialFailure(failure);
  }
}
