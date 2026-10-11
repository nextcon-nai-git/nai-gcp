import { z } from "zod";
import type { FinancialAction, FinancialActionImport } from "./actions";

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const date = z.string().refine(isCalendarDate, "Data inválida");
export const OmieDreQuerySchema = z
  .object({
    start: date,
    end: date,
    dateBasis: z.enum(["emission", "registration"]).default("emission"),
  })
  .strict()
  .superRefine((query, ctx) => {
    if (query.start > query.end)
      ctx.addIssue({ code: "custom", message: "A data inicial deve anteceder a final" });
    if (Date.parse(query.end) - Date.parse(query.start) > 366 * 86400000)
      ctx.addIssue({ code: "custom", message: "Consulte até 12 meses por vez" });
    if (query.start < "2000-01-01" || query.end > "2100-12-31")
      ctx.addIssue({ code: "custom", message: "Período fora do intervalo permitido" });
  });

export type OmieDreQuery = z.infer<typeof OmieDreQuerySchema>;
export type OmieDreRow = {
  id: string;
  date: string;
  type: string;
  group: string;
  account: string;
  category: string;
  amountCents: number;
  partyId: string;
  partyName: string;
  partyCnpj: string | null;
  identityStatus: "cnpj" | "person_hidden" | "name_only" | "unknown";
  city: string;
  state: string;
};
export type OmieDreCost = {
  id: string;
  name: string;
  cnpj: string | null;
  costCents: number;
  entries: number;
  categories: string[];
};
export type OmieDreSummary = {
  totalSignedCents: number;
  accounts: { key: string; type: string; group: string; account: string; amountCents: number }[];
  months: { month: string; amountCents: number }[];
  analysisPeriod: { start: string; end: string; label: string };
  engineering: OmieDreCost[];
  occupationalExams: OmieDreCost[];
  supplierCities: { city: string; state: string; costCents: number; entries: number }[];
  unclassifiedExpenseEntries: number;
  positiveExpenseEntries: number;
};
export type OmieDreReport = {
  schemaVersion: 1;
  query: OmieDreQuery;
  company: string;
  cnpj: string;
  queriedAt: string;
  sourceSha256: string;
  rows: OmieDreRow[];
  summary: OmieDreSummary;
  warnings: string[];
  suggestedActions: FinancialActionImport;
};

export function toOmieDate(value: string): string {
  if (!isCalendarDate(value)) throw new Error("Data inválida");
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function fromOmieDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const result = `${match[3]}-${match[2]}-${match[1]}`;
  return isCalendarDate(result) ? result : null;
}

export function previousClosedMonthQuery(now = new Date()): OmieDreQuery {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const end = new Date(Date.UTC(year, month - 1, 0));
  return {
    start: `${end.getUTCFullYear()}-01-01`,
    end: end.toISOString().slice(0, 10),
    dateBasis: "emission",
  };
}

function addCents(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result) || Math.abs(result) > 1e14)
    throw new Error("Valor financeiro fora do limite seguro");
  return result;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Only financial classification is used. A vendor name never determines its specialty. */
function expenseSegment(row: OmieDreRow): "engineering" | "exams" | "other" | null {
  const classification = normalize(`${row.type} ${row.group} ${row.account} ${row.category}`);
  if (!/\b(custos?|despesas?)\b|servicos? tomados?/.test(classification)) return null;
  // Department names and general SST costs are not proof of a professional service purchase.
  if (
    /folha|salarios?|remuneracao|pro[\s-]*labore|encargos|impostos?|tributos?|alugue|locacao|equipamentos?|materiais?|\bepis?\b|softwares?|licencas?|treinamentos?|uniformes?|medicamentos?/.test(
      classification
    )
  )
    return "other";
  const engineering = /engenharia|\bpgr\b|\bltcat\b|pericia tecnica/.test(classification);
  const exams = /exames?|\baso\b|audiometria|espirometria/.test(classification);
  if (engineering && !exams) return "engineering";
  if (exams && !engineering) return "exams";
  return "other";
}

