import { z } from "zod/v3";
import { isValidCnpj } from "@/lib/cnpj";
import { isValidCpf } from "@/lib/cpf";

export const ASO_FLOW_BATCH_SIZE = 200;
export const ASO_FLOW_MAX_PDF_BYTES = 5 * 1024 * 1024;
export const ASO_FLOW_STATUSES = {
  pending: "A preparar",
  scheduled: "Agendado",
  kit_sent: "Kit enviado",
  waiting_aso: "Aguardando ASO",
  received: "ASO recebido",
  reviewed: "Conferido",
  delivered: "Enviado e encerrado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
} as const;
export type AsoFlowStatus = keyof typeof ASO_FLOW_STATUSES;
export const ASO_FLOW_EXAM_TYPES = [
  "admissional",
  "periodico",
  "demissional",
  "retorno_trabalho",
  "mudanca_funcao",
] as const;
export type AsoFlowExamType = (typeof ASO_FLOW_EXAM_TYPES)[number];
/** Operational linkage only. Employment status never establishes medical fitness. */
export function asoFlowEmploymentAllowed(status: unknown, examType: string): boolean {
  if (!ASO_FLOW_EXAM_TYPES.includes(examType as AsoFlowExamType)) return false;
  return (
    status === "active" ||
    (examType === "retorno_trabalho" && status === "leave") ||
    (examType === "demissional" && status === "fired")
  );
}
export const asoFlowText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
export const asoFlowDigits = (value: string) => value.replace(/\D/g, "");
export const AsoFlowIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const text = (max: number) => z.string().trim().max(max);
export const AsoFlowDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida");
export const AsoFlowRowSchema = z
  .object({
    companyCnpj: text(30),
    employeeCpf: text(30),
    employeeName: text(240),
    city: text(160),
    state: text(2),
    unit: text(240),
    examType: text(50),
    cycle: text(20),
    roleTitle: text(240).optional(),
    department: text(240).optional(),
    sourceRow: z.number().int().positive().max(1000000).optional(),
  })
  .strict();
export type AsoFlowRow = z.infer<typeof AsoFlowRowSchema>;
export const AsoFlowImportSchema = z
  .object({
    rows: z.array(AsoFlowRowSchema).min(1).max(ASO_FLOW_BATCH_SIZE),
    sourceName: text(240).min(1),
  })
  .strict();
