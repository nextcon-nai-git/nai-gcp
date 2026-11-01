import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  FieldPath,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type Transaction,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { isPgrGlobalAdmin } from "@/lib/auth/require-pgr-access";
import {
  EsocialDaySchema,
  EsocialEmployerSchema,
  EsocialWorkerSchema,
  isValidEsocialRegistration,
  normalizeEsocialRegistration,
} from "@/lib/esocial-events";
import type { EsocialEventType, EsocialGrant } from "@/lib/esocial-messaging";
import {
  currentEsocialUser,
  esocialDocumentId,
  esocialPrivateRoot,
  requireEsocialAdministrator,
  requireEsocialMessagingAccess,
} from "./access";

export const esocialHash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
export const cleanRecord = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const stringValue = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const esocialCompany = (id: string) =>
  adminDb.collection("companies").doc(esocialDocumentId(id, "Cliente"));
export const esocialEmployee = (companyId: string, id: string) =>
  esocialCompany(companyId).collection("employees").doc(esocialDocumentId(id, "Colaborador"));
export const esocialLinkRef = (companyId: string, employeeId: string) =>
  esocialPrivateRoot()
    .collection("links")
    .doc(esocialHash(`${companyId}:${employeeId}`));
export const esocialGrantRef = (companyId: string) =>
  esocialPrivateRoot().collection("grants").doc(esocialDocumentId(companyId, "Cliente"));
