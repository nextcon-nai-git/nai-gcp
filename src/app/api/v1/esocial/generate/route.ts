import { NextRequest, NextResponse } from "next/server";
import { EsocialXmlService, EsocialEventType } from "@/services/esocial/xml-generator";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
} from "@/lib/developer-api-guard";

/**
 * Endpoint de Geração de XML para Integrações M2M e Governança eSocial.
 *
 * Pipeline:
 * requireApiKey(req) -> requireScope(authKey, 'esocial:write') -> requireClient(authKey, companyId)
 */
export async function POST(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "esocial:write");

    const { type, data, companyId } = await req.json();

    if (companyId) {
      requireClient(authKey, companyId);
    }

    let xml = "";
    switch (type as EsocialEventType) {
      case "S2220":
        xml = EsocialXmlService.generateS2220(data);
        break;
      case "S2240":
        xml = EsocialXmlService.generateS2240(data);
        break;
      default:
        return NextResponse.json({ error: "Tipo de evento não suportado." }, { status: 400 });
    }

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
        "X-NAI-Event-Type": type,
        "X-NAI-Tenant-Id": companyId || authKey.clientId,
      },
    });
  } catch (error) {
    return handleApiGuardError(error);
  }
}
