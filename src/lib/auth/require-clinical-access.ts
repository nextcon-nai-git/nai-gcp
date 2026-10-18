import type { AuthContext } from "./auth-context";
import { badRequest, forbidden } from "./errors";

export function requireClinicalAccess(user: AuthContext, companyId: string) {
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    companyId !== companyId.trim() ||
    companyId.length > 128 ||
    /[\/\\\u0000-\u001f]/.test(companyId) ||
    ["all", "unauthorized"].includes(companyId)
  )
    throw badRequest("Selecione uma empresa válida.");
  if (
    !["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "PROVIDER"].includes(
      user.role
    )
  )
    throw forbidden("Seu perfil não pode consultar dados clínicos.");
  if (
    !(user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !user.tenantId)) &&
    user.tenantId !== companyId &&
    !user.servedCompanies.includes(companyId)
  )
    throw forbidden("Empresa não liberada para seu perfil clínico.");
}
