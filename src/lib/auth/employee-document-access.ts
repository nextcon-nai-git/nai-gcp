/** UI preflight for the intersection of Storage and employee-metadata permissions.
 * Server rules remain authoritative. Clinical access alone cannot edit employee metadata.
 */
export function canManageEmployeeDocuments(
  profile: {
    role: string | null;
    companyId: string | null;
    tenantId?: string | null;
    isUserLoading?: boolean;
    userError?: Error | null;
  },
  target: { internal?: boolean; companyId?: string }
): boolean {
  if (profile.isUserLoading || profile.userError) return false;
  if (profile.role === "SUPER_ADMIN") return true;
  const internalStaff =
    ["ADMIN", "OPERATIONS"].includes(profile.role || "") &&
    !profile.tenantId &&
    (!profile.companyId || profile.companyId === "nextcon");
  if (target.internal) return internalStaff;
  if (!target.companyId || ["all", "unauthorized"].includes(target.companyId)) return false;
  // Storage's colaboradores namespace excludes OPERATIONS and CLIENT_ADMIN.
  // Firestore's employees namespace excludes clinical roles and served-only ADMINs.
  return (
    profile.role === "ADMIN" &&
    (internalStaff ||
      (profile.companyId === target.companyId &&
        (!profile.tenantId || profile.tenantId === target.companyId)))
  );
}
