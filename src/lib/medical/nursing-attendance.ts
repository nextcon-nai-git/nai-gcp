import { z } from "zod";

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
  care_lines: z.array(z.string().min(1).max(80)).max(20),
  coren: z.string().trim().min(1, "Informe seu COREN e UF").max(40),
});
export type NursingAttendanceValues = z.infer<typeof nursingAttendanceSchema>;

export function buildNursingAttendance(
  input: NursingAttendanceValues,
  employee:
    { id: string; name?: string; companyId?: string | null; isDeleted?: boolean } | undefined,
  actor: { uid: string; displayName?: string | null; email?: string | null } | null,
  date = new Date()
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
    createdAt: date.toISOString(),
  };
}
