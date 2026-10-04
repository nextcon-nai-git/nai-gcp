"use client";

import * as React from "react";
import { useUser } from "@/firebase";

interface SgiContextType {
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  isGlobalView: boolean;
  isStaff: boolean;
  isGlobalStaff: boolean;
  isAuthorizedProvider: boolean;
  authorizedCompanies: string[];
  isLoading: boolean;
}

const SgiContext = React.createContext<SgiContextType | undefined>(undefined);

/**
 * ENGINE DE GOVERNANÇA SGI v4.0 (Zero-Trust)
 * Gerencia o isolamento multi-tenant e a reatividade do sistema estritamente
 * a partir das Custom Claims e papéis RBAC emitidos pelo backend.
 * O frontend apenas reflete as permissões concedidas.
 */
export function SgiProvider({ children }: { children: React.ReactNode }) {
  const { role, companyId, servedCompanies, isUserLoading } = useUser();
  const [activeClientId, setActiveClientIdState] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("nai_active_client_id");
        if (saved) return saved;
      } catch (_) {}
    }
    return "all";
  });

  const roleUpper = (role || "").toUpperCase();
  const isProvider = roleUpper === "PROVIDER";

  const allowedForProvider = React.useMemo(() => {
    if (Array.isArray(servedCompanies) && servedCompanies.length > 0) {
      return servedCompanies;
    }
    if (companyId) {
      return [companyId];
    }
    return [];
  }, [servedCompanies, companyId]);

  // Determina se o usuário é do Time Central Nextcon / Super Admin (Sem amarras a uma única empresa)
  const isGlobalStaff = React.useMemo(() => {
    return ["SUPER_ADMIN", "ADMIN"].includes(roleUpper) && (!companyId || companyId === "");
  }, [roleUpper, companyId, role]);

  // Determina se o usuário possui qualquer papel técnico/administrativo
  const isAnyStaff = React.useMemo(
    () => ["SUPER_ADMIN", "ADMIN", "ENGINEER", "DOCTOR", "PROVIDER", "AUDITOR"].includes(roleUpper),
    [roleUpper, role]
  );

  const setActiveClientId = React.useCallback(
    (id: string) => {
      // Validação de Tenant: Impede troca para empresas não autorizadas
      if (isGlobalStaff || !companyId) {
        setActiveClientIdState(id);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("nai_active_client_id", id);
          } catch (_) {}
        }
      } else if (isProvider && allowedForProvider.includes(id)) {
        setActiveClientIdState(id);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("nai_active_client_id", id);
          } catch (_) {}
        }
      } else if (!isProvider && id === companyId) {
        setActiveClientIdState(id);
      }
    },
    [isGlobalStaff, companyId, isProvider, allowedForProvider]
  );

  // Efeito de Governança e Enforcing do Tenant
  React.useEffect(() => {
    if (isUserLoading) return;

    if (isGlobalStaff || !companyId) {
      // Super Admin ou Gestão Global sem amarração tem visão livre
      return;
    }

    if (isProvider) {
      // Prestador é travado na lista de empresas autorizadas nas suas claims
      if (allowedForProvider.length > 0) {
        if (!allowedForProvider.includes(activeClientId) && activeClientId !== "all") {
          setActiveClientId(allowedForProvider[0]);
        } else if (activeClientId === "all") {
          setActiveClientId(allowedForProvider[0]);
        }
      } else {
        setActiveClientId("unauthorized");
      }
      return;
    }

    if (companyId) {
      // Usuário vinculado a um único tenant/empresa
      if (activeClientId !== companyId) {
        setActiveClientId(companyId);
      }
    }
  }, [
    isUserLoading,
    isGlobalStaff,
    isProvider,
    allowedForProvider,
    companyId,
    activeClientId,
    setActiveClientId,
  ]);

  const value = React.useMemo(
    () => ({
      activeClientId,
      setActiveClientId,
      isGlobalView: (isGlobalStaff || !companyId) && activeClientId === "all",
      isStaff: isAnyStaff,
      isGlobalStaff: isGlobalStaff || !companyId,
      isAuthorizedProvider: isProvider,
      authorizedCompanies: allowedForProvider,
      isLoading: isUserLoading,
    }),
    [
      activeClientId,
      setActiveClientId,
      isGlobalStaff,
      companyId,
      isAnyStaff,
      isProvider,
      allowedForProvider,
      isUserLoading,
    ]
  );

  return <SgiContext.Provider value={value}>{children}</SgiContext.Provider>;
}

export function useSgi() {
  const context = React.useContext(SgiContext);
  if (!context) {
    throw new Error("useSgi deve ser utilizado dentro de um SgiProvider");
  }
  return context;
}
