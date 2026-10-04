import { Firestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * @fileOverview Global Audit Trail Service.
 * Garante a rastreabilidade total de alterações em registros sensíveis (LGPD).
 */

export interface AuditLog {
  userId: string;
  userName: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VIEW_PHI";
  entity: "EMPLOYEE" | "COMPANY" | "MEDICAL_RECORD" | "ASO";
  entityId: string;
  details: string;
  metadata?: any;
}

export class AuditService {
  /**
   * Registra uma ação no log de auditoria imutável.
   */
  static async log(db: Firestore, entry: AuditLog) {
    try {
      const auditRef = collection(db, "system_audit_logs");
      await addDoc(auditRef, {
        ...entry,
        timestamp: serverTimestamp(),
        clientIp: "logged_via_client",
        platform: "NAI_SGI_v4.0",
      });
    } catch (error) {
      console.error("Critical Audit Failure:", error);
      // Em microsserviços, aqui dispararíamos um alerta para o time de SRE
    }
  }
}
