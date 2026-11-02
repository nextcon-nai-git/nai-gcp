import { describe, expect, it } from "vitest";
import {
  emptyWorkflow,
  WorkflowSchema,
  workflowProblems,
  workflowNextAction,
  workflowDraft,
} from "./avp-workflow";
const base = () =>
  emptyWorkflow({
    id: "campaign-1",
    name: "Pessoa Teste",
    unit: "ASSOBES MARABÁ",
    admission: "2025-01-01",
    city: "Marabá",
  });
const kit = () => ({
  ...base(),
  stage: "kit" as const,
  identityChecked: true,
  socCheck: "existing-order" as const,
  socReference: "Consulta por CPF e vínculo em 23/10/2026",
  socOrder: "123",
  clinic: "Clínica teste",
  clinicEmail: "clinica@example.com",
  owner: "Operação",
});
const ready = () => ({
  ...kit(),
  stage: "ready" as const,
  scheduledDate: "2026-10-23",
  attendedDate: "2026-10-23",
  dueDate: "2026-10-24",
  evidenceId: "a".repeat(64),
  documentChecked: true,
  coordinator: "Coordenação",
  coordinatorEmail: "coordenador@example.com",
});
describe("esteira AVP", () => {
  it("não libera kit sem consulta e identidade verificadas", () => {
    expect(workflowProblems({ ...base(), stage: "kit" })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("CPF"),
        expect.stringContaining("consulta"),
        expect.stringContaining("pedido existente"),
      ])
    );
  });
  it("reutiliza pedido existente sem inferir realização", () => {
    expect(workflowProblems(kit())).toEqual([]);
    expect(workflowProblems({ ...kit(), stage: "waiting" })).toEqual(
      expect.arrayContaining([expect.stringContaining("comparecimento")])
    );
  });
  it("cobra somente após prazo explícito vencido", () => {
    const v = { ...ready(), stage: "waiting" as const };
    expect(workflowNextAction(v, "2026-10-24")).toBe("Acompanhar prazo de devolução");
    expect(workflowNextAction(v, "2026-10-25")).toBe("Cobrar ASO atrasado");
    expect(workflowNextAction({ ...v, dueDate: "" }, "2026-10-25")).not.toContain("atrasado");
  });
  it("impede entrega sem PDF, conferência e coordenador", () => {
    expect(
      workflowProblems({ ...ready(), evidenceId: "", documentChecked: false, coordinatorEmail: "" })
    ).toHaveLength(3);
    expect(() => workflowDraft(kit(), "coordinator")).toThrow();
  });
  it("não marca entregue sem comprovante de envio", () => {
    expect(workflowProblems({ ...ready(), stage: "delivered" })).toEqual([
      expect.stringContaining("evidência do envio"),
    ]);
    expect(
      workflowProblems({ ...ready(), stage: "delivered", deliveryReference: "message-id: 123" })
    ).toEqual([]);
  });
  it("gera apenas rascunho sem ficha clínica ou dados clínicos", () => {
    const draft = workflowDraft(ready(), "coordinator");
    expect(draft.to).toBe("coordenador@example.com");
    expect(draft.requiresApproval).toBe(true);
    expect(draft.body).not.toMatch(/anamnese|diagnóstico|CPF|ficha clínica/i);
  });
  it("rejeita datas impossíveis, e-mail inválido e campos inesperados", () => {
    expect(WorkflowSchema.safeParse({ ...base(), attendedDate: "2026-02-30" }).success).toBe(false);
    expect(WorkflowSchema.safeParse({ ...base(), clinicEmail: "errado" }).success).toBe(false);
    expect(WorkflowSchema.safeParse({ ...base(), autoSend: true }).success).toBe(false);
    expect(workflowProblems({ ...ready(), dueDate: "2026-10-22" })).toContain(
      "O prazo de devolução não pode anteceder o atendimento."
    );
  });
});
