import { NextRequest, NextResponse } from "next/server";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth/require-auth";
import { AuthError } from "@/lib/auth/errors";
import { isPgrGlobalAdmin } from "@/lib/auth/require-pgr-access";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { currentAsoFlowUser, requireAsoFlowAccess } from "@/services/aso-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Independent directory: a large or empty card list must not prevent choosing a client. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireAsoFlowAccess(user);
    const companyId = request.nextUrl.searchParams.get("companyId") || "";
    if (companyId) requireAsoFlowAccess(user, companyId);
    const global = isPgrGlobalAdmin(user);
    const authorizedIds = companyId ? [companyId] : [...new Set(user.servedCompanies)];
    if (authorizedIds.length > 5000)
      throw new AuthError(
        "A carteira excede o limite de seleção. Abra a esteira pela ficha do cliente.",
        503
      );
    let docs: DocumentSnapshot[];
    if (global && !companyId) {
      const result = await adminDb
        .collection("companies")
        .select("name", "active", "isDeleted")
        .limit(5001)
        .get();
      if (result.size > 5000)
        throw new AuthError(
          "A carteira excede o limite de seleção. Abra a esteira pela ficha do cliente.",
          503
        );
      docs = result.docs;
    } else {
      const refs = authorizedIds.map((companyId) => {
        requireAsoFlowAccess(user, companyId);
        return adminDb.collection("companies").doc(companyId);
      });
      docs = [];
      for (let offset = 0; offset < refs.length; offset += 100) {
        docs.push(
          ...(await adminDb.getAll(...refs.slice(offset, offset + 100), {
            fieldMask: ["name", "active", "isDeleted"],
          }))
        );
      }
    }
    const companies = docs
      .flatMap((doc) => {
        if (!doc.exists) return [];
        const data = doc.data() || {};
        if (data.isDeleted === true) return [];
        return [
          {
            id: doc.id,
            name:
              typeof data.name === "string" && data.name.trim()
                ? data.name.trim()
                : "Cliente sem nome",
            active: data.active !== false,
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const current = await currentAsoFlowUser(user, companyId || undefined);
    for (const company of companies) requireAsoFlowAccess(current, company.id);
    return NextResponse.json(
      {
        companies,
        requiresSelection:
          companies.length > 30 ||
          (!isPgrGlobalAdmin(current) && current.servedCompanies.length > 30),
      },
      { headers: privateHeaders }
    );
  } catch (error) {
    return privateFailure(error);
  }
}
