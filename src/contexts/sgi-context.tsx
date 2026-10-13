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
  const isDoctor = roleUpper === "DOCTOR";

  const allowedForProvider = React.useMemo(() => {
    if (Array.isArray(servedCompanies) && servedCompanies.length > 0) {
      return servedCompanies;
    }
    if (companyId) {
      return [companyId];
    }
    return [];
  }, [servedCompanies, companyId]);
  const allowedForDoctor = React.useMemo(
    () => [...new Set([...(servedCompanies || []), ...(companyId ? [companyId] : [])])],
    [servedCompanies, companyId]
  );

  // Determina se o usuário é do Time Central Nextcon / Super Admin (Sem amarras a uma única empresa)
  const isGlobalStaff = React.useMemo(() => {
    return (
      !isUserLoading &&
      ["SUPER_ADMIN", "ADMIN"].includes(roleUpper) &&
      (!companyId || companyId === "")
    );
  }, [roleUpper, companyId, role, isUserLoading]);

  // Determina se o usuário possui qualquer papel técnico/administrativo
  const isAnyStaff = React.useMemo(
    () => ["SUPER_ADMIN", "ADMIN", "ENGINEER", "DOCTOR", "PROVIDER", "AUDITOR"].includes(roleUpper),
    [roleUpper, role]
  );

  const setActiveClientId = React.useCallback(
    (id: string) => {
      // Validação de Tenant: Impede troca para empresas não autorizadas
      if (isGlobalStaff) {
        setActiveClientIdState(id);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("nai_active_client_id", id);
          } catch (_) {}
        }
      } else if (
        (isProvider && allowedForProvider.includes(id)) ||
        (isDoctor && allowedForDoctor.includes(id))
      ) {
        setActiveClientIdState(id);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("nai_active_client_id", id);
          } catch (_) {}
        }
      } else if (!isProvider && roleUpper && roleUpper !== "GUEST" && id === companyId) {
        setActiveClientIdState(id);
      }
    },
    [
      isGlobalStaff,
      companyId,
      isProvider,
      isDoctor,
      allowedForProvider,
      allowedForDoctor,
      roleUpper,
    ]
  );

  // Derive the visible tenant in the same render as the permissions. Waiting
  // for an effect exposed the previous account's selection to data hooks.
  const scopedClientId = isUserLoading
    ? "unauthorized"
    : isGlobalStaff
      ? activeClientId
      : isProvider
        ? allowedForProvider.includes(activeClientId)
          ? activeClientId
          : allowedForProvider[0] || "unauthorized"
        : isDoctor
          ? allowedForDoctor.includes(activeClientId)
            ? activeClientId
            : allowedForDoctor[0] || "unauthorized"
          : roleUpper && roleUpper !== "GUEST" && companyId
            ? companyId
            : "unauthorized";

  const value = React.useMemo(
    () => ({
      activeClientId: scopedClientId,
      setActiveClientId,
      isGlobalView: isGlobalStaff && scopedClientId === "all",
      isStaff: isAnyStaff,
      isGlobalStaff,
      isAuthorizedProvider: isProvider,
      authorizedCompanies: isDoctor ? allowedForDoctor : allowedForProvider,
      isLoading: isUserLoading,
    }),
    [
      scopedClientId,
      setActiveClientId,
      isGlobalStaff,
      companyId,
      isAnyStaff,
      isProvider,
      isDoctor,
      allowedForProvider,
      allowedForDoctor,
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
