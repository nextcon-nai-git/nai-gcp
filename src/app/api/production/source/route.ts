import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { readProductionSource } from "@/services/production-central";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    const bytes = await readProductionSource(user, await limitedJson(req));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=documento.pdf",
      },
    });
  } catch (e) {
    return privateFailure(e);
  }
}
