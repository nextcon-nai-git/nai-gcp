import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  list: vi.fn(),
  create: vi.fn(),
  advance: vi.fn(),
  triage: vi.fn(),
  copy: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: "all" }) }));
vi.mock("@/actions/aso-scheduler-actions", () => ({
  getAsoRequestsAction: m.list,
  createAsoRequestAction: m.create,
  advancePipelineStepAction: m.advance,
  runAsoOrchestratorAnalysisAction: m.triage,
}));
import Page from "./scheduling-workspace";
let v: ReturnType<typeof ui>;
const kit = {
  guiaNumber: "MINUTA-synthetic",
  companyDetails: { name: "Empresa Teste", cnpj: "synthetic" },
  employeeDetails: {
    name: "Pessoa sintética",
    cpf: "synthetic",
    roleTitle: "Função",
    department: "Setor",
  },
  examType: "admissional",
  appointmentDateTime: "A confirmar",
  clinicDetails: { name: "A confirmar", address: "" },
  examList: [
    {
      code: "x",
      name: "Exame para revisão",
      mandatory: "CONDICIONAL",
      patientPreparo: "Conferir",
      pcmsoJustification: "Revisar",
    },
  ],
  patientInstructions: ["Conferir orientação"],
  clinicInstructions: ["Conferir pedido"],
  returnDeadlineDays: 2,
  asoTemplate: { declaredRisks: [], fitnessChecklist: "", doctorNotes: "" },
};
const request = {
  id: "synthetic",
  employeeName: "Pessoa sintética",
  companyName: "Empresa Teste",
  roleTitle: "Função",
  examType: "admissional",
  status: "solicitado",
  exams: [],
  alerts: [
    {
      id: "alert",
      status: "PENDING",
      agentType: "SUPERVISOR",
      severity: "WARNING",
      requestId: "synthetic",
      message: "Conferir dados",
      suggestedAction: "Revisão humana",
    },
  ],
  digitalKit: kit,
};
const analysis = {
  triagem: { observacoes_triagem: "Revisar triagem" },
  protocolos: { exames_obrigatorios: [{ code: "test", name: "Exame para revisão" }] },
  agendamento_matching: {
    clinica_recomendada_nome: "A confirmar",
    score_compatibilidade: 0,
    motivo_escolha: "Revisar",
  },
  supervisor: { requer_intervencao_humana: true, mensagem_alerta: "Revisar análise" },
};
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("a-token") };
  m.list.mockReset().mockResolvedValue({ success: true, data: [request] });
  m.create.mockReset().mockResolvedValue({ success: true, data: { ...request, id: "created" } });
  m.advance
    .mockReset()
    .mockResolvedValue({ success: true, data: { ...request, status: "validando" } });
  m.triage.mockReset().mockResolvedValue({ success: true, data: analysis });
  m.copy.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: m.copy },
  });
});
afterEach(async () => {
  await v.cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("scheduling persistence and session boundaries", () => {
  it("requires a session", async () => {
    m.user = null;
    await v.render(<Page />);
    expect(m.list).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("Entre no NAI");
  });
  it("loads requests and starts an empty, non-fabricated form", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Pessoa sintética");
    await v.click("Nova Solicitação de ASO");
    expect(
      [...v.container.querySelectorAll("input,textarea")]
        .map((e) => (e as HTMLInputElement).value)
        .every((x) => x === "")
    ).toBe(true);
  });
  it("creates with reviewed input, splits risks and waits for save", async () => {
    await v.render(<Page />);
    await v.click("Nova Solicitação de ASO");
    const inputs = [...v.container.querySelectorAll("input")];
    const values = [
      "Empresa Teste",
      "synthetic-cnpj",
      "Pessoa nova",
      "synthetic-cpf",
      "Função",
      "Setor",
      "Ruído, , Calor",
    ];
    for (let i = 0; i < values.length; i++) {
      const input = inputs[i];
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          input,
          values[i]
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    const p = deferred<unknown>();
    m.create.mockReturnValueOnce(p.promise);
    await v.submit();
    await v.submit();
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.create.mock.calls[0][0]).toMatchObject({
      employeeName: "Pessoa nova",
      declaredRisks: ["Ruído", "Calor"],
    });
    expect(v.container.textContent).not.toContain("registrada.");
    await act(async () => p.resolve({ success: true, data: { ...request, id: "created" } }));
    expect(v.container.textContent).toContain("created registrada");
  });
  it.each(["reject", "response"])(
    "recovers create failure (%s) without losing input",
    async (mode) => {
      await v.render(<Page />);
      await v.click("Nova Solicitação de ASO");
      await v.input("input", "Empresa digitada");
      if (mode === "reject") m.create.mockRejectedValueOnce(new Error("Falha sintética"));
      else m.create.mockResolvedValueOnce({ success: false, error: "Falha sintética" });
      await v.submit();
      expect(v.container.textContent).toContain("Falha sintética");
      expect(v.button("Criar & Processar").disabled).toBe(false);
      expect(v.container.querySelector("input")?.value).toBe("Empresa digitada");
    }
  );
  it("shows triage only after successful analysis and recovers failure", async () => {
    await v.render(<Page />);
    await v.click("Nova Solicitação de ASO");
    m.triage.mockRejectedValueOnce(new Error("Falha na análise"));
    await v.click("Simular Triagem");
    expect(v.container.textContent).toContain("Falha na análise");
    expect(v.button("Simular Triagem").disabled).toBe(false);
    await v.click("Simular Triagem");
    expect(v.container.textContent).toContain("Revisar triagem");
  });
  it("blocks duplicate advances and retains request after failure", async () => {
    await v.render(<Page />);
    const p = deferred<unknown>();
    m.advance.mockReturnValue(p.promise);
    await v.click("Avançar");
    await v.click("Avançar");
    expect(m.advance).toHaveBeenCalledTimes(1);
    expect(m.advance).toHaveBeenCalledWith("synthetic", "validando", "a-token");
    await act(async () => p.resolve({ success: false, error: "Etapa não salva" }));
    expect(v.container.textContent).toContain("Etapa não salva");
    expect(v.button("Avançar").disabled).toBe(false);
  });
  it("applies persisted advance and disables completed requests", async () => {
    await v.render(<Page />);
    m.advance.mockResolvedValue({ success: true, data: { ...request, status: "aso_concluido" } });
    await v.click("Avançar");
    expect(v.button("Avançar").disabled).toBe(true);
  });
  it("does not pretend alerts were resolved", async () => {
    await v.render(<Page />);
    await v.click("Alertas & Exceções");
    expect(v.container.textContent).toContain("Conferir dados");
    expect(v.button("Resolução pendente").disabled).toBe(true);
  });
  it("copies a kit only on clipboard confirmation and reports errors", async () => {
    await v.render(<Page />);
    await v.click("Kit Digital");
    m.copy.mockRejectedValueOnce(new Error("clipboard unavailable"));
    await v.click("Copiar Kit");
    expect(v.container.textContent).toContain("Não foi possível copiar");
    expect(v.container.textContent).not.toContain("Kit Copiado!");
    await v.click("Copiar Kit");
    expect(v.container.textContent).toContain("Kit Copiado!");
    expect(v.container.textContent).not.toContain("Não foi possível copiar");
    expect(m.copy.mock.lastCall![0]).toContain("Exame para revisão");
  });
  it("hides old requests and ignores stale create completion on logout", async () => {
    await v.render(<Page />);
    await v.click("Nova Solicitação de ASO");
    const p = deferred<unknown>();
    m.create.mockReturnValueOnce(p.promise);
    await v.submit();
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve({ success: true, data: request }));
    expect(v.container.textContent).not.toContain("Pessoa sintética");
    expect(v.container.textContent).not.toContain("registrada");
  });
  it("never starts a request whose token completes after leaving", async () => {
    const p = deferred<string>();
    m.user!.getIdToken.mockReturnValueOnce(p.promise);
    await v.render(<Page />);
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("stale"));
    expect(m.list).not.toHaveBeenCalled();
  });
  it("retries failed polling without overlap", async () => {
    vi.useFakeTimers();
    m.list.mockRejectedValueOnce(new Error("temporary"));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Não foi possível atualizar");
    await act(async () => vi.advanceTimersByTime(15000));
    expect(v.container.textContent).toContain("Pessoa sintética");
    expect(v.container.textContent).not.toContain("Não foi possível atualizar");
  });
});
