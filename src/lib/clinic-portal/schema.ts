import { z } from "zod";

export const portalId = z.string().regex(/^[a-f0-9]{48}$/);
export const requestId = z.string().regex(/^[\w-]{1,128}$/);
const text = z.string().trim().max(12000);
export const clinicalSchema = z
  .object({
    attendanceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T12:00:00Z`);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value <= new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
        );
      }, "Informe a data real do atendimento, sem data futura."),
    history: text,
    occupationalHistory: text,
    medications: text,
    complaints: text,
    vitalSigns: text,
    physicalExam: text,
    results: text,
    conduct: text,
    conclusion: z.enum(["pendente", "apto", "inapto"]),
    observations: text,
  })
  .strict();
export type ClinicalData = z.infer<typeof clinicalSchema>;
export const inviteSchema = z
  .object({
    requestId,
    clinicName: z.string().trim().min(3).max(200),
    receptionEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
    doctorEmail: z.string().trim().email().max(254),
    doctorName: z.string().trim().min(3).max(200),
    crm: z
      .string()
      .trim()
      .regex(/^\d{1,10}$/),
    uf: z
      .string()
      .regex(
        /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/
      ),
    days: z.number().int().min(1).max(30),
    reviewed: z.literal(true),
  })
  .strict()
  .refine(
    (v) => !v.receptionEmail || v.receptionEmail.toLowerCase() !== v.doctorEmail.toLowerCase(),
    "Use contas individuais distintas para recepção e médico."
  );

export interface PortalGrant {
  email: string;
  role: "reception" | "doctor";
  uid?: string;
}
export interface PortalRecord {
  ownerUid: string;
  sourcePath: string;
  requestId: string;
  clinicName: string;
  doctorName: string;
  crm: string;
  uf: string;
  grants: PortalGrant[];
  expiresAt: string;
  revoked: boolean;
  version: number;
  state: "invited" | "confirmed" | "draft" | "awaiting_signature";
  createdAt: string;
  updatedAt: string;
  clinical?: ClinicalData;
  identity: {
    companyName: string;
    cnpj: string;
    employeeName: string;
    cpf: string;
    roleTitle: string;
    department: string;
    examType: string;
  };
  exams: { code: string; name: string }[];
  risks: string[];
  audit: { action: string; uid: string; at: string }[];
}

export function grantFor(
  record: PortalRecord,
  identity: { uid: string; email?: string; email_verified?: boolean },
  now = Date.now()
) {
  if (
    record.revoked ||
    Date.parse(record.expiresAt) <= now ||
    !identity.email_verified ||
    !identity.email
  )
    return null;
  return (
    record.grants.find(
      (g) => g.email === identity.email!.toLowerCase() && (!g.uid || g.uid === identity.uid)
    ) || null
  );
}

/** Explicit allowlist: reception never receives risks, exams results, history or conclusions. */
export function portalView(record: PortalRecord, role: "doctor" | "reception") {
  const basic = {
    identity: record.identity,
    clinicName: record.clinicName,
    expiresAt: record.expiresAt,
    state: record.state,
    version: record.version,
    role,
  };
  return role === "doctor"
    ? {
        ...basic,
        exams: record.exams,
        risks: record.risks,
        doctorName: record.doctorName,
        crm: record.crm,
        uf: record.uf,
        clinical: record.clinical || null,
      }
    : basic;
}
