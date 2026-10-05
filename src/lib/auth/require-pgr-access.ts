import type { AuthContext } from "./auth-context";
import { forbidden, badRequest } from "./errors";
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
    throw forbidden("Seu perfil não está autorizado a analisar PGRs.");
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
