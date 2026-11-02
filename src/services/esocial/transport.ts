import "server-only";

import { request as httpsRequest } from "node:https";
import type { Element as XmlElement } from "@xmldom/xmldom";
import { isValidCnpj } from "@/lib/cnpj";
import { isValidCpf } from "@/lib/cpf";
import {
  ESOCIAL_TRANSMISSION_DISABLED_MESSAGE,
  isEsocialTransmissionEnabled,
} from "@/lib/esocial-transmission-policy";
import {
  assertCertificateMaterialCurrent,
  parseEsocialXmlSafely,
  verifyEsocialXmlSignature,
  xmlElementChildren,
  xmlSingleChild,
  type CertificateMaterial,
  type EsocialEnvironment,
  type EsocialRegistration,
} from "./certificate";

/** Official URLs; never accept a URL, proxy, CA, redirect or TLS override from an API payload. */
export const ESOCIAL_ENDPOINTS = {
  restricted: {
    send: "https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc",
    query:
      "https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc",
  },
  production: {
    send: "https://webservices.envio.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc",
    query:
      "https://webservices.consulta.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc",
  },
} as const;

/** WSDL and namespaces are identical in communication packages 1.6 and 1.6-Alfa. */
export const ESOCIAL_COMMUNICATION = {
  soap: "http://schemas.xmlsoap.org/soap/envelope/",
  sendService: "http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0",
  queryService:
    "http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0",
  send: "http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1",
  query: "http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0",
  sendResult: "http://www.esocial.gov.br/schema/lote/eventos/envio/retornoEnvio/v1_1_0",
  queryResult: "http://www.esocial.gov.br/schema/lote/eventos/envio/retornoProcessamento/v1_3_0",
  eventResult: "http://www.esocial.gov.br/schema/evt/retornoEvento/v1_3_0",
} as const;

export interface EsocialIssue {
  code: string;
  description: string;
  type: "error" | "warning" | "history";
  location?: string;
}

export interface BatchSubmission {
  /** accepted means receipt of a batch, never acceptance of the event. */
  status: "accepted" | "rejected" | "uncertain";
  protocol?: string;
  code: string;
  description: string;
  issues: EsocialIssue[];
  duplicateBatch?: boolean;
  receivedAt?: string;
  /** Contains personal data. Persist privately; do not expose in logs or unauthenticated APIs. */
  rawResponse?: string;
}

export interface EsocialEventResult {
  eventId: string;
  status: "accepted" | "rejected" | "duplicate";
  code: string;
  description: string;
  issues: EsocialIssue[];
  /** Only present for accepted events or a duplicate accompanied by its original receipt. */
  receipt?: string;
  receiptHash?: string;
  processedAt?: string;
}

export interface BatchQuery {
  /** completed only means the batch has finished; inspect each events[].status. */
  status: "processing" | "completed" | "rejected";
  protocol: string;
  code: string;
  description: string;
  issues: EsocialIssue[];
  events: EsocialEventResult[];
  estimatedSeconds?: number;
  /** 'query' errors must not be interpreted as a rejected event. */
  rejectionScope?: "batch" | "query";
  rawResponse: string;
}

export interface SendEsocialBatchInput {
  environment: EsocialEnvironment;
  signedXml: string;
  eventId: string;
  employer: EsocialRegistration;
  transmitter: EsocialRegistration;
  certificate: CertificateMaterial;
  /** Explicitly authorized signer when it differs from the TLS transmitter. */
  signingCertificatePem?: string;
}

export interface QueryEsocialBatchInput {
  environment: EsocialEnvironment;
  protocol: string;
  eventId: string;
  employer: EsocialRegistration;
  /** Exact DigestValue of the stored, verified signed event, not the hash of its file bytes. */
  expectedDigest: string;
  certificate: CertificateMaterial;
  transmitter?: EsocialRegistration;
}

