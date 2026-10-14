import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { privateFailure, privateHeaders, limitedJson } from "@/lib/http/private-api";
import {
  getProductionBook,
  productionCompanies,
  saveProductionCommand,
} from "@/services/production-central";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    const [book, companies] = await Promise.all([
      getProductionBook(user),
      productionCompanies(user),
    ]);
    return NextResponse.json({ book, companies }, { headers: privateHeaders });
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    requireFinancialAccess(user);
    return NextResponse.json(await saveProductionCommand(user, await limitedJson(req)), {
      headers: privateHeaders,
    });
  } catch (e) {
    return privateFailure(e);
  }
}
