import type { AuthContext } from "./auth-context";
import { badRequest, forbidden } from "./errors";

export function isDashboardGlobal(user: AuthContext) {
  return (
    user.role === "SUPER_ADMIN" || (["ADMIN", "OPERATIONS"].includes(user.role) && !user.tenantId)
  );
}

export function dashboardScope(user: AuthContext, requested: string): string | null {
  if (!requested || requested.length > 128 || /[\/\u0000]/.test(requested))
    throw badRequest("Cliente inválido.");
  if (isDashboardGlobal(user)) return requested === "all" ? null : requested;
  if (
    ![
      "ADMIN",
      "OPERATIONS",
      "CLIENT_ADMIN",
      "HR",
      "RH",
      "DOCTOR",
      "NURSE",
      "ENGINEER",
      "PROVIDER",
      "SAFETY_TECH",
      "HEALTH_PROFESSIONAL",
      "COMPLIANCE",
    ].includes(user.role) ||
    !user.tenantId
  )
    throw forbidden("Seu perfil não possui uma empresa liberada para este painel.");
  if (requested !== "all" && requested !== user.tenantId)
    throw forbidden("Esta empresa não está liberada para sua conta.");
  return user.tenantId;
}
