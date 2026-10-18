import Papa from "papaparse";
import { socExamSummarySchema, type SocExamSummary } from "./soc-dashboard";

export const SOC_CONVOCATION_MAX_BYTES = 16 * 1024 * 1024;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
const columns = [
  "CNPJ DA UNIDADE",
  "Apelido da Empresa",
  "UNIDADE",
  "Exame",
  "Refazer em",
  "Código Funcionario",
  "Situação",
];
function day(value: string): string | null {
  if (!value.trim()) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw Error("Data inválida em Refazer em. Use o CSV original do SOC.");
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso)
    throw Error("Data inexistente em Refazer em.");
  return iso;
}
/** Only aggregated operational counts leave this local parser. No names or clinical results. */
export function importSocConvocation(
  csv: string,
  company: { id: string; name: string },
  referenceDate: string,
  dueSoonEnd: string,
  importedAt: string,
  portfolio: readonly { id: string; name: string }[]
): SocExamSummary {
  const matches = portfolio.filter((c) => normalize(c.name) === normalize(company.name));
  if (matches.length !== 1 || matches[0].id !== company.id)
    throw Error(
      "Apelido de empresa ausente ou repetido na carteira. Este layout não contém código SOC único; confirme a identificação na origem antes de importar."
    );
  if (new TextEncoder().encode(csv).length > SOC_CONVOCATION_MAX_BYTES)
    throw Error("CSV acima de 16 MB. Divida a exportação por empresa.");
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (
    parsed.errors.length ||
    Object.keys(parsed.meta.renamedHeaders || {}).length > 0 ||
    !columns.every((c) => parsed.meta.fields?.includes(c)) ||
    new Set(parsed.meta.fields).size !== parsed.meta.fields?.length
  )
    throw Error("Layout inválido. Exporte Convocação de Exames com as colunas originais do SOC.");
  if (!parsed.data.length || parsed.data.length > 20000)
    throw Error(
      "O CSV deve conter entre 1 e 20.000 linhas. Arquivo vazio não comprova ausência de pendências."
    );
  const summary = {
    companyId: company.id,
    importedAt,
    referenceDate,
    dueSoonEnd,
    source: "SOC · Convocação de Exames CSV" as const,
    total: 0,
    overdue: 0,
    dueSoon: 0,
    later: 0,
    unknown: 0,
    excludedInactive: 0,
    duplicates: 0,
  };
  const seen = new Map<string, string>();
  for (const row of parsed.data) {
    if (normalize(row["Apelido da Empresa"] || "") !== normalize(company.name))
      throw Error(
        "A empresa do CSV não corresponde à empresa selecionada. Confira o código SOC e o apelido cadastrado antes de importar."
      );
    const state = normalize(row["Situação"] || "");
    // Do not silently classify unknown statuses as active or inactive.
    if (!["ativo", "inativo", "demitido", "afastado", "ferias", "pendente"].includes(state))
      throw Error("Situação cadastral desconhecida no CSV. Confira o relatório antes de importar.");
    if (state !== "ativo") {
      summary.excludedInactive++;
      continue;
    }
    const employee = (row["Código Funcionario"] || "").trim();
    const exam = normalize(row.Exame || "");
    const unit = (row["CNPJ DA UNIDADE"] || "").replace(/\D/g, "") || normalize(row.UNIDADE || "");
    if (!/^\d{1,20}$/.test(employee) || !exam || !unit)
      throw Error(
        "Há linhas sem código de funcionário, unidade ou exame. Corrija a origem antes de importar."
      );
    const due = day(row["Refazer em"] || "");
    const key = JSON.stringify([employee, unit, exam]);
    if (seen.has(key)) {
      if (seen.get(key) !== (due || ""))
        throw Error(
          "O mesmo vínculo e exame tem datas divergentes. Confira o SOC; nenhuma linha foi publicada."
        );
      summary.duplicates++;
      continue;
    }
    seen.set(key, due || "");
    summary.total++;
    if (!due) summary.unknown++;
    else if (due < referenceDate) summary.overdue++;
    else if (due <= dueSoonEnd) summary.dueSoon++;
    else summary.later++;
  }
  return socExamSummarySchema.parse(summary);
}
