import { describe, expect, it } from "vitest";
import {
  asoFlowMapStatus,
  asoFlowRowProblems,
  asoFlowEmploymentAllowed,
  AsoFlowMutationSchema,
  type AsoFlowRow,
} from "./aso-flow";
const row: AsoFlowRow = {
  companyCnpj: "11222333000181",
  employeeCpf: "52998224725",
  employeeName: "Teste",
  city: "Curitiba",
  state: "PR",
  unit: "Sede",
  examType: "periodico",
  cycle: "2026-11",
};
describe("regras da esteira ASO", () => {
  it.each([
    ["leave", "retorno_trabalho", true],
    ["fired", "demissional", true],
    ["fired", "periodico", false],
    ["leave", "periodico", false],
    ["leave", "admissional", false],
    ["active", "periodico", true],
    ["unknown", "retorno_trabalho", false],
  ])("situação %s para %s aceita vínculo operacional: %s", (status, examType, expected) => {
    expect(asoFlowEmploymentAllowed(status, examType)).toBe(expected);
  });
  it("expõe pendências de identificação sem transformar nome em vínculo", () => {
    expect(asoFlowRowProblems(row)).toEqual([]);
    expect(
      asoFlowRowProblems({
        ...row,
        employeeCpf: "",
        companyCnpj: "",
        state: "XX",
        cycle: "novembro",
      })
    ).toHaveLength(4);
  });
  it("só projeta azul quando há PDF recebido e separa cancelamento", () => {
    expect(asoFlowMapStatus({ status: "received" })).toBe("pending");
    expect(asoFlowMapStatus({ status: "scheduled" })).toBe("scheduled");
    expect(asoFlowMapStatus({ status: "no_show" })).toBe("cancelled");
    expect(
      asoFlowMapStatus({
        status: "delivered",
        aso: {
          hash: "a".repeat(64),
          fileName: "aso.pdf",
          size: 100,
          receivedAt: "x",
          receivedBy: "user",
          source: "email",
          reference: "message",
          examDate: "2026-10-20",
        },
      })
    ).toBe("received");
  });
  it("não aceita alteração genérica do status, datas inválidas ou confirmação implícita", () => {
    expect(
      AsoFlowMutationSchema.safeParse({
        action: "advance",
        id: "a".repeat(64),
        version: 1,
        status: "delivered",
      }).success
    ).toBe(false);
    expect(
      AsoFlowMutationSchema.safeParse({
        action: "schedule",
        id: "a".repeat(64),
        version: 1,
        clinicId: "clinic",
        date: "2026-02-31",
        time: "08:00",
        reference: "confirmada",
      }).success
    ).toBe(false);
    expect(
      AsoFlowMutationSchema.safeParse({
        action: "review_aso",
        id: "a".repeat(64),
        version: 1,
        identityConfirmed: true,
        documentChecked: false,
      }).success
    ).toBe(false);
  });
});
