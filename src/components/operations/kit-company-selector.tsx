"use client";

import { Building2 } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { useCompanyDirectory } from "@/hooks/use-company-directory";

/** Use the existing authorized directory without the header's navigation side effect. */
export function KitCompanySelector({ disabled = false }: { disabled?: boolean }) {
  const db = useFirestore();
  const { user } = useUser();
  const { activeClientId, setActiveClientId, isGlobalStaff, isLoading } = useSgi();
  const directory = useCompanyDirectory(
    db,
    user?.uid,
    isGlobalStaff,
    [],
    !isLoading && isGlobalStaff
  );
  const companies = directory.data.filter((company) => company.active === true);
  if (!isGlobalStaff) return null;
  return (
    <div className="rounded-xl border bg-card p-3">
      <label htmlFor="kit-company" className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Building2 aria-hidden="true" className="h-4 w-4 text-primary" /> Cliente / unidade
      </label>
      <select
        id="kit-company"
        className="w-full min-w-0 rounded-md border bg-background p-2 text-sm text-foreground"
        value={activeClientId}
        disabled={disabled || directory.isLoading || !!directory.error}
        onChange={(event) => {
          const id = event.target.value;
          if (id === "all" || companies.some((company) => company.id === id)) setActiveClientId(id);
        }}
      >
        <option value="all">
          {directory.isLoading ? "Carregando clientes…" : "Selecione um cliente"}
        </option>
        {activeClientId !== "all" &&
          !companies.some((company) => company.id === activeClientId) && (
            <option value={activeClientId} disabled>
              Seleção indisponível — escolha outro cliente
            </option>
          )}
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {[
              company.displayName || company.name,
              [company.city, company.state].filter(Boolean).join("/"),
              company.cnpj,
            ]
              .filter(Boolean)
              .join(" · ")}
          </option>
        ))}
      </select>
      {directory.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Não foi possível carregar os clientes.
        </p>
      )}
    </div>
  );
}
