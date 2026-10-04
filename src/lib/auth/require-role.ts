import { AuthContext, UserRole } from "./auth-context";
import { forbidden, unauthorized } from "./errors";

export function requireRole(user: AuthContext, allowedRoles: UserRole[]): void {
  if (!user || !user.role) {
    throw unauthorized("Usuário não autenticado ou sem papel configurado.");
  }

  if (user.role === "SUPER_ADMIN") {
    return; // Super Administrador possui acesso global irrestrito
  }

  if (!allowedRoles.includes(user.role)) {
    throw forbidden(
      `Permissão negada: o papel '${user.role}' não tem acesso a este recurso. Requer: [${allowedRoles.join(", ")}].`
    );
  }
}
