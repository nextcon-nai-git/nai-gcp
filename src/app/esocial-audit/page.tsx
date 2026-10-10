"use client";

import Link from "next/link";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";

type EventRecord = {
  eventType?: string;
  employeeName?: string;
  status?: string;
  firewallMessage?: string;
};
export default function EsocialAudit() {
  const { role, companyId } = useUser();
  const { activeClientId } = useSgi();
  const global =
    role === "SUPER_ADMIN" || (["ADMIN", "OPERATIONS"].includes(role || "") && !companyId);
  const selected = global ? activeClientId : companyId;
  if (!selected || ["all", "unauthorized"].includes(selected))
    return (
      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">Fila de eventos eSocial</h1>
        <p>Selecione um cliente no menu superior para consultar os eventos registrados.</p>
        <Link className="text-teal-700 underline" href="/clients">
          Abrir clientes
        </Link>
      </section>
    );
  return <EventQueue key={selected} companyId={selected} />;
}
function EventQueue({ companyId }: { companyId: string }) {
  const db = useFirestore();
  const ref = useMemoFirebase(
    () =>
      db
        ? query(
            collection(db, "companies", companyId, "esocial_events_queue"),
            orderBy("createdAt", "desc"),
            limit(100)
          )
        : null,
    [db, companyId]
  );
  const { data, error, isLoading } = useCollection<EventRecord>(ref);
  return (
    <section className="space-y-5 rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-semibold">Fila de eventos eSocial</h1>
      <p className="text-sm text-slate-600">
        Até 100 eventos registrados para o cliente selecionado. A presença na fila e o status
        interno não comprovam transmissão: confira o recibo do evento no sistema transmissor.
      </p>
      {error ? (
        <p role="alert" className="text-amber-800">
          Não foi possível consultar a fila. Confira as permissões e tente novamente.
        </p>
      ) : !db || isLoading || !data ? (
        <p role="status">Carregando eventos…</p>
      ) : !data.length ? (
        <p>Nenhum evento registrado nesta fila.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Evento</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Status registrado</th>
                <th className="p-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {data.map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="p-3">{event.eventType || "Não informado"}</td>
                  <td className="p-3">{event.employeeName || "Não informado"}</td>
                  <td className="p-3">{event.status || "Não informado"}</td>
                  <td className="p-3">{event.firewallMessage || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link
        href={`/action-plans?company=${encodeURIComponent(companyId)}`}
        className="inline-block text-teal-700 underline"
      >
        Acompanhar pendências do cliente
      </Link>
    </section>
  );
}
