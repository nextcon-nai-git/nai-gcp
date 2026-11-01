import "server-only";
import { createHash, randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { XmlDocument, XmlElement, XsdValidator } from "libxml2-wasm";
import type { AsoFlowCard } from "@/lib/aso-flow";
import {
  ESOCIAL_LAYOUT,
  ESOCIAL_EVENT_TYPES,
  EsocialCpfSchema,
  EsocialEmployerSchema,
  EsocialReceiptSchema,
  EsocialEventInputSchema,
  EsocialWorkerSchema,
  createEsocialEventDefaults,
  normalizeEsocialRegistration,
  type EsocialEventInput,
  type EsocialEventType,
} from "@/lib/esocial-events";

export const ESOCIAL_MAX_XML_BYTES = 1024 * 1024;
export const ESOCIAL_EVENT_ELEMENTS = {
  S2210: "evtCAT",
  S2220: "evtMonit",
  S2240: "evtExpRisco",
  S2221: "evtToxic",
  S2230: "evtAfastTemp",
  S3000: "evtExclusao",
} as const;
const DS = "http://www.w3.org/2000/09/xmldsig#";
const namespace = (eventType: EsocialEventType) =>
  `http://www.esocial.gov.br/schema/evt/${ESOCIAL_EVENT_ELEMENTS[eventType]}/v_S_01_03_00`;
const APP_VERSION = "NAI-1.0";
export interface EsocialGeneratedEvent {
  xml: string;
  eventType: EsocialEventType;
  eventId: string;
  environment: "restricted" | "production";
  employer: { type: "1" | "2"; number: string };
  worker: { cpf: string; matricula?: string; category?: number } | null;
  layout: typeof ESOCIAL_LAYOUT;
  xsdValidated: true;
  businessValidation: "NOT_EVALUATED";
  /** Structural presence only. Cryptographic verification belongs to the signer. */
  signed: boolean;
  payload?: EsocialEventInput;
}
export class EsocialXmlValidationError extends Error {
  readonly code = "ESOCIAL_XML_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "EsocialXmlValidationError";
  }
}
const invalid = (message: string): never => {
  throw new EsocialXmlValidationError(message);
};
export function escapeEsocialXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
/** Tags come exclusively from a parsed strict schema, never from caller-supplied XML. */
function elements(data: Record<string, unknown>, indent: number): string {
  const pad = "  ".repeat(indent);
  return Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) return invalid("Nome de elemento inválido.");
      const one = (item: unknown): string =>
        item && typeof item === "object"
          ? `${pad}<${key}>\n${elements(item as Record<string, unknown>, indent + 1)}\n${pad}</${key}>`
          : `${pad}<${key}>${escapeEsocialXml(item as string | number)}</${key}>`;
      return (Array.isArray(value) ? value.map(one) : [one(value)]).join("\n");
    })
    .join("\n");
}
function parseEventInput(input: unknown): EsocialEventInput {
  const parsed = EsocialEventInputSchema.safeParse(input);
  if (!parsed.success) {
    // Deliberately omit supplied values and Zod's received-value descriptions from logs/errors.
    const issues = parsed.error.issues
      .slice(0, 12)
      .map(
        (e) =>
          `${e.path.join(".") || "evento"}: ${e.code === "custom" ? e.message : "campo ausente ou inválido"}`
      );
    return invalid(`Dados eSocial incompletos ou inválidos. ${issues.join("; ")}`);
  }
  return parsed.data;
}
/** Pure draft serializer. Use generateEsocialEvent for XSD validation before persistence. */
export function buildEsocialEventXml(input: unknown): string {
  const data = parseEventInput(input);
  if (!data.id)
    return invalid("Dados eSocial incompletos ou inválidos: identificador do evento ausente.");
  const ideEvento = {
    ...(data.eventType === "S3000"
      ? {}
      : { indRetif: data.ideEvento.indRetif, nrRecibo: data.ideEvento.nrRecibo }),
    tpAmb: data.ideEvento.tpAmb,
    procEmi: 1,
    verProc: APP_VERSION,
  };
  let specific: Record<string, unknown>;
  if (data.eventType === "S2220") {
    const a = data.aso;
    specific = {
      exMedOcup: {
        tpExameOcup: a.tpAso,
        aso: {
          dtAso: a.dtAso,
          resAso: a.resAso,
          exame: a.exames,
          medico: { nmMed: a.medico.nmMed, nrCRM: a.medico.nrCrm, ufCRM: a.medico.ufCrm },
        },
        respMonit: a.medicoResp
          ? {
              cpfResp: a.medicoResp.cpfResp,
              nmResp: a.medicoResp.nmMed,
              nrCRM: a.medicoResp.nrCrm,
              ufCRM: a.medicoResp.ufCrm,
            }
          : undefined,
      },
    };
  } else if (data.eventType === "S2210") specific = { cat: data.cat };
  else if (data.eventType === "S2240") specific = { infoExpRisco: data.infoExpRisco };
  else if (data.eventType === "S2221") specific = { toxicologico: data.toxicologico };
  else if (data.eventType === "S2230") specific = { infoAfastamento: data.infoAfastamento };
  else
    specific = {
      infoExclusao: { ...data.infoExclusao, ideTrabalhador: { cpfTrab: data.ideVinculo.cpfTrab } },
    };
  const event = {
    ideEvento,
    ideEmpregador: data.ideEmpregador,
    ...(data.eventType === "S3000" ? {} : { ideVinculo: data.ideVinculo }),
    ...specific,
  };
  const element = ESOCIAL_EVENT_ELEMENTS[data.eventType];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<eSocial xmlns="${namespace(data.eventType)}">\n  <${element} Id="${data.id}">\n${elements(event, 2)}\n  </${element}>\n</eSocial>\n`;
  assertSafeEsocialXml(xml);
  return xml;
}
/** Manual 1.16, §8.3: registration is right-padded with zeros to 14 characters. */
export function createEsocialEventId(
  employer: { tpInsc: 1 | 2; nrInsc: string },
  now = new Date(),
  sequence = randomInt(1, 100000)
): string {
  const e = EsocialEmployerSchema.parse(employer);
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 99999
  )
    return invalid("Data/sequência do identificador inválida.");
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .replace(/\D/g, "");
  return `ID${e.tpInsc}${e.nrInsc.padEnd(14, "0")}${stamp}${String(sequence).padStart(5, "0")}`;
}
/** Reject active XML before invoking any parser. No DTD, entity declarations, PI or external schemas. */
export function assertSafeEsocialXml(xml: string): void {
  if (
    typeof xml !== "string" ||
    !xml.trim() ||
    Buffer.byteLength(xml, "utf8") > ESOCIAL_MAX_XML_BYTES
  )
    return invalid("XML vazio ou acima do limite de 1 MiB.");
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(xml) ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(xml)
  )
    return invalid("XML contém caracteres inválidos.");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))
    return invalid("DTD e declarações de entidades são proibidos.");
  const body = xml.replace(/^\uFEFF?\s*<\?xml\s+[^?]*\?>/i, "");
  if (/<\?/.test(body)) return invalid("Instruções de processamento XML são proibidas.");
  const declaration = xml.match(/^\uFEFF?\s*<\?xml\s+([^?]*)\?>/i)?.[1];
  if (declaration && /encoding\s*=\s*['"](?!UTF-8['"])[^'"]+['"]/i.test(declaration))
    return invalid("Importe XML codificado em UTF-8.");
  if (
    /\b(?:schemaLocation|noNamespaceSchemaLocation)\s*=/i.test(xml) ||
    /http:\/\/www\.w3\.org\/2001\/XInclude/.test(xml)
  )
    return invalid("Referências de esquema externo e XInclude são proibidas.");
}

type XmlRuntime = typeof import("libxml2-wasm");
const VIRTUAL_BASE = "nai-esocial:///s-1.3-20261026/";
interface SchemaRuntime {
  lib: XmlRuntime;
  files: Map<string, Buffer>;
  validators: Map<string, XsdValidator>;
}
// No generic file/network loader is ever registered. Compilation and validation are synchronous
// after this shared initialization, so concurrent requests cannot alter the schema provider.
let runtimePromise: Promise<SchemaRuntime> | undefined;
async function runtime(): Promise<SchemaRuntime> {
  if (!runtimePromise)
    runtimePromise = (async () => {
      const lib = await import("libxml2-wasm");
      const directory = path.join(process.cwd(), "assets", "esocial", "s-1.3-20261026");
      const provenance = JSON.parse(
        await readFile(path.join(directory, "provenance.json"), "utf8")
      ) as { files: { file: string; sha256: string; bytes: number }[] };
      const required = [
        ...Object.values(ESOCIAL_EVENT_ELEMENTS).map((name) => `${name}.xsd`),
        "tipos.xsd",
        "xmldsig-core-schema.xsd",
      ];
      const files = new Map<string, Buffer>();
      await Promise.all(
        required.map(async (file) => {
          const record = provenance.files.find((entry) => entry.file === file);
          const bytes = await readFile(path.join(directory, file));
          if (
            !record ||
            bytes.length !== record.bytes ||
            createHash("sha256").update(bytes).digest("hex") !== record.sha256
          )
            throw new Error("Integridade do pacote XSD eSocial não confirmada.");
          files.set(file, bytes);
        })
      );
      const buffers = Object.fromEntries(
        ["tipos.xsd", "xmldsig-core-schema.xsd"].map((file) => [
          VIRTUAL_BASE + file,
          files.get(file)!,
        ])
      );
      if (!lib.xmlRegisterInputProvider(new lib.XmlBufferInputProvider(buffers)))
        throw new Error("Validador XSD não inicializado.");
      return { lib, files, validators: new Map<string, XsdValidator>() };
    })().catch((error) => {
      runtimePromise = undefined;
      throw error;
    });
  return runtimePromise;
}
function validator(rt: SchemaRuntime, type: EsocialEventType, signed: boolean): XsdValidator {
  const key = `${type}:${signed}`;
  const cached = rt.validators.get(key);
  if (cached) return cached;
  const file = `${ESOCIAL_EVENT_ELEMENTS[type]}.xsd`;
  let schema = rt.files.get(file)!.toString("utf8");
  if (!signed) {
    const signature = /<xs:element\s+ref="ds:Signature"\s*\/>/g;
    if ([...schema.matchAll(signature)].length !== 1)
      throw new Error("Regra de assinatura do pacote XSD inesperada.");
    // Official bytes remain unchanged on disk. This exception validates an unsigned draft,
    // not its signature. Every other element/type/facet comes from the official package.
    schema = schema.replace(signature, '<xs:element ref="ds:Signature" minOccurs="0" />');
  }
  const doc = rt.lib.XmlDocument.fromString(schema, {
    url: VIRTUAL_BASE + file,
    option:
      rt.lib.ParseOption.XML_PARSE_NONET |
      rt.lib.ParseOption.XML_PARSE_NO_XXE |
      rt.lib.ParseOption.XML_PARSE_NO_SYS_CATALOG,
  });
  try {
    const v = rt.lib.XsdValidator.fromDoc(doc);
    rt.validators.set(key, v);
    return v;
  } finally {
    doc.dispose();
  }
}
function strictStructure(
  doc: XmlDocument,
  lib: XmlRuntime
): { eventType: EsocialEventType; event: XmlElement; signed: boolean } {
  const root = doc.root;
  if (root.name !== "eSocial")
    return invalid("O documento precisa conter um único eSocial de evento.");
  const eventType = ESOCIAL_EVENT_TYPES.find((type) => namespace(type) === root.namespaceUri);
  if (!eventType) return invalid("Evento/leiaute não suportado. Use o pacote S-1.3 de 26/10/2026.");
  let count = 0;
  const visit = (element: XmlElement, depth: number) => {
    if (++count > 12000 || depth > 32 || element.attrs.length > 16)
      return invalid("XML excede os limites de estrutura.");
    if (element.namespaceUri !== root.namespaceUri && element.namespaceUri !== DS)
      return invalid("Namespace externo não permitido no evento.");
    for (const attr of element.attrs) {
      if (attr.namespaceUri && attr.namespaceUri !== "http://www.w3.org/XML/1998/namespace")
        return invalid("Atributo de namespace externo não permitido.");
      if (["href", "schemaLocation", "noNamespaceSchemaLocation", "base"].includes(attr.name))
        return invalid("Referência externa não permitida no XML.");
    }
    for (let child = element.firstChild; child; child = child.next) {
      if (child instanceof lib.XmlElement) visit(child, depth + 1);
      else if (
        !(child instanceof lib.XmlText) &&
        !(child instanceof lib.XmlComment) &&
        !(child instanceof lib.XmlCData)
      )
        return invalid("Tipo de nó não permitido no XML.");
    }
  };
  visit(root, 0);
  const children = root.find("./*") as XmlElement[];
  const events = children.filter(
    (c) => c.namespaceUri === root.namespaceUri && c.name === ESOCIAL_EVENT_ELEMENTS[eventType]
  );
  const signatures = doc.find("//*[local-name()='Signature']") as XmlElement[];
  if (
    events.length !== 1 ||
    signatures.length > 1 ||
    children.length !== 1 + signatures.length ||
    signatures.some((s) => s.namespaceUri !== DS || s.parent?.isSameNode(root) !== true)
  )
    return invalid(
      "XML deve ter um único evento e no máximo uma assinatura diretamente sob eSocial."
    );
  if (
    root.attrs.length ||
    events[0].attrs.length !== 1 ||
    events[0].attr("Id") === null ||
    doc.find("//@Id").length !== 1
  )
    return invalid("Identificador de evento ausente, duplicado ou ambíguo.");
  return { eventType, event: events[0], signed: signatures.length === 1 };
}
const arrayNames = new Set(["exame", "infoAmb", "agNoc", "respReg", "epi"]);
const numericNames = new Set([
  "tpAmb",
  "indRetif",
  "tpInsc",
  "codCateg",
  "tpExameOcup",
  "resAso",
  "ordExame",
  "indResult",
  "tpAcid",
  "tpCat",
  "iniciatCAT",
  "tpLocal",
  "lateralidade",
  "durTrat",
  "ideOC",
  "localAmb",
  "tpAval",
  "unMed",
  "utilizEPC",
  "utilizEPI",
  "tpAcidTransito",
  "infOnus",
  "infOnusRemun",
  "origRetif",
  "tpProc",
]);
/** Convert only validated known-layout nodes; optional payload is not proof of clinical review. */
function readObject(element: XmlElement): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const child of element.find("./*") as XmlElement[]) {
    const value = child.find("./*").length
      ? readObject(child)
      : numericNames.has(child.name)
        ? Number(child.content)
        : child.content;
    if (arrayNames.has(child.name)) ((out[child.name] ||= []) as unknown[]).push(value);
    else out[child.name] = value;
  }
  return out;
}
function inputFromXml(eventType: EsocialEventType, event: XmlElement): unknown {
  const data = readObject(event) as any;
  delete data.ideEvento.procEmi;
  delete data.ideEvento.verProc;
  const base = {
    eventType,
    id: event.attr("Id")!.content,
    ideEvento: data.ideEvento,
    ideEmpregador: data.ideEmpregador,
    ideVinculo: data.ideVinculo,
  };
  if (eventType === "S2220") {
    const m = data.exMedOcup,
      a = m.aso;
    return {
      ...base,
      aso: {
        dtAso: a.dtAso,
        tpAso: m.tpExameOcup,
        resAso: a.resAso,
        exames: a.exame,
        medico: { nmMed: a.medico.nmMed, nrCrm: a.medico.nrCRM, ufCrm: a.medico.ufCRM },
        medicoResp: m.respMonit
          ? {
              cpfResp: m.respMonit.cpfResp,
              nmMed: m.respMonit.nmResp,
              nrCrm: m.respMonit.nrCRM,
              ufCrm: m.respMonit.ufCRM,
            }
          : undefined,
      },
    };
  }
  if (eventType === "S3000")
    return {
      ...base,
      ideVinculo: data.infoExclusao.ideTrabalhador,
      infoExclusao: { tpEvento: data.infoExclusao.tpEvento, nrRecEvt: data.infoExclusao.nrRecEvt },
    };
  const field = {
    S2210: "cat",
    S2240: "infoExpRisco",
    S2221: "toxicologico",
    S2230: "infoAfastamento",
  }[eventType];
  return { ...base, [field]: data[field] };
}
/** Validates structure and identity only; never verifies RET, professional credentials, receipt or signature cryptography. */
export async function validateEsocialXml(
  xml: string,
  options: { allowUnsigned?: boolean } = {}
): Promise<EsocialGeneratedEvent> {
  assertSafeEsocialXml(xml);
  const rt = await runtime();
  let doc: XmlDocument | undefined;
  try {
    doc = rt.lib.XmlDocument.fromString(xml, {
      option:
        rt.lib.ParseOption.XML_PARSE_NONET |
        rt.lib.ParseOption.XML_PARSE_NO_XXE |
        rt.lib.ParseOption.XML_PARSE_NO_SYS_CATALOG,
    });
    if (doc.dtd) return invalid("DTD não permitido.");
    const { eventType, event, signed } = strictStructure(doc, rt.lib);
    if (!signed && options.allowUnsigned !== true)
      return invalid(
        "XML sem assinatura; permitido somente como rascunho explicitamente solicitado."
      );
    try {
      validator(rt, eventType, signed).validate(doc);
    } catch {
      return invalid(
        "XML incompatível com o XSD oficial S-1.3 de 26/10/2026. Confira elementos, ordem, tipos e limites."
      );
    }
    const ns = { e: namespace(eventType) };
    const get = (p: string) => event.get(p, ns)?.content || "";
    const employer = EsocialEmployerSchema.safeParse({
      tpInsc: Number(get("./e:ideEmpregador/e:tpInsc")),
      nrInsc: get("./e:ideEmpregador/e:nrInsc"),
    });
    if (!employer.success) return invalid("Inscrição do empregador no XML inválida.");
    const eventId = event.attr("Id")!.content;
    if (!eventId.startsWith(`ID${employer.data.tpInsc}${employer.data.nrInsc.padEnd(14, "0")}`))
      return invalid("Identificador do XML não corresponde ao empregador.");
    if (eventType !== "S3000") {
      const indRetif = Number(get("./e:ideEvento/e:indRetif"));
      const receipt = get("./e:ideEvento/e:nrRecibo");
      if (
        (indRetif === 2 && !EsocialReceiptSchema.safeParse(receipt).success) ||
        (indRetif === 1 && receipt)
      )
        return invalid("Indicador de retificação e recibo do evento incompatíveis.");
    }
    const tpAmb = Number(get("./e:ideEvento/e:tpAmb"));
    if (tpAmb !== 1 && tpAmb !== 2) return invalid("Ambiente do evento não suportado.");
    let worker: EsocialGeneratedEvent["worker"] = null;
    if (eventType !== "S3000") {
      const w = EsocialWorkerSchema.safeParse({
        cpfTrab: get("./e:ideVinculo/e:cpfTrab"),
        matricula: get("./e:ideVinculo/e:matricula") || undefined,
        codCateg: get("./e:ideVinculo/e:codCateg")
          ? Number(get("./e:ideVinculo/e:codCateg"))
          : undefined,
      });
      if (!w.success) return invalid("CPF/matrícula/categoria do trabalhador no XML inválidos.");
      worker = {
        cpf: w.data.cpfTrab,
        ...(w.data.matricula ? { matricula: w.data.matricula } : {}),
        ...(w.data.codCateg === undefined ? {} : { category: w.data.codCateg }),
      };
    } else {
      if (
        !["S-2210", "S-2220", "S-2240", "S-2221", "S-2230"].includes(
          get("./e:infoExclusao/e:tpEvento")
        ) ||
        !EsocialCpfSchema.safeParse(get("./e:infoExclusao/e:ideTrabalhador/e:cpfTrab")).success
      )
        return invalid("Exclusão deve referenciar um evento suportado e CPF válido.");
    }
    const parsed = EsocialEventInputSchema.safeParse(inputFromXml(eventType, event));
    return {
      xml,
      eventType,
      eventId,
      environment: tpAmb === 2 ? "restricted" : "production",
      employer: { type: String(employer.data.tpInsc) as "1" | "2", number: employer.data.nrInsc },
      worker,
      layout: ESOCIAL_LAYOUT,
      xsdValidated: true,
      businessValidation: "NOT_EVALUATED",
      signed,
      ...(parsed.success ? { payload: parsed.data } : {}),
    };
  } catch (error) {
    if (error instanceof EsocialXmlValidationError) throw error;
    return invalid(
      "Não foi possível validar o XML. Confira documento e configuração do pacote oficial."
    );
  } finally {
    doc?.dispose();
  }
}
export async function generateEsocialEvent(
  input: unknown,
  options: { now?: Date; sequence?: number } = {}
): Promise<EsocialGeneratedEvent> {
  const parsed = parseEventInput(input);
  const data = {
    ...parsed,
    id: parsed.id || createEsocialEventId(parsed.ideEmpregador, options.now, options.sequence),
  };
  const xml = buildEsocialEventXml(data);
  const validated = await validateEsocialXml(xml, { allowUnsigned: true });
  return { ...validated, payload: data };
}

export function createS2220DraftFromReviewedAso(
  card: AsoFlowCard,
  identity: {
    employer: { type: "1" | "2"; number: string };
    worker: { cpf: string; matricula?: string; category?: number };
  }
): {
  payload: Record<string, unknown>;
  source: {
    cardId: string;
    version: number;
    documentHash: string;
    reviewedAt: string;
    reviewedBy: string;
  };
  missingFields: string[];
} {
  if (
    !["reviewed", "delivered"].includes(card.status) ||
    !card.aso ||
    !card.review ||
    !/^[a-f0-9]{64}$/.test(card.aso.hash) ||
    card.aso.hash !== card.review.hash ||
    card.review.identityConfirmed !== true ||
    card.review.documentChecked !== true ||
    !card.review.reviewedAt ||
    !card.review.reviewedBy
  )
    return invalid(
      "Confira o ASO recebido e a identidade do trabalhador antes de preparar S-2220."
    );
  const employer = EsocialEmployerSchema.parse({
    tpInsc: Number(identity.employer.type),
    nrInsc: identity.employer.number,
  });
  const worker = EsocialWorkerSchema.parse({
    cpfTrab: identity.worker.cpf,
    matricula: identity.worker.matricula,
    codCateg: identity.worker.category,
  });
  const companyRegistration = normalizeEsocialRegistration(card.cnpj);
  if (!(
    companyRegistration === employer.nrInsc ||
    (employer.tpInsc === 1 &&
      employer.nrInsc.length === 8 &&
      companyRegistration.startsWith(employer.nrInsc))
  ))
    return invalid("Cliente do ASO não corresponde ao empregador selecionado.");
  const expectedIdentity = createHash("sha256")
    .update(JSON.stringify([card.companyId, card.employeeId, worker.cpfTrab]))
    .digest("hex");
  if (!card.employeeIdentityHash || card.employeeIdentityHash !== expectedIdentity)
    return invalid("CPF atual não corresponde à identidade revisada do card.");
  if (
    card.archive &&
    (card.archive.hash !== card.aso.hash ||
      card.archive.companyId !== card.companyId ||
      card.archive.employeeId !== card.employeeId)
  )
    return invalid("Arquivo do ASO está divergente da conferência.");
  const types = {
    admissional: 0,
    periodico: 1,
    retorno_trabalho: 2,
    mudanca_funcao: 3,
    demissional: 9,
  } as const;
  const type = types[card.examType];
  if (type === undefined) return invalid("Tipo de ASO não reconhecido.");
  const payload = {
    ...createEsocialEventDefaults("S2220"),
    ideEmpregador: employer,
    ideVinculo: worker,
    aso: {
      dtAso: "",
      tpAso: type,
      exames: [{ dtExm: "", procRealizado: "" }],
      medico: { nmMed: "", nrCrm: "", ufCrm: "" },
    },
  };
  return {
    payload,
    source: {
      cardId: card.id,
      version: card.version,
      documentHash: card.aso.hash,
      reviewedAt: card.review.reviewedAt,
      reviewedBy: card.review.reviewedBy,
    },
    missingFields: [
      "aso.dtAso",
      "aso.exames",
      "aso.medico",
      "confirmar responsável pelo PCMSO e autorização de resultados, se aplicáveis",
    ],
  };
}
