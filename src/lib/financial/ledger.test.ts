import { describe, expect, it } from "vitest";
import {
  LedgerSchema,
  emptyFilters,
  filterLedger,
  ledgerCsv,
  summarizeLedger,
  type LedgerRow,
} from "./ledger";
import { requireFinancialAccess } from "../auth/financial-access";
import type { AuthContext } from "../auth/auth-context";
const row = (
  id: string,
  side: "D" | "C",
  amountCents: number,
  extra: Partial<LedgerRow> = {}
): LedgerRow => ({
  id,
  side,
  amountCents,
  date: "2025-01-02",
  account: side === "D" ? "1.1.1" : "2.1.1",
  accountName: side === "D" ? "Banco teste" : "Fornecedores",
  costCenter: "",
  history: "Serviços de manutenção",
  entry: "1",
  page: 1,
  endPage: 1,
  ...extra,
});
const rows = [row("a", "D", 100), row("b", "D", 201), row("c", "C", 301)];
const book = {
  schemaVersion: 1,
  company: "Empresa Teste",
  cnpj: "00.000.000/0001-00",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  bookNumber: "1",
  sourceName: "teste.pdf",
  sourceSha256: "a".repeat(64),
  pageCount: 2,
  rows,
};
describe("ledger accounting integrity", () => {
  it("uses integer cents and balances a compound entry rather than matching pairs", () => {
    const s = summarizeLedger(rows);
    expect(s.debit).toBe(301);
    expect(s.credit).toBe(301);
    expect(s.entryCount).toBe(1);
    expect(s.unbalanced).toHaveLength(0);
    expect(s.rowCount).toBe(3);
  });
  it("does not let differences cancel between entries or days", () => {
    const s = summarizeLedger([row("a", "D", 100), row("b", "C", 100, { entry: "2" })]);
    expect(s.debit - s.credit).toBe(0);
    expect(s.unbalanced).toHaveLength(2);
    expect(
      summarizeLedger([row("a", "D", 100), row("b", "C", 100, { date: "2025-01-03" })]).entryCount
    ).toBe(2);
  });
  it("filters accents, month, account, minimum, nature and dates without changing the source", () => {
    expect(
      filterLedger(rows, {
        ...emptyFilters,
        query: "MANUTENCAO",
        side: "D",
        min: "2,00",
        month: "2025-01",
        account: "1.1.1",
        start: "2025-01-02",
        end: "2025-01-02",
      }).map((r) => r.id)
    ).toEqual(["b"]);
    expect(rows).toHaveLength(3);
    expect(filterLedger(rows, { ...emptyFilters, query: "ausente" })).toEqual([]);
  });
  it("rejects duplicate ids, invalid dates, unsafe cents and pages outside the source", () => {
    expect(LedgerSchema.safeParse(book).success).toBe(true);
    for (const invalid of [
      { ...book, rows: [rows[0], rows[0]] },
      { ...book, rows: [row("x", "D", 1.2)] },
      { ...book, rows: [row("x", "D", 100, { date: "2025-02-30" })] },
      { ...book, rows: [row("x", "D", 100, { endPage: 3 })] },
    ])
      expect(LedgerSchema.safeParse(invalid).success).toBe(false);
  });
  it("exports decimals and neutralizes spreadsheet formulas", () => {
    const csv = ledgerCsv([row("x", "D", 12345, { history: '=CMD("x")' })]);
    expect(csv).toContain('"123,45"');
    expect(csv).toContain('"\'=CMD(""x"")"');
    expect(csv).toContain("Página final");
  });
});
describe("corporate ledger authorization", () => {
  const user = (role: AuthContext["role"], tenantId: string | null = null): AuthContext => ({
    uid: "u",
    email: "test@example.com",
    role,
    tenantId,
    permissions: [],
    servedCompanies: [],
  });
  it("allows global administration", () => {
    expect(() => requireFinancialAccess(user("SUPER_ADMIN"))).not.toThrow();
    expect(() => requireFinancialAccess(user("ADMIN"))).not.toThrow();
  });
  it("denies tenant admins, staff and guests regardless of assigned company lists", () => {
    for (const u of [
      user("ADMIN", "other"),
      user("CLIENT_ADMIN", "a"),
      user("OPERATIONS"),
      user("DOCTOR"),
      user("GUEST"),
    ])
      expect(() =>
        requireFinancialAccess({ ...u, permissions: ["*"], servedCompanies: ["all"] })
      ).toThrow();
  });
});
