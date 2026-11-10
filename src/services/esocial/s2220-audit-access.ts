import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { parseClaims } from "../../lib/auth/claims";
import { auditS2220EventFlow, ESocialS2220InputSchema } from "../../lib/genkit/flows/audit-s2220";
import type { AuditActionResult } from "../../lib/genkit/s2220-contract";

export class AuditAccessError extends Error {
  constructor(
    readonly code: "unauthenticated" | "permission-denied" | "invalid-argument",
    message: string
  ) {
    super(message);
  }
}
export function checkAuditProfile(
  profile: Record<string, unknown> | undefined,
  companyId: unknown
) {
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    companyId !== companyId.trim() ||
    companyId.length > 128 ||
    /[\/\u0000]/.test(companyId) ||
    [".", "..", "all", "unauthorized"].includes(companyId)
  )
    throw new AuditAccessError("invalid-argument", "Selecione uma empresa válida.");
  if (profile && profile.accessEnabled !== false && profile.isDeleted !== true) {
    const { role, tenantId, servedCompanies } = parseClaims(profile);
    if (
      !tenantId &&
      (["SUPER_ADMIN", "ADMIN"].includes(role) ||
        (["DOCTOR", "NURSE", "HEALTH_PROFESSIONAL"].includes(role) &&
          servedCompanies?.includes(companyId)))
    )
      return;
  }
  throw new AuditAccessError(
    "permission-denied",
    "A auditoria exige acesso clínico interno à empresa."
  );
}
export async function executeAuthorizedAudit(
  token: unknown,
  companyId: unknown,
  evento: unknown
): Promise<AuditActionResult> {
  if (typeof token !== "string" || !token.trim() || token.length > 16384)
    throw new AuditAccessError("unauthenticated", "Entre novamente no NAI.");
  const app =
    getApps().find((a) => a.name === "[DEFAULT]") ??
    initializeApp({
      projectId:
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  const user = await getAuth(app)
    .verifyIdToken(token, true)
    .catch(() => {
      throw new AuditAccessError("unauthenticated", "Sessão expirada ou inválida.");
    });
  const profile = await getFirestore(app).collection("users").doc(user.uid).get();
  checkAuditProfile(profile.data(), companyId);
  const parsed = ESocialS2220InputSchema.safeParse(evento);
  if (!parsed.success) {
    const validationErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues)
      validationErrors[issue.path.join(".") || "evento"] = ["Confira este campo."];
    return { success: false, error: "Dados inválidos para auditoria.", validationErrors };
  }
  return { success: true, data: await auditS2220EventFlow(parsed.data) };
}
