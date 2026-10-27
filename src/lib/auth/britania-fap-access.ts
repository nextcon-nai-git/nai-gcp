import type { AuthContext } from "./auth-context";
/** Consolidated health data must never inherit one establishment's permissions. */
export function isBritaniaFapAdmin(user: AuthContext) {
  return (
    ["SUPER_ADMIN", "ADMIN"].includes(user.role) && (!user.tenantId || user.tenantId === "nextcon")
  );
}
