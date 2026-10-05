"use client";
import { pgrRequestHeaders } from "@/lib/pgr-request-headers";
import * as React from "react";
import { Bot, Loader2 } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { PGR_AGENT_NAMES, type PGR_AGENT_ROLES } from "@/lib/pgr-schema";
type Review = {
  resumo: string;
  achados: { descricao: string; evidencia: string; prioridade: string }[];
  checklist: string[];
  encaminhamentos: string[];
  limites: string;
};
export function PgrAgentReview({
  companyId,
  cardId,
  role,
}: {
  companyId: string;
  cardId: string;
  role: (typeof PGR_AGENT_ROLES)[number];
}) {
  const { user } = useUser();
  const [review, setReview] = React.useState<Review | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const serial = React.useRef(0);
  React.useEffect(() => {
    const run = ++serial.current;
    const controller = new AbortController();
    setReview(null);
    setBusy(false);
    setError("");
    if (user)
      void (async () => {
        try {
          const response = await fetch(
            "/api/pgr/agent-review?" + new URLSearchParams({ companyId, cardId, role }),
            { headers: await pgrRequestHeaders(user), cache: "no-store", signal: controller.signal }
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Revisão indisponível.");
          if (run === serial.current) setReview(data.review);
        } catch (e) {
          if (run === serial.current)
            setError(e instanceof Error ? e.message : "Consulta indisponível.");
        }
      })();
    return () => {
      serial.current++;
      controller.abort();
    };
  }, [user?.uid, companyId, cardId, role]);
  async function run() {
    if (!user) return;
    const run = ++serial.current;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pgr/agent-review", {
        method: "POST",
        headers: await pgrRequestHeaders(user, true),
        body: JSON.stringify({ companyId, cardId, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Revisão indisponível.");
      if (run === serial.current) setReview(data.review);
    } catch (e) {
      if (run === serial.current) setError(e instanceof Error ? e.message : "Falha na revisão.");
    } finally {
      if (run === serial.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{PGR_AGENT_NAMES[role]}</p>
        <Button size="sm" variant="outline" onClick={run} disabled={busy || !user}>
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Bot className="mr-2 size-4" />
          )}
          Preparar revisão IA
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Gera e salva um rascunho de revisão. A equipe valida e executa as ações.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {review && (
        <div className="space-y-3 text-sm">
          <p>{review.resumo}</p>
          {review.achados.map((a, i) => (
            <div key={i} className="border-l-2 pl-3">
              <p className="font-medium">{a.descricao}</p>
              <p className="text-xs text-muted-foreground">{a.evidencia}</p>
            </div>
          ))}
          <ul className="list-disc space-y-1 pl-5">
            {review.checklist.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {review.encaminhamentos.map((x, i) => (
            <p key={i}>{x}</p>
          ))}
          <p className="text-xs text-amber-800">{review.limites}</p>
        </div>
      )}
    </div>
  );
}
