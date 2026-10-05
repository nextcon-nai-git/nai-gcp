import type { AuthContext } from "./auth-context";
import { badRequest, forbidden } from "./errors";

export function requireClinicalAccess(user: AuthContext, companyId: string) {
  if (!companyId || companyId.length > 128 || /[\/\u0000]/.test(companyId))
    throw badRequest("Selecione uma empresa válida.");
  if (
    !["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "HEALTH_PROFESSIONAL", "PROVIDER"].includes(
      user.role
    )
  )
    throw forbidden("Seu perfil não pode consultar dados clínicos.");
  if (
    !["SUPER_ADMIN", "ADMIN"].includes(user.role) &&
    user.tenantId !== companyId &&
    !user.servedCompanies.includes(companyId)
  )
    throw forbidden("Empresa não liberada para seu perfil clínico.");
}
