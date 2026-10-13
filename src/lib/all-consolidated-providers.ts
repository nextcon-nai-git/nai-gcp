export interface ConsolidatedProvider {
  id: string;
  name: string;
  displayName?: string;
  companyName?: string;
  cnpj: string;
  profession: string;
  councilNumber?: string;
  type:
    | "CLINIC"
    | "LAB"
    | "DOCTOR"
    | "HOSPITAL"
    | "NURSE"
    | "ENGINEER"
    | "TECH_NURSE"
    | "ACCOUNTANT"
    | "CONSULTANCY";
  specialty: string;
  cep?: string;
  city: string;
  state: string;
  address?: string;
  email?: string;
  phone?: string;
  active: boolean;
  rating?: number;
  contractUrl?: string;
  photoUrl?: string;
  councilCardUrl?: string;
  servedCompanies?: string[];
  category?: string;
  legacyId?: string;
  nfseData?: unknown;
  boletoData?: unknown;
  financialHistory?: unknown;
}

/**
 * Compatibility boundary for the former local provider fallback.
 * An unavailable or empty database is not evidence of an operational record.
 *
 * @deprecated Read providers from the authenticated, authorized data source.
 */
export function getConsolidatedProviders(): ConsolidatedProvider[] {
  return [];
}
