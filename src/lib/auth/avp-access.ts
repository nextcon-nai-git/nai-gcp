import type { AuthContext } from "./auth-context";
import { forbidden } from "./errors";

export function requireAvpAccess(user: AuthContext) {
  if (
    !["SUPER_ADMIN", "ADMIN"].includes(user.role) &&
    user.tenantId !== "GRUPO_AVP" &&
    !user.servedCompanies.includes("GRUPO_AVP")
  )
    throw forbidden("Seu perfil não possui acesso ao Grupo AVP.");
  if (user.role === "GUEST")
    throw forbidden("Seu cadastro precisa de liberação para acessar o AVP.");
}
