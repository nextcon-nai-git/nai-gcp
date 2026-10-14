import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { dashboardScope } from "@/lib/auth/dashboard-access";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const company = dashboardScope(user, request.nextUrl.searchParams.get("company") || "all");
    const source = company
      ? adminDb.collection("companies").doc(company).collection("audits")
      : adminDb.collectionGroup("audits");
    const snapshot = await source.limit(501).get();
    const audits = snapshot.docs
      .slice(0, 500)
      .filter((d) => /^companies\/[^/]+\/audits\/[^/]+$/.test(d.ref.path))
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          companyId: d.ref.parent.parent!.id,
          companyName: String(data.companyName || "Unidade sem nome"),
          scope: String(data.scope || ""),
          auditorName: String(data.auditorName || ""),
          date: String(data.date || ""),
          status: String(data.status || "planned"),
          results: Object.fromEntries(
            Object.entries(data.results || {}).filter(
              ([key, value]) => key.length < 100 && typeof value === "boolean"
            )
          ),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(
      { audits, truncated: snapshot.size > 500 },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { error: "Não foi possível consultar as auditorias. Tente novamente." },
      { status: 503 }
    );
  }
}
