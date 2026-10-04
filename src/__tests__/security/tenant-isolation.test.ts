import { describe, it, expect } from "vitest";
import { requireTenant, requireRole } from "@/lib/auth";
import { AuthContext } from "@/lib/auth/auth-context";
import { requireApiScope, requireApiTenant, ApiKeyContext } from "@/lib/auth/api-key";

describe("NAI Security & Multi-Tenant Isolation Suite", () => {
  const userTenantA: AuthContext = {
    uid: "user_123",
    email: "gestor@empresa-a.com.br",
    role: "CLIENT_ADMIN",
    tenantId: "EMPRESA_A",
    permissions: ["employees.read", "employees.write"],
    servedCompanies: [],
  };

  const userProvider: AuthContext = {
    uid: "doc_456",
    email: "medico@clinica-credenciada.com.br",
    role: "PROVIDER",
    tenantId: "CLINICA_PRESTADORA",
    permissions: ["medical.read", "medical.write"],
    servedCompanies: ["EMPRESA_A", "EMPRESA_C"],
  };

  const superAdmin: AuthContext = {
    uid: "admin_001",
    email: "super@nextcon.com.br",
    role: "SUPER_ADMIN",
    tenantId: null,
    permissions: ["*"],
    servedCompanies: [],
  };

  // --- CENÁRIO 1: ISOLAMENTO ENTRE TENANTS DISTINTOS ---
  it("Cenário 1: Usuário do Tenant A acessando seus próprios dados -> PERMITIDO", () => {
    expect(() => requireTenant(userTenantA, "EMPRESA_A")).not.toThrow();
  });

  it("Cenário 2: Usuário do Tenant A tentando acessar dados do Tenant B -> NEGADO (403 Forbidden)", () => {
    expect(() => requireTenant(userTenantA, "EMPRESA_B")).toThrow(/Isolamento Multi-tenant/);
  });

  // --- CENÁRIO 2: PRESTADOR E REDE CREDENCIADA ---
  it("Cenário 3: Prestador acessando empresa credenciada em servedCompanies (EMPRESA_A) -> PERMITIDO", () => {
    expect(() => requireTenant(userProvider, "EMPRESA_A")).not.toThrow();
  });

  it("Cenário 4: Prestador tentando acessar empresa NÃO credenciada (EMPRESA_B) -> NEGADO (403 Forbidden)", () => {
    expect(() => requireTenant(userProvider, "EMPRESA_B")).toThrow(
      /Prestador não possui credenciamento/
    );
  });

  // --- CENÁRIO 3: SUPER ADMINISTRADOR GLOBAL ---
  it("Cenário 5: Super Admin acessando qualquer tenant -> PERMITIDO", () => {
    expect(() => requireTenant(superAdmin, "EMPRESA_A")).not.toThrow();
    expect(() => requireTenant(superAdmin, "EMPRESA_B")).not.toThrow();
    expect(() => requireTenant(superAdmin, "EMPRESA_QUALQUER")).not.toThrow();
  });

  // --- CENÁRIO 4: RBAC (ROLE-BASED ACCESS CONTROL) ---
  it("Cenário 6: Validação de Papéis autorizados -> PERMITIDO quando compatível", () => {
    expect(() => requireRole(userTenantA, ["CLIENT_ADMIN", "ADMIN"])).not.toThrow();
  });

  it("Cenário 7: Validação de Papéis não autorizados -> NEGADO (403 Forbidden)", () => {
    expect(() => requireRole(userTenantA, ["DOCTOR", "ENGINEER"])).toThrow(/Permissão negada/);
  });

  // --- CENÁRIO 5: API KEY SCOPES & CLIENT ID ---
  it("Cenário 8: API Key do Cliente A tentando acessar escopo incorreto -> NEGADO", () => {
    const apiKeyContext: ApiKeyContext = {
      id: "key_1",
      clientId: "EMPRESA_A",
      scopes: ["access_control:read", "incidents:create"],
    };

    expect(() => requireApiScope(apiKeyContext, "access_control:read")).not.toThrow();
    expect(() => requireApiScope(apiKeyContext, "esocial:generate")).toThrow(
      /Escopo de API insuficiente/
    );
    expect(() => requireApiTenant(apiKeyContext, "EMPRESA_B")).toThrow(/Isolamento de API Key/);
  });
});
