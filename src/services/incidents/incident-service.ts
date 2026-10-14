import { incidentRepository, IncidentRecord } from "@/repositories/incidents/incident-repository";
import { auditService } from "@/services/audit/audit-service";
import {
  analyzeIncidentWithNormativeGrounding,
  type TechnicalIncidentOpinion,
} from "@/services/ai/incident-investigation-engine";
import { aiFailureCode } from "@/lib/ai-failure";
import { logger } from "@/lib/logger";

export interface CreateIncidentInput {
  type: string;
  description: string;
  location?: string;
  photoUrl?: string | null;
}

export interface IncidentCreationResult {
  incidentId: string;
  opinion: TechnicalIncidentOpinion | null;
  analysisAvailable: boolean;
  reviewRequired: true;
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
      location: input.location?.trim() || "",
      photoUrl: input.photoUrl || null,
      reporterId: context.email || context.uid || "API_CLIENT",
      status: "ABERTO",
      createdAt: new Date().toISOString(),
    });

    try {
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

      const opinion = await analyzeIncidentWithNormativeGrounding(
        incidentId,
        context.tenantId,
        input.description,
        { location: input.location, photoUrl: input.photoUrl || undefined }
      );

      // A preliminary opinion does not establish clinical or regulatory record fields.
      await incidentRepository.update(incidentId, {
        technicalOpinion: opinion,
        status: "EM_ANALISE",
      });
      return { incidentId, opinion, analysisAvailable: true, reviewRequired: true };
    } catch (error) {
      // Receipt already committed: preserve its identifier even if a later step fails.
      logger.warn("Incident review unavailable after receipt", { code: aiFailureCode(error) });
      return { incidentId, opinion: null, analysisAvailable: false, reviewRequired: true };
    }
  }

  async listCompanyIncidents(companyId: string): Promise<IncidentRecord[]> {
    return incidentRepository.listByCompany(companyId);
  }
}

export const incidentService = new IncidentService();
