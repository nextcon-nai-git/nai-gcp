import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Data inválida");
export const LedgerRowSchema = z.object({
  id: z.string().min(1).max(80),
  date,
  account: z
    .string()
    .regex(/^\d+(\.\d+)+$/)
    .max(60),
  accountName: z.string().min(1).max(300),
  costCenter: z.string().max(300),
  history: z.string().max(4000),
  entry: z.string().regex(/^\d+$/).max(50),
  amountCents: z.number().int().nonnegative().max(1e12),
  side: z.enum(["D", "C"]),
  page: z.number().int().min(1).max(3000),
  endPage: z.number().int().min(1).max(3000),
});
export const LedgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    company: z.string().min(1).max(200),
    cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
    periodStart: date,
    periodEnd: date,
    bookNumber: z.string().min(1).max(20),
    sourceName: z.string().min(1).max(240),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    pageCount: z.number().int().min(1).max(3000),
    rows: z.array(LedgerRowSchema).min(1).max(30000),
  })
  .superRefine((book, ctx) => {
    const ids = new Set<string>();
    let total = 0;
    if (book.periodStart > book.periodEnd)
      ctx.addIssue({ code: "custom", message: "Período invertido" });
    for (const row of book.rows) {
      total += row.amountCents;
      if (
        ids.has(row.id) ||
        row.date < book.periodStart ||
        row.date > book.periodEnd ||
        row.page > book.pageCount ||
        row.endPage < row.page ||
        row.endPage > book.pageCount
      ) {
        ctx.addIssue({ code: "custom", message: "ID duplicado, data ou página fora do livro" });
        break;
      }
      ids.add(row.id);
    }
    if (!Number.isSafeInteger(total))
      ctx.addIssue({ code: "custom", message: "Total fora do limite seguro" });
  });
export type LedgerRow = z.infer<typeof LedgerRowSchema>;
export type LedgerBook = z.infer<typeof LedgerSchema>;
export type SavedLedger = LedgerBook & { id: string; importedAt: string; importedBy: string };
export type LedgerSummary = Omit<SavedLedger, "rows"> & {
  rowCount: number;
  entryCount: number;
  debit: number;
  credit: number;
  unbalanced: number;
};
export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dayLabel = (s: string) => s.split("-").reverse().join("/");
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const entryKey = (r: LedgerRow) => `${r.date}|${r.entry}`;

