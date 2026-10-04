import { logger, maskPatientName } from "@/lib/logger";
/**
 * NextCon Intelligence (NAI) - Medical Audit Logger (CFM & LGPD Compliance)
 * Emite eventos técnicos sem persistir dados identificáveis no navegador. A trilha durável deve ser mantida pelo backend autenticado.
 */

export interface MedicalAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  userCrmCoren?: string;
  action: "READ_PRONTUARIO" | "CREATE_ASO" | "UPDATE_EXAM" | "EXPORT_PDF";
  patientEmployeeId: string;
  patientName: string;
  companyId: string;
  ipAddress: string;
}

const sessionEvents: MedicalAuditEntry[] = [];

export class MedicalAuditLogger {
  /**
   * Registra um acesso ou modificação a um Prontuário/ASO.
   */
  static logAccess(entry: Omit<MedicalAuditEntry, "id" | "timestamp">): MedicalAuditEntry {
    const newEntry: MedicalAuditEntry = {
      ...entry,
      id: `audit_${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
    };

    sessionEvents.unshift({
      ...newEntry,
      userId: "",
      userName: "",
      userCrmCoren: "",
      patientEmployeeId: "",
      patientName: "",
      companyId: "",
      ipAddress: "",
    });
    sessionEvents.splice(100);

    logger.audit(
      "CFM_RECORD_ACCESS",
      `Ação ${newEntry.action} por ${newEntry.userName} (${newEntry.userRole})`,
      {
        patientId: newEntry.patientEmployeeId,
        patientInitials: maskPatientName(newEntry.patientName),
        companyId: newEntry.companyId,
      }
    );
    return newEntry;
  }

  /**
   * Retorna o histórico de auditoria gravado.
   */
  static getAuditTrail(): MedicalAuditEntry[] {
    return sessionEvents.map((event) => ({ ...event }));
  }
}
