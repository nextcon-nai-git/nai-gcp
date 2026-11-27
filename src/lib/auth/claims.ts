import { USER_ROLES, type UserRole } from "./auth-context";

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
  // Match isInternalStaff in Firestore/Storage. Only the legacy internal
  // ADMIN/OPERATIONS marker is global; explicit tenants always keep precedence.
  const legacyInternal =
    (claims.role === "ADMIN" || claims.role === "OPERATIONS") &&
    (claims.tenantId === undefined || claims.tenantId === null || claims.tenantId === "") &&
    claims.companyId === "nextcon";
  return {
    role: USER_ROLES.find((role) => role === claims.role) ?? "GUEST",
    tenantId:
      typeof claims.tenantId === "string" && claims.tenantId.trim() !== ""
        ? claims.tenantId
        : !legacyInternal && typeof claims.companyId === "string"
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
