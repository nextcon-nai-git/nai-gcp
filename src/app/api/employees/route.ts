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
      ? adminDb.collection("companies").doc(company).collection("employees")
      : adminDb.collectionGroup("employees");
    const snapshot = await source.limit(1001).get();
    const fields = [
      "name",
      "cpf",
      "job_role",
      "jobRole",
      "cargo",
      "role",
      "nextAsoDate",
      "fitnessStatus",
      "isArchived",
      "documents",
    ];
    const employees = snapshot.docs
      .slice(0, 1000)
      .filter((d) => /^companies\/[^/]+\/employees\/[^/]+$/.test(d.ref.path))
      .map((d) => {
        const data = d.data();
        return {
          ...Object.fromEntries(
            fields.filter((k) => data[k] !== undefined).map((k) => [k, data[k]])
          ),
          id: d.id,
          companyId: d.ref.parent.parent!.id,
        };
      });
    return NextResponse.json(
      { employees, truncated: snapshot.size > 1000 },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthError) return handleAuthError(error);
    return NextResponse.json(
      { error: "Não foi possível consultar os colaboradores." },
      { status: 503 }
    );
  }
}