export class EsocialTransportError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** A send that may have reached the government must never be blindly resent. */
    readonly submissionUncertain = false
  ) {
    super(message);
    this.name = "EsocialTransportError";
  }
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 1152 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const EVENT_ID = /^ID[12][A-Z0-9]{12}\d{21}$/;
const PROTOCOL = /^[12]\.[1-9]\.(?:\d{6}\.)?\d{19}$/;
// Manual do Desenvolvedor 1.16, sections 7.5.10, 7.6.10 and 8.6.
// Unknown/temporary codes never authorize changing the event or allocating another Id.
const SUBMISSION_REJECTIONS = new Set(["401", "402", "403", "404", "405", "406", "407"]);
const BATCH_REJECTIONS = new Set(["401", "402", "403", "404", "405"]);
const QUERY_REJECTIONS = new Set(["501", "502", "503", "504", "505"]);
const EVENT_REJECTIONS = new Set([
  "401",
  "402",
  "403",
  "404",
  "405",
  "406",
  "407",
  "408",
  "409",
  "410",
  "411",
]);

function fail(code: string, message: string): never {
  throw new EsocialTransportError(code, message);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function validateEsocialRegistration(
  registration: EsocialRegistration,
  transmitter = false
): void {
  if (
    !registration ||
    (registration.type !== "1" && registration.type !== "2") ||
    typeof registration.number !== "string"
  ) {
    return fail("REGISTRATION_INVALID", "Inscrição eSocial inválida.");
  }
  const value = registration.number;
  if (registration.type === "2") {
    if (!/^\d{11}$/.test(value) || !isValidCpf(value))
      return fail("REGISTRATION_INVALID", "CPF da inscrição eSocial inválido.");
  } else if (!(
    value.length === 8 &&
    !transmitter &&
    /^[A-Z0-9]{8}$/.test(value) &&
    value !== "00000000"
  )) {
    if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || !isValidCnpj(value))
      return fail("REGISTRATION_INVALID", "CNPJ da inscrição eSocial inválido.");
  }
}

function assertEnvironment(environment: EsocialEnvironment): void {
  if (environment !== "restricted" && environment !== "production")
    return fail("ENVIRONMENT_INVALID", "Ambiente eSocial inválido.");
}

function sameRegistration(a: EsocialRegistration, b: EsocialRegistration): boolean {
  return a.type === b.type && a.number === b.number;
}

function registrationXml(registration: EsocialRegistration): string {
  return `<tpInsc>${registration.type}</tpInsc><nrInsc>${escapeXml(registration.number)}</nrInsc>`;
}