export interface EsocialReader {
  doc(ref: DocumentReference): Promise<DocumentSnapshot>;
  query(query: Query): Promise<QuerySnapshot>;
}
export const esocialReader: EsocialReader = {
  doc: (ref) => ref.get(),
  query: (query) => query.get(),
};
export const esocialTransactionReader = (tx: Transaction): EsocialReader => ({
  doc: (ref) => tx.get(ref),
  query: (query) => tx.get(query),
});
export interface EsocialEmployeeLink {
  companyId: string;
  employeeId: string;
  cpf: string;
  matricula?: string;
  category?: number;
  admissionDate?: string;
  reference: string;
  confirmedAt: string;
  confirmedBy: string;
}
export async function listEsocialCompanies(user: AuthContext) {
  requireEsocialMessagingAccess(user);
  let docs: DocumentSnapshot[] = [];
  if (isPgrGlobalAdmin(user)) {
    const s = await adminDb
      .collection("companies")
      .select("name", "active", "isDeleted")
      .limit(5001)
      .get();
    if (s.size > 5000) throw badRequest("Abra a mensageria pelo cliente para reduzir a carteira.");
    docs = s.docs;
  } else {
    const ids = [...new Set(user.servedCompanies)];
    if (ids.length > 5000) throw badRequest("Carteira acima do limite de consulta.");
    for (let i = 0; i < ids.length; i += 100)
      docs.push(
        ...(await adminDb.getAll(...ids.slice(i, i + 100).map(esocialCompany), {
          fieldMask: ["name", "active", "isDeleted"],
        }))
      );
  }
  return docs
    .flatMap((d) =>
      d.exists && d.data()?.isDeleted !== true
        ? [
            {
              id: d.id,
              name: stringValue(d.data()?.name) || "Cliente sem nome",
              active: d.data()?.active !== false,
            },
          ]
        : []
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export async function listEsocialEmployeeLinks(user: AuthContext, companyId: string) {
  requireEsocialMessagingAccess(user, companyId);
  const [employees, links] = await Promise.all([
    esocialCompany(companyId)
      .collection("employees")
      .select("name", "cpf", "status", "isDeleted")
      .orderBy(FieldPath.documentId())
      .limit(5001)
      .get(),
    esocialPrivateRoot().collection("links").where("companyId", "==", companyId).limit(5001).get(),
  ]);
  if (employees.size > 5000 || links.size > 5000)
    throw badRequest("Cliente acima do limite de consulta de vínculos.");
  const byEmployee = new Map(
    links.docs.map((d) => [d.data().employeeId as string, d.data() as EsocialEmployeeLink])
  );
  return employees.docs.flatMap((d) =>
    d.data().isDeleted === true
      ? []
      : [
          {
            id: d.id,
            name: stringValue(d.data().name),
            cpf: stringValue(d.data().cpf),
            status: stringValue(d.data().status),
            link: byEmployee.get(d.id),
          },
        ]
  );
}
const linkSchema = z
  .object({
    companyId: z.string(),
    employeeId: z.string(),
    matricula: z.string().trim().min(1).max(30).optional(),
    category: z.number().int().optional(),
    admissionDate: EsocialDaySchema.optional(),
    reference: z.string().trim().min(3).max(500),
    confirmed: z.literal(true),
  })
  .strict();
export async function saveEsocialEmployeeLink(user: AuthContext, input: unknown) {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Confira identificação, matrícula/categoria e referência da folha.");
  const v = parsed.data;
  const current = await currentEsocialUser(user, v.companyId);
  const [company, employee] = await Promise.all([
    esocialCompany(v.companyId).get(),
    esocialEmployee(v.companyId, v.employeeId).get(),
  ]);
  const companyData = company.data();
  if (
    !company.exists ||
    !companyData ||
    companyData.isDeleted === true ||
    companyData.active === false
  )
    throw badRequest("Cliente ativo não localizado.");
  const data = employee.data();
  if (!data || data.isDeleted === true || (data.companyId && data.companyId !== v.companyId))
    throw badRequest("Colaborador não localizado neste cliente.");
  const worker = EsocialWorkerSchema.safeParse({
    cpfTrab: data.cpf,
    matricula: v.matricula,
    codCateg: v.category,
  });
  if (!worker.success) throw badRequest(worker.error.issues[0]?.message || "Vínculo inválido.");
  const record: EsocialEmployeeLink = cleanRecord({
    companyId: v.companyId,
    employeeId: v.employeeId,
    cpf: worker.data.cpfTrab,
    matricula: worker.data.matricula,
    category: worker.data.codCateg,
    admissionDate: v.admissionDate,
    reference: v.reference,
    confirmedAt: new Date().toISOString(),
    confirmedBy: current.uid,
  });
  await esocialLinkRef(v.companyId, v.employeeId).set(record);
  await esocialPrivateRoot().collection("audit").doc(randomUUID()).set({
    action: "employment_link_confirmed",
    companyId: v.companyId,
    employeeId: v.employeeId,
    actor: current.uid,
    at: record.confirmedAt,
  });
  return record;
}
const grantSchema = z
  .object({
    companyId: z.string(),
    granteeRegistration: z.string().trim(),
    profiles: z
      .array(z.enum(["sst", "toxicology"]))
      .min(1)
      .max(2),
    validFrom: EsocialDaySchema,
    validUntil: EsocialDaySchema,
    reference: z.string().trim().min(3).max(500),
    active: z.boolean(),
    confirmed: z.literal(true),
  })
  .strict();
export async function getEsocialGrant(
  user: AuthContext,
  companyId: string
): Promise<EsocialGrant | null> {
  requireEsocialMessagingAccess(user, companyId);
  const d = (await esocialGrantRef(companyId).get()).data();
  if (d && d.companyId !== companyId)
    throw badRequest("Procuração divergente do cliente selecionado.");
  return d ? (d as EsocialGrant) : null;
}
export async function saveEsocialGrant(user: AuthContext, input: unknown) {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success)
    throw badRequest("Confira titular, perfis, vigência e referência da procuração.");
  const v = parsed.data;
  const current = await currentEsocialUser(user, v.companyId);
  requireEsocialAdministrator(current);
  const registration = normalizeEsocialRegistration(v.granteeRegistration);
  if (
    !(registration.length === 11 && isValidEsocialRegistration("2", registration)) &&
    !(registration.length === 14 && isValidEsocialRegistration("1", registration))
  )
    throw badRequest("Informe CPF/CNPJ completo e válido do outorgado.");
  if (v.validUntil < v.validFrom) throw badRequest("Vigência da procuração inválida.");
  const company = (await esocialCompany(v.companyId).get()).data();
  if (!company || company.isDeleted === true || company.active === false)
    throw badRequest("Cliente ativo não encontrado.");
  const grant: EsocialGrant = {
    companyId: v.companyId,
    granteeRegistration: registration,
    profiles: [...new Set(v.profiles)],
    validFrom: v.validFrom,
    validUntil: v.validUntil,
    reference: v.reference,
    active: v.active,
    confirmedAt: new Date().toISOString(),
    confirmedBy: current.uid,
    verification: "operator_confirmed",
  };
  await esocialGrantRef(v.companyId).set(grant);
  await esocialPrivateRoot()
    .collection("audit")
    .doc(randomUUID())
    .set({
      action: v.active ? "grant_confirmed" : "grant_disabled",
      companyId: v.companyId,
      actor: current.uid,
      at: grant.confirmedAt,
    });
  return grant;
}
/** MOS S-1.3 NO12/2026, p.18: Grupo SST 3 also covers S-2230; S-2221 uses profile 9.
 * Every granted profile permits exclusion of its own events, not an arbitrary S-3000. */
export function validateEsocialGrant(
  grant: EsocialGrant | undefined | null,
  registration: string,
  eventType: EsocialEventType,
  originalType?: EsocialEventType,
  companyId?: string
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const type = eventType === "S3000" ? originalType : eventType;
  const knownType = type && ["S2210", "S2220", "S2240", "S2221", "S2230"].includes(type);
  const profile = type === "S2221" ? "toxicology" : "sst";
  if (
    !knownType ||
    !grant ||
    grant.active !== true ||
    (companyId !== undefined && grant.companyId !== companyId) ||
    !grant.companyId ||
    grant.verification !== "operator_confirmed" ||
    !stringValue(grant.confirmedBy) ||
    !stringValue(grant.confirmedAt) ||
    stringValue(grant.reference).length < 3 ||
    grant.granteeRegistration !== registration ||
    !Array.isArray(grant.profiles) ||
    !grant.profiles.includes(profile) ||
    !EsocialDaySchema.safeParse(grant.validFrom).success ||
    !EsocialDaySchema.safeParse(grant.validUntil).success ||
    grant.validUntil < grant.validFrom ||
    grant.validFrom > today ||
    grant.validUntil < today
  )
    throw new AuthError(
      "Confirme procuração vigente deste cliente para o titular do A1 e o perfil do evento.",
      409
    );
}
export async function resolveEsocialIdentity(
  reader: EsocialReader,
  companyId: string,
  employer: { type: "1" | "2"; number: string },
  worker: { cpf: string; matricula?: string; category?: number },
  expectedEmployeeId?: string
) {
  const checkedEmployer = EsocialEmployerSchema.safeParse({
    tpInsc: Number(employer.type),
    nrInsc: employer.number,
  });
  const checkedWorker = EsocialWorkerSchema.safeParse({
    cpfTrab: worker.cpf,
    matricula: worker.matricula,
    codCateg: worker.category,
  });
  if (!checkedEmployer.success || !checkedWorker.success)
    throw badRequest("Identificação do empregador ou trabalhador inválida.");
  const company = await reader.doc(esocialCompany(companyId));
  const c = company.data();
  const registeredRaw = stringValue(c?.cnpj || c?.cpf);
  const registered = normalizeEsocialRegistration(registeredRaw);
  const registeredType = registered.length === 11 ? "2" : "1";
  const employerNumber = checkedEmployer.data.nrInsc;
  const matching =
    registered === employerNumber ||
    (employer.type === "1" && employerNumber.length === 8 && registered.startsWith(employerNumber));
  if (
    !c ||
    c.isDeleted === true ||
    c.active === false ||
    ![11, 14].includes(registered.length) ||
    !isValidEsocialRegistration(registeredType, registeredRaw) ||
    registeredType !== employer.type ||
    !matching
  )
    throw badRequest("O empregador do evento não corresponde ao cliente ativo selecionado.");
  const esocialRegistration = stringValue(c.esocialRegistration);
  if (
    c.esocialRegistration !== undefined &&
    (!esocialRegistration ||
      !isValidEsocialRegistration(registeredType, esocialRegistration) ||
      normalizeEsocialRegistration(esocialRegistration) !== employerNumber)
  )
    throw badRequest("A inscrição do evento diverge do S-1000 confirmado para este cliente.");
  worker = {
    cpf: checkedWorker.data.cpfTrab,
    matricula: checkedWorker.data.matricula,
    category: checkedWorker.data.codCateg,
  };
  let employee: DocumentSnapshot;
  if (expectedEmployeeId)
    employee = await reader.doc(esocialEmployee(companyId, expectedEmployeeId));
  else {
    const formatted = worker.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    const values = [...new Set([worker.cpf, formatted])];
    const snapshots = await Promise.all(
      values.map((cpf) =>
        reader.query(
          esocialCompany(companyId).collection("employees").where("cpf", "==", cpf).limit(3)
        )
      )
    );
    const matches = [
      ...new Map(snapshots.flatMap((s) => s.docs).map((d) => [d.id, d])).values(),
    ].filter((d) => d.data()?.isDeleted !== true);
    if (matches.length !== 1)
      throw badRequest("O CPF precisa identificar um único colaborador cadastrado neste cliente.");
    employee = matches[0];
  }
  const e = employee.data();
  if (
    !e ||
    e.isDeleted === true ||
    normalizeEsocialRegistration(stringValue(e.cpf)) !== worker.cpf ||
    (e.companyId && e.companyId !== companyId)
  )
    throw badRequest("O colaborador ou o CPF mudou. Confira o cadastro e o evento.");
  const link = (await reader.doc(esocialLinkRef(companyId, employee.id))).data() as
    EsocialEmployeeLink | undefined;
  if (
    !link ||
    link.companyId !== companyId ||
    link.employeeId !== employee.id ||
    !stringValue(link.confirmedBy) ||
    !stringValue(link.confirmedAt) ||
    stringValue(link.reference).length < 3 ||
    link.cpf !== worker.cpf ||
    link.matricula !== worker.matricula ||
    link.category !== worker.category
  )
    throw badRequest(
      "Confira o vínculo da folha: matrícula/categoria do evento precisa coincidir com o cadastro eSocial confirmado."
    );
  return {
    companyId,
    companyName: stringValue(c.name),
    employeeId: employee.id,
    employeeName: stringValue(e.name),
    employee: e,
    link,
    fingerprint: esocialHash(
      JSON.stringify([
        companyId,
        employee.id,
        registeredType,
        registered,
        worker.cpf,
        worker.matricula || null,
        worker.category || null,
      ])
    ),
  };
}
