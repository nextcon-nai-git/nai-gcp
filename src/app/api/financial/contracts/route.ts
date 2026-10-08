import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { dashboardScope } from "@/lib/auth/dashboard-access";
import { AuthError } from "@/lib/auth/errors";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await requireAuth(request);
    const scope = dashboardScope(user, request.nextUrl.searchParams.get("company") || "all");
    // Server-authorized aggregation avoids the forbidden browser collectionGroup query.
    const query = scope
      ? adminDb.collection("companies").doc(scope).collection("contracts")
      : adminDb.collectionGroup("contracts");
    const result = await query.orderBy("value", "desc").limit(1001).get();
    if (result.size > 1000)
      throw new AuthError("Selecione uma empresa para consultar mais de 1.000 contratos.", 422);
    const contracts = result.docs.map((doc) => {
      const row = doc.data();
      return {
        id: doc.ref.path,
        companyName: String(row.companyName || ""),
        title: String(row.title || ""),
        value: Number(row.value) || 0,
      };
    });
    return NextResponse.json({ contracts }, { headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof AuthError ? e.message : "Não foi possível consultar os contratos." },
      { status: e instanceof AuthError ? e.status : 503, headers }
    );
  }
}
