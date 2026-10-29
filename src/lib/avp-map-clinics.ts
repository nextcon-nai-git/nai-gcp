import { parseBrlCents } from "./avp-costs";
import { normalizeAvpCity } from "./avp-verified-clinics";

export const AVP_MAP_CLINIC_TAB = "Mapa de Custos AVP";
export const AVP_MAP_CLINIC_HEADERS = [
  "ID",
  "Cidade",
  "UF",
  "Clínica",
  "Telefone",
  "Valor ASO",
  "Situação",
  "Condições",
  "Fonte",
  "Data da referência",
] as const;

export type AvpMapClinic = {
  id: string;
  cidade: string;
  uf: string;
  nome: string;
  telefone: string;
  cents: number | null;
  status: string;
  notes: string;
  source: string;
  date: string;
};

export const avpMapCityKey = (cidade: string, uf: string) =>
  `${normalizeAvpCity(cidade)}-${uf.trim().toUpperCase()}`;

export function readAvpMapClinics(values: unknown[][]): AvpMapClinic[] {
  if (values.length > 1001 || AVP_MAP_CLINIC_HEADERS.some((header, i) => values[0]?.[i] !== header))
    throw new Error("Confira a fonte do mapa de custos AVP.");
  const ids = new Set<string>();
  return values
    .slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row) => {
      const cells = AVP_MAP_CLINIC_HEADERS.map((_, i) => String(row[i] ?? "").trim());
      const [id, cidade, uf, nome, telefone, price, status, notes, source, date] = cells;
      if (!id || ids.has(id) || !cidade || !/^[A-Z]{2}$/.test(uf) || !nome)
        throw new Error("Clínica sem identificação única, cidade ou UF.");
      ids.add(id);
      const cents = parseBrlCents(price);
      return {
        id,
        cidade,
        uf,
        nome,
        telefone,
        cents: cents !== null && cents > 0 ? cents : null,
        status,
        notes,
        source,
        date,
      };
    });
}

export function avpMapClinicCost(clinics: AvpMapClinic[]) {
  const prices = clinics.map((clinic) => clinic.cents).filter((v): v is number => v !== null);
  return prices.length ? Math.max(...prices) : null;
}
