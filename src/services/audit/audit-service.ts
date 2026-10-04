import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

export interface AuditEvent {
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  tenantId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  private db;

  constructor() {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  async record(event: AuditEvent): Promise<string> {
    try {
      const docRef = await addDoc(collection(this.db, "audit_logs"), {
        ...event,
        timestamp: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error("[AuditService Error]", err);
      return "";
    }
  }
}

export const auditService = new AuditService();
