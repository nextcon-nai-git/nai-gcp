import officialTables from "./esocial-official-tables.json";

/** Official S-1.3 tables, NT 07/2026 rev. 20/10/2026. Provenance and hashes:
 * assets/esocial/s-1.3-20261026/provenance.json. No clinical prescription is inferred. */
export type EsocialTableCode = keyof typeof officialTables;
export interface EsocialCodeOption {
  value: string;
  label: string;
  validFrom?: string;
  validTo?: string;
}
export const ESOCIAL_OFFICIAL_TABLES = officialTables as Record<
  EsocialTableCode,
  EsocialCodeOption[]
>;
export const ESOCIAL_TP_ASO = [
  { value: 0, label: "Admissional" },
  { value: 1, label: "Periódico" },
  { value: 2, label: "Retorno ao trabalho" },
  { value: 3, label: "Mudança de risco ocupacional" },
  { value: 4, label: "Monitoração pontual" },
  { value: 9, label: "Demissional" },
] as const;
export const ESOCIAL_RES_ASO = [
  { value: 1, label: "Apto" },
  { value: 2, label: "Inapto" },
] as const;
export const ESOCIAL_IND_RESULT = [
  { value: 1, label: "Normal" },
  { value: 2, label: "Alterado" },
  { value: 3, label: "Estável" },
  { value: 4, label: "Agravamento" },
] as const;
export const ESOCIAL_PROCEDURES = ESOCIAL_OFFICIAL_TABLES["27"];
export const ESOCIAL_RISK_AGENTS = ESOCIAL_OFFICIAL_TABLES["24"];

/** Codes 46–53 belong to the December package, even where a legal start predates it. */
export function isEsocialTableCode(table: EsocialTableCode, code: string, at?: string): boolean {
  if (table === "18" && Number(code) >= 46) return false;
  return ESOCIAL_OFFICIAL_TABLES[table].some(
    (entry) =>
      entry.value === code &&
      (!at ||
        ((!entry.validFrom || at >= entry.validFrom) && (!entry.validTo || at <= entry.validTo)))
  );
}
export function esocialTableOptions(
  table: EsocialTableCode,
  at = "2026-10-26"
): EsocialCodeOption[] {
  const entries = ESOCIAL_OFFICIAL_TABLES[table].filter(
    (entry) =>
      isEsocialTableCode(table, entry.value, at) &&
      (!entry.validFrom || at >= entry.validFrom) &&
      (!entry.validTo || at <= entry.validTo)
  );
  return [...new Map(entries.map((entry) => [entry.value, entry])).values()];
}
export function getLabelByCode(
  list: readonly { value: number | string; label: string }[],
  code: number | string
) {
  return list.find((item) => item.value === code)?.label || "Não informado";
}
