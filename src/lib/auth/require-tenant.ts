import { AuthContext } from "./auth-context";
import { forbidden, badRequest, unauthorized } from "./errors";

export function requireTenant(user: AuthContext, tenantId: string): void {
  if (!user) {
    throw unauthorized();
  }

  if (user.role === "SUPER_ADMIN") {
    return; // Super Administrador pode acessar qualquer tenant
  }

  if (!tenantId) {
    throw badRequest("Identificador de empresa/tenant é obrigatório.");
  }

  // Se for Prestador (PROVIDER), verifica se a empresa está na lista de empresas atendidas
  if (user.role === "PROVIDER") {
    if (!user.servedCompanies.includes(tenantId)) {
      throw forbidden(
        `Isolamento Multi-tenant: Prestador não possui credenciamento para a empresa '${tenantId}'.`
      );
    }
    return;
  }

  // Demais perfis (CLIENT_ADMIN, HR, ENGINEER, etc.) devem pertencer diretamente ao tenant
  if (user.tenantId !== tenantId) {
    throw forbidden(`Isolamento Multi-tenant: Usuário não pertence à empresa '${tenantId}'.`);
  }
}
