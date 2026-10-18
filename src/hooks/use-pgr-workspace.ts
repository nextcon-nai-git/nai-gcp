"use client";
import { pgrRequestHeaders } from "@/lib/pgr-request-headers";
import * as React from "react";
import { useUser } from "@/firebase";
import type { PgrCompany } from "@/lib/pgr-schema";

function usePgrQuery<T>(
  url: string | null,
  field: "companies" | "tasks" | "risks",
  enabled: boolean,
  refresh: boolean
) {
  const { user } = useUser();
  const target = React.useMemo(
    () => ({ user, url, field, enabled, refresh }),
    [user, url, field, enabled, refresh]
  );
  const ready = !!target.user && !!target.url && target.enabled;
  const [state, setState] = React.useState<{
    target: typeof target;
    data: T[];
    loading: boolean;
    error: string;
  } | null>(null);
  React.useEffect(() => {
    if (!target.user || !target.url || !target.enabled) return;
    const { user, url, field } = target;
    let stopped = false;
    let sequence = 0;
    let controller: AbortController | null = null;
    async function load() {
      const request = ++sequence;
      controller?.abort();
      const currentController = new AbortController();
      controller = currentController;
      const current = () => !stopped && request === sequence;
      setState((previous) => ({
        target,
        data: previous?.target === target ? previous.data : [],
        loading: true,
        error: "",
      }));
      try {
        const headers = await pgrRequestHeaders(user);
        if (!current()) return;
        const response = await fetch(url, {
          headers,
          cache: "no-store",
          signal: currentController.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(typeof body?.error === "string" ? body.error : "Consulta indisponível.");
        if (!body || !Array.isArray(body[field]))
          throw new Error("Resposta inválida ao consultar o PGR.");
        if (current())
          setState({
            target,
            data: body[field],
            loading: false,
            error: body.limited
              ? "Exibidos os primeiros 500 registros; refine a unidade ou consulte o PGR original."
              : "",
          });
      } catch (error) {
        if (current())
          setState({
            target,
            data: [],
            loading: false,
            error: error instanceof Error ? error.message : "Consulta indisponível.",
          });
      }
    }
    void load();
    const timer = target.refresh ? setInterval(load, 30000) : undefined;
    if (target.refresh) window.addEventListener("nai:pgr-task-updated", load);
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== undefined) clearInterval(timer);
      if (target.refresh) window.removeEventListener("nai:pgr-task-updated", load);
    };
  }, [target]);
  // Passive-effect resets expose one render of the previous scope. Derive the
  // visible state from the exact session, endpoint and enabled state instead.
  if (!ready) return { data: [] as T[], loading: false, error: "" };
  if (state?.target !== target) return { data: [] as T[], loading: true, error: "" };
  return { data: state.data, loading: state.loading, error: state.error };
}

export function usePgrCompanies(enabled: boolean) {
  return usePgrQuery<PgrCompany>("/api/pgr/records", "companies", enabled, false);
}
export function usePgrCollection<T>(
  kind: "tasks" | "risks",
  companyId: string | null,
  enabled: boolean
) {
  const url = companyId ? "/api/pgr/" + kind + "?companyId=" + encodeURIComponent(companyId) : null;
  return usePgrQuery<T>(url, kind, enabled, true);
}
export async function updatePgrTask(
  user: { getIdToken: () => Promise<string> },
  companyId: string,
  taskId: string,
  patch: Record<string, unknown>
) {
  const r = await fetch("/api/pgr/tasks", {
    method: "PATCH",
    headers: await pgrRequestHeaders(user, true),
    body: JSON.stringify({ companyId, taskId, patch }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "O card não foi atualizado.");
  window.dispatchEvent(new Event("nai:pgr-task-updated"));
}
