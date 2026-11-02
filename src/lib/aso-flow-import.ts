import Papa from "papaparse";
import type { AsoFlowRow } from "@/lib/aso-flow";
import { assertSafeAsoXlsx } from "@/lib/aso-flow-xlsx";

export const ASO_FLOW_IMPORT_LIMIT = 5000;
export const ASO_FLOW_BATCH_SIZE = 200;
export const ASO_FLOW_FILE_LIMIT = 10 * 1024 * 1024;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const aliases: Record<keyof Omit<AsoFlowRow, "sourceRow">, string[]> = {
  companyCnpj: ["cnpjempregador", "cnpjcliente", "cnpjempresa", "cnpj"],
  employeeCpf: ["cpf", "cpfcolaborador", "cpffuncionario"],
  employeeName: ["colaborador", "nome", "nomecolaborador", "funcionario", "nomefuncionario"],
  city: ["cidade", "municipio", "cidadetrabalho", "municipiotrabalho"],
  state: ["uf", "estado", "uftrabalho"],
  unit: ["unidade", "estabelecimento", "local", "localtrabalho", "unidadeempresa", "filial"],
  examType: ["tipo", "tipoexame", "tipodeexame", "tipoaso"],
  cycle: ["competencia", "ciclo", "mesreferencia", "referencia"],
  roleTitle: ["cargo", "funcao"],
  department: ["setor", "departamento"],
};
const fieldNames: Partial<Record<keyof AsoFlowRow, string>> = {
  companyCnpj: "CNPJ empregador",
  employeeCpf: "CPF",
  employeeName: "Colaborador",
  city: "Cidade",
  state: "UF",
  unit: "Unidade",
  examType: "Tipo de exame",
  cycle: "Competência",
};
const types: Record<string, string> = {
  admissional: "admissional",
  periodico: "periodico",
  periodicos: "periodico",
  demissional: "demissional",
  retornotrabalho: "retorno_trabalho",
  retornoaotrabalho: "retorno_trabalho",
  mudancafuncao: "mudanca_funcao",
  mudancadefuncao: "mudanca_funcao",
  mudancarisco: "mudanca_funcao",
  mudancaderisco: "mudanca_funcao",
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      throw new Error(
        "Há célula com fórmula. Exporte uma cópia somente com valores para importar."
      );
    }
    if ("text" in value) return String(value.text ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText
        .map((part) => String(part.text ?? ""))
        .join("")
        .trim();
    throw new Error("Há célula com formato não reconhecido. Confira a planilha.");
  }
  return String(value).trim();
}

/** A sheet supplies claims only. The server resolves identities and owns the final preview. */
export function parseAsoFlowTable(table: unknown[][]): AsoFlowRow[] {
  const headerIndex = table.findIndex((row) => row.some((value) => cellText(value) !== ""));
  if (headerIndex < 0) throw new Error("A planilha está vazia.");
  const headers = table[headerIndex].map((value) => normalize(cellText(value)));
  const indexes = {} as Record<keyof Omit<AsoFlowRow, "sourceRow">, number>;
  for (const [key, names] of Object.entries(aliases)) {
    const matches = headers.flatMap((header, index) => (names.includes(header) ? [index] : []));
    if (matches.length > 1)
      throw new Error(
        `Há mais de uma coluna para ${fieldNames[key as keyof AsoFlowRow] || key}. Mantenha uma coluna por informação.`
      );
    indexes[key as keyof typeof indexes] = matches[0] ?? -1;
  }
  const missing = Object.entries(fieldNames)
    .filter(([key]) => indexes[key as keyof typeof indexes] === -1)
    .map(([, label]) => label);
  if (missing.length)
    throw new Error(`Faltam colunas: ${missing.join(", ")}. Use o modelo de importação.`);
  const rows: AsoFlowRow[] = [];
  for (let i = headerIndex + 1; i < table.length; i++) {
    const values = table[i].map(cellText);
    if (!values.some(Boolean)) continue;
    if (rows.length >= ASO_FLOW_IMPORT_LIMIT)
      throw new Error(
        `A planilha excede ${ASO_FLOW_IMPORT_LIMIT} linhas. Divida o arquivo em lotes menores.`
      );
    const get = (field: keyof typeof indexes) => values[indexes[field]] || "";
    const rawCycle = get("cycle");
    const cycle = /^(0[1-9]|1[0-2])\/\d{4}$/.test(rawCycle)
      ? `${rawCycle.slice(3)}-${rawCycle.slice(0, 2)}`
      : rawCycle;
    const exam = get("examType");
    rows.push({
      companyCnpj: get("companyCnpj"),
      employeeCpf: get("employeeCpf"),
      employeeName: get("employeeName"),
      city: get("city"),
      state: get("state").toUpperCase(),
      unit: get("unit"),
      examType: Object.hasOwn(types, normalize(exam)) ? types[normalize(exam)] : exam,
      cycle,
      roleTitle: get("roleTitle"),
      department: get("department"),
      sourceRow: i + 1,
    });
  }
  if (!rows.length) throw new Error("A planilha tem cabeçalhos, mas nenhuma solicitação.");
  return rows;
}

export function parseAsoFlowCsv(text: string): AsoFlowRow[] {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: false,
    dynamicTyping: false,
    preview: ASO_FLOW_IMPORT_LIMIT + 3,
  });
  if (parsed.errors.length || parsed.meta.truncated)
    throw new Error(
      parsed.meta.truncated
        ? `O CSV excede ${ASO_FLOW_IMPORT_LIMIT} linhas. Divida o arquivo.`
        : "CSV inválido. Confira separadores, aspas e número de colunas."
    );
  return parseAsoFlowTable(parsed.data);
}

export async function readAsoFlowFile(file: File): Promise<AsoFlowRow[]> {
  if (file.size > ASO_FLOW_FILE_LIMIT) throw new Error("O arquivo deve ter até 10 MB.");
  if (/\.csv$/i.test(file.name)) return parseAsoFlowCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Selecione um arquivo CSV ou XLSX.");
  const bytes = await file.arrayBuffer();
  await assertSafeAsoXlsx(bytes);
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(bytes);
  const worksheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  if (worksheets.length !== 1)
    throw new Error(
      "O XLSX deve conter uma única aba preenchida. Exporte a aba desejada para CSV ou outro XLSX."
    );
  const sheet = worksheets[0];
  if (sheet.rowCount > ASO_FLOW_IMPORT_LIMIT + 1 || sheet.columnCount > 100)
    throw new Error(`Use até ${ASO_FLOW_IMPORT_LIMIT} linhas e 100 colunas por arquivo.`);
  const table: unknown[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row: unknown[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) row.push(sheet.getCell(r, c).value);
    table.push(row);
  }
  return parseAsoFlowTable(table);
}

export const ASO_FLOW_TEMPLATE =
  "\uFEFFCNPJ empregador;CPF;Colaborador;Cidade;UF;Unidade;Tipo de exame;Competência;Cargo;Setor\r\n";