export function summarizeOmieDre(rows: OmieDreRow[], query: OmieDreQuery): OmieDreSummary {
  const last = new Date(`${query.end}T12:00:00Z`);
  const threeMonthStart = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 2, 1))
    .toISOString()
    .slice(0, 10);
  const start = query.start > threeMonthStart ? query.start : threeMonthStart;
  const summary: OmieDreSummary = {
    totalSignedCents: 0,
    accounts: [],
    months: [],
    analysisPeriod: {
      start,
      end: query.end,
      label: `${toOmieDate(start)} a ${toOmieDate(query.end)}`,
    },
    engineering: [],
    occupationalExams: [],
    supplierCities: [],
    unclassifiedExpenseEntries: 0,
    positiveExpenseEntries: 0,
  };
  const accounts = new Map<string, OmieDreSummary["accounts"][number]>();
  const months = new Map<string, number>();
  const suppliers = new Map<string, OmieDreCost & { segment: "engineering" | "exams" }>();
  const cities = new Map<string, OmieDreSummary["supplierCities"][number]>();
  for (const row of rows) {
    summary.totalSignedCents = addCents(summary.totalSignedCents, row.amountCents);
    const accountKey = JSON.stringify([row.type, row.group, row.account]);
    const account = accounts.get(accountKey) || {
      key: accountKey,
      type: row.type,
      group: row.group,
      account: row.account,
      amountCents: 0,
    };
    account.amountCents = addCents(account.amountCents, row.amountCents);
    accounts.set(accountKey, account);
    const month = row.date.slice(0, 7);
    months.set(month, addCents(months.get(month) || 0, row.amountCents));
    if (row.date < start || row.date > query.end) continue;
    const segment = expenseSegment(row);
    if (!segment) continue;
    if (row.amountCents > 0) summary.positiveExpenseEntries++;
    if (segment === "other") {
      summary.unclassifiedExpenseEntries++;
      continue;
    }
    if (row.identityStatus === "unknown") {
      summary.unclassifiedExpenseEntries++;
      continue;
    }
    const key = `${segment}:${row.partyId}`;
    const cost = suppliers.get(key) || {
      id: row.partyId,
      name: row.partyName,
      cnpj: row.partyCnpj,
      segment,
      costCents: 0,
      entries: 0,
      categories: [],
    };
    // Preserve positive reversals. Only a negative net in an expense account becomes a cost.
    cost.costCents = addCents(cost.costCents, -row.amountCents);
    cost.entries++;
    if (!cost.categories.includes(row.category)) cost.categories.push(row.category);
    suppliers.set(key, cost);
    if (segment === "exams") {
      const cityKey = JSON.stringify([normalize(row.city.trim()), row.state.toUpperCase()]);
      const city = cities.get(cityKey) || {
        city: row.city || "Cidade não informada",
        state: row.state,
        costCents: 0,
        entries: 0,
      };
      city.costCents = addCents(city.costCents, -row.amountCents);
      city.entries++;
      cities.set(cityKey, city);
    }
  }
  summary.accounts = [...accounts.values()].sort((a, b) => a.key.localeCompare(b.key, "pt-BR"));
  summary.months = [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amountCents]) => ({
      month,
      amountCents,
    }));
  for (const { segment, ...cost } of suppliers.values()) {
    if (cost.costCents <= 0) continue;
    cost.categories.sort((a, b) => a.localeCompare(b, "pt-BR"));
    (segment === "engineering" ? summary.engineering : summary.occupationalExams).push(cost);
  }
  const compareCosts = (a: OmieDreCost, b: OmieDreCost) =>
    b.costCents - a.costCents || a.id.localeCompare(b.id);
  summary.engineering.sort(compareCosts);
  summary.occupationalExams.sort(compareCosts);
  summary.supplierCities = [...cities.values()]
    .filter((city) => city.costCents > 0)
    .sort((a, b) => b.costCents - a.costCents || a.city.localeCompare(b.city, "pt-BR"));
  return summary;
}

