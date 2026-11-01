import { describe, expect, it } from "vitest";
import { ASO_FLOW_TEMPLATE, parseAsoFlowCsv, parseAsoFlowTable } from "./aso-flow-import";

const headers = [
  "CNPJ empregador",
  "CPF",
  "Colaborador",
  "Cidade",
  "UF",
  "Unidade",
  "Tipo de exame",
  "Competência",
  "Cargo",
  "Setor",
];
const row = [
  "00.000.000/0001-00",
  "000.000.000-00",
  "Pessoa de teste",
  "Curitiba",
  "pr",
  "Unidade de teste",
  "Periódico",
  "11/2026",
  "Cargo teste",
  "Setor teste",
];

describe("importação de solicitações de ASO", () => {
  it("preserva documentos como texto, empregador separado de clínica e número original de linha", () => {
    const parsed = parseAsoFlowTable([
      [],
      headers.concat("CNPJ clínica"),
      row.concat("99.999.999/0001-99"),
    ]);
    expect(parsed).toEqual([
      {
        companyCnpj: row[0],
        employeeCpf: row[1],
        employeeName: row[2],
        city: "Curitiba",
        state: "PR",
        unit: row[5],
        examType: "periodico",
        cycle: "2026-11",
        roleTitle: "Cargo teste",
        department: "Setor teste",
        sourceRow: 3,
      },
    ]);
  });
  it("aceita CSV com ponto e vírgula e aspas sem avaliar fórmulas", () => {
    const parsed = parseAsoFlowCsv(
      ASO_FLOW_TEMPLATE +
        '00.000.000/0001-00;000.000.000-00;"Teste; pessoa";Curitiba;PR;Unidade;Periódico;2026-11;=HYPERLINK("x");Setor\r\n'
    );
    expect(parsed[0].employeeName).toBe("Teste; pessoa");
    expect(parsed[0].roleTitle).toBe('=HYPERLINK("x")');
    expect(parsed[0].employeeCpf).toBe("000.000.000-00");
  });
  it("deixa dados ausentes e tipo desconhecido para a conferência por linha no servidor", () => {
    const broken = [...row];
    broken[0] = "";
    broken[6] = "tipo não reconhecido";
    broken[7] = "";
    const parsed = parseAsoFlowTable([headers, broken]);
    expect(parsed[0]).toMatchObject({
      companyCnpj: "",
      examType: "tipo não reconhecido",
      cycle: "",
    });
  });
  it("não presume que CNPJ de clínica seja o empregador e rejeita colunas ambíguas", () => {
    expect(() => parseAsoFlowTable([["CNPJ clínica", ...headers.slice(1)], row])).toThrow(
      "CNPJ empregador"
    );
    expect(() => parseAsoFlowTable([headers.concat("CNPJ empresa"), row.concat(row[0])])).toThrow(
      "mais de uma coluna"
    );
  });
  it("rejeita fórmulas Excel e linhas além do limite sem cortar silenciosamente", () => {
    const formula = [...row] as unknown[];
    formula[1] = { formula: "A1", result: "00000000000" };
    expect(() => parseAsoFlowTable([headers, formula])).toThrow("somente com valores");
    expect(() => parseAsoFlowTable([headers, ...Array.from({ length: 5001 }, () => row)])).toThrow(
      "excede 5000"
    );
  });
});
