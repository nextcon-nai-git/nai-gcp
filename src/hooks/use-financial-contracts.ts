"use client";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/firebase";
type Contract = { id: string; companyName: string; title: string; value: number };
export function useFinancialContracts(scope: string) {
  const { user } = useUser();
  const key = `${user?.uid || ""}:${scope}`;
  const [result, setResult] = useState<{ key: string; data: Contract[] } | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let live = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/financial/contracts?company=${encodeURIComponent(scope)}`,
          {
            cache: "no-store",
            signal: controller.signal,
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Falha ao consultar contratos.");
        if (live) setResult({ key, data: body.contracts });
      } catch (e) {
        if (live) {
          setResult(null);
          setError({ key, text: e instanceof Error ? e.message : "Falha ao consultar contratos." });
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      controller.abort();
    };
  }, [key, scope, user, revision]);
  return {
    data: result?.key === key ? result.data : [],
    error: error?.key === key ? error.text : null,
    isLoading: loading,
    refresh,
  };
}
