import Papa from "papaparse";

export const CONVOCATION_MAX_BYTES = 4_000_000;
export const convocationFields = [
  "CNPJ DA UNIDADE",
  "Apelido da Empresa",
  "UNIDADE",
  "SETOR",
  "CARGO",
  "Nome",
  "Dt.Admissão",
  "Exame",
  "Último Pedido",
  "Data Resultado",
  "Periodicidade",
  "Refazer em",
  "Código Funcionario",
  "Data Último Agendamento (Pedido de Exames)",
  "Situação",
  "Origem",
  "Data do Último Agendamento",
] as const;
export type ConvocationRow = Record<(typeof convocationFields)[number], string>;
export function socDay(value: string): string | null {
  if (!value.trim()) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) throw Error("Data inválida no CSV. Use DD/MM/AAAA.");
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso)
    throw Error("Data inválida no CSV.");
  return iso;
}
export const convocationKey = (r: ConvocationRow) =>
  JSON.stringify([r["CNPJ DA UNIDADE"].replace(/\D/g, ""), r["Código Funcionario"], r.Exame]);
export function parseConvocations(csv: string): ConvocationRow[] {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (
    parsed.errors.length ||
    !parsed.meta.fields ||
    convocationFields.some((f) => !parsed.meta.fields!.includes(f)) ||
    parsed.meta.fields.length !== convocationFields.length
  )
    throw Error("Layout inválido. Envie o CSV Convocação de Exames com as 17 colunas originais.");
  if (!parsed.data.length || parsed.data.length > 15_000)
    throw Error("Envie entre 1 e 15.000 registros.");
  return parsed.data.map((row) => {
    const clean = Object.fromEntries(
      convocationFields.map((f) => [f, (row[f] || "").trim()])
    ) as ConvocationRow;
    if (
      Object.values(clean).some((v) => v.length > 300) ||
      !/^\d{1,20}$/.test(clean["Código Funcionario"]) ||
      clean["CNPJ DA UNIDADE"].replace(/\D/g, "").length !== 14 ||
      !clean.Nome ||
      !clean.UNIDADE ||
      !clean.Exame
    )
      throw Error("Registro sem código SOC, CNPJ da unidade, nome, unidade ou exame válido.");
    for (const f of [
      "Dt.Admissão",
      "Último Pedido",
      "Data Resultado",
      "Refazer em",
      "Data Último Agendamento (Pedido de Exames)",
      "Data do Último Agendamento",
    ] as const)
      socDay(clean[f]);
    return clean;
  });
}
export function convocationStatus(r: ConvocationRow, today: string) {
  const due = socDay(r["Refazer em"]);
  if (!due) return "Sem vencimento informado";
  if (due < today) return "Vencido na fonte";
  const limit = new Date(`${today}T12:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  return due <= limit.toISOString().slice(0, 10) ? "Vence em até 30 dias" : "Vencimento posterior";
}
export function summarizeConvocations(rows: ConvocationRow[], today: string) {
  const keys = new Map<string, number>();
  rows.forEach((r) => keys.set(convocationKey(r), (keys.get(convocationKey(r)) || 0) + 1));
  return {
    rows: rows.length,
    uniqueEmployeeExamKeys: keys.size,
    employees: new Set(rows.map((r) => r["Código Funcionario"])).size,
    units: new Set(rows.map((r) => r.UNIDADE)).size,
    cnpjs: new Set(rows.map((r) => r["CNPJ DA UNIDADE"].replace(/\D/g, ""))).size,
    repeatedKeys: [...keys.values()].filter((n) => n > 1).length,
    extraRowsForRepeatedKeys: rows.length - keys.size,
    withResultDate: rows.filter((r) => r["Data Resultado"]).length,
    withoutDueDate: rows.filter((r) => !r["Refazer em"]).length,
    overdue: rows.filter((r) => convocationStatus(r, today) === "Vencido na fonte").length,
    dueSoon: rows.filter((r) => convocationStatus(r, today) === "Vence em até 30 dias").length,
  };
}
