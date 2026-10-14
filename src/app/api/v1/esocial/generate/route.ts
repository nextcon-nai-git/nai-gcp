import { NextRequest, NextResponse } from "next/server";
import { EsocialXmlService } from "@/services/esocial/xml-generator";
import { adminDb } from "@/lib/firebase-admin";
import {
  requireApiKey,
  requireScope,
  requireClient,
  handleApiGuardError,
  ApiGuardError,
} from "@/lib/developer-api-guard";
import { AuthError, handleAuthError } from "@/lib/auth/errors";
import { limitedBytes, privateHeaders } from "@/lib/http/private-api";
import { isAccessDocumentId } from "@/services/access-control/materialize-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generates an unsigned S-2220 draft. No signature, transmission or receipt is claimed. */
export async function POST(req: NextRequest) {
  try {
    const authKey = await requireApiKey(req);
    requireScope(authKey, "esocial:write");
    let body: Record<string, unknown>;
    try {
      const input: unknown = JSON.parse((await limitedBytes(req, 65536)).toString("utf8"));
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
      body = input as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new ApiGuardError("Solicitação JSON inválida.", 400);
    }
    const companyId = body.companyId ?? authKey.clientId;
    if (!isAccessDocumentId(companyId))
      throw new ApiGuardError("Informe uma empresa válida. Chaves globais exigem companyId.", 400);
    requireClient(authKey, companyId);
    if (body.type !== "S2220")
      return NextResponse.json(
        {
          error:
            "Geração deste evento aguarda adequação e validação do leiaute vigente. Nenhum evento foi assinado ou transmitido.",
          status: "LAYOUT_VALIDATION_REQUIRED",
        },
        { status: 501, headers: privateHeaders }
      );
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data))
      throw new ApiGuardError("Informe os dados revisados do ASO.", 400);
    const data = body.data as Record<string, unknown>;
    const company = await adminDb.collection("companies").doc(companyId).get();
    if (!company.exists || company.data()?.isDeleted === true)
      throw new ApiGuardError("Empresa não encontrada.", 404);
    const employer =
      data.ideEmpregador && typeof data.ideEmpregador === "object"
        ? (data.ideEmpregador as Record<string, unknown>).nrInsc
        : data.cnpjEmpregador;
    const normalize = (value: unknown) =>
      typeof value === "string" ? value.replace(/[.\-/\s]/g, "").toUpperCase() : "";
    const registered = normalize(company.data()?.cnpj);
    const supplied = normalize(employer);
    if (
      !registered ||
      !supplied ||
      !(registered === supplied || (supplied.length === 8 && registered.startsWith(supplied)))
    )
      throw new ApiGuardError(
        "O empregador do evento não corresponde ao cadastro da empresa autorizada.",
        403
      );
    let xml: string;
    try {
      xml = EsocialXmlService.generateS2220(data);
    } catch {
      throw new ApiGuardError(
        "Dados do S-2220 incompletos ou inválidos. Confira identificador, vínculo, datas, exames e médico responsável.",
        422
      );
    }
    return new NextResponse(xml, {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="rascunho-s2220-nao-assinado.xml"',
        "X-NAI-Event-Type": "S2220",
        "X-NAI-Tenant-Id": companyId,
        "X-NAI-Layout": "S-1.3",
        "X-NAI-Signature-Status": "UNSIGNED",
        "X-NAI-Transmission-Status": "NOT_SUBMITTED",
      },
    });
  } catch (error) {
    const response =
      error instanceof AuthError ? handleAuthError(error) : handleApiGuardError(error);
    for (const [name, value] of Object.entries(privateHeaders)) response.headers.set(name, value);
    return response;
  }
}
