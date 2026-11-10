"use server";
import { executeAuthorizedAudit, AuditAccessError } from "@/services/esocial/s2220-audit-access";
import type { AuditActionResult } from "@/lib/genkit/s2220-contract";
export async function executeS2220AuditAction(
  token: string,
  companyId: string,
  evento: unknown
): Promise<AuditActionResult> {
  try {
    return await executeAuthorizedAudit(token, companyId, evento);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof AuditAccessError
          ? error.message
          : "Não foi possível concluir a auditoria.",
    };
  }
}
