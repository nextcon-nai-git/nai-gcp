import type { AuthContext } from "./auth-context";
import { forbidden } from "./errors";

export function canAccessAvpEvidence(user: {
  role: string | null;
  tenantId: string | null;
  servedCompanies: string[];
}) {
  return (
    user.role === "SUPER_ADMIN" ||
    (!user.tenantId &&
      (user.role === "ADMIN" ||
        (user.role === "OPERATIONS" && user.servedCompanies.includes("GRUPO_AVP"))))
  );
}

export function requireAvpAccess(user: AuthContext) {
  // ADMIN is also used for tenant administrators; only an unscoped internal
  // administrator may access AVP without an explicit company relationship.
  const internalAdmin = user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !user.tenantId);
  if (
    !internalAdmin &&
    user.tenantId !== "GRUPO_AVP" &&
    !user.servedCompanies.includes("GRUPO_AVP")
  )
    throw forbidden("Seu perfil não possui acesso ao Grupo AVP.");
  if (user.role === "GUEST")
    throw forbidden("Seu cadastro precisa de liberação para acessar o AVP.");
}
