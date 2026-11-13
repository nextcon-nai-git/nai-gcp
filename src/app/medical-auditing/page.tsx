"use client";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";

export default function MedicalAuditingDashboard() {
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const target = useMemoFirebase(
    () =>
      db && activeClientId && !["all", "unauthorized"].includes(activeClientId)
        ? query(
            collection(db, "medical_audits"),
            where("companyId", "==", activeClientId),
            orderBy("createdAt", "desc"),
            limit(20)
          )
        : null,
    [db, activeClientId]
  );
  const { data, isLoading, error } = useCollection<{ inconsistencias?: unknown }>(target);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Auditoria médica</h1>
      <p>Resultados das últimas 20 auditorias registradas para a empresa selecionada.</p>
      {!target || isLoading || error || !data?.length ? (
        <p role="status">
          {!target
            ? "Selecione uma empresa."
            : isLoading
              ? "Consultando registros…"
              : error
                ? "Não foi possível consultar as auditorias."
                : "Nenhuma auditoria registrada."}
        </p>
      ) : (
        <ul className="space-y-4">
          {data.map((a) => {
            const issues = Array.isArray(a.inconsistencias)
              ? a.inconsistencias.filter((v): v is string => typeof v === "string" && !!v.trim())
              : [];
            return (
              <li key={a.id} className="rounded border p-4">
                <h2 className="font-semibold">Auditoria {a.id}</h2>
                {issues.length ? (
                  <ul className="list-disc pl-6">
                    {issues.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Sem divergências documentadas neste registro.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
