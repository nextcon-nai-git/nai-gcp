import { createHash } from "node:crypto";

export const SOC_EXAM_RESULTS_MAX_ROWS = 5000;
export const SOC_EXAM_RESULTS_MAX_BYTES = 2_000_000;

export const SOC_EXAM_RESULT_FIELDS = [
  "EMPRESA",
  "NOMEEMPRESA",
  "DATAFICHA",
  "DATARESULTADO",
  "TIPOEXAME",
  "DATAEXAME",
  "CODEXAME",
  "NOMEEXAME",
  "EXAMEALTERADO",
  "CPFMEDICOEXAMINADOR",
  "NOMEMEDICOEXAMINADOR",
  "CODIGOPRESTADOR",
  "NOMEPRESTADOR",
  "UF",
  "CIDADEPRESTADOR",
] as const;

export type SocExamResultRow = Record<(typeof SOC_EXAM_RESULT_FIELDS)[number], string> & {
  derivedStatus: "REALIZADO" | "FALTA_AUSENCIA";
};

const datePattern = /^(?:|\d{2}\/\d{2}\/\d{4})$/;
const codePattern = /^.{0,80}$/;
const shortPattern = /^.{0,500}$/;

function clean(value: unknown, max = 500) {
  if (value == null) return "";
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("Registro SOC contém campo inválido.");
  const text = String(value).trim();
  if (text.length > max) throw new Error("Registro SOC contém campo acima do limite.");
  return text;
}

function normalizeRow(input: unknown): SocExamResultRow {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Registro SOC inválido.");
  const source = input as Record<string, unknown>;
  const row = Object.fromEntries(
    SOC_EXAM_RESULT_FIELDS.map((field) => [field, clean(source[field], field.includes("NOME") ? 500 : 120)])
  ) as Record<(typeof SOC_EXAM_RESULT_FIELDS)[number], string>;

  if (!/^\d{1,20}$/.test(row.EMPRESA)) throw new Error("Código de empresa SOC inválido.");
  if (!row.NOMEEMPRESA || !shortPattern.test(row.NOMEEMPRESA))
    throw new Error("Empresa SOC ausente ou inválida.");
  for (const field of ["DATAFICHA", "DATARESULTADO", "DATAEXAME"] as const)
    if (!datePattern.test(row[field])) throw new Error(`Data SOC inválida em ${field}.`);
  if (!codePattern.test(row.CODEXAME) || !codePattern.test(row.CODIGOPRESTADOR))
    throw new Error("Código SOC acima do limite.");
  if (row.EXAMEALTERADO && !/^[01]$/.test(row.EXAMEALTERADO))
    throw new Error("Indicador EXAMEALTERADO inválido.");

  const absence =
    /FALTA|AUS[ÊE]NCIA/i.test(row.NOMEEXAME) ||
    (row.CODEXAME === "250" && !/CLINIC/i.test(row.NOMEEXAME));
  return { ...row, derivedStatus: absence ? "FALTA_AUSENCIA" : "REALIZADO" };
}

function canonical(row: SocExamResultRow) {
  return SOC_EXAM_RESULT_FIELDS.map((field) => row[field]).join("\u001f");
}

export function parseSocExamResults(input: unknown) {
  if (!Array.isArray(input)) throw new Error("Envie uma lista JSON de resultados SOC.");
  if (!input.length) throw new Error("O lote SOC está vazio.");
  if (input.length > SOC_EXAM_RESULTS_MAX_ROWS)
    throw new Error(`O lote excede ${SOC_EXAM_RESULTS_MAX_ROWS} registros.`);

  const normalized = input.map(normalizeRow);
  const seen = new Set<string>();
  const rows: SocExamResultRow[] = [];
  for (const row of normalized) {
    const key = canonical(row);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(row);
    }
  }
  return {
    rows,
    sourceRows: normalized.length,
    duplicates: normalized.length - rows.length,
  };
}

export function summarizeSocExamResults(rows: SocExamResultRow[], sourceRows: number, duplicates: number) {
  const companies = [...new Set(rows.map((row) => `${row.EMPRESA}|${row.NOMEEMPRESA}`))].sort();
  return {
    sourceRows,
    uniqueRows: rows.length,
    duplicates,
    companies: companies.length,
    realized: rows.filter((row) => row.derivedStatus === "REALIZADO").length,
    absences: rows.filter((row) => row.derivedStatus === "FALTA_AUSENCIA").length,
    altered: rows.filter((row) => row.EXAMEALTERADO === "1").length,
    missingProvider: rows.filter((row) => !row.CODIGOPRESTADOR || row.CODIGOPRESTADOR === "0").length,
    reconciliationRequired: true,
  };
}

export function hashSocExamResults(rows: SocExamResultRow[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
