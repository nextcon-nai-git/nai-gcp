import type { OmiePage } from "./omie";
import { isCalendarDate } from "./omie-dre";

export type Title = OmiePage["rows"][number];
export type Portfolio = {
  rows: Title[];
  total: number;
  complete: boolean;
  queriedAt: string;
  warning: string;
};
export function brazilToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now);
}
export function dueDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  return isCalendarDate(iso) ? iso : null;
}
export function daysUntil(value: string, today: string) {
  const date = dueDate(value);
  return date ? Math.round((Date.parse(date) - Date.parse(today)) / 86400000) : null;
}
export function amountCents(value: number) {
  const cents = Math.round(value * 100);
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(cents) ? cents : null;
}
export function summarizeTitles(rows: Title[], today: string) {
  const buckets = [
    { label: "Vencidos", min: -Infinity, max: -1, cents: 0, count: 0 },
    { label: "Hoje", min: 0, max: 0, cents: 0, count: 0 },
    { label: "1 a 7 dias", min: 1, max: 7, cents: 0, count: 0 },
    { label: "8 a 30 dias", min: 8, max: 30, cents: 0, count: 0 },
    { label: "Após 30 dias", min: 31, max: Infinity, cents: 0, count: 0 },
  ];
  let invalid = 0;
  for (const row of rows) {
    const days = daysUntil(row.dueDate, today);
    const cents = amountCents(row.amount);
    if (days === null || cents === null) {
      invalid++;
      continue;
    }
    const bucket = buckets.find((b) => days >= b.min && days <= b.max)!;
    bucket.cents += cents;
    bucket.count++;
  }
  return { buckets, invalid };
}

/** A changing/paginated source is never represented as a complete balance. */
export async function collectTitles(
  fetchPage: (page: number) => Promise<OmiePage>,
  progress: (loaded: number, total: number) => void,
  signal: AbortSignal,
  maxPages = 20
): Promise<Portfolio> {
  const rows: Title[] = [];
  const seen = new Set<string>();
  let total = 0,
    pages = 0,
    queriedAt = "",
    warning = "";
  for (let page = 1; page <= maxPages; page++) {
    signal.throwIfAborted();
    const result = await fetchPage(page);
    signal.throwIfAborted();
    if (page === 1) {
      total = result.total;
      pages = result.pages;
    }
    if (result.page !== page || result.total !== total || result.pages !== pages) {
      warning = "A carteira mudou durante a consulta. Atualize para conferir a cobertura.";
      break;
    }
    queriedAt = result.queriedAt;
    for (const row of result.rows) {
      if (seen.has(row.id)) {
        warning = "Títulos repetidos na paginação. Atualize a consulta.";
        continue;
      }
      seen.add(row.id);
      rows.push(row);
    }
    progress(rows.length, total);
    if (page >= pages) break;
  }
  const complete = !warning && rows.length === total && pages <= maxPages;
  if (!complete && !warning)
    warning =
      "Consulta parcial: limite de 1.000 títulos por carteira ou divergência de paginação. Consulte os demais títulos no Omie.";
  return { rows, total, complete, queriedAt, warning };
}

export function titlesCsv(rows: Title[], kind: string) {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      [
        "Tipo",
        "Título",
        "Documento",
        "Código cliente/fornecedor",
        "Vencimento",
        "Situação Omie",
        "Categoria",
        "Valor original (BRL)",
      ],
      ...rows.map((r) => [
        kind,
        r.id,
        r.document,
        r.partyCode,
        r.dueDate,
        r.status,
        r.category,
        r.amount.toFixed(2).replace(".", ","),
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
