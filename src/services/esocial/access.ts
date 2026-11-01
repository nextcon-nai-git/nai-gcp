import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import type { AuthContext } from "@/lib/auth/auth-context";
import { parseClaims } from "@/lib/auth/claims";
import { badRequest, forbidden } from "@/lib/auth/errors";
import { adminDb } from "@/lib/firebase-admin";
import { isPgrGlobalAdmin, requirePgrCompany } from "@/lib/auth/require-pgr-access";

export const esocialPrivateRoot = () =>
  adminDb.collection("clinic_portal_private").doc("esocial-messaging");
const roles = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATIONS",
  "COMPLIANCE",
  "ENGINEER",
  "SAFETY_TECH",
  "DOCTOR",
  "NURSE",
  "HEALTH_PROFESSIONAL",
]);
export function requireEsocialMessagingAccess(user: AuthContext, companyId?: string) {
  if (user.tenantId || !roles.has(user.role))
    throw forbidden("Mensageria disponível somente à equipe interna autorizada.");
  if (companyId) requirePgrCompany(user, companyId);
}
export function canManageEsocialConnection(user: AuthContext) {
  return !user.tenantId && isPgrGlobalAdmin(user);
}
export function requireEsocialAdministrator(user: AuthContext) {
  requireEsocialMessagingAccess(user);
  if (!canManageEsocialConnection(user))
    throw forbidden("A configuração exige um administrador interno.");
}
export function esocialDocumentId(input: string, label = "Registro") {
  if (
    typeof input !== "string" ||
    !input ||
    input.length > 128 ||
    /[\/\u0000]/.test(input) ||
    [".", "..", "all", "unauthorized"].includes(input)
  )
    throw badRequest(`${label} inválido.`);
  return input;
}
/** Re-read before a signature or external request; cached claims cannot grant transmission. */
export async function currentEsocialUser(
  user: AuthContext,
  companyId?: string,
  transaction?: Pick<Transaction, "get">
): Promise<AuthContext> {
  const reference = adminDb.collection("users").doc(user.uid);
  const snapshot = transaction ? await transaction.get(reference) : await reference.get();
  const profile = snapshot.data();
  if (!snapshot.exists || !profile || profile.accessEnabled === false)
    throw forbidden("O acesso do operador foi suspenso ou removido.");
  const claims = parseClaims(profile);
  const current: AuthContext = {
    uid: user.uid,
    email: typeof profile.email === "string" ? profile.email : "",
    role: claims.role,
    tenantId: claims.tenantId || null,
    servedCompanies: claims.servedCompanies || [],
    permissions: claims.permissions || [],
  };
  requireEsocialMessagingAccess(current, companyId);
  return current;
}
