import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

export type MedicalAuditAction =
  | "MEDICAL_RECORD_VIEWED"
  | "MEDICAL_RECORD_CREATED"
  | "MEDICAL_RECORD_UPDATED"
  | "ASO_VIEWED"
  | "CERTIFICATE_VIEWED"
  | "MEDICAL_ASSISTANT_USED"
  | "PHI_EXPORTED";

export interface MedicalAuditEvent {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  tenantId: string;
  patientId: string;
  action: MedicalAuditAction;
  details?: string;
}

export class MedicalAuditService {
  private db;

  constructor() {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  async record(event: MedicalAuditEvent): Promise<void> {
    try {
      await addDoc(collection(this.db, "phi_audit_logs"), {
        ...event,
        timestamp: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("[MedicalAuditService Error]", err);
    }
  }
}

export const medicalAuditService = new MedicalAuditService();
