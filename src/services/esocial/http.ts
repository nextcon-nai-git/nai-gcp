import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod/v3";
import { ESOCIAL_EVENT_FORMS, type EsocialFormField } from "@/lib/esocial-events";
import { privateFailure, privateHeaders } from "@/lib/http/private-api";
import { EsocialXmlValidationError } from "./events";

const labels = new Map<string, string>(
  Object.entries({
    action: "operação",
    companyId: "cliente",
    employeeId: "colaborador",
    id: "registro",
    version: "versão do registro",
    payload: "dados do evento",
    sourceReference: "referência do documento de origem",
    sourceDocumentHash: "documento de origem",
    asoCardId: "ASO de origem",
    confirmed: "confirmação da operação",
    identityConfirmed: "conferência da identidade",
    documentChecked: "conferência do documento",
    xml: "arquivo XML",
    eventType: "tipo de evento",
  })
);
function addFields(fields: readonly EsocialFormField[], prefix = "") {
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    labels.set(path, field.label);
    if (field.fields) addFields(field.fields, path);
  }
}
Object.values(ESOCIAL_EVENT_FORMS).forEach((form) =>
  form.sections.forEach((section) => addFields(section.fields))
);

function labelFor(path: readonly PropertyKey[]) {
  const parts = path.filter((part) => typeof part !== "number").map(String);
  if (parts[0] === "payload") parts.shift();
  while (parts.length) {
    const label = labels.get(parts.join("."));
    if (label) return label;
    parts.pop();
  }
  return "dados da operação";
}

/** Return field labels only: neither Zod received values nor parser exception text is public. */
export function esocialFailure(error: unknown) {
  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map((issue) => labelFor(issue.path)))].slice(0, 8);
    return NextResponse.json(
      {
        error: `Confira os dados obrigatórios e seus formatos: ${fields.join("; ")}.`,
        code: "ESOCIAL_INPUT_INVALID",
        fields,
      },
      { status: 400, headers: privateHeaders }
    );
  }
  if (error instanceof EsocialXmlValidationError) {
    let message =
      "O XML não passou na validação. Confira o leiaute S-1.3, os elementos, a ordem e os campos obrigatórios, ou prepare o evento pelo formulário.";
    if (error.message.startsWith("Dados eSocial incompletos ou inválidos.")) {
      const paths = [...error.message.matchAll(/(?:\. |; )([A-Za-z][A-Za-z0-9_.]*):/g)].map(
        (match) => match[1].split(".").filter((part) => !/^\d+$/.test(part))
      );
      const fields = [...new Set(paths.map(labelFor))].slice(0, 8);
      message = `Complete e confira os dados do evento${fields.length ? `: ${fields.join("; ")}` : " no formulário"}.`;
    } else if (/ASO|identidade revisada/.test(error.message))
      message =
        "Confira o ASO recebido, o arquivo arquivado e a identidade do trabalhador antes de preparar o S-2220.";
    else if (/UTF-8/.test(error.message)) message = "Importe um XML codificado em UTF-8.";
    else if (/retificação|Exclusão/.test(error.message))
      message =
        "Confira o tipo de evento, a operação e o recibo do evento original. Abra o evento aceito para retificar ou excluir.";
    else if (/empregador/.test(error.message))
      message =
        "Confira a inscrição do empregador no XML e no cadastro do cliente conforme o S-1000.";
    else if (/CPF|matrícula|categoria/.test(error.message))
      message =
        "Confira o CPF e a matrícula ou categoria do trabalhador conforme o vínculo da folha.";
    return NextResponse.json(
      { error: message, code: "ESOCIAL_XML_INVALID" },
      { status: 422, headers: privateHeaders }
    );
  }
  return privateFailure(error);
}
