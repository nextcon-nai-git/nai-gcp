import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

export interface AiAuditRecord {
  tenantId: string;
  actorId: string;
  flow: string;
  model: string;
  promptVersion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  tokensEstimate?: number;
  costEstimateUsd?: number;
  confidenceScore?: number;
  status: "SUCCESS" | "ERROR" | "FALLBACK";
  errorMessage?: string;
}

export class AiAuditService {
  private db;

  constructor() {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  async recordInference(record: AiAuditRecord): Promise<void> {
    try {
      await addDoc(collection(this.db, "ai_audit_logs"), {
        ...record,
        serverTimestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("[AiAuditService Error]", err);
    }
  }
}

export const aiAuditService = new AiAuditService();
