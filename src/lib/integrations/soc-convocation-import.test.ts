// @vitest-environment node
import { describe, it, expect } from "vitest";
import { importSocConvocation } from "./soc-convocation-import";
import { socDashboardSchema } from "./soc-dashboard";
const header =
  "CNPJ DA UNIDADE,Apelido da Empresa,UNIDADE,Exame,Refazer em,Código Funcionario,Situação,Nome,Data Resultado";
const row = (id: string, due: string, state = "Ativo", company = "Empresa Teste") =>
  `001,${company},Unidade,Exame clínico,${due},${id},${state},Pessoa privada,01/01/2026`;
const parse = (rows: string[]) =>
  importSocConvocation(
    [header, ...rows].join("\n"),
    { id: "101", name: "Empresa Teste" },
    "2026-10-16",
    "2026-11-15",
    "2026-10-16T15:00:00Z"
  );
describe("SOC convocation import", () => {
  it("classifies explicit due dates at the boundaries and never invents absent dates", () => {
    expect(
      parse([
        row("1", "15/10/2026"),
        row("2", "16/10/2026"),
        row("3", "15/11/2026"),
        row("4", "16/11/2026"),
        row("5", ""),
      ])
    ).toMatchObject({ total: 5, overdue: 1, dueSoon: 2, later: 1, unknown: 1 });
  });
  it("deduplicates the same exam without merging different employee codes", () => {
    expect(parse([row("1", ""), row("1", ""), row("2", "")])).toMatchObject({
      total: 2,
      duplicates: 1,
      unknown: 2,
    });
  });
  it("rejects conflicting dates for the same unit, employee and exam", () => {
    expect(() => parse([row("1", ""), row("1", "01/10/2026")])).toThrow("divergentes");
  });
  it("rejects mixed companies even when the foreign row is inactive", () => {
    expect(() => parse([row("1", ""), row("2", "", "Inativo", "Outra")])).toThrow("empresa");
  });
  it("counts non-active rows separately and fails on unknown statuses", () => {
    expect(parse([row("1", "", "Demitido"), row("2", "")])).toMatchObject({
      total: 1,
      excludedInactive: 1,
    });
    expect(() => parse([row("1", "", "indefinido")])).toThrow("desconhecida");
  });
  it.each(["31/02/2026", "2026-10-16", "16/10/26"])("rejects invalid due date %s", (due) => {
    expect(() => parse([row("1", due)])).toThrow();
  });
  it("rejects a header-only file instead of publishing zero overdue exams", () => {
    expect(() => parse([])).toThrow("vazio");
  });
  it("does not transmit employee names, IDs, unit CNPJ or results in its summary", () => {
    const result = JSON.stringify(parse([row("12345678", "")]));
    for (const sensitive of ["Pessoa privada", "12345678", "01/01/2026", "CNPJ", "Resultado"])
      expect(result).not.toContain(sensitive);
  });
  it("rejects a summary outside the registered portfolio or inconsistent totals", () => {
    const summary = parse([row("1", "")]);
    const snapshot = {
      schemaVersion: 1,
      source: "SOC · consulta manual",
      observedAt: "2026-10-16T15:00:00Z",
      dueSoonEnd: "2026-11-15",
      inactiveExcluded: 0,
      activeCompanies: [{ id: "101", name: "Teste" }],
      reports: [],
      administrativeTasks: [],
      limitation: "Teste",
      examSummaries: [summary],
    };
    expect(socDashboardSchema.safeParse(snapshot).success).toBe(true);
    expect(
      socDashboardSchema.safeParse({
        ...snapshot,
        examSummaries: [{ ...summary, companyId: "999" }],
      }).success
    ).toBe(false);
    expect(
      socDashboardSchema.safeParse({ ...snapshot, examSummaries: [{ ...summary, total: 7 }] })
        .success
    ).toBe(false);
    expect(
      socDashboardSchema.safeParse({ ...snapshot, examSummaries: [summary, summary] }).success
    ).toBe(false);
  });
});
