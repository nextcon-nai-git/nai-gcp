import { BaseFirestoreRepository } from "../firestore/base-repository";

export interface IncidentRecord {
  id: string;
  companyId: string;
  type: string;
  description: string;
  photoUrl?: string | null;
  location?: string;
  reporterId: string;
  status: "ABERTO" | "EM_ANALISE" | "CONCLUIDO" | "CANCELADO";
  createdAt: string;
  severity?: "LEVE" | "GRAVE" | "FATAL";
  hasLeave?: boolean;
  daysOfLeave?: number;
  requiresCatS2210?: boolean;
  catDeadlineIso?: string | null;
  catDeadlineTimestamp?: number | null;
  catStatus?: "PENDENTE" | "EMITIDA" | "FORA_DO_PRAZO" | "NAO_APLICAVEL";
  technicalOpinion?: unknown;
}

export class IncidentRepository extends BaseFirestoreRepository<IncidentRecord> {
  constructor() {
    super("incidents");
  }

  async listByCompany(companyId: string): Promise<IncidentRecord[]> {
    return this.list({ companyId });
  }
}

export const incidentRepository = new IncidentRepository();
