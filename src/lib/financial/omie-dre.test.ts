import { describe, expect, it } from "vitest";
import { FinancialActionImportSchema } from "./actions";
import {
  exportOmieDreCsv,
  fromOmieDate,
  OmieDreQuerySchema,
  previousClosedMonthQuery,
  suggestOmieDreActions,
  summarizeOmieDre,
  type OmieDreReport,
  type OmieDreRow,
} from "./omie-dre";

const query = { start: "2026-01-01", end: "2026-09-30", dateBasis: "emission" as const };
const row = (overrides: Partial<OmieDreRow> = {}): OmieDreRow => ({
  id: "a".repeat(64),
  date: "2026-09-10",
  type: "Custos",
  group: "Custos diretos",
  account: "Engenharia de Segurança",
  category: "Laudos PGR",
  amountCents: -10010,
  partyId: "supplier-1",
  partyName: "Fornecedor sintético",
  partyCnpj: "00000000000000",
  identityStatus: "cnpj",
  city: "Curitiba",
  state: "PR",
  ...overrides,
});
const report = (rows: OmieDreRow[]): OmieDreReport => {
  const data = {
    schemaVersion: 1 as const,
    query,
    company: "Empresa de teste",
    cnpj: "00000000000000",
    queriedAt: "2026-10-11T00:00:00Z",
    sourceSha256: "b".repeat(64),
    rows,
    summary: summarizeOmieDre(rows, query),
    warnings: [],
  };
  return { ...data, suggestedActions: suggestOmieDreActions(data) };
};

describe("Omie DRE analysis", () => {
  it("validates calendar dates, range and allowed query fields", () => {
    expect(fromOmieDate("29/02/2024")).toBe("2024-02-29");
    expect(fromOmieDate("29/02/2026")).toBeNull();
    for (const invalid of [
      { ...query, start: "2026-02-30" },
      { ...query, end: "2025-12-31" },
      { ...query, start: "2024-01-01" },
      { ...query, call: "AlterarLancamento" },
    ])
      expect(OmieDreQuerySchema.safeParse(invalid).success).toBe(false);
    expect(previousClosedMonthQuery(new Date("2026-10-11T00:00:00Z"))).toEqual(query);
    expect(previousClosedMonthQuery(new Date("2026-11-01T02:59:00Z"))).toEqual(query);
    expect(previousClosedMonthQuery(new Date("2026-01-03T00:00:00Z"))).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
      dateBasis: "emission",
    });
  });

  it("preserves duplicate-looking entries, integer cents and positive reversals", () => {
    const result = summarizeOmieDre(
      [
        row(),
        row(),
        row({ amountCents: 1020 }),
        row({
          type: "Receitas",
          group: "Receitas",
          account: "Serviços",
          category: "Vendas",
          amountCents: 30000,
        }),
      ],
      query
    );
    expect(result.totalSignedCents).toBe(11000);
    expect(result.engineering[0]).toMatchObject({ costCents: 19000, entries: 3 });
    expect(result.positiveExpenseEntries).toBe(1);
    expect(result.accounts.reduce((sum, account) => sum + account.amountCents, 0)).toBe(11000);
  });

  it("ranks only the last three months and never infers specialty from a vendor name", () => {
    const result = summarizeOmieDre(
      [
        row({ date: "2026-06-30", amountCents: -900000 }),
        row(),
        row({
          partyName: "ENGENHARIA E CLINICA TESTE",
          account: "Despesas gerais",
          category: "Diversos",
          amountCents: -80000,
        }),
        row({
          account: "Receitas",
          type: "Receitas",
          group: "Vendas",
          category: "PGR",
          amountCents: -50000,
        }),
        row({
          account: "Custos de engenharia e exames",
          category: "Pacote misto",
          amountCents: -40000,
        }),
      ],
      query
    );
    expect(result.analysisPeriod.start).toBe("2026-07-01");
    expect(result.engineering).toHaveLength(1);
    expect(result.engineering[0].costCents).toBe(10010);
    expect(result.occupationalExams).toHaveLength(0);
    expect(result.unclassifiedExpenseEntries).toBe(2);
  });

  it("groups suppliers by identity and labels cities as supplier data, without quantities", () => {
    const result = summarizeOmieDre(
      [
        row({ account: "Exames ocupacionais", category: "ASO", partyId: "a", amountCents: -25000 }),
        row({ account: "Exames ocupacionais", category: "ASO", partyId: "a", amountCents: 5000 }),
        row({
          account: "Exames ocupacionais",
          category: "ASO",
          partyId: "b",
          city: "CURITIBA",
          amountCents: -30000,
        }),
        row({
          account: "Exames ocupacionais",
          category: "ASO",
          identityStatus: "unknown",
          amountCents: -70000,
        }),
      ],
      query
    );
    expect(result.occupationalExams.map((cost) => cost.costCents)).toEqual([30000, 20000]);
    expect(result.supplierCities).toEqual([
      { city: "Curitiba", state: "PR", costCents: 50000, entries: 3 },
    ]);
    expect(result.unclassifiedExpenseEntries).toBe(1);
  });

  it("keeps general SST materials, payroll, clinics and medical consultation out of service rankings", () => {
    const result = summarizeOmieDre(
      [
        row({ group: "Materiais", account: "EPIs", category: "Segurança do Trabalho" }),
        row({ account: "Folha de engenharia", category: "Salários" }),
        row({ account: "Despesas de saúde", category: "Clínica e medicina do trabalho" }),
        row({ account: "Despesas de engenharia", category: "Treinamento PGR" }),
      ],
      query
    );
    expect(result.engineering).toEqual([]);
    expect(result.occupationalExams).toEqual([]);
    expect(result.unclassifiedExpenseEntries).toBe(4);
  });

  it("does not convert positive-only expenses into costs or fabricated zero statements", () => {
    expect(summarizeOmieDre([row({ amountCents: 10000 })], query).engineering).toEqual([]);
    expect(summarizeOmieDre([], query).accounts).toEqual([]);
    expect(() => summarizeOmieDre([row({ amountCents: 1e14 }), row()], query)).not.toThrow();
    expect(() =>
      summarizeOmieDre([row({ amountCents: 1e14 }), row({ amountCents: 1 })], query)
    ).toThrow();
  });

  it("creates bounded, schema-valid suggestions with a stable source key and no invented savings", () => {
    const data = report(
      Array.from({ length: 50 }, (_, index) =>
        row({ category: `Laudo PGR ${index} ${"a".repeat(900)}` })
      )
    );
    expect(FinancialActionImportSchema.safeParse(data.suggestedActions).success).toBe(true);
    expect(data.suggestedActions.idempotencyKey).toBe(`omie-dre-v1:${data.sourceSha256}`);
    expect(
      data.suggestedActions.actions.every(
        (action) => action.estimatedSavingsCents === null && action.status === "proposed"
      )
    ).toBe(true);
    expect(data.suggestedActions.actions[1].baseAmountCents).toBe(500500);
    expect(data.summary.engineering[0].categories).toHaveLength(50);
  });

  it("exports source metadata, real signed numbers and quoted text safe from spreadsheet formulas", () => {
    const csv = exportOmieDreCsv(
      report([row({ partyName: '\u0000\t=HYPERLINK("x")', category: "ASO; teste\nsegunda linha" })])
    );
    expect(csv).toContain('"\'\t=HYPERLINK(""x"")"');
    expect(csv).toContain('"ASO; teste\nsegunda linha"');
    expect(csv).toContain(";-100,10;");
    expect(csv).toContain("SHA256 fonte");
    expect(csv).not.toContain("\u0000");
  });
});
