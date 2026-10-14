import type { AuthContext } from "./auth-context";
import { forbidden, badRequest } from "./errors";
import { getNaiDocument, type PgrAnalysisOutput } from "../pgr-schema";
export function requirePgrRole(user: AuthContext) {
  if (
    ![
      "SUPER_ADMIN",
      "ADMIN",
      "CLIENT_ADMIN",
      "ENGINEER",
      "SAFETY_TECH",
      "PROVIDER",
      "COMPLIANCE",
      "OPERATIONS",
      "DOCTOR",
      "NURSE",
      "HEALTH_PROFESSIONAL",
    ].includes(user.role)
  )
    throw forbidden("Seu perfil não está autorizado a importar documentos de SST.");
}

/** Matches the clinical AI roles; a generic provider may be an engineer. */
export function canAccessClinicalImport(user: AuthContext) {
  return ["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL"].includes(user.role);
}

export function requirePgrDocumentAccess(user: AuthContext, analysis: PgrAnalysisOutput) {
  requirePgrRole(user);
  const document = getNaiDocument(analysis);
  if (
    (document.acesso === "clinico_restrito" ||
      ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(document.tipo)) &&
    !canAccessClinicalImport(user)
  )
    throw forbidden(
      "Este documento exige acesso clínico. A análise integral está disponível apenas para um perfil de saúde autorizado."
    );
}
export function isPgrGlobalAdmin(user: AuthContext) {
  return user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !user.tenantId);
}
export function requirePgrCompany(user: AuthContext, companyId: string) {
  requirePgrRole(user);
  if (
    typeof companyId !== "string" ||
    !companyId ||
    companyId.length > 128 ||
    /[\/\u0000]/.test(companyId)
  )
    throw badRequest("Cliente inválido.");
  if (
    !isPgrGlobalAdmin(user) &&
    user.tenantId !== companyId &&
    !user.servedCompanies.includes(companyId)
  )
    throw forbidden("A empresa não está liberada para sua conta.");
}
