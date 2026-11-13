import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import {
  importAsoFlowRows,
  listAsoFlowCards,
  listAsoFlowClinics,
  previewAsoFlowImport,
  requireAsoFlowAccess,
  updateAsoFlowCard,
} from "@/services/aso-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (request.nextUrl.searchParams.get("directory") === "clinics")
      return NextResponse.json(
        {
          clinics: await listAsoFlowClinics(
            user,
            request.nextUrl.searchParams.get("companyId") || undefined
          ),
        },
        { headers: privateHeaders }
      );
    const data = await listAsoFlowCards(user, {
      companyId: request.nextUrl.searchParams.get("companyId") || undefined,
      cursor: request.nextUrl.searchParams.get("cursor") || undefined,
    });
    return NextResponse.json(data, { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireAsoFlowAccess(user);
    const body = await limitedJson(request, 750000);
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.action !== "string")
      throw badRequest("Selecione uma ação válida.");
    const { action, ...input } = body;
    if (action === "preview")
      return NextResponse.json(
        { preview: await previewAsoFlowImport(user, input) },
        { headers: privateHeaders }
      );
    if (action === "import")
      return NextResponse.json(await importAsoFlowRows(user, input), { headers: privateHeaders });
    return NextResponse.json(
      { card: await updateAsoFlowCard(user, body) },
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}
