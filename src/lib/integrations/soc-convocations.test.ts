import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  convocationFields,
  parseConvocations,
  socDay,
  convocationStatus,
  summarizeConvocations,
} from "./soc-convocations";
const row = Object.fromEntries(convocationFields.map((f) => [f, ""])) as Record<
  (typeof convocationFields)[number],
  string
>;
Object.assign(row, {
  "CNPJ DA UNIDADE": "11.918.109/0008-03",
  "Código Funcionario": "001",
  Nome: "Exemplo",
  UNIDADE: "AESA",
  Exame: "Clínico",
  Periodicidade: "12",
});
const csv = (rows = [row]) => Papa.unparse(rows);
describe("SOC convocações", () => {
  it("preserves codes, repeated keys and differing source rows", () => {
    const rows = parseConvocations(csv([row, { ...row, Origem: "Pendente" }]));
    expect(rows[0]["Código Funcionario"]).toBe("001");
    expect(summarizeConvocations(rows, "2026-10-16")).toMatchObject({
      rows: 2,
      repeatedKeys: 1,
      extraRowsForRepeatedKeys: 1,
      withResultDate: 0,
      withoutDueDate: 2,
    });
  });
  it("does not infer due dates or completion from frequency or order", () => {
    expect(convocationStatus({ ...row, "Último Pedido": "01/10/2025" }, "2026-10-16")).toBe(
      "Sem vencimento informado"
    );
  });
  it("validates real dates and uses source due dates", () => {
    expect(() => socDay("31/02/2026")).toThrow();
    expect(convocationStatus({ ...row, "Refazer em": "15/10/2026" }, "2026-10-16")).toBe(
      "Vencido na fonte"
    );
    expect(convocationStatus({ ...row, "Refazer em": "15/11/2026" }, "2026-10-16")).toBe(
      "Vence em até 30 dias"
    );
  });
  it("rejects incorrect layouts and missing identity", () => {
    expect(() => parseConvocations("Nome,COD\nExemplo,1")).toThrow();
    expect(() => parseConvocations(csv([{ ...row, "Código Funcionario": "" }]))).toThrow();
  });
});
