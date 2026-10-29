"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useUser } from "@/firebase";
import { AVP_SOURCE } from "@/lib/avp-source-config";
import type { AvpMapClinic } from "@/lib/avp-map-clinics";
import { GrupoAvpQueueMap } from "./grupo-avp-queue-map";

export function GrupoAvpLiveCostMap(props: ComponentProps<typeof GrupoAvpQueueMap>) {
  const { user } = useUser();
  const [result, setResult] = useState<{
    owner: string;
    clinics: AvpMapClinic[];
    checkedAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        if (!active) return;
        const response = await fetch("/api/clients/grupo-avp/map-clinics", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok || !Array.isArray(data.clinics)) {
          setResult(null);
          throw new Error("Não foi possível atualizar as clínicas e os custos.");
        }
        setResult({ owner: user.uid, clinics: data.clinics, checkedAt: data.checkedAt });
        setError("");
      } catch {
        if (active) {
          setResult(null);
          setError("Clínicas atuais indisponíveis; o mapa mostra os valores históricos da fila.");
        }
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), AVP_SOURCE.intervalSeconds * 1000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [user]);
  const current = result?.owner === user?.uid ? result : null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground" role="status">
        {error ||
          (current
            ? `Clínicas e custos consultados em ${new Date(current.checkedAt).toLocaleString("pt-BR")}`
            : "Consultando clínicas e custos atuais…")}
      </p>
      <GrupoAvpQueueMap {...props} clinics={current?.clinics} />
    </div>
  );
}
