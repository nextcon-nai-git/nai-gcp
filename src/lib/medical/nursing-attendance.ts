import { z } from "zod";

export const NURSING_CARE_LINES = [
  "ginastica_laboral",
  "alongamento",
  "pausa_ativa",
  "ajuste_posto",
  "escuta_ativa",
  "higiene_sono",
  "manejo_estresse",
  "repouso_acustico",
  "uso_epi",
  "lavagem_nasal",
] as const;

/** Use receipt time assigned by Firestore, never the client device clock. */
export function nursingAttendanceDate(record: { timestamp?: unknown }): Date | null {
  const value = record.timestamp;
  if (
    !value ||
    typeof value !== "object" ||
    !("toDate" in value) ||
    typeof value.toDate !== "function"
  )
    return null;
  try {
    const date: unknown = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

export const nursingAttendanceSchema = z.object({
  companyId: z
    .string()
    .trim()
    .min(1, "Selecione a unidade")
    .max(128)
    .refine(
      (value) => !/[\/\\\u0000-\u001f]/.test(value) && !["all", "unauthorized"].includes(value)
    ),
  employeeId: z
    .string()
    .trim()
    .min(1, "Selecione um colaborador")
    .max(128)
    .refine((value) => !/[\/\\\u0000-\u001f]/.test(value)),
  complaint: z.string().trim().min(3, "Descreva a queixa").max(10000),
  conduct: z.enum(["observation", "work", "emergency"]),
  care_lines: z.array(z.enum(NURSING_CARE_LINES)).max(20),
  coren: z.string().trim().min(1, "Informe seu COREN e UF").max(40),
});
export type NursingAttendanceValues = z.infer<typeof nursingAttendanceSchema>;

export function buildNursingAttendance(
  input: NursingAttendanceValues,
  employee:
    { id: string; name?: string; companyId?: string | null; isDeleted?: boolean } | undefined,
  actor: { uid: string; displayName?: string | null; email?: string | null } | null
) {
  const values = nursingAttendanceSchema.parse(input);
  if (!actor?.uid || !(actor.displayName?.trim() || actor.email?.trim()))
    throw new Error("Identifique o profissional na sua conta antes de salvar.");
  if (
    !employee ||
    employee.id !== values.employeeId ||
    !employee.name?.trim() ||
    employee.isDeleted ||
    (employee.companyId && employee.companyId !== values.companyId)
  )
    throw new Error("Selecione um colaborador válido da unidade atual.");
  return {
    ...values,
    employeeName: employee.name,
    nurseName: actor.displayName?.trim() || actor.email!.trim(),
    createdBy: actor.uid,
    status_esocial: "Não transmitido",
  };
}
