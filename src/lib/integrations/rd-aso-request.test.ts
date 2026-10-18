import { describe, it, expect } from "vitest";
import { canManageRdAso, completedRdAsoText, rdAsoRequestFromText } from "./rd-aso-request";
const fields = {
  companyName: "Empresa sintética",
  cnpj: "11.222.333/0001-81",
  employeeName: "Pessoa sintética",
  cpf: "529.982.247-25",
  roleTitle: "Função teste",
  department: "Setor teste",
  examType: "admissional",
  requestedCity: "Vitória/ES",
};
const parse = (text: string) =>
  rdAsoRequestFromText(text, "key", "message", "2026-10-18T12:00:00Z");
describe("RD completed ASO contract", () => {
  it.each(["SUPER_ADMIN", "ADMIN", "OPERATIONS"])("allows management role %s", (role) =>
    expect(canManageRdAso(role)).toBe(true)
  );
  it.each(["DOCTOR", "PROVIDER", "CLIENT", "admin", ""])(
    "does not infer permissions for %s",
    (role) => expect(canManageRdAso(role)).toBe(false)
  );
  it("creates a request with provenance but no inferred examinations or clinical validation", () => {
    const text = completedRdAsoText(fields)!;
    expect(parse(text)).toMatchObject({
      id: "rd-key",
      source: "rd-conversas",
      sourceMessageId: "message",
      companyName: fields.companyName,
      cpf: "52998224725",
      cnpj: "11222333000181",
      status: "solicitado",
      validationPassed: false,
      declaredRisks: [],
      exams: [],
      createdAt: "2026-10-18T12:00:00Z",
    });
  });
  it.each([
    ["Periódico", "periodico"],
    ["Retorno ao trabalho", "retorno_trabalho"],
    ["retorno_trabalho", "retorno_trabalho"],
    ["Mudança de função", "mudanca_funcao"],
    ["mudanca_funcao", "mudanca_funcao"],
    ["demissional", "demissional"],
  ])("normalizes the explicit exam type %s", (examType, expected) =>
    expect(parse(completedRdAsoText({ ...fields, examType })!)?.examType).toBe(expected)
  );
  it.each([
    null,
    [],
    42,
    {},
    { ...fields, cpf: 123 },
    { ...fields, employeeName: "Pessoa\nCPF: 111" },
    { ...fields, companyName: "x".repeat(201) },
    { ...fields, examType: "constructor" },
    { ...fields, examType: "unknown" },
    { ...fields, cpf: "11111111111" },
    { ...fields, cpf: "52998224724" },
    { ...fields, cnpj: "11222333000180" },
    { ...fields, department: "x" },
  ])("rejects incomplete or ambiguous collector payloads %#", (value) =>
    expect(completedRdAsoText(value)).toBeNull()
  );
  it("rejects duplicate labels even when case and accents differ", () => {
    const text = completedRdAsoText(fields)!;
    expect(parse(text + "\nEMPRESA: Outra empresa")).toBeNull();
  });
  it("requires the request header instead of mining ordinary messages", () =>
    expect(
      parse(completedRdAsoText(fields)!.replace("SOLICITAÇÃO DE ASO", "Conversa comum"))
    ).toBeNull());
  it("tolerates CRLF and whitespace without changing the supplied values", () => {
    expect(
      parse(" \r\n" + completedRdAsoText(fields)!.replaceAll("\n", "\r\n") + "\r\n")?.employeeName
    ).toBe(fields.employeeName);
  });
  it("does not repair letters inserted into CPF or CNPJ", () => {
    expect(parse(completedRdAsoText(fields)!.replace("529.982", "529a.982"))).toBeNull();
  });
});
