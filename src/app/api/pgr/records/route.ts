import { requirePgrAppCheck } from "@/lib/auth/require-pgr-app-check";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePgrRole, requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { getPgrCompanies, getPgrRecords } from "@/services/pgr-workspace";
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await requirePgrAppCheck(request);
    requirePgrRole(user);
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (companyId) requirePgrCompany(user, companyId);
    return NextResponse.json(
      companyId
        ? { records: await getPgrRecords(user, companyId) }
        : { companies: await getPgrCompanies(user) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof AuthError) return handleAuthError(e);
    return NextResponse.json(
      { error: "Não foi possível consultar as importações." },
      { status: 503 }
    );
  }
}