function envelope(
  operation: string,
  namespace: string,
  parameter: string,
  payload: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="${ESOCIAL_COMMUNICATION.soap}"><soap:Body><${operation} xmlns="${namespace}"><${parameter}>${payload}</${parameter}></${operation}></soap:Body></soap:Envelope>`;
}

/** Unitary SST batch (group 2). No event is created, signed or changed by the transport. */
export function buildEsocialBatchEnvelope(input: SendEsocialBatchInput): string {
  assertEnvironment(input.environment);
  validateEsocialRegistration(input.employer);
  validateEsocialRegistration(input.transmitter, true);
  assertCertificateMaterialCurrent(input.certificate);
  if (!sameRegistration(input.transmitter, input.certificate.metadata.holder)) {
    return fail(
      "TRANSMITTER_MISMATCH",
      "O transmissor deve corresponder ao titular do A1 usado no TLS."
    );
  }
  const verified = verifyEsocialXmlSignature(
    input.signedXml,
    input.signingCertificatePem ?? input.certificate.certificatePem
  );
  if (
    verified.eventId !== input.eventId ||
    verified.environment !== input.environment ||
    !sameRegistration(verified.employer, input.employer)
  ) {
    return fail(
      "EVENT_CONTEXT_MISMATCH",
      "Evento, empregador ou ambiente divergem do lote autorizado."
    );
  }
  if (
    input.eventId.slice(2, 3) !== input.employer.type ||
    input.eventId.slice(3, 17) !== input.employer.number.padEnd(14, "0")
  ) {
    return fail(
      "EVENT_ID_MISMATCH",
      "O identificador do evento diverge da inscrição do empregador."
    );
  }
  const event = input.signedXml.replace(/^\uFEFF?<\?xml[^?]*\?>\s*/i, "");
  const payload = `<eSocial xmlns="${ESOCIAL_COMMUNICATION.send}"><envioLoteEventos grupo="2"><ideEmpregador>${registrationXml(input.employer)}</ideEmpregador><ideTransmissor>${registrationXml(input.transmitter)}</ideTransmissor><eventos><evento Id="${escapeXml(input.eventId)}">${event}</evento></eventos></envioLoteEventos></eSocial>`;
  return envelope("EnviarLoteEventos", ESOCIAL_COMMUNICATION.sendService, "loteEventos", payload);
}

export function buildEsocialQueryEnvelope(input: QueryEsocialBatchInput): string {
  assertEnvironment(input.environment);
  validateEsocialRegistration(input.employer);
  if (
    !EVENT_ID.test(input.eventId) ||
    !PROTOCOL.test(input.protocol) ||
    !/^[A-Za-z0-9+/]{43}=$/.test(input.expectedDigest)
  )
    return fail("QUERY_INVALID", "Evento ou protocolo eSocial inválido.");
  assertCertificateMaterialCurrent(input.certificate);
  if (input.transmitter) {
    validateEsocialRegistration(input.transmitter, true);
    if (!sameRegistration(input.transmitter, input.certificate.metadata.holder)) {
      return fail(
        "TRANSMITTER_MISMATCH",
        "O transmissor da consulta deve corresponder ao titular do A1."
      );
    }
  }
  const payload = `<eSocial xmlns="${ESOCIAL_COMMUNICATION.query}"><consultaLoteEventos><protocoloEnvio>${escapeXml(input.protocol)}</protocoloEnvio></consultaLoteEventos></eSocial>`;
  return envelope("ConsultarLoteEventos", ESOCIAL_COMMUNICATION.queryService, "consulta", payload);
}

function field(
  node: XmlElement,
  name: string,
  required = true,
  maxLength = 2048
): string | undefined {
  const child = xmlSingleChild(node, name, node.namespaceURI, required);
  if (!child) return undefined;
  const text = child.textContent?.trim() ?? "";
  if (xmlElementChildren(child).length || (required && !text) || text.length > maxLength) {
    return fail("RESPONSE_INVALID", `Conteúdo inválido no retorno eSocial: ${name}.`);
  }
  return text;
}

function resultPayload(raw: string, kind: "send" | "query"): XmlElement {
  const namespaces = ESOCIAL_COMMUNICATION;
  const document = parseEsocialXmlSafely(raw, MAX_RESPONSE_BYTES);
  const root = document.documentElement!;
  if (root.localName !== "Envelope" || root.namespaceURI !== namespaces.soap)
    return fail("SOAP_INVALID", "Retorno não corresponde ao SOAP 1.1 oficial.");
  const rootChildren = xmlElementChildren(root);
  if (
    rootChildren.some(
      (node) =>
        node.namespaceURI !== namespaces.soap || !["Header", "Body"].includes(node.localName!)
    )
  )
    return fail("SOAP_INVALID", "Envelope SOAP inválido.");
  xmlSingleChild(root, "Header", namespaces.soap, false);
  const body = xmlSingleChild(root, "Body", namespaces.soap)!;
  const bodyChildren = xmlElementChildren(body);
  if (bodyChildren.length !== 1)
    return fail("SOAP_INVALID", "O retorno SOAP deve conter uma única resposta.");
  if (bodyChildren[0].localName === "Fault" && bodyChildren[0].namespaceURI === namespaces.soap) {
    return fail(
      "SOAP_FAULT",
      "O serviço eSocial retornou uma falha SOAP; nenhum aceite foi confirmado."
    );
  }
  const operation = kind === "send" ? "EnviarLoteEventos" : "ConsultarLoteEventos";
  const serviceNs = kind === "send" ? namespaces.sendService : namespaces.queryService;
  const response = xmlSingleChild(body, `${operation}Response`, serviceNs)!;
  const result = xmlSingleChild(response, `${operation}Result`, serviceNs)!;
  const dataNs = kind === "send" ? namespaces.sendResult : namespaces.queryResult;
  const dataRoot = xmlSingleChild(result, "eSocial", dataNs)!;
  if (
    xmlElementChildren(response).length !== 1 ||
    xmlElementChildren(result).length !== 1 ||
    xmlElementChildren(dataRoot).length !== 1
  )
    return fail("SOAP_INVALID", "Estrutura do resultado SOAP inválida.");
  return xmlSingleChild(
    dataRoot,
    kind === "send" ? "retornoEnvioLoteEventos" : "retornoProcessamentoLoteEventos",
    dataNs
  )!;
}

function readRegistration(node: XmlElement): EsocialRegistration {
  const type = field(node, "tpInsc", true, 1);
  const number = field(node, "nrInsc", true, 14)!;
  if (type !== "1" && type !== "2")
    return fail("RESPONSE_INVALID", "Tipo de inscrição inválido na resposta eSocial.");
  return { type, number };
}

function matchReturnedRegistration(
  parent: XmlElement,
  name: string,
  expected: EsocialRegistration,
  required: boolean
): void {
  const node = xmlSingleChild(parent, name, parent.namespaceURI, required);
  if (node && !sameRegistration(readRegistration(node), expected))
    return fail(
      "RESPONSE_CONTEXT_MISMATCH",
      "A resposta eSocial pertence a outro empregador ou transmissor."
    );
}

function readIssues(node: XmlElement, allowHistory = false): EsocialIssue[] {
  const group = xmlSingleChild(node, "ocorrencias", node.namespaceURI, false);
  if (!group) return [];
  const issues = xmlElementChildren(group);
  if (!issues.length || issues.length > 2000)
    return fail("RESPONSE_INVALID", "Quantidade de ocorrências inválida.");
  return issues.map((item) => {
    if (item.localName !== "ocorrencia" || item.namespaceURI !== node.namespaceURI)
      return fail("RESPONSE_INVALID", "Ocorrência inválida no retorno eSocial.");
    const type = field(item, "tipo", true, 1);
    const code = field(item, "codigo", true, 12)!;
    if ((type !== "1" && type !== "2" && !(allowHistory && type === "3")) || !/^\d+$/.test(code))
      return fail("RESPONSE_INVALID", "Código de ocorrência eSocial inválido.");
    const location = field(item, "localizacao", false);
    return {
      code,
      description: field(item, "descricao")!,
      type: type === "1" ? "error" : type === "2" ? "warning" : "history",
      ...(location ? { location } : {}),
    };
  });
}

function readStatus(node: XmlElement, allowHistory = false) {
  const code = field(node, "cdResposta", true, 3)!;
  if (!/^\d{3}$/.test(code))
    return fail("RESPONSE_INVALID", "Código de resposta eSocial inválido.");
  return {
    code,
    description: field(node, "descResposta")!,
    issues: readIssues(node, allowHistory),
  };
}

export function parseEsocialSubmissionResponse(
  rawResponse: string,
  input: Pick<SendEsocialBatchInput, "employer" | "transmitter">
): BatchSubmission {
  const payload = resultPayload(rawResponse, "send");
  const status = readStatus(xmlSingleChild(payload, "status")!);
  const accepted = ["201", "202", "203"].includes(status.code);
  matchReturnedRegistration(payload, "ideEmpregador", input.employer, accepted);
  matchReturnedRegistration(payload, "ideTransmissor", input.transmitter, accepted);
  if (accepted) {
    const receipt = xmlSingleChild(payload, "dadosRecepcaoLote")!;
    const protocol = field(receipt, "protocoloEnvio", true, 30)!;
    if (!PROTOCOL.test(protocol) || status.issues.some((issue) => issue.type === "error"))
      return fail(
        "RESPONSE_INVALID",
        "Recepção do lote sem protocolo válido ou com erros contraditórios."
      );
    return {
      status: "accepted",
      ...status,
      protocol,
      duplicateBatch: status.code === "203",
      receivedAt: field(receipt, "dhRecepcao", true, 40),
      rawResponse,
    };
  }
  return {
    status: SUBMISSION_REJECTIONS.has(status.code) ? "rejected" : "uncertain",
    ...status,
    rawResponse,
  };
}

function parseEventResult(wrapper: XmlElement, input: QueryEsocialBatchInput): EsocialEventResult {
  const eventId = wrapper.getAttribute("Id");
  if (eventId !== input.eventId)
    return fail("RESPONSE_EVENT_MISMATCH", "O recibo retornado pertence a outro evento.");
  const duplicate = wrapper.getAttribute("evtDupl");
  if (duplicate && !["true", "false", "1", "0"].includes(duplicate))
    return fail("RESPONSE_INVALID", "Marcador de duplicidade inválido.");
  const content = xmlSingleChild(wrapper, "retornoEvento")!;
  const returnedXml = xmlSingleChild(content, "eSocial", ESOCIAL_COMMUNICATION.eventResult)!;
  if (xmlElementChildren(content).length !== 1)
    return fail("RESPONSE_INVALID", "Retorno do evento ambíguo.");
  const event = xmlSingleChild(returnedXml, "retornoEvento", ESOCIAL_COMMUNICATION.eventResult)!;
  if (event.getAttribute("Id") !== eventId)
    return fail("RESPONSE_EVENT_MISMATCH", "Identificadores interno e externo do recibo divergem.");
  matchReturnedRegistration(event, "ideEmpregador", input.employer, true);
  const reception = xmlSingleChild(event, "recepcao")!;
  const environmentCode = field(reception, "tpAmb", true, 1);
  if (environmentCode !== (input.environment === "production" ? "1" : "2"))
    return fail("RESPONSE_ENVIRONMENT_MISMATCH", "O retorno pertence a outro ambiente eSocial.");
  const protocol = field(reception, "protocoloEnvioLote", false, 30);
  if (protocol && protocol !== input.protocol)
    return fail("RESPONSE_PROTOCOL_MISMATCH", "O evento retornado pertence a outro protocolo.");
  const processing = xmlSingleChild(event, "processamento")!;
  const status = readStatus(processing, true);
  const processedAt = field(processing, "dhProcessamento", true, 40)!;
  const success = status.code === "201" || status.code === "202";
  const receipt = xmlSingleChild(event, "recibo", event.namespaceURI, success);
  if (success) {
    const number = field(receipt!, "nrRecibo", true, 40)!;
    if (
      !/^1\.[1-9]\.\d{19}$/.test(number) ||
      number.split(".")[1] !== environmentCode ||
      status.issues.some((issue) => issue.type === "error")
    )
      return fail(
        "RESPONSE_RECEIPT_INVALID",
        "Evento aceito sem recibo válido ou com erros contraditórios."
      );
    const receiptHash = field(receipt!, "hash", true, 1024)!.replace(/\s/g, "");
    if (receiptHash !== input.expectedDigest)
      return fail(
        "RESPONSE_DIGEST_MISMATCH",
        "O hash do recibo não corresponde ao conteúdo assinado deste evento."
      );
    return {
      eventId,
      status: duplicate === "true" || duplicate === "1" ? "duplicate" : "accepted",
      ...status,
      receipt: number,
      receiptHash,
      processedAt,
    };
  }
  if (receipt)
    return fail(
      "RESPONSE_RECEIPT_INVALID",
      "Resposta contraditória: recibo presente para um evento rejeitado."
    );
  if (status.code === "301")
    return fail(
      "ESOCIAL_TEMPORARY_ERROR",
      "O eSocial informou erro temporário no processamento do evento. Preserve o protocolo e consulte novamente."
    );
  if (!EVENT_REJECTIONS.has(status.code))
    return fail(
      "RESPONSE_UNKNOWN",
      "Código de processamento do evento não reconhecido; nenhuma rejeição definitiva foi confirmada."
    );
  // A duplicate error without the original receipt is not proof of acceptance.
  return { eventId, status: "rejected", ...status, processedAt };
}

export function parseEsocialQueryResponse(
  rawResponse: string,
  input: QueryEsocialBatchInput
): BatchQuery {
  const payload = resultPayload(rawResponse, "query");
  const statusNode = xmlSingleChild(payload, "status")!;
  const status = readStatus(statusNode);
  if (status.code === "301")
    return fail(
      "ESOCIAL_TEMPORARY_ERROR",
      "O eSocial informou erro temporário na consulta. Preserve o protocolo e consulte novamente."
    );
  const completed = ["201", "202"].includes(status.code);
  const processing = status.code === "101";
  matchReturnedRegistration(payload, "ideEmpregador", input.employer, completed);
  matchReturnedRegistration(
    payload,
    "ideTransmissor",
    input.transmitter ?? input.certificate.metadata.holder,
    completed
  );
  const reception = xmlSingleChild(payload, "dadosRecepcaoLote", payload.namespaceURI, completed);
  if (reception && field(reception, "protocoloEnvio", true, 30) !== input.protocol)
    return fail("RESPONSE_PROTOCOL_MISMATCH", "A resposta pertence a outro protocolo eSocial.");
  const group = xmlSingleChild(payload, "retornoEventos", payload.namespaceURI, completed);
  const wrappers = group ? xmlElementChildren(group) : [];
  if (
    completed &&
    (wrappers.length !== 1 ||
      wrappers[0].localName !== "evento" ||
      wrappers[0].namespaceURI !== payload.namespaceURI)
  )
    return fail(
      "RESPONSE_EVENT_MISMATCH",
      "Esperado exatamente o evento do lote unitário autorizado."
    );
  if (!completed && wrappers.length)
    return fail("RESPONSE_INVALID", "Resposta incompleta contém recibos inesperados.");
  const estimated = field(statusNode, "tempoEstimadoConclusao", false, 8);
  if (estimated !== undefined && !/^\d{1,8}$/.test(estimated))
    return fail("RESPONSE_INVALID", "Tempo de processamento inválido.");
  if (
    !completed &&
    !processing &&
    !BATCH_REJECTIONS.has(status.code) &&
    !QUERY_REJECTIONS.has(status.code)
  )
    return fail(
      "RESPONSE_UNKNOWN",
      "Código de processamento eSocial não reconhecido; nenhum aceite confirmado."
    );
  return {
    status: completed ? "completed" : processing ? "processing" : "rejected",
    protocol: input.protocol,
    ...status,
    events: completed ? wrappers.map((wrapper) => parseEventResult(wrapper, input)) : [],
    ...(estimated !== undefined ? { estimatedSeconds: Number(estimated) } : {}),
    ...(!completed && !processing
      ? {
          rejectionScope: QUERY_REJECTIONS.has(status.code)
            ? ("query" as const)
            : ("batch" as const),
        }
      : {}),
    rawResponse,
  };
}

/** One POST, TLS peer verification enabled, no redirects/retries, finite total timeout. */
async function soapPost(
  environment: EsocialEnvironment,
  operation: "send" | "query",
  xml: string,
  material: CertificateMaterial
): Promise<{ statusCode: number; body: string }> {
  assertEnvironment(environment);
  const bytes = Buffer.from(xml, "utf8");
  if (bytes.length > MAX_REQUEST_BYTES)
    return fail("REQUEST_SIZE", "Lote eSocial maior que o limite permitido.");
  const url = new URL(ESOCIAL_ENDPOINTS[environment][operation]);
  const serviceNs =
    operation === "send" ? ESOCIAL_COMMUNICATION.sendService : ESOCIAL_COMMUNICATION.queryService;
  const service = operation === "send" ? "EnviarLoteEventos" : "ConsultarLoteEventos";
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (
      error?: EsocialTransportError,
      response?: { statusCode: number; body: string }
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (error) reject(error);
      else resolve(response!);
    };
    const failure = (code: string, description: string) =>
      new EsocialTransportError(code, description, operation === "send");
    let request: ReturnType<typeof httpsRequest> | undefined;
    const deadline = setTimeout(() => {
      finish(
        failure(
          "TRANSPORT_TIMEOUT",
          "Tempo limite do eSocial atingido; o resultado do envio precisa ser conciliado."
        )
      );
      request?.destroy();
    }, REQUEST_TIMEOUT_MS);
    deadline.unref();
    try {
      request = httpsRequest(
        url,
        {
          method: "POST",
          agent: false,
          cert: [material.certificatePem, ...material.chainPem].join("\n"),
          key: material.privateKeyPem,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          maxHeaderSize: 16 * 1024,
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "Content-Length": bytes.length,
            SOAPAction: `"${serviceNs}/Servico${service}/${service}"`,
            Accept: "text/xml",
            "Accept-Encoding": "identity",
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          const contentEncoding = response.headers["content-encoding"];
          if (contentEncoding && contentEncoding !== "identity") {
            finish(failure("RESPONSE_ENCODING", "Codificação de resposta eSocial não suportada."));
            response.destroy();
            return;
          }
          response.on("data", (chunk: Buffer | string) => {
            const data = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
            size += data.length;
            if (size > MAX_RESPONSE_BYTES) {
              finish(failure("RESPONSE_SIZE", "Retorno do eSocial excede o limite permitido."));
              response.destroy();
              return;
            }
            chunks.push(data);
          });
          response.on("end", () => {
            const data = Buffer.concat(chunks);
            let body: string;
            try {
              body = new TextDecoder("utf-8", { fatal: true }).decode(data);
            } catch {
              finish(failure("RESPONSE_ENCODING", "O retorno do eSocial não é UTF-8 válido."));
              return;
            }
            finish(undefined, { statusCode: response.statusCode ?? 0, body });
          });
          response.on("error", () =>
            finish(
              failure(
                "TRANSPORT_ERROR",
                "Falha ao receber a resposta do eSocial; nenhum aceite foi confirmado."
              )
            )
          );
          response.on("aborted", () =>
            finish(
              failure(
                "TRANSPORT_ERROR",
                "Conexão eSocial interrompida; nenhum aceite foi confirmado."
              )
            )
          );
        }
      );
    } catch {
      finish(
        failure("TRANSPORT_ERROR", "Não foi possível iniciar a conexão autenticada com o eSocial.")
      );
      return;
    }
    request.on("error", () =>
      finish(
        failure(
          "TRANSPORT_ERROR",
          "Falha na conexão autenticada com o eSocial; nenhum aceite foi confirmado."
        )
      )
    );
    request.end(bytes);
  });
}

export async function sendEsocialBatch(input: SendEsocialBatchInput): Promise<BatchSubmission> {
  if (!isEsocialTransmissionEnabled())
    throw new EsocialTransportError(
      "TRANSMISSION_DISABLED",
      ESOCIAL_TRANSMISSION_DISABLED_MESSAGE,
      false
    );
  // Fail locally before starting any request. Authorization and durable outbox live in the caller.
  const body = buildEsocialBatchEnvelope(input);
  let response: { statusCode: number; body: string } | undefined;
  try {
    response = await soapPost(input.environment, "send", body, input.certificate);
    if (response.statusCode !== 200)
      return {
        status: "uncertain",
        code: `HTTP_${response.statusCode}`,
        description:
          "O serviço não confirmou a recepção. Concilie o envio antes de tentar novamente.",
        issues: [],
        rawResponse: response.body,
      };
    return parseEsocialSubmissionResponse(response.body, input);
  } catch (error) {
    const code = error instanceof EsocialTransportError ? error.code : "RESPONSE_INVALID";
    return {
      status: "uncertain",
      code,
      description:
        "Não foi possível confirmar a recepção do lote. Preserve o evento e concilie antes de reenviar.",
      issues: [],
      ...(response ? { rawResponse: response.body } : {}),
    };
  }
}

export async function queryEsocialBatch(input: QueryEsocialBatchInput): Promise<BatchQuery> {
  const body = buildEsocialQueryEnvelope(input);
  const response = await soapPost(input.environment, "query", body, input.certificate);
  if (response.statusCode !== 200)
    return fail(
      `HTTP_${response.statusCode}`,
      "A consulta eSocial falhou; preserve o protocolo e consulte novamente."
    );
  return parseEsocialQueryResponse(response.body, input);
}
