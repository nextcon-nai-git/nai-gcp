import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { KitId, KitSelection } from "@/lib/operational-kits";
import {
  confirmKitBatch,
  downloadKit,
  getKitCatalog,
  prepareKitBatch,
} from "@/services/operational-kits";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), companyId: KitId, selection: KitSelection }).strict(),
  z
    .object({
      action: z.literal("confirm"),
      companyId: KitId,
      proposalId: z.string().uuid(),
      reviewed: z.literal(true),
    })
    .strict(),
]);
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request),
      companyId = request.nextUrl.searchParams.get("companyId") || "";
    const id = request.nextUrl.searchParams.get("download");
    if (id) {
      const pdf = await downloadKit(user, companyId, id);
      return new NextResponse(new Uint8Array(pdf.bytes), {
        headers: {
          ...privateHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        },
      });
    }
    return NextResponse.json(await getKitCatalog(user, companyId), { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const parsed = command.safeParse(await limitedJson(request, 30000));
    if (!parsed.success)
      throw badRequest("Confira os dados e confirme a revisão para gerar o kit.");
    const data = parsed.data;
    const result =
      data.action === "prepare"
        ? await prepareKitBatch(user, data.companyId, data.selection)
        : { results: await confirmKitBatch(user, data.companyId, data.proposalId) };
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