const states = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ")
);
export function asoFlowRowProblems(row: AsoFlowRow): string[] {
  const errors: string[] = [];
  if (!isValidCnpj(asoFlowDigits(row.companyCnpj)))
    errors.push("CNPJ do cliente ausente ou inválido.");
  if (!isValidCpf(asoFlowDigits(row.employeeCpf)))
    errors.push("CPF do colaborador ausente ou inválido.");
  if (row.employeeName.length < 2) errors.push("Informe o nome do colaborador.");
  if (row.city.length < 2 || !states.has(row.state.toUpperCase()))
    errors.push("Informe cidade e UF válidas.");
  if (!row.unit) errors.push("Informe o estabelecimento/unidade.");
  if (!ASO_FLOW_EXAM_TYPES.includes(row.examType as AsoFlowExamType))
    errors.push("Tipo de ASO ausente ou não reconhecido.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.cycle))
    errors.push("Informe a competência real da campanha (AAAA-MM).");
  return errors;
}
export interface AsoFlowClinic {
  id: string;
  name: string;
  email: string;
  companyIds: string[];
}
export interface AsoFlowDocument {
  hash: string;
  fileName: string;
  originalFileName?: string;
  size: number;
  receivedAt: string;
  receivedBy: string;
  reference: string;
  source: "email" | "soc" | "upload";
}
export interface AsoFlowEvent {
  action: string;
  at: string;
  actor: string;
  version: number;
  status: AsoFlowStatus;
}
export interface AsoFlowCard {
  id: string;
  version: number;
  companyId: string;
  companyName: string;
  cnpj: string;
  employeeId: string;
  employeeName: string;
  /** Binds the source CPF without returning it in card lists. */
  employeeIdentityHash?: string;
  city: string;
  state: string;
  unit: string;
  examType: AsoFlowExamType;
  cycle: string;
  roleTitle: string;
  department: string;
  status: AsoFlowStatus;
  sourceName: string;
  sourceRow: number;
  clientEmail: string;
  clinic?: { id: string; name: string; email: string };
  appointment?: {
    date: string;
    time: string;
    reference: string;
    confirmedBy: string;
    confirmedAt: string;
  };
  attendedDate?: string;
  kit?: AsoFlowDocument & { socOrder: string; socCompanyId: string; nativeSocDeclared: true };
  kitDelivery?: {
    recipient: string;
    reference: string;
    sentAt: string;
    hash: string;
    method: "gmail" | "manual";
  };
  aso?: AsoFlowDocument & { examDate: string };
  review?: {
    hash: string;
    reviewedAt: string;
    reviewedBy: string;
    identityConfirmed: true;
    documentChecked: true;
  };
  archive?: {
    companyId: string;
    employeeId: string;
    hash: string;
    fileName: string;
    archivedAt: string;
  };
  delivery?: {
    recipient: string;
    reference: string;
    deliveredAt: string;
    hash: string;
    method: "gmail" | "manual";
  };
  cancellation?: { reason: string; at: string; by: string };
  mailLock?: {
    outboxId: string;
    documentHash: string;
    kind: "kit" | "aso";
    recipient: string;
    version: number;
    startedAt: string;
  };
  events: AsoFlowEvent[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
export interface AsoFlowPreviewRow {
  row: AsoFlowRow;
  index: number;
  state: "ready" | "exists" | "blocked";
  errors: string[];
  id?: string;
  companyId?: string;
  companyName?: string;
  employeeId?: string;
}
export interface AsoFlowPreview {
  rows: AsoFlowPreviewRow[];
  ready: number;
  existing: number;
  blocked: number;
}
export function asoFlowMapStatus(
  card: Pick<AsoFlowCard, "status" | "aso">
): "pending" | "scheduled" | "received" | "cancelled" {
  if (["cancelled", "no_show"].includes(card.status)) return "cancelled";
  if (["received", "reviewed", "delivered"].includes(card.status) && card.aso) return "received";
  if (["scheduled", "kit_sent", "waiting_aso"].includes(card.status)) return "scheduled";
  return "pending";
}
const mutation = { id: AsoFlowIdSchema, version: z.number().int().positive() };
const documentId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[^/\u0000]+$/);
export const AsoFlowMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...mutation,
      action: z.literal("schedule"),
      clinicId: documentId,
      date: AsoFlowDaySchema,
      time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      reference: text(500).min(3),
    })
    .strict(),
  z
    .object({ ...mutation, action: z.literal("waiting_aso"), attendedDate: AsoFlowDaySchema })
    .strict(),
  z
    .object({
      ...mutation,
      action: z.literal("review_aso"),
      identityConfirmed: z.literal(true),
      documentChecked: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...mutation,
      action: z.literal("record_delivery"),
      recipient: z.string().trim().email().max(254),
      reference: text(500).min(3),
      deliveredAt: z.string().datetime({ offset: true }),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...mutation,
      action: z.literal("record_kit_delivery"),
      recipient: z.string().trim().email().max(254),
      reference: text(500).min(3),
      sentAt: z.string().datetime({ offset: true }),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...mutation,
      action: z.literal("cancel"),
      outcome: z.enum(["cancelled", "no_show"]),
      reason: text(1000).min(3),
    })
    .strict(),
]);
export type AsoFlowMutation = z.infer<typeof AsoFlowMutationSchema>;
export const AsoFlowUploadSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...mutation,
      action: z.literal("record_soc_kit"),
      identityConfirmed: z.literal(true),
      socOrder: z
        .string()
        .trim()
        .regex(/^\d{1,40}$/),
      socCompanyId: z
        .string()
        .trim()
        .regex(/^\d{1,20}$/),
      reference: text(500).min(3),
    })
    .strict(),
  z
    .object({
      ...mutation,
      action: z.literal("receive_aso"),
      identityConfirmed: z.literal(true),
      examDate: AsoFlowDaySchema,
      source: z.enum(["email", "soc", "upload"]),
      reference: text(500).min(3),
    })
    .strict(),
]);
export type AsoFlowUpload = z.infer<typeof AsoFlowUploadSchema>;
