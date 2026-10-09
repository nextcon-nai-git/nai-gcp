import { describe, expect, it } from "vitest";
import {
  MonthlyBillingImportSchema,
  parseMonthlyBillingPaste,
  resolveBillingCompany,
} from "./monthly-billing";

const row = { cnpj: "11222333000181", name: "Empresa de exemplo", valueCents: 123456 };
describe("monthly billing import", () => {
  it("parses Excel tabs, formatted CNPJ and Brazilian cents without floating-point rounding", () => {
    expect(
      parseMonthlyBillingPaste(
        "CNPJ\tRazão Social\tValor\n11.222.333/0001-81 \tEmpresa de exemplo\tR$ 1.234,56\n"
      )
    ).toEqual([row]);
  });
  it.each(["1,234.56", "1234.56", "", "-1,00", "0,00", "10,999", "NaN"])(
    "rejects invalid or ambiguous amounts: %s",
    (amount) => {
      expect(() =>
        parseMonthlyBillingPaste(`11.222.333/0001-81\tEmpresa de exemplo\t${amount}`)
      ).toThrow();
    }
  );
  it("rejects repeated CNPJs even when formatting differs", () => {
    expect(() =>
      parseMonthlyBillingPaste(
        "11.222.333/0001-81\tEmpresa de exemplo\t10,00\n11222333000181\tOutra linha\t20,00"
      )
    ).toThrow(/repetidos/);
    expect(
      MonthlyBillingImportSchema.safeParse({
        groupCompanyId: "group",
        sourceName: "example.xlsx",
        revision: "a".repeat(64),
        confirmed: true,
        rows: [row, { ...row, cnpj: "11.222.333/0001-81" }],
      }).success
    ).toBe(false);
  });
  it("requires valid CNPJ checksums and explicit review", () => {
    expect(() => parseMonthlyBillingPaste("11222333000182\tExemplo\t10,00")).toThrow(/CNPJ/);
    expect(
      MonthlyBillingImportSchema.safeParse({
        groupCompanyId: "group",
        sourceName: "example.xlsx",
        revision: "a".repeat(64),
        confirmed: false,
        rows: [row],
      }).success
    ).toBe(false);
  });
  it("reuses an existing company ID and prevents duplicates and cross-group reassignment", () => {
    expect(
      resolveBillingCompany(row, [{ id: "legacy", cnpj: "11.222.333/0001-81" }], "group")
    ).toBe("legacy");
    expect(resolveBillingCompany(row, [], "group")).toBe(row.cnpj);
    expect(() =>
      resolveBillingCompany(
        row,
        [
          { id: "one", cnpj: row.cnpj },
          { id: "two", cnpj: row.cnpj },
        ],
        "group"
      )
    ).toThrow(/duplicados/);
    expect(() =>
      resolveBillingCompany(
        row,
        [{ id: "legacy", cnpj: row.cnpj, portfolioClientId: "other" }],
        "group"
      )
    ).toThrow(/outro grupo/);
    expect(() =>
      resolveBillingCompany(row, [{ id: row.cnpj, cnpj: "12345678000195" }], "group")
    ).toThrow(/outro cadastro/);
    expect(() =>
      resolveBillingCompany(row, [{ id: "legacy", cnpj: row.cnpj, isDeleted: true }], "group")
    ).toThrow(/excluído/);
  });
});
