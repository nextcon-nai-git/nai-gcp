import { z } from "zod";

/**
 * Schemas de validação rigorosa para dados SST (eSocial Ready)
 */

export const JobRoleSchema = z.object({
  id: z.string(),
  title: z.string(),
  cbo: z.string().optional(),
});

export const EmployeeSchema = z.object({
  id: z.string().min(1, "Matrícula é obrigatória"),
  name: z.string().min(3, "Nome muito curto"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  companyId: z.string().min(1, "Vínculo com empresa é obrigatório"),
  job_role: JobRoleSchema,
  status: z.enum(["active", "leave", "fired"]),
  createdAt: z.string().optional(),
});

export const CompanySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(3),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido"),
  segment: z.enum(["CONSTRUCTION", "HOSPITAL", "INDUSTRY", "GENERAL"]),
  city: z.string(),
  state: z.string().length(2),
  risk_degree: z.number().min(1).max(4).optional(),
  cnae: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

export const RiskSchema = z.object({
  id: z.string(),
  category: z.enum(["fisico", "quimico", "biologico", "ergonomico", "acidente"]),
  hazard: z.string().min(1),
  intensity: z.string().optional(),
  controlMeasures: z.array(z.string()),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["pgr", "pcmso", "ltcat", "treinamento", "esocial", "iot_check"]),
  status: z.enum(["todo", "doing", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  companyId: z.string(),
  companyName: z.string(),
  ai_risk_score: z.number().optional(),
  dueDate: z.string(),
});

export type EmployeeInput = z.infer<typeof EmployeeSchema>;
export type CompanyInput = z.infer<typeof CompanySchema>;
export type RiskInput = z.infer<typeof RiskSchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
