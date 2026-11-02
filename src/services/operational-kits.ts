import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { isPgrGlobalAdmin, requirePgrCompany } from "@/lib/auth/require-pgr-access";
import { AuthError, badRequest, forbidden } from "@/lib/auth/errors";
import { isValidCpf } from "@/lib/cpf";
import { isValidCnpj } from "@/lib/cnpj";
import {
  KitId,
  KitSelection,
  type KitSelectionData,
  type KitPreview,
  type KitCatalog,
  type KitResult,
} from "@/lib/operational-kits";
import {
  generateOccupationalKitPdf,
  occupationalKitFilename,
  type KitRegistration,
} from "./occupational-kit-pdf";
import type { AsoRequest, DigitalKit } from "@/types/aso-scheduler-types";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
// This namespace is already denied to browser SDK reads/writes by Firestore rules.
const records = () => adminDb.collection("workAssistantProposals");
const ledger = (companyId: string) =>
  records()
    .doc(`kit-ledger_${hash(companyId)}`)
    .collection("issued");
const companyRef = (id: string) => adminDb.collection("companies").doc(id);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const required = (v: unknown, label: string) => {
  const value = str(v);
  if (!value || value.length > 240)
    throw badRequest(`Confira ${label} no cadastro antes de preparar o kit.`);
  return value;
};
export function requireKitAccess(user: AuthContext, companyId: string) {
  if (!isPgrGlobalAdmin(user))
    throw forbidden("Kits disponíveis à administração interna autorizada.");
  if (!KitId.safeParse(companyId).success) throw badRequest("Selecione uma empresa válida.");
  requirePgrCompany(user, companyId);
}
function parseSelection(input: unknown) {
  const parsed = KitSelection.safeParse(input);
  if (!parsed.success)
    throw badRequest(
      "Confira colaboradores, clínica, competência, documentos, exames, riscos e médico do PCMSO (CRM/UF). Limite: 10 colaboradores por lote."
    );
  return parsed.data;
}
function references(companyId: string, input: KitSelectionData) {
  const company = companyRef(companyId);
  return [
    company,
    adminDb.collection("providers").doc(input.clinicId),
    company.collection("sourceDocuments").doc(input.pcmsoDocumentId),
    company.collection("sourceDocuments").doc(input.pgrDocumentId),
    ...input.employeeIds.map((id) => company.collection("employees").doc(id)),
  ];
}
function validateSources(companyId: string, input: KitSelectionData, docs: DocumentSnapshot[]) {
  if (docs.some((d) => !d.exists || d.data()?.isDeleted === true))
    throw badRequest("Cadastro ou documento não encontrado. Atualize a seleção.");
  const [company, clinic, pcmso, pgr, ...employees] = docs.map((d) => d.data()!);
  if (company.active !== true || !isValidCnpj(str(company.cnpj)))
    throw badRequest("A empresa precisa estar ativa e possuir CNPJ válido.");
  required(company.name, "o nome da empresa");
  if (
    clinic.active !== true ||
    !["CLINIC", "HOSPITAL"].includes(clinic.type) ||
    !isValidCnpj(str(clinic.cnpj)) ||
    !Array.isArray(clinic.servedCompanies) ||
    !clinic.servedCompanies.includes(companyId)
  )
    throw badRequest(
      "Selecione uma clínica ativa, com CNPJ válido e vínculo com este cliente no credenciamento."
    );
  required(clinic.name, "o nome da clínica");
  required(clinic.address, "o endereço da clínica");
  required(clinic.phone, "o telefone da clínica");
  if (
    pcmso.companyId !== companyId ||
    pgr.companyId !== companyId ||
    !/\bPCMSO\b/i.test(str(pcmso.name).replace(/_/g, " ")) ||
    !/\bPGR\b/i.test(str(pgr.name).replace(/_/g, " "))
  )
    throw badRequest(
      "Vincule os PDFs PGR e PCMSO do cliente no acervo. A vigência e o conteúdo exigem conferência humana."
    );
  const cpfs = new Set<string>();
  for (const employee of employees) {
    const cpf = str(employee.cpf).replace(/\D/g, "");
    if (employee.companyId !== companyId || employee.status !== "active" || !isValidCpf(cpf))
      throw badRequest("Cada colaborador deve estar ativo, vinculado à empresa e com CPF válido.");
    if (cpfs.has(cpf)) throw badRequest("Há cadastros do mesmo CPF no lote. Corrija a seleção.");
    cpfs.add(cpf);
    required(employee.name, "o nome do colaborador");
    required(employee.job_role?.title, "o cargo do colaborador");
    required(employee.department, "o setor do colaborador");
  }
  if (new Set(employees.map((e) => `${str(e.job_role?.title)}|${str(e.department)}`)).size !== 1)
    throw badRequest(
      "Separe os lotes por cargo e setor para conferir o mesmo protocolo de exames e riscos."
    );
  return { company, clinic, pcmso, pgr, employees };
}
function sourceVersion(docs: DocumentSnapshot[]) {
  return hash(docs.map((d) => [d.ref.path, d.updateTime?.seconds, d.updateTime?.nanoseconds]));
}
export async function getKitCatalog(user: AuthContext, companyId: string): Promise<KitCatalog> {
  requireKitAccess(user, companyId);
  const ref = companyRef(companyId);
  const [company, employees, clinics, documents, history] = await Promise.all([
    ref.get(),
    ref.collection("employees").limit(3001).get(),
    adminDb
      .collection("providers")
      .where("servedCompanies", "array-contains", companyId)
      .limit(501)
      .get(),
    ref.collection("sourceDocuments").limit(201).get(),
    ledger(companyId).orderBy("createdAt", "desc").limit(50).get(),
  ]);
  if (!company.exists || company.data()?.isDeleted === true)
    throw new AuthError("Cliente não encontrado.", 404);
  if (employees.size > 3000 || clinics.size > 500 || documents.size > 200)
    throw badRequest("O cadastro excede o limite deste piloto. Separe a operação por unidade.");
  const catalog: KitCatalog = {
    history: history.docs.map((d) => ({
      id: d.id,
      employeeName: str(d.data().employeeName),
      filename: str(d.data().filename),
      reused: true,
    })),
    employees: employees.docs
      .filter((d) => d.data().status === "active" && !d.data().isDeleted)
      .map((d) => ({
        id: d.id,
        name: str(d.data().name),
        role: str(d.data().job_role?.title),
        department: str(d.data().department),
      })),
    clinics: clinics.docs
      .filter(
        (d) =>
          d.data().active === true &&
          !d.data().isDeleted &&
          ["CLINIC", "HOSPITAL"].includes(d.data().type)
      )
      .map((d) => ({ id: d.id, name: str(d.data().name), city: str(d.data().city) })),
    documents: documents.docs
      .filter((d) => !d.data().isDeleted)
      .map((d) => ({ id: d.id, name: str(d.data().name) })),
  };
  if (companyId === "GRUPO_AVP") {
    try {
      const { readAvpPeriodicSnapshot } = await import("./avp-periodic-sync");
      const campaign = await readAvpPeriodicSnapshot();
      catalog.campaign = {
        checkedAt: campaign.checkedAt,
        people: campaign.summary.uniquePeople,
        review: campaign.summary.review,
        cities: campaign.summary.cities,
        status: campaign.sync?.status || "CONSULTADO",
      };
    } catch {
      catalog.campaignWarning = "Não foi possível atualizar o resumo da campanha AVP.";
    }
  }
  return catalog;
}
export async function prepareKitBatch(
  user: AuthContext,
  companyId: string,
  selection: unknown
): Promise<KitPreview> {
  requireKitAccess(user, companyId);
  const input = parseSelection(selection);
  const docs = await adminDb.getAll(...references(companyId, input));
  const source = validateSources(companyId, input, docs);
  const proposalId = randomUUID(),
    expiresAt = Date.now() + 30 * 60000;
  const preview: KitPreview = {
    proposalId,
    expiresAt,
    company: source.company.name,
    clinic: source.clinic.name,
    clinicAddress: source.clinic.address,
    cycle: input.cycle,
    examType: input.examType,
    employees: source.employees.map((e, i) => ({
      id: input.employeeIds[i],
      name: e.name,
      role: e.job_role.title,
      department: e.department,
    })),
    documents: [
      { id: input.pcmsoDocumentId, name: source.pcmso.name, purpose: "PCMSO" },
      { id: input.pgrDocumentId, name: source.pgr.name, purpose: "PGR" },
    ],
    exams: input.exams,
    risks: input.risks,
    pcmsoDoctor: input.pcmsoDoctor,
    pcmsoCrm: input.pcmsoCrm,
  };
  await records()
    .doc(proposalId)
    .create({
      kind: "kit-preview",
      uid: user.uid,
      companyId,
      input,
      sourceVersion: sourceVersion(docs),
      createdAt: new Date().toISOString(),
      expiresAt,
    });
  return preview;
}
export function kitOperationId(companyId: string, cpf: string, cycle: string, examType: string) {
  return `kit_${hash([companyId, cpf.replace(/\D/g, ""), cycle, examType])}`;
}
function buildKit(
  id: string,
  input: KitSelectionData,
  source: ReturnType<typeof validateSources>,
  index: number,
  now: string
) {
  const employee = source.employees[index];
  const kit: DigitalKit = {
    kitId: id,
    requestId: id,
    guiaNumber: `NAI-${id.slice(4, 20)}`,
    generatedAt: now,
    companyDetails: { name: source.company.name, cnpj: source.company.cnpj, contact: "" },
    employeeDetails: {
      name: employee.name,
      cpf: employee.cpf,
      roleTitle: employee.job_role.title,
      department: employee.department,
    },
    examType: input.examType,
    clinicDetails: {
      name: source.clinic.name,
      address: source.clinic.address,
      phone: source.clinic.phone,
    },
    appointmentDateTime: "A confirmar com a clínica — este kit não reserva horário",
    examList: input.exams.map((name, i) => ({
      code: `NAI-${i + 1}`,
      name,
      mandatory: "CONDICIONAL",
      pcmsoJustification: `Conferido pelo operador no PCMSO ${source.pcmso.name}.`,
      patientPreparo: "Confirmar preparo com a clínica.",
    })),
    patientInstructions: ["Confirmar data, horário e preparo com a clínica antes de comparecer."],
    clinicInstructions: [
      "Conferir exames com o PCMSO e preencher os documentos pelo profissional habilitado.",
    ],
    returnDeadlineDays: 0,
    asoTemplate: {
      declaredRisks: input.risks,
      fitnessChecklist: "",
      doctorNotes: "Preenchimento exclusivo do médico.",
    },
    qrCodeUrl: "",
  };
  const registration: KitRegistration = {
    registration: str(employee.registration),
    birthDate: str(employee.birthDate),
    admissionDate: str(employee.admissionDate),
    unit: str(employee.unit),
    companyAddress: str(source.company.address),
    pcmsoDoctor: input.pcmsoDoctor,
    pcmsoCrm: input.pcmsoCrm,
  };
  return { kit, registration };
}
async function confirmTransaction(
  tx: Transaction,
  user: AuthContext,
  companyId: string,
  proposalId: string
) {
  const ref = records().doc(proposalId),
    saved = (await tx.get(ref)).data();
  if (
    !saved ||
    saved.kind !== "kit-preview" ||
    saved.uid !== user.uid ||
    saved.companyId !== companyId
  )
    throw forbidden("Prévia indisponível nesta sessão.");
  if (saved.confirmedAt)
    return (saved.results as KitResult[]).map((item) => ({ ...item, reused: true }));
  if (!Number.isFinite(saved.expiresAt) || saved.expiresAt < Date.now())
    throw badRequest("A prévia expirou. Prepare novamente.");
  const input = parseSelection(saved.input);
  const docs = await tx.getAll(...references(companyId, input));
  const source = validateSources(companyId, input, docs);
  if (sourceVersion(docs) !== saved.sourceVersion)
    throw new AuthError(
      "Os cadastros ou documentos mudaram. Prepare e confira uma nova prévia.",
      409
    );
  const ids = source.employees.map((e) =>
    kitOperationId(companyId, e.cpf, input.cycle, input.examType)
  );
  const previous = await tx.getAll(...ids.map((id) => records().doc(id)));
  const now = new Date().toISOString();
  // Generate every PDF before any writes. Firestore commits the complete batch or nothing.
  const items = ids.map((id, i) => {
    const { kit, registration } = buildKit(id, input, source, i, now);
    const { employeeIds: _employees, ...protocol } = input;
    const fingerprint = hash({
      protocol,
      company: kit.companyDetails,
      employee: kit.employeeDetails,
      clinic: kit.clinicDetails,
      registration,
    });
    const existing = previous[i].data();
    if (existing && (existing.kind !== "kit-issued" || existing.fingerprint !== fingerprint))
      throw new AuthError(
        "Já existe kit deste colaborador, tipo e competência com dados diferentes. Confira o histórico; a reemissão precisa de revisão específica.",
        409
      );
    const filename = `${occupationalKitFilename(kit).replace(/\.pdf$/, "")}-${input.cycle}-${id.slice(-8)}.pdf`;
    const result: KitResult = {
      id,
      employeeName: kit.employeeDetails.name,
      filename: existing?.filename || filename,
      reused: !!existing,
    };
    if (existing) return { result };
    const pdf = Buffer.from(
      generateOccupationalKitPdf(kit, registration, new Date(now)).output("arraybuffer")
    );
    if (pdf.length > 500000) throw badRequest("Kit excede o limite de PDF do piloto.");
    const request: AsoRequest = {
      id,
      companyName: kit.companyDetails.name,
      cnpj: kit.companyDetails.cnpj,
      employeeName: kit.employeeDetails.name,
      cpf: kit.employeeDetails.cpf,
      roleTitle: kit.employeeDetails.roleTitle,
      department: kit.employeeDetails.department,
      examType: input.examType,
      declaredRisks: input.risks,
      status: "kit_montado",
      clinicId: input.clinicId,
      clinicName: source.clinic.name,
      exams: kit.examList,
      digitalKit: kit,
      alerts: [],
      validationPassed: true,
      validationNotes: [
        "Dados e protocolo conferidos pelo operador. Não comprova avaliação médica, envio, horário ou pedido no SOC.",
      ],
      createdAt: now,
      updatedAt: now,
    };
    return {
      result,
      request,
      record: {
        kind: "kit-issued",
        companyId,
        employeeId: input.employeeIds[i],
        cycle: input.cycle,
        examType: input.examType,
        clinicId: input.clinicId,
        proposalId,
        fingerprint,
        sourceVersion: saved.sourceVersion,
        createdBy: user.uid,
        createdAt: now,
        filename,
        pdfSha256: createHash("sha256").update(pdf).digest("hex"),
        pdfBase64: pdf.toString("base64"),
        socStatus: "not_transmitted",
        deliveryStatus: "not_sent",
      },
    };
  });
  for (const item of items)
    if (item.record) {
      tx.create(records().doc(item.result.id), item.record);
      tx.create(ledger(companyId).doc(item.result.id), { ...item.result, createdAt: now });
      tx.create(
        adminDb.collection("users").doc(user.uid).collection("asoRequests").doc(item.result.id),
        item.request!
      );
    }
  const results = items.map((item) => item.result);
  tx.update(ref, {
    confirmedAt: now,
    confirmedBy: user.uid,
    results,
    confirmation: "reviewed_sources_clinic_protocol",
  });
  return results;
}
export async function confirmKitBatch(user: AuthContext, companyId: string, proposalId: string) {
  requireKitAccess(user, companyId);
  if (!/^[a-f0-9-]{36}$/.test(proposalId)) throw badRequest("Prévia inválida.");
  return adminDb.runTransaction((tx) => confirmTransaction(tx, user, companyId, proposalId));
}
export async function downloadKit(user: AuthContext, companyId: string, id: string) {
  requireKitAccess(user, companyId);
  if (!/^kit_[a-f0-9]{64}$/.test(id)) throw badRequest("Kit inválido.");
  const ref = records().doc(id),
    record = (await ref.get()).data();
  if (!record || record.kind !== "kit-issued" || record.companyId !== companyId)
    throw new AuthError("Kit não encontrado.", 404);
  const bytes = Buffer.from(record.pdfBase64, "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== record.pdfSha256)
    throw new AuthError("Não foi possível validar o PDF arquivado.", 503);
  await ref
    .collection("audit")
    .add({ action: "download", uid: user.uid, at: new Date().toISOString() });
  return { bytes, filename: record.filename as string };
}
