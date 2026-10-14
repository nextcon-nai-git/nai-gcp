import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireSupplierAccess } from "@/lib/suppliers/qualification";
import { getSuppliers, saveSupplier } from "@/services/supplier-qualification";
import { privateHeaders, privateFailure, limitedJson } from "@/lib/http/private-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: NextRequest) {
  try {
    const u = await requireAuth(r);
    requireSupplierAccess(u);
    return NextResponse.json(await getSuppliers(u), { headers: privateHeaders });
  } catch (e) {
    return privateFailure(e);
  }
}
export async function POST(r: NextRequest) {
  try {
    const u = await requireAuth(r);
    requireSupplierAccess(u);
    return NextResponse.json(await saveSupplier(u, await limitedJson(r)), {
      headers: privateHeaders,
    });
  } catch (e) {
    return privateFailure(e);
  }
}
