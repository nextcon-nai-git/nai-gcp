import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
export const WORKFLOW_STAGES = {
  pending: "Conferir pedido SOC",
  kit: "Kit pronto",
  scheduled: "Agendado",
  waiting: "Aguardando ASO",
  review: "Em conferência",
  ready: "Pronto para envio",
  delivered: "Entregue",
} as const;
export const WorkflowSchema = z
  .object({
    sourceId: text(150).min(1),
    employee: text(240).min(2),
    unit: text(240).min(2),
    admission: text(30).min(1),
    city: text(160).min(1),
    stage: z.enum(["pending", "kit", "scheduled", "waiting", "review", "ready", "delivered"]),
    socCheck: z.enum(["unchecked", "no-order", "existing-order"]),
    socReference: text(500),
    socOrder: text(80),
    identityChecked: z.boolean(),
    clinic: text(240),
    clinicEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
    owner: text(160),
    scheduledDate: z.union([z.literal(""), day]),
    attendedDate: z.union([z.literal(""), day]),
    dueDate: z.union([z.literal(""), day]),
    coordinator: text(160),
    coordinatorEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
    evidenceId: z.union([z.literal(""), z.string().regex(/^[a-f0-9]{64}$/)]),
    documentChecked: z.boolean(),
    deliveryReference: text(500),
    notes: text(2000),
  })
  .strict();
export type AvpWorkflow = z.infer<typeof WorkflowSchema>;
export type StoredWorkflow = AvpWorkflow & {
  id: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
};
export function emptyWorkflow(source: {
  id: string;
  name: string;
  unit: string;
  admission: string;
  city: string;
}): AvpWorkflow {
  return {
    sourceId: source.id,
    employee: source.name,
    unit: source.unit,
    admission: source.admission,
    city: source.city,
    stage: "pending",
    socCheck: "unchecked",
    socReference: "",
    socOrder: "",
    identityChecked: false,
    clinic: "",
    clinicEmail: "",
    owner: "",
    scheduledDate: "",
    attendedDate: "",
    dueDate: "",
    coordinator: "",
    coordinatorEmail: "",
    evidenceId: "",
    documentChecked: false,
    deliveryReference: "",
    notes: "",
  };
}
export function workflowProblems(v: AvpWorkflow): string[] {
  if (v.stage === "pending") return [];
  const errors: string[] = [];
  if (!v.identityChecked) errors.push("Confira CPF e vínculo no SOC.");
  if (v.socCheck === "unchecked" || !v.socReference)
    errors.push("Registre a consulta de pedidos SOC e a evidência da conferência.");
  if (!v.socOrder) errors.push("Informe o pedido existente ou o pedido criado após a conferência.");
  if (!v.clinic || !v.clinicEmail) errors.push("Confirme clínica e e-mail de atendimento.");
  if (!v.owner) errors.push("Defina o responsável pelo acompanhamento.");
  if (
    ["scheduled", "waiting", "review", "ready", "delivered"].includes(v.stage) &&
    !v.scheduledDate
  )
    errors.push("Informe a data confirmada do agendamento.");
  if (
    ["waiting", "review", "ready", "delivered"].includes(v.stage) &&
    (!v.attendedDate || !v.dueDate)
  )
    errors.push("Confirme o comparecimento e o prazo de devolução do ASO.");
  if (v.attendedDate && v.dueDate && v.dueDate < v.attendedDate)
    errors.push("O prazo de devolução não pode anteceder o atendimento.");
  if (["review", "ready", "delivered"].includes(v.stage) && !v.evidenceId)
    errors.push("Vincule o PDF do ASO recebido.");
  if (["ready", "delivered"].includes(v.stage)) {
    if (!v.documentChecked)
      errors.push(
        "Confira identificação, empresa, data, assinatura, legibilidade e versão do ASO."
      );
    if (!v.coordinator || !v.coordinatorEmail)
      errors.push("Confirme o coordenador responsável pela unidade e seu e-mail.");
  }
  if (v.stage === "delivered" && !v.deliveryReference)
    errors.push("Registre a evidência do envio efetivamente realizado.");
  return errors;
}
export function workflowNextAction(v: AvpWorkflow, today: string) {
  if (v.stage === "waiting" && v.dueDate && v.dueDate < today) return "Cobrar ASO atrasado";
  return {
    pending: "Conferir CPF, vínculo e pedidos antes de gerar kit",
    kit: "Confirmar agenda com a clínica",
    scheduled: "Confirmar comparecimento",
    waiting: "Acompanhar prazo de devolução",
    review: "Conferir ASO recebido",
    ready: "Revisar e autorizar envio ao coordenador",
    delivered: "Acompanhar confirmação de recebimento",
  }[v.stage];
}
/** Drafts never send messages or include clinical forms, diagnoses or signed links. */
export function workflowDraft(v: AvpWorkflow, kind: "clinic" | "coordinator") {
  if (kind === "coordinator" && !["ready", "delivered"].includes(v.stage))
    throw new Error("Conclua a conferência antes de preparar a entrega.");
  const problems = workflowProblems(v);
  if (problems.length || v.stage === "pending")
    throw new Error(problems[0] || "Conclua a conferência do pedido.");
  const to = kind === "clinic" ? v.clinicEmail : v.coordinatorEmail;
  const subject =
    kind === "clinic"
      ? `Acompanhamento de ASO — ${v.employee} — ${v.unit}`
      : `ASO — ${v.employee} — ${v.unit}`;
  const body =
    kind === "clinic"
      ? `Prezados,\n\nSolicitamos atualização sobre a devolução do ASO de ${v.employee}, ${v.unit}, atendimento em ${v.attendedDate || v.scheduledDate || "data a confirmar"}, pedido SOC ${v.socOrder}. Prazo de devolução: ${v.dueDate || "a confirmar"}.\n\nFavor confirmar o andamento.\n\nNextcon Saúde`
      : `Prezado(a) ${v.coordinator},\n\nSegue o ASO conferido de ${v.employee}, da unidade ${v.unit}, referente ao atendimento de ${v.attendedDate}. Favor confirmar o recebimento.\n\nNextcon Saúde`;
  return { to, subject, body, requiresApproval: true as const };
}
