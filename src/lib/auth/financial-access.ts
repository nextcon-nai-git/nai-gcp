import type { AuthContext } from "./auth-context";
import { forbidden } from "./errors";
/** Corporate ledger: never inferred from the client selected in the operational UI. */
export function requireFinancialAccess(user: AuthContext): void {
  if (user.role === "SUPER_ADMIN" || (user.role === "ADMIN" && !user.tenantId)) return;
  throw forbidden(
    "O livro contábil interno está disponível apenas à administração financeira do NAI."
  );
}
