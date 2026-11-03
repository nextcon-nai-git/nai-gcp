import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { csvTextCell } from "./csv-cell";

describe("CSV text cells", () => {
  it.each([
    "=1+1",
    "+1+1",
    "-1+1",
    "@SUM(1)",
    "  =1+1",
    "\t=1+1",
    "\r=1+1",
    "\n=1+1",
    "\u0000 =1+1",
    "\u00a0=1+1",
    "＝1+1",
    "＋1+1",
    "－1+1",
    "＠SUM(1)",
    "\tordinary text",
    "\rordinary text",
    "\nordinary text",
  ])("exports formula-like text as a literal: %j", (text) => {
    const parsed = Papa.parse<string[]>(csvTextCell(text), { delimiter: ";" });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual([["'" + text]]);
  });

  it("keeps quotes, separators and embedded newlines in one cell", () => {
    const value = 'Clínica "A";=1+1\r\nOutro texto';
    const parsed = Papa.parse<string[]>([csvTextCell(value), csvTextCell("fim")].join(";"), {
      delimiter: ";",
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual([[value, "fim"]]);
  });

  it.each([
    [undefined, '""'],
    [null, '""'],
    [0, '"0"'],
    [123.45, '"123.45"'],
    ["Saúde Ocupacional", '"Saúde Ocupacional"'],
    ["  Nome revisado", '"  Nome revisado"'],
  ])("preserves ordinary values: %j", (value, expected) => {
    expect(csvTextCell(value)).toBe(expected);
  });
});
