import { UserRole } from "./auth-context";

export interface NAIClaims {
  role: UserRole;
  tenantId?: string;
  permissions?: string[];
  servedCompanies?: string[];
}

/**
 * Normaliza e valida Custom Claims recebidas do Firebase ID Token
 */
export function parseClaims(claims: Record<string, unknown>): NAIClaims {
  return {
    role: (claims.role as UserRole) || "GUEST",
    tenantId:
      typeof claims.tenantId === "string"
        ? claims.tenantId
        : typeof claims.companyId === "string"
          ? claims.companyId
          : undefined,
    permissions: Array.isArray(claims.permissions)
      ? claims.permissions.filter((p): p is string => typeof p === "string")
      : [],
    servedCompanies: Array.isArray(claims.servedCompanies)
      ? claims.servedCompanies.filter((p): p is string => typeof p === "string")
      : [],
  };
}
