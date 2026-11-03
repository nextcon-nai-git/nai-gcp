import "server-only";
import type { AuthContext } from "@/lib/auth/auth-context";
import { parseClaims } from "@/lib/auth/claims";
import { forbidden } from "@/lib/auth/errors";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { adminDb } from "@/lib/firebase-admin";

/** Long-running queries and new external writes must retain the current corporate grant. */
export async function requireCurrentFinancialAccess(user: AuthContext): Promise<void> {
  requireFinancialAccess(user);
  const snapshot = await adminDb.collection("users").doc(user.uid).get();
  const profile = snapshot.data();
  if (!snapshot.exists || !profile || profile.accessEnabled === false || profile.isDeleted === true)
    throw forbidden("O acesso financeiro do operador foi suspenso ou removido.");
  const claims = parseClaims(profile);
  requireFinancialAccess({
    ...user,
    role: claims.role,
    tenantId: claims.tenantId || null,
  });
}
