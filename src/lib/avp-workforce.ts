import { normalizeCnpj } from "./cnpj";

export const ASSOBES_SOC_COMPANY = "2306171";

// Companies observed in the NAI portfolio on 20/11/2026. Unit codes come from docs/soc-integration.md.
// Names are not identifiers. Unit 246 has no confirmed institution.
const institutionUnits: Record<string, readonly string[]> = {
  "01711282003202": Array.from({ length: 32 }, (_, i) => String(i + 2)), // ASSOBES
  "02843943000101": ["286", "300"], // CEUDESP
  "03729627000257": ["245"], // ASCEC
  "11888849001484": ["243"], // ASPER
  "11870359000640": ["293"], // APESU
  "11648433000417": ["306"], // AESPI
  "11918109000803": ["251"], // AESA
  "31300858000286": ["147"], // AVIES
  "03995468000666": ["250", "304"], // AESMS
};
export const knownAvpUnits = new Set(Object.values(institutionUnits).flat());

export type AvpUnitLink = { units: readonly string[]; conflict: boolean };
export function avpUnitLink(id: string, record: Record<string, unknown>): AvpUnitLink | undefined {
  const cnpj = typeof record.cnpj === "string" ? normalizeCnpj(record.cnpj) : "";
  const byId = Object.hasOwn(institutionUnits, id) ? institutionUnits[id] : undefined;
  const byCnpj = Object.hasOwn(institutionUnits, cnpj) ? institutionUnits[cnpj] : undefined;
  const socCodes = [record.socCompanyId, record.socCode]
    .filter((value) => value != null && value !== "")
    .map(String);
  if (!byId && !byCnpj && !socCodes.includes(ASSOBES_SOC_COMPANY)) return;
  return {
    units: byId || byCnpj || [],
    conflict:
      (!!cnpj && !!byId && id !== cnpj) ||
      (!!byCnpj && /^\d{14}$/.test(id) && id !== cnpj) ||
      socCodes.some((code) => code !== ASSOBES_SOC_COMPANY),
  };
}

export type AvpRosterReading = {
  checkedAt: string;
  records: number;
  active: number;
  other: number;
  unknown: number;
  observedUnits: string[];
  unmappedUnitRecords: number;
};

type HistoricalReference = { records: number; observedOn: string };
export type AvpWorkforce = { historical: HistoricalReference } & (
  | { source: "connector" | "cache"; reading: AvpRosterReading; issue: null }
  | { source: "manual"; reading: null; issue: "configuration" | "provider" | "integrity" }
);

export const activeWorkforceLabel = "Vínculos ativos confirmados no SOC";
export const historicalWorkforceLabel = "Registros históricos da ASSOBES";
export const workforceIssue = {
  configuration: "Configuração pendente",
  provider: "Falha na consulta SOC",
  integrity: "Resposta SOC inconsistente (layout, empresa ou códigos de vínculo)",
};

export function confirmedActive(reading: AvpRosterReading | null | undefined) {
  return !reading || (reading.unknown > 0 && reading.active === 0) ? null : reading.active;
}

export function rosterOrigin(roster: AvpWorkforce) {
  if (roster.source === "manual") return "Referência histórica";
  return roster.source === "cache" ? "Consulta SOC em cache" : "Consulta SOC";
}
