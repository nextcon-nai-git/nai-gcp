import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase/firestore";
import { advanceClinicalAppointment, createClinicalAppointment } from "./clinical-scheduling";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  set: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: (base: { path?: string }, ...segments: string[]) => ({
    path: [base.path, ...segments, ...(segments.length ? [] : ["new-appointment"])]
      .filter(Boolean)
      .join("/"),
    id: segments.at(-1) || "new-appointment",
  }),
  collection: (base: { path?: string }, ...segments: string[]) => ({
    path: [base.path, ...segments].filter(Boolean).join("/"),
  }),
  runTransaction: (_db: unknown, fn: (tx: unknown) => unknown) => state.transaction(fn),
  serverTimestamp: () => "SERVER_TIMESTAMP",
}));
const db = {} as Firestore;
const input = {
  companyId: "company-a",
  employeeId: "employee-a",
  date: "2026-10-19",
  time: "08:30",
  type: "Periódico",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.records.clear();
  state.records.set("companies/company-a", { name: "Empresa sintética" });
  state.records.set("companies/company-a/employees/employee-a", {
    name: "Pessoa sintética",
    companyId: "company-a",
  });
  state.records.set("companies/company-a/agendamentos/appointment-a", {
    companyId: "company-a",
    status: "Agendado",
  });
  state.transaction.mockImplementation(async (fn) =>
    fn({
      get: async (ref: { path: string }) => ({
        exists: () => state.records.has(ref.path),
        data: () => state.records.get(ref.path),
      }),
      set: state.set,
      update: state.update,
    })
  );
});

describe("agendamento com vínculo persistido", () => {
  it("confere empresa e colaborador antes de gravar o agendamento", async () => {
    await expect(createClinicalAppointment(db, input)).resolves.toMatchObject({
      employeeName: "Pessoa sintética",
    });
    expect(state.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: "companies/company-a/agendamentos/new-appointment" }),
      expect.objectContaining({
        colaborador_id: "employee-a",
        companyId: "company-a",
        colaborador_nome: "Pessoa sintética",
        status: "Agendado",
        data_hora: "2026-10-19T08:30:00",
      })
    );
  });
  it("não usa colaborador residual ao trocar de empresa", async () => {
    state.records.set("companies/company-b", { name: "Outra empresa" });
    await expect(
      createClinicalAppointment(db, { ...input, companyId: "company-b" })
    ).rejects.toThrow("não encontrado");
    expect(state.set).not.toHaveBeenCalled();
  });
  it("não agenda cadastro com companyId divergente", async () => {
    state.records.set("companies/company-a/employees/employee-a", {
      name: "Pessoa sintética",
      companyId: "company-b",
    });
    await expect(createClinicalAppointment(db, input)).rejects.toThrow("não encontrado");
    expect(state.set).not.toHaveBeenCalled();
  });
  it.each([
    { date: "2026-02-30" },
    { date: "" },
    { time: "25:00" },
    { time: "" },
    { companyId: "all" },
    { employeeId: "../employee-b" },
  ])("rejeita seleção ou horário inválido: %j", async (override) => {
    await expect(createClinicalAppointment(db, { ...input, ...override })).rejects.toThrow();
    expect(state.transaction).not.toHaveBeenCalled();
    expect(state.set).not.toHaveBeenCalled();
  });
  it("propaga falha de confirmação do banco", async () => {
    state.transaction.mockRejectedValueOnce(new Error("permission-denied"));
    await expect(createClinicalAppointment(db, input)).rejects.toThrow("permission-denied");
  });
});
describe("transição de atendimento sem sucesso prematuro", () => {
  it("confirma check-in no agendamento persistido", async () => {
    await advanceClinicalAppointment(db, "company-a", "appointment-a", "Em Espera");
    expect(state.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "Em Espera", check_in_realizado: true })
    );
  });
  it.each(["Concluído", "Em Atendimento", "Cancelado"])(
    "não reverte o status %s com check-in antigo",
    async (status) => {
      state.records.set("companies/company-a/agendamentos/appointment-a", {
        companyId: "company-a",
        status,
      });
      await expect(
        advanceClinicalAppointment(db, "company-a", "appointment-a", "Em Espera")
      ).rejects.toThrow("status");
      expect(state.update).not.toHaveBeenCalled();
    }
  );
  it("não altera agendamento de outra empresa", async () => {
    await expect(
      advanceClinicalAppointment(db, "company-b", "appointment-a", "Em Espera")
    ).rejects.toThrow("não encontrado");
    expect(state.update).not.toHaveBeenCalled();
  });
  it("aguarda a confirmação e propaga falha de gravação", async () => {
    state.transaction.mockRejectedValueOnce(new Error("offline"));
    await expect(
      advanceClinicalAppointment(db, "company-a", "appointment-a", "Em Espera")
    ).rejects.toThrow("offline");
  });
});
