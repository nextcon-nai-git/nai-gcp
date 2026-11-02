import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { AsoFlowIdSchema } from "@/lib/aso-flow";
import { asoGmailConfiguration } from "@/lib/integrations/aso-gmail";
import { requireAsoFlowAccess } from "@/services/aso-flow";
import {
  AsoFlowMailSchema,
  acceptAsoMailCandidate,
  asoFlowMailbox,
  readAsoMailCandidate,
  reconcileAsoFlowMail,
  sendAsoFlowMail,
  syncAsoFlowMail,
} from "@/services/aso-flow-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireAsoFlowAccess(user);
    const rawId = request.nextUrl.searchParams.get("id");
    if (!rawId)
      return NextResponse.json(
        { status: asoGmailConfiguration(), candidates: [] },
        { headers: privateHeaders }
      );
    const parsed = AsoFlowIdSchema.safeParse(rawId);
    if (!parsed.success) throw badRequest("Card inválido.");
    const download = request.nextUrl.searchParams.get("download");
    if (download) {
      if (!AsoFlowIdSchema.safeParse(download).success) throw badRequest("Anexo inválido.");
      const { bytes, candidate } = await readAsoMailCandidate(user, parsed.data, download);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(candidate.fileName)}`,
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    return NextResponse.json(
      await asoFlowMailbox(
        user,
        parsed.data,
        request.nextUrl.searchParams.get("cursor") || undefined
      ),
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireAsoFlowAccess(user);
    const parsed = AsoFlowMailSchema.safeParse(await limitedJson(request, 8000));
    if (!parsed.success)
      throw badRequest("Confira o card, destinatário, confirmação e ação do e-mail.");
    const input = parsed.data;
    if (input.action === "sync")
      return NextResponse.json(
        { result: await syncAsoFlowMail(user, input.id) },
        { headers: privateHeaders }
      );
    if (input.action === "reconcile")
      return NextResponse.json(await reconcileAsoFlowMail(user, input.id), {
        headers: privateHeaders,
      });
    const card =
      input.action === "send"
        ? await sendAsoFlowMail(user, input)
        : await acceptAsoMailCandidate(user, input);
    return NextResponse.json({ card }, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
