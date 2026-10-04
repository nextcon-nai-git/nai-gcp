import { AuthContext } from "./auth-context";
import { forbidden, unauthorized } from "./errors";

export function requirePermission(user: AuthContext, permission: string): void {
  if (!user) {
    throw unauthorized();
  }

  if (user.role === "SUPER_ADMIN") {
    return; // Super Administrador possui todas as permissões
  }

  if (!user.permissions.includes("*") && !user.permissions.includes(permission)) {
    throw forbidden(`Permissão negada: operação requer a permissão '${permission}'.`);
  }
}
