import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

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
  async recordInference(record: AiAuditRecord): Promise<void> {
    try {
      await adminDb.collection("ai_audit_logs").add({
        ...record,
        serverTimestamp: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("[AiAuditService Error]", error);
    }
  }
}

export const aiAuditService = new AiAuditService();
