import "server-only";
import { createHash } from "node:crypto";
import {
  FieldPath,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type Transaction,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseConfig } from "@/firebase/config";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { isPgrGlobalAdmin, requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { parseClaims } from "@/lib/auth/claims";
import { socWebAccess } from "@/lib/integrations/soc-access";
import { asoGmailConfiguration } from "@/lib/integrations/aso-gmail";
import { asoClientEmailSendingEnabled } from "@/lib/aso-email-policy";
import {
  AsoFlowIdSchema,
  AsoFlowImportSchema,
  AsoFlowMutationSchema,
  AsoFlowUploadSchema,
  ASO_FLOW_MAX_PDF_BYTES,
  asoFlowDigits,
  asoFlowText,
  asoFlowRowProblems,
  asoFlowEmploymentAllowed,
  type AsoFlowCard,
  type AsoFlowClinic,
  type AsoFlowDocument,
  type AsoFlowExamType,
  type AsoFlowPreview,
  type AsoFlowPreviewRow,
  type AsoFlowRow,
} from "@/lib/aso-flow";

const root = () => adminDb.collection("clinic_portal_private").doc("aso-flow");
const cases = () => root().collection("cases");
const companyRef = (id: string) => adminDb.collection("companies").doc(id);
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const value = (input: unknown) => (typeof input === "string" ? input.trim() : "");
const email = (input: unknown) =>
  z.string().email().max(254).safeParse(value(input)).success ? value(input).toLowerCase() : "";
const json = <T>(input: T): T => JSON.parse(JSON.stringify(input));
const conflict = (message: string) => new AuthError(message, 409);
const id = (input: string) => {
  if (!AsoFlowIdSchema.safeParse(input).success) throw badRequest("Card inválido.");
  return input;
};
export function requireAsoFlowAccess(user: AuthContext, companyId?: string) {
  if (
    user.tenantId ||
    !["SUPER_ADMIN", "ADMIN", "OPERATIONS", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL"].includes(
      user.role
    )
  )
    throw forbidden("Esteira de ASOs disponível somente à equipe interna autorizada.");
  if (companyId) requirePgrCompany(user, companyId);
}
const allowed = (user: AuthContext, companyId: string) => {
  try {
    requireAsoFlowAccess(user, companyId);
    return true;
  } catch {
    return false;
  }
};
function requireVersion(card: AsoFlowCard, version: number, allowMail = false) {
  if (card.version !== version)
    throw conflict("Outro usuário alterou este card. Atualize antes de continuar.");
  if (card.mailLock && !allowMail)
    throw conflict("Envio em conferência; consulte o comprovante antes de alterar o card.");
}
function mutable(card: AsoFlowCard) {
  if (["delivered", "cancelled", "no_show"].includes(card.status))
    throw conflict(
      "Este card está encerrado. Encaminhe a retificação para conferência dos documentos e envios anteriores."
    );
}
function updated(card: AsoFlowCard, actor: string, action: string, at: string): AsoFlowCard {
  const next = { ...card, version: card.version + 1, updatedBy: actor, updatedAt: at };
  next.events = [
    ...(card.events || []),
    { action, at, actor, version: next.version, status: next.status },
  ].slice(-50);
  return json(next);
}
function save(tx: Transaction, card: AsoFlowCard) {
  const ref = cases().doc(card.id);
  tx.set(ref, card);
  tx.create(ref.collection("history").doc(String(card.version)), card);
}
type Reader = {
  query(query: Query): Promise<QuerySnapshot>;
  doc(ref: DocumentReference): Promise<DocumentSnapshot>;
};
const read: Reader = { query: (query) => query.get(), doc: (ref) => ref.get() };
const transactionReader = (tx: Transaction): Reader => ({
  query: (query) => tx.get(query),
  doc: (ref) => tx.get(ref),
});
const formattedCnpj = (v: string) =>
  v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const formattedCpf = (v: string) => v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
const uniqueDocs = (snapshots: QuerySnapshot[]) => {
  if (snapshots.some((snapshot) => snapshot.size >= 4))
    throw conflict(
      "Há múltiplos cadastros para o mesmo documento. Corrija as duplicidades antes de importar."
    );
  return [...new Map(snapshots.flatMap((s) => s.docs).map((doc) => [doc.id, doc])).values()];
};
const employeeIdentityHash = (companyId: string, employeeId: string, cpf: string) =>
  sha(JSON.stringify([companyId, employeeId, asoFlowDigits(cpf)]));
export function asoFlowCaseId(companyId: string, employeeId: string, row: AsoFlowRow) {
  return sha(
    JSON.stringify([
      companyId,
      employeeId,
      asoFlowText(row.unit),
      asoFlowText(row.city),
      row.state.toUpperCase(),
      row.examType,
      row.cycle,
    ])
  );
}
type Resolved = {
  preview: AsoFlowPreviewRow;
  company?: DocumentSnapshot;
  employee?: DocumentSnapshot;
  existing?: AsoFlowCard;
};
async function resolveRows(
  user: AuthContext,
  rows: AsoFlowRow[],
  reader: Reader
): Promise<Resolved[]> {
  const companyCache = new Map<string, DocumentSnapshot[]>();
  const employeeCache = new Map<string, DocumentSnapshot[]>();
  const seen = new Set<string>();
  const resolved: Resolved[] = rows.map((row, index) => ({
    preview: {
      row,
      index: row.sourceRow ?? index + 2,
      state: "blocked",
      errors: asoFlowRowProblems(row),
    },
  }));
  const companyRows = [
    ...new Map(
      resolved
        .filter((r) => !r.preview.errors.length)
        .map((r) => [asoFlowDigits(r.preview.row.companyCnpj), r.preview.row])
    ).values(),
  ];
  await inBatches(companyRows, async (row) => {
    const cnpj = asoFlowDigits(row.companyCnpj);
    companyCache.set(
      cnpj,
      uniqueDocs(
        await Promise.all([
          reader.query(
            adminDb
              .collection("companies")
              .where("cnpj", "in", [...new Set([cnpj, formattedCnpj(cnpj), row.companyCnpj])])
              .limit(4)
          ),
          reader.query(
            adminDb.collection("companies").where("cnpjNormalized", "==", cnpj).limit(4)
          ),
        ])
      )
    );
  });
  for (const item of resolved) {
    const { preview } = item,
      { row } = preview;
    if (preview.errors.length) continue;
    const companies = companyCache
      .get(asoFlowDigits(row.companyCnpj))!
      .filter((doc) => doc.data()?.isDeleted !== true && doc.data()?.active === true);
    if (companies.length !== 1 || !allowed(user, companies[0].id)) {
      preview.errors.push(
        "CNPJ sem cadastro ativo único autorizado. Confira cliente e estabelecimento."
      );
      continue;
    }
    item.company = companies[0];
  }
  const employeeRows = [
    ...new Map(
      resolved
        .filter((r) => r.company)
        .map((r) => [`${r.company!.id}:${asoFlowDigits(r.preview.row.employeeCpf)}`, r])
    ).values(),
  ];
  await inBatches(employeeRows, async (item) => {
    const company = item.company!,
      row = item.preview.row,
      cpf = asoFlowDigits(row.employeeCpf);
    employeeCache.set(
      `${company.id}:${cpf}`,
      uniqueDocs(
        await Promise.all([
          reader.query(
            company.ref
              .collection("employees")
              .where("cpf", "in", [...new Set([cpf, formattedCpf(cpf), row.employeeCpf])])
              .limit(4)
          ),
          reader.query(
            company.ref.collection("employees").where("cpfNormalized", "==", cpf).limit(4)
          ),
        ])
      )
    );
  });
  for (const item of resolved) {
    const { preview, company } = item,
      { row } = preview;
    if (!company || preview.errors.length) continue;
    const companyData = company.data()!,
      cnpj = asoFlowDigits(row.companyCnpj),
      cpf = asoFlowDigits(row.employeeCpf);
    const employees = employeeCache
      .get(`${company.id}:${cpf}`)!
      .filter(
        (doc) =>
          doc.data()?.isDeleted !== true &&
          asoFlowEmploymentAllowed(doc.data()?.status, row.examType)
      );
    if (employees.length !== 1) {
      preview.errors.push(
        "CPF sem vínculo cadastral único compatível com este tipo de ASO. Confira o cadastro."
      );
      continue;
    }
    const employee = employees[0],
      employeeData = employee.data()!;
    if (
      employeeData.companyId !== company.id ||
      asoFlowDigits(value(employeeData.cpf)) !== cpf ||
      asoFlowDigits(value(companyData.cnpj)) !== cnpj
    ) {
      preview.errors.push(
        "CPF/CNPJ ou vínculo cadastral divergente. Corrija a identificação antes de importar."
      );
      continue;
    }
    if (asoFlowText(value(employeeData.name)) !== asoFlowText(row.employeeName)) {
      preview.errors.push("O nome do colaborador diverge do CPF cadastrado. Confira a identidade.");
      continue;
    }
    const role = value(employeeData.job_role?.title),
      department = value(employeeData.department);
    if (row.roleTitle && asoFlowText(row.roleTitle) !== asoFlowText(role))
      preview.errors.push("Cargo diverge do cadastro do colaborador.");
    if (row.department && asoFlowText(row.department) !== asoFlowText(department))
      preview.errors.push("Setor diverge do cadastro do colaborador.");
    if (!value(companyData.name)) preview.errors.push("Cliente sem nome cadastrado.");
    if (preview.errors.length) continue;
    const caseId = asoFlowCaseId(company.id, employee.id, row);
    Object.assign(preview, {
      id: caseId,
      companyId: company.id,
      companyName: companyData.name,
      employeeId: employee.id,
    });
    item.employee = employee;
  }
  const existing = new Map<string, AsoFlowCard | undefined>();
  await inBatches(
    [...new Set(resolved.map((r) => r.preview.id).filter((v): v is string => !!v))],
    async (caseId) => {
      existing.set(
        caseId,
        (await reader.doc(cases().doc(caseId))).data() as AsoFlowCard | undefined
      );
    }
  );
  for (const item of resolved) {
    if (!item.preview.id) continue;
    item.existing = existing.get(item.preview.id);
    if (item.existing) {
      const card = item.existing,
        { row } = item.preview,
        companyId = item.company!.id,
        employeeId = item.employee!.id;
      if (
        card.id !== item.preview.id ||
        card.companyId !== companyId ||
        card.employeeId !== employeeId ||
        card.cnpj !== asoFlowDigits(row.companyCnpj) ||
        card.employeeIdentityHash !==
          employeeIdentityHash(companyId, employeeId, row.employeeCpf) ||
        asoFlowText(value(card.employeeName)) !== asoFlowText(row.employeeName) ||
        asoFlowText(value(card.unit)) !== asoFlowText(row.unit) ||
        asoFlowText(value(card.city)) !== asoFlowText(row.city) ||
        value(card.state).toUpperCase() !== row.state.toUpperCase() ||
        card.examType !== row.examType ||
        card.cycle !== row.cycle
      ) {
        item.preview.errors.push(
          "O card existente possui identificação diferente do cadastro ou desta solicitação. Confira o histórico antes de reimportar; nenhum vínculo foi alterado."
        );
        item.preview.state = "blocked";
        continue;
      }
    }
    item.preview.state = item.existing || seen.has(item.preview.id) ? "exists" : "ready";
    seen.add(item.preview.id);
  }
  return resolved;
}
async function inBatches<T>(items: T[], run: (item: T) => Promise<void>) {
  // Bound fanout while avoiding hundreds of serial network round trips inside a transaction.
  for (let start = 0; start < items.length; start += 20)
    await Promise.all(items.slice(start, start + 20).map(run));
}
function previewResult(resolved: Resolved[]): AsoFlowPreview {
  const rows = resolved.map((r) => r.preview);
  return {
    rows,
    ready: rows.filter((r) => r.state === "ready").length,
    existing: rows.filter((r) => r.state === "exists").length,
    blocked: rows.filter((r) => r.state === "blocked").length,
  };
}
function parseImport(input: unknown) {
  const parsed = AsoFlowImportSchema.safeParse(input);
  if (!parsed.success)
    throw badRequest(
      "Envie de 1 a 200 linhas por lote, com o nome da planilha e os campos esperados."
    );
  return parsed.data;
}
export async function previewAsoFlowImport(user: AuthContext, input: unknown) {
  requireAsoFlowAccess(user);
  const data = parseImport(input);
  return previewResult(await resolveRows(user, data.rows, read));
}
export async function importAsoFlowRows(user: AuthContext, input: unknown) {
  requireAsoFlowAccess(user);
  const data = parseImport(input);
  return adminDb.runTransaction(async (tx) => {
    const resolved = await resolveRows(user, data.rows, transactionReader(tx));
    const preview = previewResult(resolved);
    if (preview.blocked)
      throw conflict(
        "Há linhas com identificação pendente. Revise a prévia e importe somente as linhas liberadas."
      );
    const at = new Date().toISOString(),
      createdCards = new Map<string, AsoFlowCard>();
    let created = 0,
      unchanged = 0;
    for (const item of resolved) {
      const { row } = item.preview;
      if (item.existing || createdCards.has(item.preview.id!)) {
        unchanged++;
        if (item.existing) createdCards.set(item.existing.id, item.existing);
        continue;
      }
      const company = item.company!.data()!,
        employee = item.employee!.data()!;
      const card: AsoFlowCard = {
        id: item.preview.id!,
        version: 1,
        companyId: item.company!.id,
        companyName: value(company.name),
        cnpj: asoFlowDigits(value(company.cnpj)),
        employeeId: item.employee!.id,
        employeeName: value(employee.name),
        employeeIdentityHash: employeeIdentityHash(
          item.company!.id,
          item.employee!.id,
          value(employee.cpf)
        ),
        city: row.city,
        state: row.state.toUpperCase(),
        unit: row.unit,
        examType: row.examType as AsoFlowExamType,
        cycle: row.cycle,
        roleTitle: value(employee.job_role?.title),
        department: value(employee.department),
        status: "pending",
        sourceName: data.sourceName,
        sourceRow: row.sourceRow ?? item.preview.index,
        clientEmail: email(company.contactEmail) || email(company.email),
        events: [{ action: "import", at, actor: user.uid, version: 1, status: "pending" }],
        createdAt: at,
        createdBy: user.uid,
        updatedAt: at,
        updatedBy: user.uid,
      };
      tx.create(cases().doc(card.id), card);
      tx.create(cases().doc(card.id).collection("history").doc("1"), card);
      createdCards.set(card.id, card);
      created++;
    }
    return { created, unchanged, cards: [...createdCards.values()] };
  });
}
export async function getAsoFlowCard(user: AuthContext, caseId: string): Promise<AsoFlowCard> {
  requireAsoFlowAccess(user);
  const card = (await cases().doc(id(caseId)).get()).data() as AsoFlowCard | undefined;
  if (!card) throw new AuthError("Card não encontrado.", 404);
  requireAsoFlowAccess(user, card.companyId);
  return card;
}
export async function listAsoFlowCards(
  user: AuthContext,
  options: { companyId?: string; cursor?: string } = {}
) {
  requireAsoFlowAccess(user, options.companyId);
  let query: Query = cases();
  if (options.companyId) query = query.where("companyId", "==", options.companyId);
  else if (!isPgrGlobalAdmin(user)) {
    const ids = [...new Set(user.servedCompanies)];
    if (!ids.length)
      return { cards: [], nextCursor: null, clinics: [], capabilities: asoFlowCapabilities() };
    if (ids.length > 30) throw badRequest("Selecione um cliente para consultar sua carteira.");
    query = query.where("companyId", "in", ids);
  }
  query = query.orderBy(FieldPath.documentId());
  if (options.cursor) query = query.startAfter(id(options.cursor));
  const snapshot = await query.limit(201).get();
  const cards = snapshot.docs.slice(0, 200).map((d) => ({ ...d.data(), id: d.id }) as AsoFlowCard);
  const clinics = await listAsoFlowClinics(user, options.companyId);
  return {
    cards,
    nextCursor: snapshot.size > 200 ? cards.at(-1)!.id : null,
    clinics,
    capabilities: asoFlowCapabilities(),
  };
}
export function asoFlowCapabilities() {
  const mail = asoGmailConfiguration();
  return {
    socGeneration: false,
    emailSend: mail.configured,
    clientEmailSend: mail.configured && asoClientEmailSendingEnabled(),
    emailMonitoring: mail.monitoringConfigured,
    socPdfReception: false,
    socHref: socWebAccess().href,
  };
}
export async function listAsoFlowClinics(
  user: AuthContext,
  companyId?: string
): Promise<AsoFlowClinic[]> {
  requireAsoFlowAccess(user, companyId);
  let query: Query = adminDb.collection("providers");
  if (companyId) query = query.where("servedCompanies", "array-contains", companyId);
  else if (!isPgrGlobalAdmin(user)) {
    const ids = [...new Set(user.servedCompanies)];
    if (!ids.length) return [];
    if (ids.length > 30) throw badRequest("Selecione um cliente para consultar clínicas.");
    query = query.where("servedCompanies", "array-contains-any", ids);
  }
  const snapshot = await query.limit(2001).get();
  if (snapshot.size > 2000)
    throw badRequest("Selecione um cliente para reduzir a lista de clínicas.");
  return snapshot.docs.flatMap((doc) => {
    const clinic = doc.data();
    const ids = Array.isArray(clinic.servedCompanies)
      ? clinic.servedCompanies.filter((c): c is string => typeof c === "string" && allowed(user, c))
      : [];
    return clinic.active === true &&
      clinic.isDeleted !== true &&
      ["CLINIC", "HOSPITAL"].includes(clinic.type) &&
      ids.length &&
      value(clinic.name)
      ? [{ id: doc.id, name: value(clinic.name), email: email(clinic.email), companyIds: ids }]
      : [];
  });
}
function validateClinic(
  data: Record<string, unknown> | undefined,
  card: AsoFlowCard,
  clinicId: string
) {
  if (
    !data ||
    data.active !== true ||
    data.isDeleted === true ||
    !["CLINIC", "HOSPITAL"].includes(value(data.type)) ||
    !Array.isArray(data.servedCompanies) ||
    !data.servedCompanies.includes(card.companyId) ||
    !value(data.name) ||
    !email(data.email)
  )
    throw badRequest(
      "Escolha uma clínica ativa vinculada ao cliente, com e-mail de atendimento válido."
    );
  return { id: clinicId, name: value(data.name), email: email(data.email) };
}
function requireNotFuture(instant: string) {
  if (!Number.isFinite(Date.parse(instant)) || Date.parse(instant) > Date.now() + 300000)
    throw badRequest("Informe o horário em que o envio efetivamente ocorreu.");
}
function requireReviewed(card: AsoFlowCard) {
  if (
    card.status !== "reviewed" ||
    !card.aso ||
    card.review?.hash !== card.aso.hash ||
    card.archive?.hash !== card.aso.hash ||
    card.review.documentChecked !== true ||
    card.review.identityConfirmed !== true
  )
    throw conflict("Confira a identidade, o documento e o arquivamento do ASO antes de entregar.");
}
async function currentIdentity(tx: Transaction, card: AsoFlowCard) {
  const [company, employee] = await Promise.all([
    tx.get(companyRef(card.companyId)),
    tx.get(companyRef(card.companyId).collection("employees").doc(card.employeeId)),
  ]);
  const c = company.data(),
    e = employee.data();
  if (
    !c ||
    !e ||
    c.isDeleted === true ||
    c.active !== true ||
    e.isDeleted === true ||
    e.companyId !== card.companyId ||
    card.employeeIdentityHash !==
      employeeIdentityHash(card.companyId, card.employeeId, value(e.cpf)) ||
    asoFlowDigits(value(c.cnpj)) !== card.cnpj ||
    asoFlowText(value(e.name)) !== asoFlowText(card.employeeName)
  )
    throw conflict(
      "O cadastro do cliente ou colaborador mudou. Confira a identificação antes de continuar."
    );
  return { company: c, employee: e };
}
function docPath(card: AsoFlowCard, kind: "kit" | "aso", hash: string) {
  return `aso-flow-private/v1/clientes/${encodeURIComponent(card.companyId)}/asos/${encodeURIComponent(card.employeeId)}/${card.id}/${kind}/${hash}.pdf`;
}
function archiveRef(card: AsoFlowCard, documentHash: string) {
  return root()
    .collection("clientArchives")
    .doc(sha(JSON.stringify([card.companyId, card.employeeId, card.id, documentHash])));
}
async function verifyDocument(card: AsoFlowCard, kind: "kit" | "aso") {
  const document = card[kind];
  if (!document) throw conflict("Anexe o PDF correspondente antes de continuar.");
  const [bytes] = await getStorage()
    .bucket(firebaseConfig.storageBucket)
    .file(docPath(card, kind, document.hash))
    .download();
  if (
    bytes.length > ASO_FLOW_MAX_PDF_BYTES ||
    bytes.length !== document.size ||
    bytes.subarray(0, 5).toString() !== "%PDF-" ||
    sha(bytes) !== document.hash
  )
    throw conflict("A integridade do PDF não pôde ser confirmada. Confira o documento original.");
  return { bytes, fileName: document.fileName, hash: document.hash, card };
}
export async function readAsoFlowDocument(user: AuthContext, caseId: string, kind: "kit" | "aso") {
  if (!["kit", "aso"].includes(kind)) throw badRequest("Tipo de documento inválido.");
  const card = await getAsoFlowCard(user, caseId);
  const result = await verifyDocument(card, kind);
  await cases()
    .doc(card.id)
    .collection("documentAccess")
    .add({ kind, hash: result.hash, at: new Date().toISOString(), actor: user.uid });
  return result;
}
export async function updateAsoFlowCard(user: AuthContext, input: unknown): Promise<AsoFlowCard> {
  requireAsoFlowAccess(user);
  const parsed = AsoFlowMutationSchema.safeParse(input);
  if (!parsed.success) throw badRequest("Confira os campos, datas e confirmações desta ação.");
  const data = parsed.data,
    before = await getAsoFlowCard(user, data.id);
  requireVersion(before, data.version);
  mutable(before);
  if (["review_aso", "record_delivery"].includes(data.action)) await verifyDocument(before, "aso");
  if (data.action === "record_kit_delivery") await verifyDocument(before, "kit");
  return adminDb.runTransaction(async (tx) => {
    const card = (await tx.get(cases().doc(data.id))).data() as AsoFlowCard;
    if (!card) throw new AuthError("Card não encontrado.", 404);
    requireAsoFlowAccess(user, card.companyId);
    requireVersion(card, data.version);
    mutable(card);
    const identity = await currentIdentity(tx, card);
    const at = new Date().toISOString();
    if (data.action === "schedule") {
      if (!asoFlowEmploymentAllowed(identity.employee.status, card.examType))
        throw conflict(
          "A situação cadastral do colaborador mudou. Confira o vínculo para este tipo de ASO antes de agendar."
        );
      if (!["pending", "scheduled"].includes(card.status) || card.kitDelivery || card.aso)
        throw conflict("Confira os envios anteriores antes de alterar o agendamento.");
      const clinic = (await tx.get(adminDb.collection("providers").doc(data.clinicId))).data();
      if (
        card.kit &&
        (card.clinic?.id !== data.clinicId ||
          card.appointment?.date !== data.date ||
          card.appointment?.time !== data.time)
      )
        throw conflict("Já há kit SOC anexado. Confira o pedido antes de alterar clínica ou data.");
      card.clinic = validateClinic(clinic, card, data.clinicId);
      card.appointment = {
        date: data.date,
        time: data.time,
        reference: data.reference,
        confirmedBy: user.uid,
        confirmedAt: at,
      };
      card.status = "scheduled";
    } else if (data.action === "waiting_aso") {
      if (!["scheduled", "kit_sent"].includes(card.status) || !card.appointment)
        throw conflict("Confirme o agendamento antes de registrar o comparecimento.");
      if (data.attendedDate > at.slice(0, 10))
        throw badRequest("O comparecimento não pode ter data futura.");
      card.attendedDate = data.attendedDate;
      card.status = "waiting_aso";
    } else if (data.action === "review_aso") {
      if (!["received", "reviewed"].includes(card.status) || !card.aso)
        throw conflict("Receba o PDF antes de registrar a conferência.");
      card.review = {
        hash: card.aso.hash,
        reviewedAt: at,
        reviewedBy: user.uid,
        identityConfirmed: true,
        documentChecked: true,
      };
      card.clientEmail = email(identity.company.contactEmail) || email(identity.company.email);
      card.archive = {
        companyId: card.companyId,
        employeeId: card.employeeId,
        hash: card.aso.hash,
        fileName: card.aso.fileName,
        archivedAt: at,
      };
      card.status = "reviewed";
    } else if (data.action === "record_delivery") {
      requireReviewed(card);
      requireNotFuture(data.deliveredAt);
      const recipient = email(identity.company.contactEmail) || email(identity.company.email);
      if (!recipient || email(data.recipient) !== recipient)
        throw badRequest(
          "Confirme o e-mail de entrega no cadastro do cliente antes de registrar o envio."
        );
      card.clientEmail = recipient;
      card.delivery = {
        recipient,
        reference: data.reference,
        deliveredAt: data.deliveredAt,
        hash: card.aso!.hash,
        method: "manual",
      };
      card.status = "delivered";
    } else if (data.action === "record_kit_delivery") {
      if (
        !card.kit ||
        !card.appointment ||
        !card.clinic ||
        !["scheduled", "kit_sent"].includes(card.status)
      )
        throw conflict("Confirme agenda, clínica e PDF nativo SOC antes de registrar o envio.");
      const clinic = validateClinic(
        (await tx.get(adminDb.collection("providers").doc(card.clinic.id))).data(),
        card,
        card.clinic.id
      );
      if (email(data.recipient) !== clinic.email)
        throw badRequest("O destinatário deve corresponder ao e-mail cadastrado da clínica.");
      requireNotFuture(data.sentAt);
      card.kitDelivery = {
        recipient: clinic.email,
        reference: data.reference,
        sentAt: data.sentAt,
        hash: card.kit.hash,
        method: "manual",
      };
      card.status = "kit_sent";
    } else {
      if (data.outcome === "no_show" && !card.appointment)
        throw conflict("Registre o agendamento antes de informar uma falta.");
      if (card.aso)
        throw conflict(
          "Há ASO recebido. Confira o documento antes de cancelar ou registrar falta."
        );
      card.status = data.outcome;
      card.cancellation = { reason: data.reason, at, by: user.uid };
    }
    const next = updated(card, user.uid, data.action, at);
    if (data.action === "review_aso")
      tx.set(archiveRef(card, card.aso!.hash), {
        ...card.archive,
        caseId: card.id,
        reviewedBy: user.uid,
        current: true,
        superseded: false,
      });
    save(tx, next);
    return next;
  });
}
const safeFileName = (text: string) =>
  text.replace(/[\\/\x00-\x1f\x7f<>:"|?*]/g, " ").slice(0, 175);
function requireUploadVersion(
  card: AsoFlowCard,
  version: number,
  kind: "kit" | "aso",
  hash: string
) {
  // A lost acknowledgement can be retried after later review/delivery. It may only
  // return the current identical document; a different PDF still needs the current version.
  const replay = card[kind]?.hash === hash && version <= card.version;
  requireVersion(card, replay ? card.version : version);
}
export async function uploadAsoFlowDocument(
  user: AuthContext,
  input: unknown,
  bytes: Buffer,
  fileName: string
): Promise<AsoFlowCard> {
  requireAsoFlowAccess(user);
  const parsed = AsoFlowUploadSchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Confira os dados do documento, a referência e a confirmação de identidade.");
  if (
    bytes.length < 100 ||
    bytes.length > ASO_FLOW_MAX_PDF_BYTES ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw badRequest("Envie um PDF válido de até 5 MB.");
  const data = parsed.data,
    before = await getAsoFlowCard(user, data.id);
  const kind = data.action === "record_soc_kit" ? "kit" : "aso",
    hash = sha(bytes);
  requireUploadVersion(before, data.version, kind, hash);
  if (before[kind]?.hash !== hash) mutable(before);
  if (
    kind === "kit" &&
    before.kit?.hash !== hash &&
    (!before.appointment || !before.clinic || before.kitDelivery || before.aso)
  )
    throw conflict(
      "Confirme a agenda e a clínica antes de anexar o kit; um kit enviado exige conferência específica para substituição."
    );
  const object = getStorage()
    .bucket(firebaseConfig.storageBucket)
    .file(docPath(before, kind, hash));
  try {
    await object.save(bytes, {
      resumable: false,
      contentType: "application/pdf",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { cacheControl: "private, no-store" },
    });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && Number(error.code) === 412))
      throw error;
    const [existing] = await object.download();
    if (sha(existing) !== hash)
      throw conflict("O arquivo existente não corresponde ao documento recebido.");
  }
  return adminDb.runTransaction(async (tx) => {
    const card = (await tx.get(cases().doc(data.id))).data() as AsoFlowCard;
    if (!card) throw new AuthError("Card não encontrado.", 404);
    requireAsoFlowAccess(user, card.companyId);
    requireUploadVersion(card, data.version, kind, hash);
    const identity = await currentIdentity(tx, card);
    const at = new Date().toISOString();
    const existingDocument = card[kind];
    if (existingDocument?.hash === hash) {
      if (
        existingDocument.size !== bytes.length ||
        (data.version < card.version &&
          (existingDocument.reference !== data.reference ||
            (data.action === "receive_aso" && existingDocument.source !== data.source))) ||
        (data.action === "receive_aso" && card.aso?.examDate !== data.examDate) ||
        (data.action === "record_soc_kit" &&
          (card.kit?.socOrder !== data.socOrder || card.kit?.socCompanyId !== data.socCompanyId))
      )
        throw conflict(
          "O mesmo PDF já está vinculado com outra identificação. Confira o documento original antes de corrigir os dados."
        );
      return card;
    }
    mutable(card);
    // An archive index remains as historical evidence, but a replaced PDF is no longer current.
    const previousArchiveRef =
      data.action === "receive_aso" && card.aso ? archiveRef(card, card.aso.hash) : null;
    const previousArchive = previousArchiveRef ? await tx.get(previousArchiveRef) : null;
    const previousArchiveData =
      previousArchive?.data() || (card.archive ? { ...card.archive, caseId: card.id } : null);
    const base: AsoFlowDocument = {
      hash,
      fileName: "",
      originalFileName: safeFileName(fileName),
      size: bytes.length,
      receivedAt: at,
      receivedBy: user.uid,
      reference: data.reference,
      source: "soc",
    };
    let orderRef: DocumentReference | null = null,
      oldOrderRef: DocumentReference | null = null;
    let previousOrderData: Record<string, unknown> | null = null;
    if (data.action === "record_soc_kit") {
      const registeredSoc = value(identity.company.socCompanyId) || value(identity.company.socCode);
      if (registeredSoc && registeredSoc !== data.socCompanyId)
        throw badRequest("O código SOC informado diverge do cadastro do cliente.");
      if (!card.appointment || !card.clinic || card.kitDelivery || card.aso)
        throw conflict("O agendamento ou documento mudou. Confira antes de substituir o kit.");
      orderRef = root()
        .collection("socOrders")
        .doc(sha(JSON.stringify([data.socCompanyId, data.socOrder])));
      const order = await tx.get(orderRef);
      if (
        order.exists &&
        (order.data()?.caseId !== card.id ||
          order.data()?.companyId !== card.companyId ||
          order.data()?.employeeId !== card.employeeId)
      )
        throw conflict("Este pedido SOC já está vinculado a outro card ou identificação.");
      if (
        card.kit &&
        (card.kit.socOrder !== data.socOrder || card.kit.socCompanyId !== data.socCompanyId)
      ) {
        const ref = root()
          .collection("socOrders")
          .doc(sha(JSON.stringify([card.kit.socCompanyId, card.kit.socOrder])));
        const previousOrder = await tx.get(ref);
        if (
          previousOrder.exists &&
          (previousOrder.data()?.caseId !== card.id ||
            previousOrder.data()?.companyId !== card.companyId ||
            previousOrder.data()?.employeeId !== card.employeeId)
        )
          throw conflict("O pedido SOC anterior possui vínculo divergente. Confira o histórico.");
        oldOrderRef = ref;
        previousOrderData = previousOrder.data() || {};
      }
      card.kit = {
        ...base,
        fileName: `${safeFileName(`Kit SOC - ${card.employeeName} - ${card.cycle} - ${card.city}`)}.pdf`,
        socOrder: data.socOrder,
        socCompanyId: data.socCompanyId,
        nativeSocDeclared: true,
      };
    } else {
      if (data.examDate > at.slice(0, 10))
        throw badRequest("A data do ASO recebido não pode ser futura.");
      card.aso = {
        ...base,
        fileName: `${safeFileName(`ASO - ${card.employeeName} - ${data.examDate} - ${card.city}`)}.pdf`,
        examDate: data.examDate,
        source: data.source,
      };
      delete card.review;
      delete card.archive;
      delete card.delivery;
      card.status = "received";
    }
    const next = updated(card, user.uid, data.action, at);
    if (previousArchiveRef && previousArchiveData)
      tx.set(previousArchiveRef, {
        ...previousArchiveData,
        current: false,
        superseded: true,
        supersededByHash: hash,
        supersededAt: at,
        supersededBy: user.uid,
      });
    if (oldOrderRef && data.action === "record_soc_kit")
      tx.set(oldOrderRef, {
        ...previousOrderData,
        caseId: card.id,
        companyId: card.companyId,
        employeeId: card.employeeId,
        current: false,
        supersededAt: at,
        supersededBy: user.uid,
        replacementSocOrder: data.socOrder,
        replacementSocCompanyId: data.socCompanyId,
      });
    if (orderRef)
      tx.set(orderRef, {
        caseId: card.id,
        companyId: card.companyId,
        employeeId: card.employeeId,
        current: true,
      });
    save(tx, next);
    return next;
  });
}
export async function reserveAsoFlowMail(
  user: AuthContext,
  input: {
    id: string;
    version: number;
    kind: "kit" | "aso";
    recipient: string;
    documentHash: string;
    outboxId: string;
    mailbox: string;
    messageId: string;
    startedAt: string;
  }
): Promise<void> {
  requireAsoFlowAccess(user);
  id(input.id);
  if (
    !AsoFlowIdSchema.safeParse(input.outboxId).success ||
    !AsoFlowIdSchema.safeParse(input.documentHash).success ||
    !email(input.recipient) ||
    !email(input.mailbox) ||
    !["kit", "aso"].includes(input.kind) ||
    input.messageId !== `<nai-aso-${input.outboxId}@${email(input.mailbox).split("@")[1]}>`
  )
    throw badRequest("Dados de envio inválidos.");
  requireNotFuture(input.startedAt);
  await adminDb.runTransaction(async (tx) => {
    const ref = cases().doc(input.id),
      outbox = root().collection("outbox").doc(input.outboxId);
    const [snapshot, previous, profile] = await Promise.all([
      tx.get(ref),
      tx.get(outbox),
      tx.get(adminDb.collection("users").doc(user.uid)),
    ]);
    const card = snapshot.data() as AsoFlowCard | undefined;
    if (!card) throw new AuthError("Card não encontrado.", 404);
    const profileData = profile.data();
    if (!profileData || profileData.accessEnabled === false)
      throw forbidden("O acesso do operador foi revogado.");
    const claims = parseClaims(profileData);
    requireAsoFlowAccess(
      {
        ...user,
        role: claims.role,
        tenantId: claims.tenantId || null,
        permissions: claims.permissions || [],
        servedCompanies: claims.servedCompanies || [],
      },
      card.companyId
    );
    requireVersion(card, input.version);
    mutable(card);
    if (previous.exists)
      throw conflict(
        previous.data()?.state === "sent"
          ? "Este arquivo já foi enviado a este destinatário. Consulte o comprovante."
          : "Há um envio em conferência. Consulte o comprovante antes de tentar novamente."
      );
    if (card[input.kind]?.hash !== input.documentHash)
      throw conflict("O arquivo mudou. Atualize o card antes de enviar.");
    const identity = await currentIdentity(tx, card);
    let recipient = "";
    if (input.kind === "kit") {
      if (
        !card.clinic ||
        !card.appointment ||
        !card.kit?.nativeSocDeclared ||
        card.status !== "scheduled" ||
        card.kitDelivery
      )
        throw conflict(
          "Confirme a agenda e o kit SOC; um envio registrado não pode ser repetido automaticamente."
        );
      if (!asoFlowEmploymentAllowed(identity.employee.status, card.examType))
        throw conflict(
          "Confira a situação cadastral e o vínculo para este tipo de ASO antes de enviar o kit."
        );
      const clinic = validateClinic(
        (await tx.get(adminDb.collection("providers").doc(card.clinic.id))).data(),
        card,
        card.clinic.id
      );
      recipient = clinic.email;
      if (recipient !== card.clinic.email)
        throw conflict("O e-mail da clínica mudou. Confira o agendamento antes de enviar.");
    } else {
      requireReviewed(card);
      recipient = email(identity.company.contactEmail) || email(identity.company.email);
      if (!recipient || recipient !== card.clientEmail)
        throw conflict("O e-mail do cliente mudou. Confira o destinatário antes de enviar.");
    }
    if (recipient !== email(input.recipient))
      throw badRequest("O destinatário diverge do cadastro confirmado.");
    tx.create(outbox, {
      caseId: input.id,
      version: input.version,
      kind: input.kind,
      recipient,
      documentHash: input.documentHash,
      mailbox: email(input.mailbox),
      messageId: input.messageId,
      state: "sending",
      startedAt: input.startedAt,
      createdBy: user.uid,
    });
    tx.update(ref, {
      mailLock: {
        outboxId: input.outboxId,
        documentHash: input.documentHash,
        kind: input.kind,
        recipient,
        version: input.version,
        startedAt: input.startedAt,
      },
    });
  });
}
export async function recordAsoFlowSent(
  user: AuthContext,
  input: {
    id: string;
    version: number;
    kind: "kit" | "aso";
    recipient: string;
    providerMessageId: string;
    sentAt: string;
    documentHash: string;
    outboxId?: string;
  }
): Promise<AsoFlowCard> {
  requireAsoFlowAccess(user);
  id(input.id);
  if (
    !input.outboxId ||
    !AsoFlowIdSchema.safeParse(input.outboxId).success ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(input.providerMessageId) ||
    !AsoFlowIdSchema.safeParse(input.documentHash).success ||
    !email(input.recipient)
  )
    throw badRequest("Comprovante de envio inválido.");
  requireNotFuture(input.sentAt);
  return adminDb.runTransaction(async (tx) => {
    const ref = cases().doc(input.id),
      outbox = root().collection("outbox").doc(input.outboxId!);
    const [snapshot, receipt] = await Promise.all([tx.get(ref), tx.get(outbox)]);
    const card = snapshot.data() as AsoFlowCard | undefined;
    if (!card || !receipt.exists) throw conflict("Envio não encontrado para conferência.");
    requireAsoFlowAccess(user, card.companyId);
    requireVersion(card, input.version, true);
    mutable(card);
    const lock = card.mailLock;
    if (
      !lock ||
      lock.outboxId !== input.outboxId ||
      lock.documentHash !== input.documentHash ||
      lock.kind !== input.kind ||
      lock.recipient !== input.recipient ||
      lock.version !== input.version ||
      card[input.kind]?.hash !== input.documentHash
    )
      throw conflict("O envio não corresponde ao card, destinatário e arquivo reservados.");
    const identity = await currentIdentity(tx, card);
    const at = new Date().toISOString();
    if (input.kind === "aso") {
      requireReviewed(card);
      const recipient = email(identity.company.contactEmail) || email(identity.company.email);
      if (recipient !== email(input.recipient))
        throw conflict("O destinatário do cliente mudou durante o envio. Confira o comprovante.");
      card.delivery = {
        recipient,
        reference: input.providerMessageId,
        deliveredAt: input.sentAt,
        hash: input.documentHash,
        method: "gmail",
      };
      card.status = "delivered";
    } else {
      if (!card.clinic || !card.appointment || !["scheduled", "kit_sent"].includes(card.status))
        throw conflict("A agenda mudou durante o envio.");
      const clinic = validateClinic(
        (await tx.get(adminDb.collection("providers").doc(card.clinic.id))).data(),
        card,
        card.clinic.id
      );
      if (clinic.email !== email(input.recipient))
        throw conflict("O destinatário da clínica mudou durante o envio. Confira o comprovante.");
      card.kitDelivery = {
        recipient: clinic.email,
        reference: input.providerMessageId,
        sentAt: input.sentAt,
        hash: input.documentHash,
        method: "gmail",
      };
      card.status = "kit_sent";
    }
    delete card.mailLock;
    const next = updated(card, user.uid, input.kind === "kit" ? "send_kit" : "send_aso", at);
    save(tx, next);
    tx.update(outbox, {
      state: "sent",
      providerMessageId: input.providerMessageId,
      sentAt: input.sentAt,
      completedAt: at,
      caseVersion: next.version,
    });
    return next;
  });
}
