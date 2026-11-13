"use client";
import { useState } from "react";
import { doc } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnvironmentalManagement() {
  const { activeClientId } = useSgi();
  const db = useFirestore();
  const [month, setMonth] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" })
      .format(new Date())
      .slice(0, 7)
  );
  const ref = useMemoFirebase(
    () =>
      db &&
      activeClientId &&
      !["all", "unauthorized"].includes(activeClientId) &&
      /^\d{4}-\d{2}$/.test(month)
        ? doc(db, "companies", activeClientId, "environmental_measurements", month)
        : null,
    [db, activeClientId, month]
  );
  const { data, isLoading, error } = useDoc(ref);
  const evidence = typeof data?.source === "string" && data.source.trim() ? data.source : null;
  const amount = (key: string) =>
    evidence && typeof data?.[key] === "number" && Number.isFinite(data[key]) && data[key] >= 0
      ? Number(data[key])
      : null;
  function percent(key: string) {
    const total = amount("wasteKg"),
      part = amount(key);
    return total && part !== null && part <= total
      ? (part / total).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 })
      : null;
  }
  const critical = amount("criticalImpacts");
  const indicators = [
    ["Impactos críticos", Number.isInteger(critical) ? critical : null],
    ["Destinação final documentada", percent("disposedKg")],
    ["Resíduos desviados de aterro", percent("divertedKg")],
    [
      "Conformidade LIRA",
      evidence && typeof data?.liraStatus === "string" ? data.liraStatus.trim() || null : null,
    ],
  ] as const;
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Gestão ambiental</h1>
      <label className="block">
        Competência{" "}
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </label>
      <p role="status">
        {!ref
          ? "Selecione a empresa e a competência."
          : isLoading
            ? "Consultando medições…"
            : error
              ? "Não foi possível consultar as medições desta empresa."
              : evidence
                ? "Fonte: " + evidence
                : "Sem medição documentada para esta empresa e competência."}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {indicators.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
            </CardHeader>
            <CardContent>{value ?? "Não apurado"}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
