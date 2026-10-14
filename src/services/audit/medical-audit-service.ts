import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export type MedicalAuditAction =
  | "MEDICAL_RECORD_VIEWED"
  | "MEDICAL_RECORD_CREATED"
  | "MEDICAL_RECORD_UPDATED"
  | "ASO_VIEWED"
  | "CERTIFICATE_VIEWED"
  | "MEDICAL_ASSISTANT_USED";

export interface MedicalAuditEvent {
  actorId: string;
  actorRole: string;
  tenantId: string;
  patientId: string;
  action: MedicalAuditAction;
}

export class MedicalAuditService {
  async record(event: MedicalAuditEvent): Promise<void> {
    await adminDb.collection("phi_audit_logs").add({
      ...event,
      timestamp: FieldValue.serverTimestamp(),
    });
  }
}

export const medicalAuditService = new MedicalAuditService();
