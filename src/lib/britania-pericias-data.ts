export interface JudicialPericia {
  id: string;
  clientName: string;
  date: string;
  time: string;
  fullDateTime: string;
  provision: string;
  location: string;
  locationDetails?: string;
  googleMapsUrl?: string;
  medicalExpert: string; // Perito Judicial
  adverseParty: string; // Reclamante / Adverso
  processNumber: string;
  courtJurisdiction: string;
  varaTrab?: string;
  city: string;
  state: string;
  issuingLawFirm?: string;
  issuingDate?: string;
  status: "AGENDADA" | "REALIZADA" | "CANCELADA";
  urgency?: "CRITICA" | "ALTA" | "NORMAL" | "CONCLUIDA";
  estimatedValue?: number;
  technicalAssistantChecklist?: string[];
  notes?: string;
}

export const BRITANIA_PERICIAS: JudicialPericia[] = [];