export function suggestOmieDreActions(
  report: Omit<OmieDreReport, "suggestedActions">
): FinancialActionImport {
  const basis = report.query.dateBasis === "emission" ? "emissão" : "registro";
  const evidence = {
    label: "Consulta DRE no Omie",
    detail: `Consulta por ${basis}: ${toOmieDate(report.query.start)} a ${toOmieDate(report.query.end)}. Fonte SHA-256 ${report.sourceSha256}. Conferir classificação, competência e NFs; cidade é a do cadastro do fornecedor.`,
    sourceSha256: report.sourceSha256,
    url: "/financial/omie/dre",
  };
  const checklist = (items: string[]) =>
    items.map((text, index) => ({ id: `c${index + 1}`, text, required: true, checked: false }));
  const actions: FinancialAction[] = [
    {
      key: "conciliar-dre",
      title: "Conferir o fechamento da DRE consultada",
      action: "Conciliar o relatório com a contabilidade e documentar os ajustes por competência.",
      rationale:
        "O Omie considera a base de datas escolhida e as categorias associadas a contas DRE. Isso exige verificar itens sem classificação, provisões e documentos emitidos após a prestação.",
      priority: "high",
      status: "proposed",
      suggestedOwner: "Financeiro / contabilidade",
      proposedDueDate: null,
      period: { start: report.query.start, end: report.query.end, label: `DRE por ${basis}` },
      checklist: checklist([
        "Conferir a base de datas e categorias sem vínculo à DRE no Omie.",
        "Conciliar receitas, custos, folha, tributos e provisões com o período de competência.",
        "Verificar sinais, estornos e duplicidades documentais sem excluir linhas por mera igualdade de valor.",
        "Registrar ajustes e a aprovação do responsável pelo fechamento.",
      ]),
      evidence: [evidence],
      baseAmountCents: null,
      estimatedSavingsCents: null,
      caveat:
        "A consulta não é uma auditoria ou aprovação contábil. Nenhum lançamento foi alterado no Omie.",
    },
  ];
  for (const [segment, costs] of [
    ["engenharia", report.summary.engineering],
    ["exames", report.summary.occupationalExams],
  ] as const) {
    for (const [index, cost] of costs.slice(0, 3).entries()) {
      actions.push({
        key: `negociar-${segment}-${index + 1}`,
        title: `Revisar ${segment}: ${cost.name}`.slice(0, 180),
        action: `Conferir escopo, volume e NFs de ${cost.name}; obter propostas equivalentes e negociar preço por entrega, prazo e condições de pagamento.`,
        rationale: `Fornecedor entre os maiores valores líquidos classificados em ${segment} no período ${report.summary.analysisPeriod.label}. Categorias: ${cost.categories
          .slice(0, 6)
          .map((category) => category.slice(0, 180))
          .join(
            ", "
          )}${cost.categories.length > 6 ? `; mais ${cost.categories.length - 6} categorias no relatório` : ""}.`,
        priority: index === 0 ? "high" : "medium",
        status: "proposed",
        suggestedOwner:
          segment === "engenharia"
            ? "Compras / Engenharia de Segurança"
            : "Credenciamento / Médico do Trabalho",
        proposedDueDate: null,
        period: report.summary.analysisPeriod,
        checklist: checklist([
          "Confirmar CNPJ, NFs e o serviço efetivamente prestado.",
          "Levantar quantidade, preço unitário, qualidade, prazo e retrabalho no mesmo escopo.",
          segment === "exames"
            ? "Confirmar a unidade executante, cidade e tipo de exame antes de comparar clínicas."
            : "Separar visitas, laudos, deslocamento e serviços adicionais para comparar propostas.",
          "Obter propostas comparáveis e aprovar a nova condição antes de mudar o fornecedor.",
          "Registrar economia efetiva pelo mesmo volume e escopo, após implantação.",
        ]),
        evidence: [
          {
            ...evidence,
            detail: `${evidence.detail} CNPJ: ${cost.cnpj || "não informado ou pessoa física minimizada"}. ${cost.entries} lançamentos na classificação; quantidade de exames/entregas não informada.`,
          },
        ],
        baseAmountCents: cost.costCents,
        estimatedSavingsCents: null,
        estimateBasis:
          "Valor líquido dos lançamentos nas contas de custo/despesa identificadas, com estornos compensados e sinais originais preservados. Não é economia nem quantidade de exames.",
        caveat:
          "Classificação financeira deve ser conferida nas NFs. Nome do fornecedor não foi usado para inferir a especialidade. Não há cotação ou economia garantida.",
      });
    }
  }
  if (report.summary.unclassifiedExpenseEntries || report.summary.positiveExpenseEntries) {
    actions.push({
      key: "conferir-classificacoes",
      title: "Conferir categorias e sinais antes de fechar o ranking de custos",
      action:
        "Revisar despesas sem especialidade inequívoca e valores positivos em contas de custo/despesa. Separar engenharia, exames e outros serviços pelas NFs.",
      rationale: `${report.summary.unclassifiedExpenseEntries} lançamentos de despesas precisam de classificação/identidade. Há ${report.summary.positiveExpenseEntries} valores positivos em contas de despesa, que podem ser estornos ou uma convenção de sinais diferente.`,
      priority: "high",
      status: "proposed",
      suggestedOwner: "Financeiro / contabilidade",
      proposedDueDate: null,
      period: report.summary.analysisPeriod,
      checklist: checklist([
        "Confirmar a convenção de sinais do relatório e conciliar os estornos.",
        "Vincular cada despesa à NF, CNPJ e categoria apropriada.",
        "Consultar novamente a DRE e conferir os totais antes de negociar com base no ranking.",
      ]),
      evidence: [evidence],
      baseAmountCents: null,
      estimatedSavingsCents: null,
      caveat:
        "Despesa sem classificação confirmada não foi atribuída automaticamente a engenharia ou exames.",
    });
  }
  return {
    schemaVersion: 1,
    idempotencyKey: `omie-dre-v1:${report.sourceSha256}`,
    title: `Ações da DRE Omie — ${toOmieDate(report.query.start)} a ${toOmieDate(report.query.end)}`,
    actions,
  };
}

export function exportOmieDreCsv(report: OmieDreReport): string {
  // Spreadsheet formula injection applies to every untrusted text cell, including after whitespace.
  const cell = (value: string) => {
    const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    const safe = /^[\s]*[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = [
    "Data",
    "Tipo DRE",
    "Grupo",
    "Conta",
    "Categoria",
    "Fornecedor",
    "CNPJ",
    "Cidade cadastral",
    "UF",
    "Valor BRL",
    "Base de data",
    "Período inicial",
    "Período final",
    "Consultado em",
    "SHA256 fonte",
  ];
  const records = report.rows.map((row) =>
    [
      ...[
        row.date,
        row.type,
        row.group,
        row.account,
        row.category,
        row.partyName,
        row.partyCnpj || "",
        row.city,
        row.state,
      ].map(cell),
      (row.amountCents / 100).toFixed(2).replace(".", ","),
      ...[
        report.query.dateBasis === "emission" ? "Emissão" : "Registro",
        report.query.start,
        report.query.end,
        report.queriedAt,
        report.sourceSha256,
      ].map(cell),
    ].join(";")
  );
  return "\uFEFF" + [header.map(cell).join(";"), ...records].join("\r\n");
}
