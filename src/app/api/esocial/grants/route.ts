import { esocialFailure } from "@/services/esocial/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateHeaders } from "@/lib/http/private-api";
import {
  requireEsocialAdministrator,
  requireEsocialMessagingAccess,
} from "@/services/esocial/access";
import { getEsocialGrant, saveEsocialGrant } from "@/services/esocial/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) throw badRequest("Selecione o cliente.");
    requireEsocialMessagingAccess(user, companyId);
    return NextResponse.json(
      { grant: await getEsocialGrant(user, companyId) },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialAdministrator(user);
    const body = await limitedJson(request, 256 * 1024);
    return NextResponse.json(
      { grant: await saveEsocialGrant(user, body) },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}
