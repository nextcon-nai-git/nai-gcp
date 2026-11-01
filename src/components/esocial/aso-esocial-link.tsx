"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileCode2 } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import type { AsoFlowCard } from "@/lib/aso-flow";
import type { EsocialMessageEvent } from "@/lib/esocial-messaging";
import { EventStatus } from "./event-status";

export function AsoEsocialLink({ card }: { card: AsoFlowCard }) {
  const { user } = useUser();
  return <AsoLinkSession key={`${user?.uid || "none"}:${card.id}:${card.version}`} card={card} />;
}

function AsoLinkSession({ card }: { card: AsoFlowCard }) {
  const { user } = useUser();
  const active = useRef(true);
  const [events, setEvents] = useState<EsocialMessageEvent[]>([]);
  const [status, setStatus] = useState("Consultando eSocial…");
  const reviewed = !!card.aso && card.review?.hash === card.aso.hash;
  const params = new URLSearchParams({ company: card.companyId });
  if (reviewed) params.set("aso", card.id);
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    if (user)
      void (async () => {
        try {
          const token = await user.getIdToken();
          const query = new URLSearchParams({
            companyId: card.companyId,
            asoCaseId: card.id,
            summary: "true",
          });
          const response = await fetch(`/api/esocial/messaging?${query}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          });
          const result = await response.json();
          if (!active.current) return;
          if (!response.ok || !Array.isArray(result.events))
            throw new Error("Consulta indisponível");
          setEvents(result.events);
          setStatus(
            result.events.length
              ? ""
              : reviewed
                ? "eSocial · Ainda sem evento"
                : "eSocial · ASO a conferir"
          );
        } catch {
          if (active.current) {
            setEvents([]);
            setStatus("eSocial · Consulta indisponível");
          }
        }
      })();
    return () => {
      active.current = false;
      controller.abort();
    };
  }, [user, card.companyId, card.id, reviewed]);
  return (
    <div className="my-4 space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">eSocial</h3>
        <Button asChild size="sm" variant="outline">
          <Link href={`/esocial/messaging?${params}`}>
            <FileCode2 className="mr-2 size-4" />
            {reviewed ? "Preparar / acompanhar S-2220" : "Abrir mensageria"}
          </Link>
        </Button>
      </div>
      {status && <p className="text-xs text-slate-500">{status}</p>}
      {events.slice(0, 3).map((event) => (
        <div key={event.id} className="flex flex-wrap items-center gap-2">
          <span className="text-xs">
            {event.eventType.replace("S", "S-")} ·{" "}
            {event.environment === "production" ? "Produção" : "Restrita"}
          </span>
          <EventStatus event={event} />
          {event.receipt && <span className="break-all text-xs">Recibo: {event.receipt}</span>}
        </div>
      ))}
      {events.length > 3 && (
        <p className="text-xs text-slate-500">
          Mais {events.length - 3} eventos no painel de mensageria.
        </p>
      )}
    </div>
  );
}
