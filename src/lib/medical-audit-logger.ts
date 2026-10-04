import { logger, maskPatientName } from "@/lib/logger";
/**
 * NextCon Intelligence (NAI) - Medical Audit Logger (CFM & LGPD Compliance)
 * Registra acessos imutáveis a prontuários e ASOs para rastreabilidade de dados médicos.
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

const AUDIT_STORAGE_KEY = "nai_medical_audit_trail";

export class MedicalAuditLogger {
  /**
   * Registra um acesso ou modificação a um Prontuário/ASO.
   */
  static logAccess(entry: Omit<MedicalAuditEntry, "id" | "timestamp">): MedicalAuditEntry {
    const logs = this.getAuditTrail();
    const newEntry: MedicalAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };

    logs.unshift(newEntry);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 100))); // Mantém até 100 registros locais
    }

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
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(AUDIT_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}
