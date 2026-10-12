import { outstanding, settlementCash, sumCents, type FinanceBook } from "./operations";
import { isCalendarDate } from "./omie-dre";

/** Current residual snapshot, not a retroactive balance. Dates are UTC calendar dates only. */
export function erpReports(book: FinanceBook, month: string, today: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !isCalendarDate(today))
    throw new Error("Período inválido.");
  const approved = book.titles.filter((t) => t.status === "approved");
  const aging = [
    "A vencer",
    "Vence hoje",
    "1–30 dias",
    "31–60 dias",
    "61–90 dias",
    "Mais de 90 dias",
  ].map((label) => ({ label, receivable: 0, payable: 0, count: 0 }));
  const receivables = approved
    .filter((t) => t.kind === "receivable" && outstanding(book, t) > 0)
    .map((t) => {
      const followUp = book.erp.followUps
        .filter((f) => f.titleId === t.id)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            book.erp.followUps.indexOf(b) - book.erp.followUps.indexOf(a)
        )[0];
      return { ...t, residual: outstanding(book, t), followUp };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const t of approved) {
    const residual = outstanding(book, t);
    if (residual <= 0) continue;
    const days = Math.round(
      (Date.parse(today + "T00:00:00Z") - Date.parse(t.dueDate + "T00:00:00Z")) / 86400000
    );
    const index =
      days < 0 ? 0 : days === 0 ? 1 : days <= 30 ? 2 : days <= 60 ? 3 : days <= 90 ? 4 : 5;
    aging[index][t.kind] = sumCents([aging[index][t.kind], residual]);
    aging[index].count++;
  }
  const result = new Map<
    string,
    { kind: string; category: string; revenue: number; expense: number }
  >();
  for (const t of approved.filter((t) => t.competence === month)) {
    const key = `${t.kind}:${t.category}`;
    const row = result.get(key) || { kind: t.kind, category: t.category, revenue: 0, expense: 0 };
    const side = t.kind === "receivable" ? "revenue" : "expense";
    row[side] = sumCents([row[side], t.amountCents]);
    result.set(key, row);
  }
  const cash = new Map<string, { date: string; in: number; out: number }>();
  for (const s of book.settlements.filter((s) => !s.reversed && s.date.startsWith(month))) {
    const title = book.titles.find((t) => t.id === s.titleId);
    if (!title) throw new Error("Baixa sem título de origem.");
    const row = cash.get(s.date) || { date: s.date, in: 0, out: 0 };
    const side = title.kind === "receivable" ? "in" : "out";
    row[side] = sumCents([row[side], settlementCash(s)]);
    cash.set(s.date, row);
  }
  return {
    aging,
    receivables,
    result: [...result.values()].sort((a, b) => a.category.localeCompare(b.category)),
    cash: [...cash.values()].sort((a, b) => a.date.localeCompare(b.date)),
    revenue: sumCents([...result.values()].map((r) => r.revenue)),
    expense: sumCents([...result.values()].map((r) => r.expense)),
  };
}
export function reportCsv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const raw = String(value);
            const safe = /^[\s]*[=+@-]/.test(raw) && typeof value === "string" ? `'${raw}` : raw;
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(";")
      )
      .join("\r\n")
  );
}
