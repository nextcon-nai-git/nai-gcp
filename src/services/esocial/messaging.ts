import "server-only";
import { randomUUID } from "node:crypto";
import { FieldPath, type Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { parseClaims } from "@/lib/auth/claims";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { isPgrGlobalAdmin } from "@/lib/auth/require-pgr-access";
import type { AsoFlowCard } from "@/lib/aso-flow";
import { EsocialReceiptSchema, normalizeEsocialRegistration } from "@/lib/esocial-events";
import {
  ESOCIAL_TRANSMISSION_DISABLED_MESSAGE,
  isEsocialTransmissionEnabled,
} from "@/lib/esocial-transmission-policy";
import type {
  EsocialEventType,
  EsocialGrant,
  EsocialMessageEvent,
  EsocialMessagingCapabilities,
} from "@/lib/esocial-messaging";
import {
  canManageEsocialConnection,
  currentEsocialUser,
  esocialDocumentId,
  esocialPrivateRoot,
  requireEsocialAdministrator,
  requireEsocialMessagingAccess,
} from "./access";
import {
  readEsocialArtifact,
  saveEsocialArtifact,
  type EsocialArtifact,
  type EsocialArtifactKind,
} from "./artifacts";
import { signEsocialXml, verifyEsocialXmlSignature, type EsocialRegistration } from "./certificate";
import {
  createS2220DraftFromReviewedAso,
  generateEsocialEvent,
  validateEsocialXml,
  type EsocialGeneratedEvent,
} from "./events";
import {
  cleanRecord,
  esocialCompany,
  esocialEmployee,
  esocialGrantRef,
  esocialHash,
  esocialLinkRef,
  esocialReader,
  esocialTransactionReader,
  resolveEsocialIdentity,
  stringValue,
  validateEsocialGrant,
  type EsocialEmployeeLink,
  type EsocialReader,
} from "./records";
import {
  EsocialTransportError,
  queryEsocialBatch,
  sendEsocialBatch,
  type BatchQuery,
  type BatchSubmission,
} from "./transport";
import { esocialCertificateStatus, loadEsocialCertificate } from "./vault";

interface StoredEvent extends EsocialMessageEvent {
  payload: Record<string, unknown>;
  employer: EsocialRegistration;
  worker: { cpf: string; matricula?: string; category?: number };
  identityFingerprint: string;
  semanticHash: string;
  businessKey: string;
  artifacts: Partial<Record<EsocialArtifactKind, EsocialArtifact>>;
  approval?: { hash: string; identityFingerprint: string; by: string; at: string };
  submission?: {
    id: string;
    startedAt: string;
    actor: string;
    transmitter: EsocialRegistration;
    certificateId: string;
  };
  queryLease?: { id: string; until: string };
  queryFailures?: number;
  signedDigest?: string;
}
const events = () => esocialPrivateRoot().collection("events");
const ref = (id: string) => events().doc(esocialDocumentId(id));
const dedupRef = (key: string) => esocialPrivateRoot().collection("deduplication").doc(key);
const eventIdRef = (environment: string, eventId: string) =>
  esocialPrivateRoot()
    .collection("eventIds")
    .doc(esocialHash(`${environment}:${eventId}`));
const settingsRef = (companyId: string) =>
  esocialPrivateRoot().collection("companySettings").doc(esocialDocumentId(companyId));
const readinessRef = (companyId: string, certificateId: string, type: EsocialEventType) =>
  esocialPrivateRoot()
    .collection("readiness")
    .doc(esocialHash(`${companyId}:${certificateId}:${type}`));
const asoRef = (id: string) =>
  adminDb
    .collection("clinic_portal_private")
    .doc("aso-flow")
    .collection("cases")
    .doc(esocialDocumentId(id));
const conflict = (message: string) => new AuthError(message, 409);
const now = () => new Date().toISOString();
const later = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
const uuid = () => randomUUID().replaceAll("-", "");
const eventTypes: EsocialEventType[] = ["S2210", "S2220", "S2240", "S2221", "S2230", "S3000"];
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const atPath = (value: unknown, path: string) =>
  path.split(".").reduce<unknown>((v, key) => record(v)[key], value);

// Explicit allowlist prevents credentials, storage paths and private transport state leaking.
function publicEvent(value: StoredEvent, detail = false): EsocialMessageEvent {
  const keys: (keyof EsocialMessageEvent)[] = [
    "id",
    "version",
    "companyId",
    "companyName",
    "employeeId",
    "employeeName",
    "asoCardId",
    "eventType",
    "eventId",
    "environment",
    "status",
    "sourceReference",
    "sourceDocumentHash",
    "payloadHash",
    "layout",
    "xsdValidated",
    "businessValidation",
    "certificateId",
    "protocol",
    "receipt",
    "officialCode",
    "issues",
    "previousId",
    "replacesType",
    "correctionId",
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "approvedAt",
    "approvedBy",
    "submittedAt",
    "processedAt",
    "nextPollAt",
    "attempts",
  ];
  if (detail) keys.push("payload", "history");
  return cleanRecord(
    Object.fromEntries(keys.map((key) => [key, value[key]]))
  ) as unknown as EsocialMessageEvent;
}
function changed(
  value: StoredEvent,
  actor: string,
  action: string,
  patch: Partial<StoredEvent>
): StoredEvent {
  const time = now(),
    version = value.version + 1;
  return cleanRecord({
    ...value,
    ...patch,
    updatedAt: time,
    updatedBy: actor,
    version,
    history: [...(value.history || []), { action, at: time, actor, version }].slice(-50),
  });
}
function save(tx: Transaction, value: StoredEvent) {
  tx.set(ref(value.id), value);
  tx.create(
    ref(value.id).collection("history").doc(String(value.version)),
    cleanRecord({
      version: value.version,
      action: value.history?.at(-1)?.action,
      at: value.updatedAt,
      actor: value.updatedBy,
      status: value.status,
      eventId: value.eventId,
      payloadHash: value.payloadHash,
      protocol: value.protocol,
      receipt: value.receipt,
      certificateId: value.certificateId,
    })
  );
}
function version(value: StoredEvent, expected: number) {
  if (value.version !== expected)
    throw conflict("Este evento foi alterado. Atualize a tela antes de continuar.");
}
async function load(user: AuthContext, id: string, reader = esocialReader): Promise<StoredEvent> {
  requireEsocialMessagingAccess(user);
  const value = (await reader.doc(ref(id))).data() as StoredEvent | undefined;
  if (!value) throw new AuthError("Evento não encontrado.", 404);
  requireEsocialMessagingAccess(user, value.companyId);
  return value;
}
async function operator(reader: EsocialReader, user: AuthContext, companyId: string) {
  const profile = (await reader.doc(adminDb.collection("users").doc(user.uid))).data();
  if (!profile || profile.accessEnabled === false) throw forbidden("Operador indisponível.");
  const c = parseClaims(profile);
  const current: AuthContext = {
    uid: user.uid,
    email: stringValue(profile.email),
    role: c.role,
    tenantId: c.tenantId || null,
    servedCompanies: c.servedCompanies || [],
    permissions: c.permissions || [],
  };
  requireEsocialMessagingAccess(current, companyId);
  return current;
}
function semantic(payload: Record<string, unknown>) {
  const { id: _id, ...data } = payload;
  return esocialHash(JSON.stringify(data));
}
function occurrence(generated: EsocialGeneratedEvent, employeeId: string, previousId?: string) {
  const paths: Record<EsocialEventType, string[]> = {
    S2220: ["aso.dtAso", "aso.tpAso"],
    S2210: ["cat.dtAcid", "cat.hrAcid", "cat.tpCat"],
    S2240: ["infoExpRisco.dtIniCondicao"],
    S2221: ["toxicologico.dtExame", "toxicologico.codSeqExame"],
    S2230: [
      "infoAfastamento.iniAfastamento.dtIniAfast",
      "infoAfastamento.fimAfastamento.dtTermAfast",
    ],
    S3000: ["infoExclusao.nrRecEvt"],
  };
  const dates =
    generated.eventType === "S2230"
      ? atPath(generated.payload, "infoAfastamento.iniAfastamento.dtIniAfast")
        ? ["start", atPath(generated.payload, "infoAfastamento.iniAfastamento.dtIniAfast")]
        : ["end", atPath(generated.payload, "infoAfastamento.fimAfastamento.dtTermAfast")]
      : paths[generated.eventType].map((p) => atPath(generated.payload, p) ?? null);
  return JSON.stringify([
    employeeId,
    generated.eventType,
    generated.environment,
    previousId || null,
    ...dates,
  ]);
}
async function source(
  reader: EsocialReader,
  value: Pick<
    StoredEvent,
    | "asoCardId"
    | "sourceDocumentHash"
    | "companyId"
    | "employeeId"
    | "eventType"
    | "employer"
    | "worker"
  >
) {
  if (!value.asoCardId) return;
  // Exclusion targets the accepted historical receipt, even if its source PDF was replaced.
  if (value.eventType === "S3000") return;
  if (value.eventType !== "S2220")
    throw badRequest("A origem ASO só pode vincular o monitoramento de saúde ou sua exclusão.");
  const card = (await reader.doc(asoRef(value.asoCardId))).data() as AsoFlowCard | undefined;
  if (
    !card ||
    card.companyId !== value.companyId ||
    card.employeeId !== value.employeeId ||
    card.aso?.hash !== value.sourceDocumentHash
  )
    throw conflict("O documento de origem mudou ou pertence a outro cliente/colaborador.");
  createS2220DraftFromReviewedAso(card, { employer: value.employer, worker: value.worker });
}
async function exclusionIdentity(reader: EsocialReader, original: StoredEvent) {
  const company = (await reader.doc(esocialCompany(original.companyId))).data();
  const registered = normalizeEsocialRegistration(
    stringValue(company?.esocialRegistration || company?.cnpj || company?.cpf)
  );
  if (
    !company ||
    company.isDeleted === true ||
    company.active === false ||
    !(
      registered === original.employer.number ||
      (original.employer.type === "1" &&
        original.employer.number.length === 8 &&
        registered.startsWith(original.employer.number))
    )
  )
    throw conflict("Confira o cliente do evento original antes de excluí-lo.");
  // S-3000 removes the accepted historical receipt. A corrected current matrícula,
  // category or CPF must not make that receipt impossible to remove.
  return {
    companyName: original.companyName,
    employeeId: original.employeeId,
    employeeName: original.employeeName,
    fingerprint: original.identityFingerprint,
  };
}
async function identity(reader: EsocialReader, value: StoredEvent) {
  const previous = value.previousId
    ? ((await reader.doc(ref(value.previousId))).data() as StoredEvent | undefined)
    : undefined;
  if (value.eventType === "S3000" && !previous)
    throw conflict("Exclusão exige evento original aceito.");
  const resolved =
    value.eventType === "S3000" && previous
      ? await exclusionIdentity(reader, previous)
      : await resolveEsocialIdentity(
          reader,
          value.companyId,
          value.employer,
          value.worker,
          value.employeeId
        );
  if (resolved.fingerprint !== value.identityFingerprint)
    throw conflict("O vínculo da folha mudou após a preparação. Confira o evento novamente.");
  await source(reader, value);
  if (value.previousId) {
    if (
      !previous ||
      previous.status !== "accepted" ||
      !previous.receipt ||
      previous.companyId !== value.companyId ||
      previous.employeeId !== value.employeeId ||
      previous.environment !== value.environment ||
      JSON.stringify(previous.employer) !== JSON.stringify(value.employer) ||
      previous.eventType !== (value.replacesType || value.eventType) ||
      (previous.correctionId && previous.correctionId !== value.id)
    )
      throw conflict(
        "O evento original já mudou ou possui outra retificação/exclusão em andamento."
      );
    const receipt =
      value.eventType === "S3000"
        ? atPath(value.payload, "infoExclusao.nrRecEvt")
        : atPath(value.payload, "ideEvento.nrRecibo");
    if (receipt !== previous.receipt)
      throw conflict("O recibo da correção não corresponde ao evento original.");
    if (
      value.eventType === "S3000" &&
      (atPath(value.payload, "ideVinculo.cpfTrab") !== previous.worker.cpf ||
        atPath(value.payload, "infoExclusao.tpEvento") !== previous.eventType.replace("S", "S-"))
    )
      throw conflict("CPF e tipo da exclusão devem corresponder ao evento original.");
  }
  return resolved;
}
async function capabilities(
  user: AuthContext,
  companyId?: string
): Promise<EsocialMessagingCapabilities> {
  const certificate = await esocialCertificateStatus();
  const monitor = (
    await esocialPrivateRoot().collection("settings").doc("queryMonitor").get()
  ).data();
  const [grantSnapshot, settings, readiness] = companyId
    ? await Promise.all([
        esocialGrantRef(companyId).get(),
        settingsRef(companyId).get(),
        certificate.id
          ? adminDb.getAll(...eventTypes.map((t) => readinessRef(companyId, certificate.id!, t)))
          : Promise.resolve([]),
      ])
    : [null, null, []];
  const eligible = readiness.flatMap((s) =>
    s.exists && s.data()?.receipt ? [s.data()!.eventType as EsocialEventType] : []
  );
  return {
    certificate,
    grant: (grantSnapshot?.data() as EsocialGrant) || null,
    canManageCertificates: canManageEsocialConnection(user),
    canManageGrants: canManageEsocialConnection(user),
    productionEnabled: Boolean(
      isEsocialTransmissionEnabled() &&
      certificate.localValid &&
      certificate.id &&
      settings?.data()?.productionEnabled === true &&
      settings.data()?.certificateId === certificate.id
    ),
    productionEligibleTypes: eligible,
    emailToClientsEnabled: false,
    monitorConfigured: Boolean(
      process.env.ESOCIAL_SYNC_INVOKER_EMAIL &&
      process.env.ESOCIAL_SYNC_AUDIENCE &&
      process.env.ESOCIAL_SYNC_ENABLED === "true" &&
      monitor?.lastRunAt &&
      Date.parse(monitor.lastRunAt) > Date.now() - 15 * 60 * 1000
    ),
  };
}

export async function getEsocialWorkspace(
  user: AuthContext,
  query: {
    companyId?: string;
    id?: string;
    asoCaseId?: string;
    summary?: boolean;
    cursor?: string;
  } = {}
) {
  requireEsocialMessagingAccess(user, query.companyId);
  if (query.id) return { event: publicEvent(await load(user, query.id), true) };
  if (query.asoCaseId && !query.summary) {
    if (!query.companyId) throw badRequest("Selecione o cliente.");
    const card = (await asoRef(query.asoCaseId).get()).data() as AsoFlowCard | undefined;
    if (!card || card.companyId !== query.companyId)
      throw new AuthError("ASO não encontrado neste cliente.", 404);
    const [company, employee, link] = await Promise.all([
      esocialCompany(card.companyId).get(),
      esocialEmployee(card.companyId, card.employeeId).get(),
      esocialLinkRef(card.companyId, card.employeeId).get(),
    ]);
    const c = company.data(),
      e = employee.data(),
      l = link.data() as EsocialEmployeeLink | undefined;
    const registered = normalizeEsocialRegistration(stringValue(c?.cnpj || c?.cpf));
    const number =
      normalizeEsocialRegistration(stringValue(c?.esocialRegistration)) ||
      (registered.length === 14 ? registered.slice(0, 8) : registered);
    const employer: EsocialRegistration = { type: number.length === 11 ? "2" : "1", number };
    const worker = {
      cpf: normalizeEsocialRegistration(stringValue(e?.cpf)),
      matricula: l?.matricula,
      category: l?.category,
    };
    await resolveEsocialIdentity(esocialReader, card.companyId, employer, worker, card.employeeId);
    const suggested = createS2220DraftFromReviewedAso(card, { employer, worker });
    return {
      suggestion: {
        payload: suggested.payload,
        sourceReference: `ASO ${card.id} • PDF ${suggested.source.documentHash}`,
        sourceDocumentHash: suggested.source.documentHash,
        asoCardId: card.id,
        employeeId: card.employeeId,
        missingFields: [
          ...suggested.missingFields,
          ...(!c?.esocialRegistration
            ? [
                "Confirme a inscrição do empregador já informada no S-1000; a base do CNPJ é apenas uma sugestão.",
              ]
            : []),
        ],
      },
      capabilities: await capabilities(user, query.companyId),
    };
  }
  let q: FirebaseFirestore.Query = events();
  if (query.companyId) q = q.where("companyId", "==", esocialDocumentId(query.companyId));
  else if (!isPgrGlobalAdmin(user)) {
    const companies = [...new Set(user.servedCompanies)];
    if (!companies.length)
      return { events: [], nextCursor: null, capabilities: await capabilities(user) };
    if (companies.length > 30) throw badRequest("Selecione um cliente para consultar os eventos.");
    q = q.where("companyId", "in", companies);
  }
  if (query.asoCaseId) {
    if (!query.companyId) throw badRequest("Selecione o cliente.");
    // Avoid an additional composite index; the authorized company page is bounded.
    q = q.where("asoCardId", "==", esocialDocumentId(query.asoCaseId));
  }
  q = q.orderBy(FieldPath.documentId());
  if (query.cursor) q = q.startAfter(esocialDocumentId(query.cursor));
  const result = await q.limit(101).get();
  return {
    events: result.docs.slice(0, 100).map((d) => publicEvent(d.data() as StoredEvent)),
    nextCursor: result.size > 100 ? result.docs[99].id : null,
    capabilities: await capabilities(user, query.companyId),
  };
}

const prepareSchema = z
  .object({
    action: z.literal("prepare"),
    companyId: z.string(),
    payload: z.record(z.string(), z.unknown()),
    sourceReference: z.string().trim().min(3).max(500),
    asoCardId: z.string().optional(),
    sourceDocumentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
const updateSchema = z
  .object({
    action: z.literal("update"),
    id: z.string(),
    version: z.number().int().positive(),
    payload: z.record(z.string(), z.unknown()),
    sourceReference: z.string().trim().min(3).max(500),
  })
  .strict();
const operationSchema = z
  .object({
    action: z.enum(["authorize", "transmit", "query", "rectify", "exclude", "cancel", "recover"]),
    id: z.string(),
    version: z.number().int().positive(),
    confirmed: z.literal(true).optional(),
    identityConfirmed: z.literal(true).optional(),
    documentChecked: z.literal(true).optional(),
  })
  .strict();
type Prepare = z.infer<typeof prepareSchema>;

async function prepare(user: AuthContext, input: Prepare, previous?: StoredEvent) {
  requireEsocialMessagingAccess(user, input.companyId);
  const payload = { ...input.payload };
  delete payload.id;
  if (!previous && (payload.eventType === "S3000" || atPath(payload, "ideEvento.indRetif") === 2))
    throw badRequest(
      "Abra o evento aceito e use Retificar ou Excluir para preservar a vinculação ao recibo."
    );
  const generated = await generateEsocialEvent(payload);
  if (!generated.payload) throw badRequest("Conteúdo do evento indisponível.");
  const worker = generated.worker || previous?.worker;
  if (!worker) throw badRequest("Vínculo do trabalhador ausente.");
  const resolved =
    previous && generated.eventType === "S3000"
      ? await exclusionIdentity(esocialReader, previous)
      : await resolveEsocialIdentity(
          esocialReader,
          input.companyId,
          generated.employer,
          worker,
          previous?.employeeId
        );
  const key = esocialHash(
    `${input.companyId}:${occurrence(generated, resolved.employeeId, previous?.id)}`
  );
  const time = now(),
    id = uuid();
  const unsigned = await saveEsocialArtifact(input.companyId, id, "unsigned", generated.xml);
  const value: StoredEvent = cleanRecord({
    id,
    version: 1,
    companyId: input.companyId,
    companyName: resolved.companyName,
    employeeId: resolved.employeeId,
    employeeName: resolved.employeeName,
    eventType: generated.eventType,
    eventId: generated.eventId,
    environment: generated.environment,
    status: "draft",
    sourceReference: input.sourceReference,
    asoCardId: input.asoCardId,
    sourceDocumentHash: input.sourceDocumentHash,
    payload: generated.payload as Record<string, unknown>,
    payloadHash: esocialHash(generated.xml),
    semanticHash: semantic(generated.payload as Record<string, unknown>),
    businessKey: key,
    employer: generated.employer,
    worker,
    identityFingerprint: resolved.fingerprint,
    layout: generated.layout,
    xsdValidated: true,
    businessValidation: "NOT_EVALUATED",
    artifacts: { unsigned },
    issues: [],
    createdAt: time,
    createdBy: user.uid,
    updatedAt: time,
    updatedBy: user.uid,
    attempts: 0,
    previousId: previous?.id,
    replacesType: previous?.eventType,
    history: [
      {
        action: previous
          ? generated.eventType === "S3000"
            ? "exclusion_prepared"
            : "rectification_prepared"
          : "prepared",
        at: time,
        actor: user.uid,
        version: 1,
      },
    ],
  });
  return adminDb.runTransaction(async (tx) => {
    const reader = esocialTransactionReader(tx);
    await operator(reader, user, value.companyId);
    await identity(reader, value);
    const duplicate = (await tx.get(dedupRef(key))).data();
    if (duplicate?.eventId) {
      const existing = (await tx.get(ref(duplicate.eventId))).data() as StoredEvent | undefined;
      if (existing && existing.status !== "cancelled") {
        if (
          existing.semanticHash === value.semanticHash &&
          existing.sourceDocumentHash === value.sourceDocumentHash &&
          existing.asoCardId === value.asoCardId
        )
          return existing;
        throw conflict(
          "Já existe evento para este trabalhador, ocorrência e ambiente. Abra o registro existente para conferir ou retificar."
        );
      }
    }
    const reservedId = eventIdRef(value.environment, value.eventId);
    if ((await tx.get(reservedId)).exists)
      throw conflict(
        "O identificador do evento já foi reservado. Prepare novamente para obter um novo identificador."
      );
    tx.create(reservedId, { localId: id, companyId: value.companyId, at: time });
    save(tx, value);
    tx.set(dedupRef(key), { eventId: id, companyId: value.companyId, createdAt: time });
    return value;
  });
}

async function update(user: AuthContext, input: z.infer<typeof updateSchema>) {
  const original = await load(user, input.id);
  version(original, input.version);
  if (!["draft", "rejected"].includes(original.status))
    throw conflict("Somente rascunhos ou eventos rejeitados podem ser editados.");
  const payload = { ...input.payload };
  delete payload.id;
  const generated = await generateEsocialEvent(payload);
  if (
    !generated.payload ||
    generated.eventType !== original.eventType ||
    generated.environment !== original.environment ||
    JSON.stringify(generated.employer) !== JSON.stringify(original.employer) ||
    (generated.worker && JSON.stringify(generated.worker) !== JSON.stringify(original.worker))
  )
    throw badRequest(
      "Tipo, ambiente, empregador e vínculo não podem mudar neste registro. Prepare um novo evento."
    );
  if (
    !original.previousId &&
    (generated.eventType === "S3000" || atPath(payload, "ideEvento.indRetif") === 2)
  )
    throw badRequest("Retificação exige evento original aceito.");
  const unsigned = await saveEsocialArtifact(
    original.companyId,
    original.id,
    "unsigned",
    generated.xml
  );
  const key = esocialHash(
    `${original.companyId}:${occurrence(generated, original.employeeId, original.previousId)}`
  );
  return adminDb.runTransaction(async (tx) => {
    const reader = esocialTransactionReader(tx),
      current = await load(user, input.id, reader);
    version(current, input.version);
    await operator(reader, user, current.companyId);
    const candidate = { ...current, payload: generated.payload as Record<string, unknown> };
    await identity(reader, candidate);
    const slot = (await tx.get(dedupRef(key))).data();
    if (slot?.eventId && slot.eventId !== current.id)
      throw conflict("Outra ocorrência já utiliza esta identificação. Confira a duplicidade.");
    const reservedId = eventIdRef(generated.environment, generated.eventId);
    if ((await tx.get(reservedId)).exists)
      throw conflict("Identificador já reservado. Salve novamente para gerar outro identificador.");
    const value = changed(current, user.uid, "edited", {
      payload: generated.payload as Record<string, unknown>,
      eventId: generated.eventId,
      payloadHash: esocialHash(generated.xml),
      semanticHash: semantic(generated.payload as Record<string, unknown>),
      businessKey: key,
      sourceReference: input.sourceReference,
      status: "draft",
      approval: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      submission: undefined,
      signedDigest: undefined,
      protocol: undefined,
      receipt: undefined,
      officialCode: undefined,
      certificateId: undefined,
      submittedAt: undefined,
      nextPollAt: undefined,
      issues: [],
      artifacts: { unsigned },
    });
    if (current.businessKey !== key) tx.delete(dedupRef(current.businessKey));
    tx.create(reservedId, { localId: value.id, companyId: value.companyId, at: value.updatedAt });
    tx.set(dedupRef(key), {
      eventId: value.id,
      companyId: value.companyId,
      createdAt: value.createdAt,
    });
    save(tx, value);
    return value;
  });
}

async function authorize(user: AuthContext, id: string, expected: number) {
  return adminDb.runTransaction(async (tx) => {
    const reader = esocialTransactionReader(tx),
      value = await load(user, id, reader);
    version(value, expected);
    await operator(reader, user, value.companyId);
    if (value.status !== "draft") throw conflict("Confira e salve o rascunho antes de aprovar.");
    await identity(reader, value);
    const next = changed(value, user.uid, "approved", {
      status: "approved",
      approvedAt: now(),
      approvedBy: user.uid,
      approval: {
        hash: value.payloadHash,
        identityFingerprint: value.identityFingerprint,
        by: user.uid,
        at: now(),
      },
    });
    save(tx, next);
    return next;
  });
}

async function connectionChecks(
  reader: EsocialReader,
  value: StoredEvent,
  certificateId: string,
  holder: EsocialRegistration,
  recovery = false
) {
  const grant = (await reader.doc(esocialGrantRef(value.companyId))).data() as
    EsocialGrant | undefined;
  validateEsocialGrant(grant, holder.number, value.eventType, value.replacesType, value.companyId);
  const active = (
    await reader.doc(esocialPrivateRoot().collection("settings").doc("certificate"))
  ).data();
  const cert = (
    await reader.doc(esocialPrivateRoot().collection("certificates").doc(certificateId))
  ).data();
  if (
    !cert ||
    !cert.active ||
    active?.activeId !== certificateId ||
    cert.registration !== holder.number ||
    Date.parse(cert.validUntil) <= Date.now()
  )
    throw conflict("O certificado ativo mudou ou perdeu a validade. Atualize antes de transmitir.");
  if (recovery && value.certificateId !== certificateId)
    throw conflict(
      "A recuperação do envio exige o certificado original ainda válido; confira o protocolo no portal oficial após a renovação."
    );
  if (value.environment === "production") {
    const [settings, ready] = await Promise.all([
      reader.doc(settingsRef(value.companyId)),
      reader.doc(readinessRef(value.companyId, certificateId, value.eventType)),
    ]);
    if (
      settings.data()?.productionEnabled !== true ||
      settings.data()?.certificateId !== certificateId ||
      !ready.data()?.receipt
    )
      throw conflict(
        "Produção exige recibo em produção restrita para este cliente, tipo de evento e A1, seguido de liberação explícita do administrador."
      );
  }
}

async function transmit(user: AuthContext, id: string, expected: number, recovery = false) {
  // This guard also covers recovery, before certificate access, signing or any reservation.
  if (!isEsocialTransmissionEnabled())
    throw new AuthError(ESOCIAL_TRANSMISSION_DISABLED_MESSAGE, 503);
  const original = await load(user, id);
  version(original, expected);
  const required = recovery ? "uncertain" : "approved";
  if (original.status !== required || (recovery && original.protocol))
    throw conflict(
      recovery
        ? "Consulte o protocolo existente; só se recupera um envio sem protocolo confirmado."
        : "Confira e aprove o evento antes de transmitir."
    );
  if (recovery && original.submission) {
    const attempt = (await ref(id).collection("attempts").doc(original.submission.id).get()).data();
    if (attempt?.response && attempt.response.status !== "uncertain")
      return finalizeSubmission(id, original.submission.id, user.uid, attempt.response);
  }
  if (!original.approval || original.approval.hash !== original.payloadHash)
    throw conflict("O conteúdo exige nova conferência e aprovação.");
  await currentEsocialUser(user, original.companyId);
  const certificate = await loadEsocialCertificate(recovery ? original.certificateId : undefined);
  await connectionChecks(
    esocialReader,
    original,
    certificate.id,
    certificate.material.metadata.holder,
    recovery
  );
  await identity(esocialReader, original);
  let signedXml: string;
  if (recovery) {
    if (!original.artifacts.signed) throw conflict("XML assinado do envio anterior indisponível.");
    signedXml = await readEsocialArtifact(
      original.companyId,
      original.id,
      "signed",
      original.artifacts.signed
    );
  } else {
    if (!original.artifacts.unsigned) throw conflict("XML preparado indisponível.");
    const unsigned = await readEsocialArtifact(
      original.companyId,
      original.id,
      "unsigned",
      original.artifacts.unsigned
    );
    if (esocialHash(unsigned) !== original.payloadHash)
      throw conflict("XML divergente da aprovação.");
    await validateEsocialXml(unsigned, { allowUnsigned: true });
    signedXml = signEsocialXml(unsigned, certificate.material);
  }
  const checked = await validateEsocialXml(signedXml);
  const verifiedSignature = verifyEsocialXmlSignature(
    signedXml,
    certificate.material.certificatePem
  );
  if (checked.eventId !== original.eventId || checked.environment !== original.environment)
    throw conflict("XML assinado divergente do evento aprovado.");
  const signed = await saveEsocialArtifact(original.companyId, id, "signed", signedXml);
  const attemptId = uuid();
  const reserved = await adminDb.runTransaction(async (tx) => {
    const reader = esocialTransactionReader(tx),
      value = await load(user, id, reader);
    version(value, expected);
    await operator(reader, user, value.companyId);
    if (
      value.status !== required ||
      value.payloadHash !== original.payloadHash ||
      !value.approval ||
      value.approval.hash !== value.payloadHash
    )
      throw conflict("O evento mudou antes da assinatura. Atualize e confira novamente.");
    await identity(reader, value);
    await connectionChecks(
      reader,
      value,
      certificate.id,
      certificate.material.metadata.holder,
      recovery
    );
    const previous = value.previousId
      ? ((await tx.get(ref(value.previousId))).data() as StoredEvent)
      : undefined;
    const next = changed(
      value,
      user.uid,
      recovery ? "submission_recovery_started" : "submission_started",
      {
        status: "submitting",
        certificateId: certificate.id,
        submittedAt: now(),
        attempts: value.attempts + 1,
        artifacts: { ...value.artifacts, signed },
        signedDigest: verifiedSignature.digestValue,
        nextPollAt: later(120),
        submission: {
          id: attemptId,
          startedAt: now(),
          actor: user.uid,
          transmitter: certificate.material.metadata.holder,
          certificateId: certificate.id,
        },
      }
    );
    if (previous)
      save(tx, changed(previous, user.uid, "correction_submitted", { correctionId: value.id }));
    save(tx, next);
    tx.create(ref(id).collection("attempts").doc(attemptId), {
      at: now(),
      actor: user.uid,
      eventId: value.eventId,
      signedHash: signed.hash,
      recovery,
      status: "reserved",
    });
    return next;
  });
  let response: BatchSubmission;
  try {
    response = await sendEsocialBatch({
      environment: reserved.environment,
      signedXml,
      eventId: reserved.eventId,
      employer: reserved.employer,
      transmitter: certificate.material.metadata.holder,
      certificate: certificate.material,
    });
  } catch {
    response = {
      status: "uncertain",
      code: "TRANSPORT_UNCERTAIN",
      description:
        "O transporte não confirmou o resultado. Confira antes de recuperar o mesmo evento.",
      issues: [],
    };
  }
  let artifact: EsocialArtifact | undefined;
  if (response.rawResponse) {
    try {
      artifact = await saveEsocialArtifact(
        reserved.companyId,
        id,
        "response",
        response.rawResponse
      );
    } catch {
      response.issues.push({
        code: "RESPONSE_ARCHIVE_PENDING",
        description:
          "O comprovante XML aguarda nova consulta; o protocolo recebido foi preservado.",
        type: "warning",
      });
    }
  }
  // Store the received protocol separately before the aggregate update, so an interrupted
  // database acknowledgement can be recovered without a new submission.
  const result = cleanRecord({ ...response, rawResponse: undefined, artifact });
  await ref(id)
    .collection("attempts")
    .doc(attemptId)
    .set({ status: "response_received", response: result, at: now() }, { merge: true });
  return finalizeSubmission(id, attemptId, user.uid, result);
}

async function finalizeSubmission(
  id: string,
  attemptId: string,
  actor: string,
  result: Omit<BatchSubmission, "rawResponse"> & { artifact?: EsocialArtifact }
) {
  return adminDb.runTransaction(async (tx) => {
    const current = (await tx.get(ref(id))).data() as StoredEvent;
    if (
      current.submission?.id !== attemptId ||
      !["submitting", "uncertain"].includes(current.status)
    )
      return current;
    const status =
      result.status === "accepted" && result.protocol
        ? "processing"
        : result.status === "rejected"
          ? "rejected"
          : "uncertain";
    const next = changed(current, actor, "submission_result", {
      status,
      protocol: result.protocol,
      officialCode: result.code,
      issues: [{ code: result.code, description: result.description }, ...result.issues],
      nextPollAt: status === "processing" ? later(30) : undefined,
      artifacts: result.artifact
        ? { ...current.artifacts, response: result.artifact }
        : current.artifacts,
    });
    save(tx, next);
    return next;
  });
}

async function query(user: AuthContext, id: string, expected: number) {
  let original = await load(user, id);
  version(original, expected);
  if (
    ["submitting", "uncertain"].includes(original.status) &&
    original.submission &&
    !original.protocol
  ) {
    const stored = (await ref(id).collection("attempts").doc(original.submission.id).get()).data();
    if (stored?.response) {
      original = await finalizeSubmission(id, original.submission.id, user.uid, stored.response);
      if (original.status !== "processing") return original;
      expected = original.version;
    }
    if (
      original.status === "submitting" &&
      !original.protocol &&
      original.submission &&
      Date.parse(original.submission.startedAt) + 120000 <= Date.now()
    ) {
      return adminDb.runTransaction(async (tx) => {
        const reader = esocialTransactionReader(tx),
          value = await load(user, id, reader);
        version(value, expected);
        await operator(reader, user, value.companyId);
        if (value.status !== "submitting" || value.protocol) return value;
        const next = changed(value, user.uid, "submission_interrupted", {
          status: "uncertain",
          nextPollAt: undefined,
          issues: [
            {
              code: "CONFIRM_RESULT",
              description:
                "O envio não confirmou o resultado. Confira no portal ou recupere exatamente o mesmo XML.",
            },
          ],
        });
        save(tx, next);
        return next;
      });
    }
  }
  if (!original.protocol || !["processing", "uncertain"].includes(original.status))
    throw conflict("A consulta exige um protocolo de lote confirmado.");
  const certificate = await loadEsocialCertificate();
  if (
    !original.submission ||
    certificate.material.metadata.holder.number !== original.submission.transmitter.number
  )
    throw conflict("O A1 da consulta deve pertencer ao mesmo transmissor do lote.");
  const leaseId = uuid();
  const reserved = await adminDb.runTransaction(async (tx) => {
    const reader = esocialTransactionReader(tx),
      current = await load(user, id, reader);
    version(current, expected);
    await operator(reader, user, current.companyId);
    if (
      current.protocol !== original.protocol ||
      !["processing", "uncertain"].includes(current.status)
    )
      throw conflict("O resultado mudou; atualize a tela.");
    if (current.queryLease && current.queryLease.until > now())
      throw conflict("Uma consulta já está em andamento.");
    const grant = (await tx.get(esocialGrantRef(current.companyId))).data() as
      EsocialGrant | undefined;
    validateEsocialGrant(
      grant,
      certificate.material.metadata.holder.number,
      current.eventType,
      current.replacesType,
      current.companyId
    );
    const [pointer, cert] = await Promise.all([
      tx.get(esocialPrivateRoot().collection("settings").doc("certificate")),
      tx.get(esocialPrivateRoot().collection("certificates").doc(certificate.id)),
    ]);
    if (
      pointer.data()?.activeId !== certificate.id ||
      cert.data()?.active !== true ||
      cert.data()?.registration !== certificate.material.metadata.holder.number ||
      Date.parse(cert.data()?.validUntil) <= Date.now()
    )
      throw conflict("O A1 da consulta mudou ou foi desativado. Atualize a configuração.");
    const next = changed(current, user.uid, "query_started", {
      queryLease: { id: leaseId, until: later(90) },
      nextPollAt: later(90),
    });
    save(tx, next);
    return next;
  });
  let response: BatchQuery;
  try {
    if (!reserved.signedDigest)
      throw conflict(
        "O resumo criptográfico do envio não foi preservado; confira o histórico antes de consultar."
      );
    response = await queryEsocialBatch({
      environment: reserved.environment,
      protocol: reserved.protocol!,
      eventId: reserved.eventId,
      employer: reserved.employer,
      transmitter: reserved.submission!.transmitter,
      certificate: certificate.material,
      expectedDigest: reserved.signedDigest,
    });
  } catch (failure) {
    const correlationFailure =
      failure instanceof EsocialTransportError &&
      [
        "RESPONSE_DIGEST_MISMATCH",
        "RESPONSE_EVENT_MISMATCH",
        "RESPONSE_CONTEXT_MISMATCH",
        "RESPONSE_PROTOCOL_MISMATCH",
        "RESPONSE_ENVIRONMENT_MISMATCH",
      ].includes(failure.code);
    return adminDb.runTransaction(async (tx) => {
      const current = (await tx.get(ref(id))).data() as StoredEvent;
      if (current.queryLease?.id !== leaseId) return current;
      const failures = (current.queryFailures || 0) + 1;
      const next = changed(
        current,
        user.uid,
        correlationFailure ? "query_inconsistent" : "query_unavailable",
        {
          status: correlationFailure ? "uncertain" : "processing",
          queryLease: undefined,
          queryFailures: failures,
          nextPollAt: correlationFailure
            ? undefined
            : later(Math.min(3600, 60 * 2 ** Math.min(failures, 5))),
          issues: [
            {
              code: correlationFailure ? failure.code : "QUERY_UNAVAILABLE",
              description: correlationFailure
                ? "O retorno não corresponde ao XML/lote enviado. Confira o recibo no portal oficial antes de continuar."
                : "Consulta indisponível. O lote permanece pendente e será consultado novamente.",
            },
          ],
        }
      );
      save(tx, next);
      return next;
    });
  }
  const artifact = await saveEsocialArtifact(
    reserved.companyId,
    id,
    "response",
    response.rawResponse
  );
  return adminDb.runTransaction(async (tx) => {
    const current = (await tx.get(ref(id))).data() as StoredEvent;
    if (current.queryLease?.id !== leaseId || current.protocol !== response.protocol)
      return current;
    const remote = response.events.find((e) => e.eventId === current.eventId);
    const accepted =
      response.status === "completed" &&
      (remote?.status === "accepted" || remote?.status === "duplicate") &&
      EsocialReceiptSchema.safeParse(remote.receipt).success;
    const rejected =
      (response.status === "completed" && remote?.status === "rejected") ||
      (response.status === "rejected" && response.rejectionScope === "batch");
    const previous =
      accepted && current.previousId
        ? ((await tx.get(ref(current.previousId))).data() as StoredEvent | undefined)
        : undefined;
    if (
      previous &&
      (previous.companyId !== current.companyId ||
        previous.employeeId !== current.employeeId ||
        previous.environment !== current.environment ||
        previous.correctionId !== current.id)
    )
      throw conflict(
        "Vínculo com o evento original divergente. Preserve o recibo e confira o histórico."
      );
    const next = changed(
      current,
      user.uid,
      accepted ? "receipt_accepted" : rejected ? "event_rejected" : "query_pending",
      {
        status: accepted ? "accepted" : rejected ? "rejected" : "processing",
        receipt: accepted ? remote!.receipt : undefined,
        businessValidation: accepted ? "ACCEPTED_BY_ESOCIAL" : "NOT_EVALUATED",
        officialCode: remote?.code || response.code,
        issues: [
          {
            code: remote?.code || response.code,
            description: remote?.description || response.description,
          },
          ...(remote?.issues || response.issues),
        ],
        processedAt: accepted || rejected ? remote?.processedAt || now() : undefined,
        queryLease: undefined,
        queryFailures: 0,
        nextPollAt:
          accepted || rejected
            ? undefined
            : later(Math.max(30, Math.min(response.estimatedSeconds || 60, 3600))),
        artifacts: { ...current.artifacts, response: artifact },
      }
    );
    if (previous)
      save(
        tx,
        changed(
          previous,
          user.uid,
          current.eventType === "S3000" ? "excluded_with_receipt" : "rectified_with_receipt",
          {
            status: current.eventType === "S3000" ? "excluded" : "superseded",
            correctionId: current.id,
          }
        )
      );
    if (accepted && current.environment === "restricted" && current.certificateId) {
      tx.set(readinessRef(current.companyId, current.certificateId, current.eventType), {
        companyId: current.companyId,
        certificateId: current.certificateId,
        eventType: current.eventType,
        eventId: current.id,
        receipt: remote!.receipt,
        at: now(),
      });
      tx.update(esocialPrivateRoot().collection("certificates").doc(current.certificateId), {
        verifiedInRestricted: true,
      });
    }
    save(tx, next);
    return next;
  });
}

async function correction(user: AuthContext, id: string, expected: number, exclude: boolean) {
  const original = await load(user, id);
  version(original, expected);
  if (
    original.status !== "accepted" ||
    original.eventType === "S3000" ||
    !EsocialReceiptSchema.safeParse(original.receipt).success
  )
    throw conflict("Selecione um evento aceito com recibo para retificar ou excluir.");
  const payload = exclude
    ? {
        eventType: "S3000",
        ideEvento: { tpAmb: original.environment === "production" ? 1 : 2 },
        ideEmpregador: original.payload.ideEmpregador,
        ideVinculo: { cpfTrab: original.worker.cpf },
        infoExclusao: {
          tpEvento: original.eventType.replace("S", "S-"),
          nrRecEvt: original.receipt,
        },
      }
    : {
        ...original.payload,
        id: undefined,
        ideEvento: {
          ...record(original.payload.ideEvento),
          indRetif: 2,
          nrRecibo: original.receipt,
        },
      };
  let sourceDocumentHash = original.sourceDocumentHash;
  if (!exclude && original.asoCardId) {
    const currentCard = (await asoRef(original.asoCardId).get()).data() as AsoFlowCard | undefined;
    if (
      !currentCard ||
      currentCard.companyId !== original.companyId ||
      currentCard.employeeId !== original.employeeId
    )
      throw conflict("O ASO atual não pertence ao mesmo cliente e trabalhador.");
    const checked = createS2220DraftFromReviewedAso(currentCard, {
      employer: original.employer,
      worker: original.worker,
    });
    sourceDocumentHash = checked.source.documentHash;
  }
  return prepare(
    user,
    {
      action: "prepare",
      companyId: original.companyId,
      payload,
      sourceReference:
        `Correção de ${original.eventId} • ${sourceDocumentHash ? `PDF ${sourceDocumentHash}` : original.sourceReference}`.slice(
          0,
          500
        ),
      asoCardId: original.asoCardId,
      sourceDocumentHash,
    },
    original
  );
}

async function cancel(user: AuthContext, id: string, expected: number) {
  return adminDb.runTransaction(async (tx) => {
    const reader = esocialTransactionReader(tx),
      value = await load(user, id, reader);
    version(value, expected);
    await operator(reader, user, value.companyId);
    if (!["draft", "approved", "rejected"].includes(value.status))
      throw conflict(
        "Cancelar rascunho não exclui eventos transmitidos. Consulte o resultado ou use Exclusão com recibo."
      );
    const previous = value.previousId
      ? ((await tx.get(ref(value.previousId))).data() as StoredEvent | undefined)
      : undefined;
    const next = changed(value, user.uid, "draft_cancelled", {
      status: "cancelled",
      approval: undefined,
    });
    if (previous?.correctionId === value.id && previous.status === "accepted")
      save(tx, changed(previous, user.uid, "correction_cancelled", { correctionId: undefined }));
    save(tx, next);
    return next;
  });
}

export async function mutateEsocialMessage(user: AuthContext, input: unknown) {
  requireEsocialMessagingAccess(user);
  const action = record(input).action;
  if (action === "prepare")
    return { event: publicEvent(await prepare(user, prepareSchema.parse(input)), true) };
  if (action === "update")
    return { event: publicEvent(await update(user, updateSchema.parse(input)), true) };
  if (action === "import_xml") {
    const data = z
      .object({
        action: z.literal("import_xml"),
        companyId: z.string(),
        xml: z.string().max(1024 * 1024),
        sourceReference: z.string().trim().min(3).max(500),
      })
      .strict()
      .parse(input);
    requireEsocialMessagingAccess(user, data.companyId);
    const checked = await validateEsocialXml(data.xml, { allowUnsigned: true });
    if (!checked.payload)
      throw badRequest(
        "O XML precisa ser complementado no formulário antes de gerar um novo rascunho."
      );
    // Imported signatures/receipts are never evidence of acceptance. Rebuild a fresh draft.
    return {
      event: publicEvent(
        await prepare(user, {
          action: "prepare",
          companyId: data.companyId,
          payload: checked.payload as Record<string, unknown>,
          sourceReference: data.sourceReference,
        }),
        true
      ),
    };
  }
  if (action === "enable_production") {
    const data = z
      .object({
        action: z.literal("enable_production"),
        companyId: z.string(),
        confirmed: z.literal(true),
      })
      .strict()
      .parse(input);
    const current = await currentEsocialUser(user, data.companyId);
    requireEsocialAdministrator(current);
    const c = await capabilities(current, data.companyId);
    if (
      !c.certificate.id ||
      !c.certificate.localValid ||
      !c.certificate.vaultConfigured ||
      !c.productionEligibleTypes.length
    )
      throw conflict(
        "Valide um evento deste cliente no ambiente restrito com o A1 ativo antes de liberar produção."
      );
    await adminDb.runTransaction(async (tx) => {
      const reader = esocialTransactionReader(tx);
      requireEsocialAdministrator(await operator(reader, current, data.companyId));
      const pointer = (
        await tx.get(esocialPrivateRoot().collection("settings").doc("certificate"))
      ).data();
      const ready = await tx.get(
        readinessRef(data.companyId, c.certificate.id!, c.productionEligibleTypes[0])
      );
      if (pointer?.activeId !== c.certificate.id || !ready.data()?.receipt)
        throw conflict("O A1 ou a validação mudou. Atualize a tela.");
      tx.set(settingsRef(data.companyId), {
        productionEnabled: true,
        certificateId: c.certificate.id,
        enabledBy: current.uid,
        enabledAt: now(),
      });
      tx.create(esocialPrivateRoot().collection("audit").doc(uuid()), {
        action: "production_enabled",
        companyId: data.companyId,
        certificateId: c.certificate.id,
        actor: current.uid,
        at: now(),
      });
    });
    return getEsocialWorkspace(current, { companyId: data.companyId });
  }
  const data = operationSchema.parse(input);
  if (
    data.action === "authorize"
      ? !(data.identityConfirmed && data.documentChecked)
      : data.confirmed !== true
  )
    throw badRequest("Confirme a ação e a conferência exigida.");
  const result =
    data.action === "authorize"
      ? await authorize(user, data.id, data.version)
      : data.action === "transmit" || data.action === "recover"
        ? await transmit(user, data.id, data.version, data.action === "recover")
        : data.action === "query"
          ? await query(user, data.id, data.version)
          : data.action === "cancel"
            ? await cancel(user, data.id, data.version)
            : await correction(user, data.id, data.version, data.action === "exclude");
  return { event: publicEvent(result, true) };
}

export async function downloadEsocialDocument(user: AuthContext, id: string, type: string) {
  if (!["unsigned", "signed", "response"].includes(type))
    throw badRequest("Tipo de documento inválido.");
  const value = await load(user, id),
    kind = type as EsocialArtifactKind,
    artifact = value.artifacts[kind];
  if (!artifact) throw new AuthError("Documento ainda indisponível.", 404);
  const xml = await readEsocialArtifact(value.companyId, value.id, kind, artifact);
  await ref(id)
    .collection("documentAccess")
    .doc(uuid())
    .set({ kind, hash: artifact.hash, actor: user.uid, at: now() });
  return { xml, filename: `${value.eventType}-${value.eventId}-${kind}.xml` };
}

/** Scheduler only consults previously submitted batches. It never approves, signs or sends. */
export async function syncEsocialMessages() {
  if (process.env.ESOCIAL_SYNC_ENABLED !== "true")
    throw new AuthError("Consulta automática eSocial ainda não ativada.", 503);
  const started = Date.now();
  const pending = await events()
    .where("status", "in", ["processing", "submitting"])
    .where("nextPollAt", "<=", now())
    .orderBy("nextPollAt")
    .limit(10)
    .get();
  let checked = 0,
    waiting = 0,
    unavailable = 0;
  for (const document of pending.docs) {
    if (Date.now() - started > 120000) break;
    const value = document.data() as StoredEvent;
    try {
      const user = await currentEsocialUser(
        {
          uid: value.submission?.actor || value.createdBy,
          email: "",
          role: "GUEST",
          tenantId: null,
          servedCompanies: [],
          permissions: [],
        },
        value.companyId
      );
      if (value.status === "submitting") {
        const attempt = value.submission
          ? (await ref(value.id).collection("attempts").doc(value.submission.id).get()).data()
          : undefined;
        if (attempt?.response && value.submission)
          await finalizeSubmission(value.id, value.submission.id, user.uid, attempt.response);
        else
          await adminDb.runTransaction(async (tx) => {
            const current = (await tx.get(ref(value.id))).data() as StoredEvent;
            if (current.version === value.version && current.status === "submitting")
              save(
                tx,
                changed(current, user.uid, "submission_interrupted", {
                  status: "uncertain",
                  nextPollAt: undefined,
                  issues: [
                    {
                      code: "CONFIRM_RESULT",
                      description:
                        "O envio foi interrompido sem confirmação. Confira o resultado antes de recuperar o mesmo XML.",
                    },
                  ],
                })
              );
          });
        waiting++;
        continue;
      }
      await query(user, value.id, value.version);
      checked++;
    } catch {
      unavailable++;
      // A revoked submitter or unavailable A1 must not leave the first ten jobs
      // permanently at the head of the queue and starve other clients.
      await adminDb.runTransaction(async (tx) => {
        const current = (await tx.get(ref(value.id))).data() as StoredEvent | undefined;
        if (
          current?.version === value.version &&
          ["processing", "submitting"].includes(current.status)
        )
          save(
            tx,
            changed(current, "system:esocial-query", "monitor_waiting", {
              nextPollAt: later(900),
              issues: [
                {
                  code: "MONITOR_WAITING",
                  description:
                    "Consulta automática temporariamente bloqueada. Confira o acesso do operador, A1 e procuração; o lote foi preservado.",
                },
              ],
            })
          );
      });
    }
  }
  await esocialPrivateRoot()
    .collection("settings")
    .doc("queryMonitor")
    .set({ lastRunAt: now(), checked, waiting, unavailable });
  return { checked, waiting, unavailable };
}
