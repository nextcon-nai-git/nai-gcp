import { incidentRepository, IncidentRecord } from "@/repositories/incidents/incident-repository";
import { auditService } from "@/services/audit/audit-service";
import {
  analyzeIncidentWithNormativeGrounding,
  TechnicalIncidentOpinion,
} from "@/services/ai/incident-investigation-engine";

export interface CreateIncidentInput {
  type: string;
  description: string;
  location?: string;
  photoUrl?: string | null;
}

export interface IncidentCreationResult {
  incidentId: string;
  opinion: TechnicalIncidentOpinion;
}

export class IncidentService {
  async createIncident(
    context: { uid?: string; email?: string; role?: string; tenantId: string },
    input: CreateIncidentInput
  ): Promise<IncidentCreationResult> {
    // 1. Gravação no repositório persistente
    const incidentId = await incidentRepository.create({
      companyId: context.tenantId,
      type: input.type,
      description: input.description,
      location: input.location || "Chão de Fábrica",
      photoUrl: input.photoUrl || null,
      reporterId: context.email || context.uid || "API_CLIENT",
      status: "ABERTO",
      createdAt: new Date().toISOString(),
    });

    // 2. Registro de Auditoria
    await auditService.record({
      actorId: context.uid || "API",
      actorEmail: context.email,
      actorRole: context.role,
      tenantId: context.tenantId,
      action: "INCIDENT_REPORTED",
      resourceType: "incident",
      resourceId: incidentId,
      metadata: { type: input.type },
    });

    // 3. Execução do RAG Grounding Engine Normativo
    const opinion = await analyzeIncidentWithNormativeGrounding(
      incidentId,
      context.tenantId,
      input.description,
      { location: input.location, photoUrl: input.photoUrl || undefined }
    );

    // 4. Enriquecimento do registro do incidente com o Parecer Técnico e Prazos de CAT
    const requiresCat = opinion.esocialImpact.requiresCatS2210;
    await incidentRepository.update(incidentId, {
      severity: opinion.severity,
      hasLeave: opinion.extractedFacts.hasLeave,
      daysOfLeave: opinion.extractedFacts.estimatedDaysOfLeave,
      requiresCatS2210: requiresCat,
      catDeadlineIso: opinion.esocialImpact.catDeadlineIso || null,
      catDeadlineTimestamp: opinion.esocialImpact.catDeadlineTimestamp || null,
      catStatus: requiresCat ? "PENDENTE" : "NAO_APLICAVEL",
      technicalOpinion: opinion,
      status: "EM_ANALISE",
    });

    return {
      incidentId,
      opinion,
    };
  }

  async listCompanyIncidents(companyId: string): Promise<IncidentRecord[]> {
    return incidentRepository.listByCompany(companyId);
  }
}

export const incidentService = new IncidentService();
