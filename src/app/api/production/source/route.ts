import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { limitedBytes, limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { badRequest } from "@/lib/auth/errors";
import { preserveProductionSource, readProductionSource } from "@/services/production-central";
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

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    if (req.headers.get("content-type")?.split(";")[0] !== "application/pdf")
      throw badRequest("Envie um PDF.");
    const source = await preserveProductionSource(
      user,
      await limitedBytes(req, 10 * 1024 * 1024 - 1)
    );
    return NextResponse.json({ source }, { headers: privateHeaders });
  } catch (e) {
    return privateFailure(e);
  }
}
