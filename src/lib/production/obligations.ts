import { z } from "zod";
import { isCalendarDate } from "@/lib/financial/omie-dre";

export const MAX_OBLIGATIONS = 100;
const optionalDate = z.string().refine((v) => v === "" || isCalendarDate(v), "Data inválida.");
export const serviceTypes = [
  "PGR",
  "PCMSO",
  "ASO",
  "LTCAT",
  "AET",
  "AEP",
  "PERICIA",
  "OUTRO",
] as const;
export const ObligationSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    title: z.string().trim().min(3).max(180),
    serviceType: z.enum(serviceTypes),
    owner: z.string().trim().max(180),
    due: optionalDate,
    trigger: z.string().trim().max(500).default(""),
    deadlineRule: z.string().trim().max(500),
    sourceReference: z.string().trim().min(3).max(300),
    sourceExcerpt: z.string().trim().min(3).max(600),
  })
  .strict();
export type Obligation = z.infer<typeof ObligationSchema>;
export const ObligationsSchema = z
  .array(ObligationSchema)
  .max(MAX_OBLIGATIONS)
  .default([])
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Cada obrigação deve ter um identificador único."
  );
export const TaskUpdateSchema = z
  .object({
    owner: z.string().trim().max(180),
    due: optionalDate,
    status: z.enum(["todo", "doing", "blocked", "done", "na"]),
    checks: z.array(z.boolean()).length(4),
    evidence: z.string().trim().max(2000),
    blocker: z.string().trim().max(1000),
  })
  .strict();
export const TaskSchema = TaskUpdateSchema.extend({
  obligation: ObligationSchema,
  updatedAt: z.string(),
});
export type ProductionTask = z.infer<typeof TaskSchema>;
export function makeTasks(obligations: Obligation[], initial = true): ProductionTask[] {
  return obligations.map((obligation) => ({
    obligation: structuredClone(obligation),
    owner: obligation.owner,
    due: initial ? obligation.due : "",
    status: "todo",
    checks: [false, false, false, false],
    evidence: "",
    blocker: "",
    updatedAt: "",
  }));
}
export const taskSteps = [
  "Conferir cláusula, unidade, dados necessários e prazo desta obrigação.",
  "Executar o serviço e registrar documentos, exames ou demais entregáveis.",
  "Obter revisão e assinatura do profissional habilitado, quando aplicável.",
  "Vincular a evidência ao kit de entrega do ciclo e conferir as pendências.",
] as const;

export const taskComplete = (task: Pick<ProductionTask, "status">) =>
  task.status === "done" || task.status === "na";
