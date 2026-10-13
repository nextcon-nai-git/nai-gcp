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
  nfseData?: any;
  boletoData?: any;
  financialHistory?: any;
}

/**
 * Compatibility boundary for the provider screen's former local fallback.
 *
 * An empty, loading or unavailable database is not evidence of a provider's
 * identity, registration, contract, company scope, location or assessment.
 * Never substitute embedded records or inferred defaults for persisted data.
 * This function does not read, delete or rewrite existing database records.
 *
 * @deprecated Read providers from the authenticated, authorized data source.
 */
export function getConsolidatedProviders(): ConsolidatedProvider[] {
  return [];
}
