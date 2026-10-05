import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    const companyId = request.nextUrl.searchParams.get("companyId") || "";
    requirePgrCompany(user, companyId);
    const snap = await adminDb
      .collection("companies")
      .doc(companyId)
      .collection("risks")
      .limit(500)
      .get();
    return NextResponse.json(
      { risks: snap.docs.map((d) => ({ ...d.data(), id: d.id })), limited: snap.size === 500 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return e instanceof AuthError
      ? handleAuthError(e)
      : NextResponse.json({ error: "Inventário indisponível." }, { status: 503 });
  }
}
