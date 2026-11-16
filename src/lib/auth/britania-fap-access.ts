import { BRITANIA_ANCHOR } from "../britania-group";
/** Consolidated health data must never inherit one establishment's permissions. */
export function isBritaniaFapAdmin(user: { role: string; tenantId?: string | null }) {
  return (
    ["SUPER_ADMIN", "ADMIN"].includes(user.role) && (!user.tenantId || user.tenantId === "nextcon")
  );
}

export function canReadDossierTask(
  user: { role: string; tenantId?: string | null },
  companyId: string | null,
  taskId: string
) {
  return (
    companyId !== BRITANIA_ANCHOR || !taskId.startsWith("document_") || isBritaniaFapAdmin(user)
  );
}
