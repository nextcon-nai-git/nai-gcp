import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { limitedJson, privateFailure, privateHeaders } from "@/lib/http/private-api";
import { listFiscalInvoices } from "@/services/fiscal-invoices";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// POST keeps fiscal filters out of URLs and intermediary access logs. Read only.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireFinancialAccess(user);
    return NextResponse.json(await listFiscalInvoices(user, await limitedJson(request)), {
      headers: privateHeaders,
    });
  } catch (error) {
    return privateFailure(error);
  }
}
