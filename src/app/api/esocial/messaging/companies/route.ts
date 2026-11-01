import { esocialFailure } from "@/services/esocial/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { privateHeaders } from "@/lib/http/private-api";
import { listEsocialCompanies } from "@/services/esocial/records";
import { requireEsocialMessagingAccess } from "@/services/esocial/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialMessagingAccess(user);
    return NextResponse.json(
      { companies: await listEsocialCompanies(user) },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}
