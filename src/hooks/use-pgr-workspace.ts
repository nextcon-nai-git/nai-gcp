"use client";
import { pgrRequestHeaders } from "@/lib/pgr-request-headers";
import * as React from "react";
import { useUser } from "@/firebase";
import type { PgrCompany } from "@/lib/pgr-schema";
export function usePgrCompanies(enabled: boolean) {
  const { user } = useUser();
  const [data, setData] = React.useState<PgrCompany[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    let stopped = false;
    setData([]);
    setLoading(enabled && !!user);
    if (enabled && user)
      void (async () => {
        try {
          const r = await fetch("/api/pgr/records", {
            headers: await pgrRequestHeaders(user),
            cache: "no-store",
          });
          const d = await r.json();
          if (!stopped && r.ok) setData(d.companies || []);
        } catch {
          if (!stopped) setData([]);
        } finally {
          if (!stopped) setLoading(false);
        }
      })();
    return () => {
      stopped = true;
    };
  }, [enabled, user?.uid]);
  return { data, loading };
}
export function usePgrCollection<T>(
  kind: "tasks" | "risks",
  companyId: string | null,
  enabled: boolean
) {
  const { user } = useUser();
  const [data, setData] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    setData([]);
    setError("");
    setLoading(!!user && !!companyId && enabled);
    async function load() {
      if (!user || !companyId || !enabled) return;
      try {
        const r = await fetch("/api/pgr/" + kind + "?companyId=" + encodeURIComponent(companyId), {
          headers: await pgrRequestHeaders(user),
          cache: "no-store",
          signal: controller.signal,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Consulta indisponível.");
        if (!stopped) {
          setData(d[kind] || []);
          setError(
            d.limited
              ? "Exibidos os primeiros 500 registros; refine a unidade ou consulte o PGR original."
              : ""
          );
        }
      } catch (e) {
        if (!stopped) {
          setData([]);
          setError(e instanceof Error ? e.message : "Consulta indisponível.");
        }
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(load, 30000);
    window.addEventListener("nai:pgr-task-updated", load);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("nai:pgr-task-updated", load);
    };
  }, [user?.uid, companyId, enabled, kind]);
  return { data, loading, error };
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
