import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { generateCassiXml } from "@/services/cassi-xml";
export async function POST(req: NextRequest) {
  try {
    requireFinancialAccess(await requireAuth(req));
    const { guide, fields } = (await limitedJson(req, 512000)) ?? {};
    const xml = await generateCassiXml(guide, fields || {});
    return new NextResponse(new Uint8Array(xml), {
      headers: { ...privateHeaders, "Content-Type": "application/xml; charset=iso-8859-1" },
    });
  } catch (e) {
    return privateFailure(e);
  }
}
