import { describe, expect, it } from "vitest";
import { balanceMoney, balanceTotals, parseBalancePages, type BalanceTextItem } from "./balance";

function fixture() {
  const items: BalanceTextItem[] = [
    { text: "BALANÇO PATRIMONIAL", x: 200, y: 800 },
    { text: "Entidade:", x: 30, y: 780 },
    { text: "Empresa de Teste", x: 165, y: 780 },
    { text: "00.000.000/0001-00", x: 400, y: 760 },
    { text: "01/01/2025 a 31/12/2025", x: 165, y: 760 },
    { text: "Saldo Inicial", x: 350, y: 690 },
    { text: "Saldo Final", x: 490, y: 690 },
  ];
  [
    ["ATIVO", "R$ 100,00", "R$ 200,00"],
    ["(-) DEPRECIAÇÃO", "R$ (10,00)", "R$ (20,00)"],
    ["PASSIVO", "R$ 100,00", "R$ 200,00"],
    ["PATRIMÔNIO LÍQUIDO", "R$ 60,00", "R$ 80,00"],
  ].forEach(([label, opening, closing], index) => {
    const y = 665 - index * 24;
    // SPED content order presents closing before opening; x coordinate is authoritative.
    items.push(
      { text: label, x: 40, y: y - 1 },
      { text: closing, x: 520, y },
      { text: opening, x: 390, y }
    );
  });
  return items;
}
describe("SPED balance extraction", () => {
  it("preserves signs and cents without floating point rounding", () => {
    expect(balanceMoney("R$ (1.234,56)")).toBe(-123456);
    expect(balanceMoney("R$ 0,01")).toBe(1);
    expect(() => balanceMoney("R$ (1,00")).toThrow();
  });
  it.each([
    ["R$ 1.234,56", 123456],
    ["R$ 1234,56", 123456],
    ["R$ (1.234.567,89)", -123456789],
    ["R$ 000,01", 1],
  ])("preserves supported SPED monetary notation: %s", (value, expected) => {
    expect(balanceMoney(value)).toBe(expected);
  });
  it.each([
    "R$ .,00",
    "R$ 1.2,34",
    "R$ 1..234,56",
    "R$ .123,45",
    "R$ 1234.567,89",
    "R$ 1,2",
    "R$ 1,234",
    "R$ 1,00)",
    "R$ (1,00",
  ])("rejects malformed money instead of changing its value: %s", (value) => {
    expect(() => balanceMoney(value)).toThrow("monetário inválido");
  });
  it("rejects a malformed account even when total assets and liabilities still match", () => {
    const items = fixture();
    for (const item of items) {
      if (item.y === 641 && item.x >= 390) item.text = "R$ 1.2,34";
    }
    expect(() => parseBalancePages([items])).toThrow("monetário inválido");
  });
  it("still rejects currency outside the supported value columns", () => {
    const items = fixture();
    items.find((item) => item.x === 390 && item.y === 641)!.x = 200;
    expect(() => parseBalancePages([items])).toThrow("Colunas");
  });
  it("uses column positions, includes wrapped labels and distinguishes debt from total passivo", () => {
    const items = fixture();
    items.push({ text: "ACUMULADA", x: 40, y: 632 });
    const balance = parseBalancePages([items]);
    expect(balance.company).toBe("Empresa de Teste");
    expect(balance.periodEnd).toBe("2025-12-31");
    expect(balance.rows[1]).toMatchObject({
      label: "(-) DEPRECIAÇÃO ACUMULADA",
      closingCents: -2000,
    });
    const totals = balanceTotals(balance);
    expect(totals.assets.openingCents).toBe(10000);
    expect(totals.assets.closingCents).toBe(20000);
    expect(totals.liabilitiesCents).toBe(12000);
  });
  it("rejects incomplete columns, mismatched totals and impossible dates", () => {
    const missing = fixture().filter((item) => !(item.x === 390 && item.y === 665));
    expect(() => parseBalancePages([missing])).toThrow("Colunas");
    const mismatch = fixture();
    mismatch.find((item) => item.x === 520 && item.y === 665)!.text = "R$ 201,00";
    expect(() => parseBalancePages([mismatch])).toThrow("não conferem");
    const dates = fixture();
    dates.find((item) => item.text.includes("01/01/2025"))!.text = "31/02/2025 a 31/12/2025";
    expect(() => parseBalancePages([dates])).toThrow("Período inválido");
    expect(() => parseBalancePages([[]])).toThrow("SPED");
  });
});
