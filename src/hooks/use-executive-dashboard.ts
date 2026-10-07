"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/firebase";
import type { ExecutiveDashboard } from "@/lib/executive-dashboard";

export function useExecutiveDashboard(scope: string) {
  const { user } = useUser();
  const key = `${user?.uid || ""}:${scope}`;
  const [result, setResult] = useState<{ key: string; data: ExecutiveDashboard } | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 45000);
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      if (request.signal.aborted) return;
      const response = await fetch(`/api/dashboard/overview?company=${encodeURIComponent(scope)}`, {
        signal: request.signal,
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (response.status === 401 || response.status === 403) setResult(null);
      if (!response.ok) throw new Error(body.error || "Não foi possível atualizar o painel.");
      if (!request.signal.aborted) setResult({ key, data: body });
    } catch (cause) {
      if (controller.current === request) {
        setError({
          key,
          text: request.signal.aborted
            ? "A consulta demorou mais que o esperado. Tente novamente."
            : cause instanceof Error
              ? cause.message
              : "Falha ao consultar as fontes.",
        });
      }
    } finally {
      clearTimeout(timeout);
      if (controller.current === request) setLoading(false);
    }
  }, [user, scope, key]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => {
      clearInterval(timer);
      controller.current?.abort();
      controller.current = null;
    };
  }, [refresh]);
  return {
    data: result?.key === key ? result.data : null,
    error: error?.key === key ? error.text : null,
    loading,
    refresh,
  };
}
