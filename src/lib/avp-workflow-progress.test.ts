// @vitest-environment node
import { describe, expect, it } from "vitest";
import { emptyWorkflow, type StoredWorkflow } from "./avp-workflow";
import type { PeriodicPerson } from "./avp-periodic-control";
import { projectAvpWorkflowProgress } from "./avp-workflow-progress";

const person = (changes: Partial<PeriodicPerson> = {}): PeriodicPerson => ({
  id: "periodico-2026-1",
  name: "Pessoa de Teste",
  unit: "Unidade Teste",
  city: "Marabá",
  uf: "PA",
  cityKey: "MARABA|PA",
  admission: "2025-01-01",
  status: "Não iniciado",
  progress: "pending",
  review: "OK - conferido",
  phone: "",
  email: "",
  classification: "listed",
  duplicateRows: 0,
  sourceRows: [5],
  ...changes,
});
const record = (changes: Partial<StoredWorkflow> = {}): StoredWorkflow => ({
  ...emptyWorkflow(person()),
  id: "case-1",
  version: 1,
  updatedAt: "2026-11-01T12:00:00Z",
  updatedBy: "operator",
  stage: "scheduled",
  identityChecked: true,
  socCheck: "existing-order",
  socReference: "consulta",
  socOrder: "order-1",
  clinic: "Clínica Teste",
  clinicEmail: "clinic@example.test",
  owner: "operator",
  scheduledDate: "2026-10-30",
  ...changes,
});
const received = (stage: "review" | "ready" | "delivered" = "review") =>
  record({
    stage,
    attendedDate: "2026-10-30",
    dueDate: "2026-11-02",
    evidenceId: "a".repeat(64),
    documentChecked: true,
    coordinator: "Contato Teste",
    coordinatorEmail: "client@example.test",
    deliveryReference: stage === "delivered" ? "email-id-confirmado" : "",
  });

describe("projeção compartilhada da esteira no mapa AVP", () => {
  it("atualiza agendamento confirmado sem perder o status de origem nem mutar as fontes", () => {
    const source = person();
    const workflow = record();
    const result = projectAvpWorkflowProgress([source], [workflow])[0];
    expect(result).toMatchObject({
      progress: "scheduled",
      status: "Agendado",
      sourceStatus: "Não iniciado",
      sourceProgress: "pending",
      progressSource: "workflow",
      workflowStage: "scheduled",
    });
    expect(source.status).toBe("Não iniciado");
    expect(workflow.stage).toBe("scheduled");
    expect(JSON.stringify(result)).not.toContain("clinic@example.test");
  });
  it.each(["review", "ready", "delivered"] as const)(
    "projeta azul para %s validado com ASO vinculado",
    (stage) => {
      expect(projectAvpWorkflowProgress([person()], [received(stage)])[0]).toMatchObject({
        progress: "received",
        progressSource: "workflow",
      });
    }
  );
  it("não cria sucesso com registro malformado, PDF ausente ou entrega sem comprovante", () => {
    for (const invalid of [
      record({ stage: "other" as any }),
      { ...received(), evidenceId: "" },
      { ...received("delivered"), deliveryReference: "" },
      { ...record(), version: 0 },
    ]) {
      const result = projectAvpWorkflowProgress([person()], [invalid])[0];
      expect(result.progress).toBe("unknown");
      expect(result.progressConflict).toBeTruthy();
      expect(result.sourceProgress).toBe("pending");
    }
  });
  it("usa ID, unidade e admissão exatos, sem ligar pessoas somente pelo nome", () => {
    for (const other of [
      record({ sourceId: "different" }),
      record({ unit: "Outra unidade" }),
      record({ admission: "2025-01-02" }),
    ]) {
      expect(projectAvpWorkflowProgress([person()], [other])[0]).toMatchObject({
        progress: "pending",
        progressSource: "spreadsheet",
      });
    }
    expect(
      projectAvpWorkflowProgress([person()], [record({ employee: "PESSOA DE TESTE" })])[0].progress
    ).toBe("unknown");
    expect(
      projectAvpWorkflowProgress([person()], [record({ city: "Outra cidade" })])[0].progress
    ).toBe("unknown");
  });
  it("bloqueia projeção quando o vínculo não é único em qualquer das fontes", () => {
    expect(
      projectAvpWorkflowProgress([person()], [record(), record({ id: "case-2" })])[0].progress
    ).toBe("unknown");
    expect(
      projectAvpWorkflowProgress([person(), person()], [record()]).every(
        (p) => p.progress === "unknown"
      )
    ).toBe(true);
    expect(projectAvpWorkflowProgress([person({ duplicateRows: 1 })], [record()])[0].progress).toBe(
      "unknown"
    );
  });
  it.each(["Cancelado", "Faltou", "Não compareceu"])(
    "preserva amarelo para %s apesar de caso avançado",
    (status) => {
      const result = projectAvpWorkflowProgress(
        [person({ status, progress: "cancelled", classification: "cancelled" })],
        [received("delivered")]
      )[0];
      expect(result).toMatchObject({
        status,
        sourceStatus: status,
        progress: "cancelled",
        progressSource: "spreadsheet",
      });
      expect(result.progressConflict).toContain("cancelamento ou falta");
    }
  );
  it("preserva conflitos explícitos e pendências de identidade da origem", () => {
    expect(
      projectAvpWorkflowProgress(
        [person({ progress: "unknown", status: "Cancelado / ASO recebido" })],
        [received()]
      )[0].progress
    ).toBe("unknown");
    expect(
      projectAvpWorkflowProgress([person({ classification: "review" })], [record()])[0].progress
    ).toBe("unknown");
  });
  it("sinaliza divergência sem rebaixar ASO recebido da planilha para agendamento", () => {
    const result = projectAvpWorkflowProgress(
      [person({ progress: "received", status: "ASO recebido" })],
      [record()]
    )[0];
    expect(result).toMatchObject({
      progress: "unknown",
      sourceProgress: "received",
      sourceStatus: "ASO recebido",
    });
  });
  it("um caso ainda em conferência de pedido não apaga progresso conhecido na fonte", () => {
    const pending = record({ stage: "pending" });
    expect(
      projectAvpWorkflowProgress(
        [person({ progress: "scheduled", status: "Agendado na planilha" })],
        [pending]
      )[0]
    ).toMatchObject({ progress: "scheduled", progressSource: "spreadsheet" });
  });
});
