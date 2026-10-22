// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  periodicPatchSchema,
  validatePeriodicTransition,
  type PeriodicPatch,
  type PeriodicWorkState,
} from "./avp-periodic-workflow";
import type { PeriodicPerson } from "./avp-periodic-control";
const person: PeriodicPerson = {
  id: "periodico-2026-1",
  name: "Teste",
  unit: "Empresa",
  city: "Curitiba",
  uf: "PR",
  cityKey: "CURITIBA|PR",
  status: "Não iniciado",
  review: "Conferir",
  phone: "",
  email: "",
  admission: "01/01/2020",
  classification: "review",
  duplicateRows: 0,
  sourceRows: [2],
};
const patch: PeriodicPatch = {
  id: person.id,
  sourceVersion: "a".repeat(64),
  revision: 0,
  stage: "agendar",
  responsible: "Operador teste",
  nextDate: "2026-10-25",
  evidence: "Fonte de teste conferida em 22/10/2026",
};
describe("fluxo dos periódicos", () => {
  it("exige responsável, referência e revisão de fonte válida", () => {
    expect(periodicPatchSchema.safeParse({ ...patch, evidence: "" }).success).toBe(false);
    expect(periodicPatchSchema.safeParse({ ...patch, responsible: "" }).success).toBe(false);
    expect(periodicPatchSchema.safeParse({ ...patch, sourceVersion: "" }).success).toBe(false);
  });
  it("permite confirmar uma revisão registrada, mas impede pular para conclusão", () => {
    expect(() => validatePeriodicTransition(person, null, patch)).not.toThrow();
    expect(() =>
      validatePeriodicTransition(person, null, { ...patch, stage: "concluido" })
    ).toThrow("uma etapa");
  });
  it.each([
    { ...person, classification: "cancelled" as const },
    { ...person, duplicateRows: 1 },
    { ...person, unit: "" },
  ])("bloqueia convocação mas permite atribuir a revisão de fontes pendentes", (p) => {
    expect(() => validatePeriodicTransition(p, null, patch)).toThrow();
    expect(() => validatePeriodicTransition(p, null, { ...patch, stage: "validar" })).not.toThrow();
  });
  it("rejeita datas inexistentes sem normalizar para o mês seguinte", () => {
    expect(() =>
      validatePeriodicTransition(person, null, { ...patch, nextDate: "2026-02-30" })
    ).toThrow("inválida");
  });
  it("permite retornar à validação e exige sequência para confirmar realização", () => {
    const state: PeriodicWorkState = {
      ...patch,
      stage: "confirmar_realizacao",
      updatedAt: "2026-10-22",
      updatedBy: "test",
    };
    expect(() =>
      validatePeriodicTransition(person, state, { ...patch, stage: "resgatar_aso" })
    ).not.toThrow();
    expect(() =>
      validatePeriodicTransition(person, state, { ...patch, stage: "conferir_esocial" })
    ).toThrow();
    expect(() =>
      validatePeriodicTransition(person, state, { ...patch, stage: "validar" })
    ).not.toThrow();
  });
});
