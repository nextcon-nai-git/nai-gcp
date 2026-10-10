import { z } from "zod";

export const BalanceRowSchema = z.object({
  label: z.string().min(1).max(500),
  openingCents: z.number().int().safe(),
  closingCents: z.number().int().safe(),
  page: z.number().int().positive(),
});
export const BalanceSchema = z.object({
  company: z.string().min(1).max(200),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(BalanceRowSchema).min(3).max(2000),
});
export type Balance = z.infer<typeof BalanceSchema>;
export type SavedBalance = Balance & {
  id: string;
  sourceName: string;
  importedAt: string;
  importedBy: string;
};
export type BalanceSummary = Omit<SavedBalance, "rows">;
export type BalanceTextItem = { text: string; x: number; y: number };
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const amountPattern = /^R\$\s*(\(?[\d.]+,\d{2}\)?)$/;
export function balanceMoney(value: string): number {
  const match = value.trim().match(amountPattern);
  if (!match || match[1].startsWith("(") !== match[1].endsWith(")"))
    throw new Error("Valor monetário inválido.");
  const negative = match[1].startsWith("(");
  const cents = Number(match[1].replace(/[().,]/g, "")) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(cents)) throw new Error("Valor fora do limite seguro.");
  return cents;
}

export function balanceTotals(balance: Balance) {
  const find = (label: string) => {
    const matches = balance.rows.filter((row) => normalized(row.label) === label);
    if (matches.length !== 1) throw new Error(`Total ${label} ausente ou duplicado no PDF.`);
    return matches[0];
  };
  const assets = find("ATIVO");
  // SPED labels the complete liabilities + equity side as PASSIVO.
  const total = find("PASSIVO");
  const equity = find("PATRIMONIO LIQUIDO");
  return { assets, total, equity, liabilitiesCents: total.closingCents - equity.closingCents };
}

/** Supported layout: SPED balance with Descrição, Saldo Inicial and Saldo Final columns. */
export function parseBalancePages(pages: BalanceTextItem[][]): Balance {
  if (!pages.length || pages.length > 20) throw new Error("Use um balanço SPED de até 20 páginas.");
  const first = pages[0].filter((item) => item.text.trim());
  const text = first.map((item) => item.text).join(" ");
  if (!normalized(text).includes("BALANCO PATRIMONIAL"))
    throw new Error("O documento não é um Balanço Patrimonial SPED.");
  const entityLabel = first.find((item) => normalized(item.text) === "ENTIDADE:");
  const company =
    entityLabel &&
    first
      .filter((item) => item.x > entityLabel.x + 50 && Math.abs(item.y - entityLabel.y) < 3)
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" ")
      .trim();
  const cnpj = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0];
  const dates = text.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  if (!company || !cnpj || !dates)
    throw new Error("Empresa, CNPJ ou período não foram identificados no PDF.");
  const date = (s: string) => s.split("/").reverse().join("-");
  const periodStart = date(dates[1]),
    periodEnd = date(dates[2]);
  for (const value of [periodStart, periodEnd]) {
    const d = new Date(value + "T12:00:00Z");
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
      throw new Error("Período inválido no PDF.");
  }
  if (periodStart > periodEnd) throw new Error("Período invertido no PDF.");
  const rows: Balance["rows"] = [];
  pages.forEach((items, pageIndex) => {
    const clean = items.filter((item) => item.text.trim());
    const opening = clean.find((item) => normalized(item.text) === "SALDO INICIAL");
    const closing = clean.find((item) => normalized(item.text) === "SALDO FINAL");
    if (!opening || !closing || closing.x <= opening.x)
      throw new Error(
        "Layout não reconhecido: use o PDF textual do Balanço SPED com saldos inicial e final."
      );
    const values = clean.filter(
      (item) => amountPattern.test(item.text.trim()) && item.y < opening.y - 3
    );
    const groups: { y: number; values: BalanceTextItem[] }[] = [];
    for (const item of [...values].sort((a, b) => b.y - a.y)) {
      const group = groups.find((g) => Math.abs(g.y - item.y) < 3);
      if (group) group.values.push(item);
      else groups.push({ y: item.y, values: [item] });
    }
    if (!groups.length) throw new Error("Nenhum saldo legível encontrado nesta página.");
    groups.forEach((group, index) => {
      const pair = [...group.values].sort((a, b) => a.x - b.x);
      if (
        pair.length !== 2 ||
        pair[0].x >= closing.x ||
        pair[1].x < closing.x ||
        pair[0].x < opening.x - 25
      )
        throw new Error("Colunas de valores inconsistentes no PDF.");
      const top = index === 0 ? opening.y - 3 : (groups[index - 1].y + group.y) / 2;
      const bottom =
        index === groups.length - 1 ? group.y - 12 : (groups[index + 1].y + group.y) / 2;
      const label = clean
        .filter((item) => item.x < opening.x - 30 && item.y < top && item.y >= bottom)
        .sort((a, b) => (Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x))
        .map((item) => item.text.trim())
        .join(" ");
      if (!label) throw new Error("Conta sem descrição no PDF.");
      rows.push({
        label,
        openingCents: balanceMoney(pair[0].text),
        closingCents: balanceMoney(pair[1].text),
        page: pageIndex + 1,
      });
    });
  });
  const balance = BalanceSchema.parse({ company, cnpj, periodStart, periodEnd, rows });
  const { assets, total } = balanceTotals(balance);
  if (assets.openingCents !== total.openingCents || assets.closingCents !== total.closingCents)
    throw new Error("Ativo e Passivo total não conferem. Confira o PDF antes de importar.");
  return balance;
}
