import type { GrupoAvpAso } from "./grupo-avp-asos-data";

/** A cotação deve representar um preço único. Texto com vários preços não vira média. */
export function parseBrlCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  const raw = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw) && !/^\d+\.\d{1,2}$/.test(raw))
    return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function avpCostSummary(asos: GrupoAvpAso[], revenueCents = 4000) {
  const costs = asos.map((a) => parseBrlCents(a.valorAso)).filter((v): v is number => v !== null);
  return {
    quoted: costs.length,
    missing: asos.length - costs.length,
    aboveTarget: costs.filter((v) => v > revenueCents).length,
    totalCostCents: costs.reduce((sum, v) => sum + v, 0),
    grossMarginCents: costs.reduce((sum, v) => sum + revenueCents - v, 0),
    maximumCostCents: costs.length ? Math.max(...costs) : null,
  };
}

export function formatBrlCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function avpElapsedDays(aso: GrupoAvpAso, now = new Date()) {
  const m = aso.dataPedido.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m || ["EXAME FEITO", "GESTOR CANCELOU", "DESISTIU DA VAGA"].includes(aso.status))
    return aso.diasParado;
  const start = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const date = new Date(start);
  if (
    date.getUTCFullYear() !== Number(m[3]) ||
    date.getUTCMonth() !== Number(m[2]) - 1 ||
    date.getUTCDate() !== Number(m[1])
  )
    return aso.diasParado;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.max(
    0,
    Math.floor((Date.UTC(part("year"), part("month") - 1, part("day")) - start) / 86400000)
  );
}
