import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { getOperationalStatus } from "@/services/operational-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth(request);
    return NextResponse.json(await getOperationalStatus(actor), { headers: privateHeaders });
  } catch (error) {
    return privateFailure(error);
  }
}