export function summarizeLedger(rows: LedgerRow[]) {
  let debit = 0,
    credit = 0;
  const entries = new Map<
    string,
    { key: string; date: string; entry: string; debit: number; credit: number; rows: LedgerRow[] }
  >();
  const monthly = new Map<
    string,
    { month: string; debit: number; credit: number; count: number }
  >();
  const accounts = new Map<
    string,
    { account: string; name: string; debit: number; credit: number; count: number }
  >();
  for (const r of rows) {
    if (r.side === "D") debit += r.amountCents;
    else credit += r.amountCents;
    const key = entryKey(r);
    const e = entries.get(key) || {
      key,
      date: r.date,
      entry: r.entry,
      debit: 0,
      credit: 0,
      rows: [],
    };
    e[r.side === "D" ? "debit" : "credit"] += r.amountCents;
    e.rows.push(r);
    entries.set(key, e);
    const month = r.date.slice(0, 7);
    const m = monthly.get(month) || { month, debit: 0, credit: 0, count: 0 };
    m[r.side === "D" ? "debit" : "credit"] += r.amountCents;
    m.count++;
    monthly.set(month, m);
    const a = accounts.get(r.account) || {
      account: r.account,
      name: r.accountName,
      debit: 0,
      credit: 0,
      count: 0,
    };
    a[r.side === "D" ? "debit" : "credit"] += r.amountCents;
    a.count++;
    accounts.set(r.account, a);
  }
  return {
    debit,
    credit,
    rowCount: rows.length,
    entryCount: entries.size,
    entries: [...entries.values()],
    unbalanced: [...entries.values()].filter((e) => e.debit !== e.credit),
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    accounts: [...accounts.values()].sort((a, b) => b.debit + b.credit - a.debit - a.credit),
  };
}
export type LedgerFilters = {
  query: string;
  month: string;
  account: string;
  side: string;
  group: string;
  min: string;
  start: string;
  end: string;
};
export const emptyFilters: LedgerFilters = {
  query: "",
  month: "all",
  account: "all",
  side: "all",
  group: "all",
  min: "",
  start: "",
  end: "",
};
export function filterLedger(rows: LedgerRow[], f: LedgerFilters) {
  const terms = fold(f.query).trim().split(/\s+/).filter(Boolean);
  const min = Math.round(Number(f.min.replace(",", ".")) * 100);
  return rows.filter(
    (r) =>
      (f.month === "all" || r.date.startsWith(f.month)) &&
      (f.account === "all" || r.account === f.account) &&
      (f.side === "all" || r.side === f.side) &&
      (f.group === "all" || r.account.startsWith(f.group + ".")) &&
      (!f.start || r.date >= f.start) &&
      (!f.end || r.date <= f.end) &&
      (!f.min || r.amountCents >= min) &&
      terms.every((t) =>
        fold(`${r.history} ${r.accountName} ${r.account} ${r.entry} ${r.costCenter}`).includes(t)
      )
  );
}
export function ledgerCsv(rows: LedgerRow[]) {
  const cell = (s: string | number) =>
    `"${String(s)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replace(/"/g, '""')}"`;
  const header = [
    "Data",
    "Lançamento",
    "Conta",
    "Nome da conta",
    "Centro de custo",
    "Histórico",
    "Débito (R$)",
    "Crédito (R$)",
    "Página inicial",
    "Página final",
  ];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((r) => [
        dayLabel(r.date),
        r.entry,
        r.account,
        r.accountName,
        r.costCenter,
        r.history,
        r.side === "D" ? (r.amountCents / 100).toFixed(2).replace(".", ",") : "",
        r.side === "C" ? (r.amountCents / 100).toFixed(2).replace(".", ",") : "",
        r.page,
        r.endPage,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}

export type CashMovement = {
  key: string;
  entry: string;
  date: string;
  amountCents: number;
  participant: string;
  history: string;
  category: string;
  page: number;
  identificationPending: boolean;
};
const isCash = (r: LedgerRow) => r.account.startsWith("1.1.01.");
const isClient = (r: LedgerRow) =>
  r.account.startsWith("1.1.02.") && /cliente|duplicata|receber/.test(fold(r.accountName));
function participant(history: string) {
  const name = history
    .replace(
      /^(PIX (RECEBIDO|ENVIADO)|PAGAMENTO DE BOLETO OUTROS BANCOS|PAGAMENTO DE BOLETO|TED RECEBIDA|TED ENVIADA)\s*/i,
      ""
    )
    .trim();
  const pending =
    !name ||
    /^\d[\d.\/-]*$/.test(name) ||
    /PAGFOR|LIQUIDACAO|LIQ COBRANCA|CR COB|DIFEREN TIT/i.test(name);
  return { participant: name || "Identificação não informada", identificationPending: pending };
}
/** Rebuild full entries before ranking. Bank D/C is cash movement; revenue provisions are not. */
export function rankCashMovements(book: LedgerBook, visibleKeys?: Set<string>) {
  const receipts: CashMovement[] = [],
    outflows: CashMovement[] = [];
  const review: Array<{ key: string; entry: string; reason: string }> = [];
  let internalTransfers = 0,
    otherReceipts = 0;
  const ownCnpj = book.cnpj.replace(/\D/g, "");
  for (const e of summarizeLedger(book.rows).entries) {
    if (visibleKeys && !visibleKeys.has(e.key)) continue;
    const bankRows = e.rows.filter(isCash);
    if (!bankRows.length) continue;
    if (e.debit !== e.credit) {
      review.push({
        key: e.key,
        entry: e.entry,
        reason: "Lançamento com débitos e créditos divergentes",
      });
      continue;
    }
    const delta = bankRows.reduce(
      (n, r) => n + (r.side === "D" ? r.amountCents : -r.amountCents),
      0
    );
    if (!delta) {
      internalTransfers++;
      continue;
    }
    const direction = delta > 0 ? "D" : "C";
    const movementRows = bankRows.filter((r) => r.side === direction);
    const history = [...new Set(movementRows.map((r) => r.history))].join(" · ");
    if (delta > 0) {
      const externalCredits = e.rows.filter((r) => !isCash(r) && r.side === "C");
      if (!externalCredits.some(isClient)) {
        otherReceipts++;
        continue;
      }
      if (externalCredits.some((r) => !isClient(r))) {
        review.push({
          key: e.key,
          entry: e.entry,
          reason:
            "Recebimento mistura clientes e outras contrapartidas; valor não atribuído automaticamente",
        });
        continue;
      }
      if (history.replace(/\D/g, "").includes(ownCnpj)) {
        review.push({
          key: e.key,
          entry: e.entry,
          reason: "Classificado em Clientes, mas o histórico informa o CNPJ da própria empresa",
        });
        continue;
      }
    }
    const counterparts = e.rows.filter((r) => !isCash(r) && r.side === (delta > 0 ? "C" : "D"));
    const supplier =
      counterparts.length > 0 &&
      counterparts.every((r) =>
        /fornecedor|servicos profissionais|honorarios|assessoria|consultoria|manutencao de sistemas/.test(
          fold(r.accountName)
        )
      );
    const category =
      delta > 0
        ? "Recebimento de clientes"
        : supplier
          ? "Fornecedores / prestadores"
          : [...new Set(counterparts.map((r) => r.accountName))].join(" · ") || "Outras saídas";
    const item: CashMovement = {
      key: e.key,
      entry: e.entry,
      date: e.date,
      amountCents: Math.abs(delta),
      ...participant(history),
      history,
      category,
      page: Math.min(...movementRows.map((r) => r.page)),
    };
    (delta > 0 ? receipts : outflows).push(item);
  }
  const order = (a: CashMovement, b: CashMovement) =>
    b.amountCents - a.amountCents || b.date.localeCompare(a.date) || a.entry.localeCompare(b.entry);
  return {
    receipts: receipts.sort(order),
    outflows: outflows.sort(order),
    review,
    internalTransfers,
    otherReceipts,
  };
}
