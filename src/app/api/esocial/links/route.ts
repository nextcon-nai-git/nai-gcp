import { esocialFailure } from "@/services/esocial/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { badRequest } from "@/lib/auth/errors";
import { limitedJson, privateHeaders } from "@/lib/http/private-api";
import { requireEsocialMessagingAccess } from "@/services/esocial/access";
import {
  esocialCompany,
  listEsocialEmployeeLinks,
  saveEsocialEmployeeLink,
  stringValue,
} from "@/services/esocial/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) throw badRequest("Selecione o cliente.");
    requireEsocialMessagingAccess(user, companyId);
    const [employees, snapshot] = await Promise.all([
      listEsocialEmployeeLinks(user, companyId),
      esocialCompany(companyId).get(),
    ]);
    const company = snapshot.data();
    if (!snapshot.exists || !company || company.isDeleted === true)
      throw badRequest("Cliente não encontrado.");
    const explicit = stringValue(company.esocialRegistration);
    const document = stringValue(company.cnpj || company.cpf)
      .replace(/[.\-/\s]/g, "")
      .toUpperCase();
    const registration = explicit || (document.length === 14 ? document.slice(0, 8) : document);
    return NextResponse.json(
      {
        employees,
        company: {
          registration,
          tpInsc: registration.replace(/[.\-/\s]/g, "").length === 11 ? 2 : 1,
        },
      },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireEsocialMessagingAccess(user);
    const body = await limitedJson(request, 256 * 1024);
    return NextResponse.json(
      { link: await saveEsocialEmployeeLink(user, body) },
      { headers: privateHeaders }
    );
  } catch (failure) {
    return esocialFailure(failure);
  }
}
