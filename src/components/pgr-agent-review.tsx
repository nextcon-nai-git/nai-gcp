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
type Props = {
  companyId: string;
  cardId: string;
  role: (typeof PGR_AGENT_ROLES)[number];
};
export function PgrAgentReview(props: Props) {
  const profile = useUser();
  const enabled = !!profile.user && !profile.isUserLoading && !profile.userError;
  const sessionKey = JSON.stringify([
    profile.user?.uid,
    profile.role,
    profile.companyId,
    profile.tenantId,
    [...new Set(profile.servedCompanies || [])].sort(),
    enabled,
    props.companyId,
    props.cardId,
    props.role,
  ]);
  return <PgrAgentReviewSession key={sessionKey} {...props} enabled={enabled} />;
}
function PgrAgentReviewSession({ companyId, cardId, role, enabled }: Props & { enabled: boolean }) {
  const { user } = useUser();
  const [review, setReview] = React.useState<Review | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const serial = React.useRef(0);
  const active = React.useRef(true);
  const pending = React.useRef(false);
  const readController = React.useRef<AbortController | null>(null);
  const writeController = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    active.current = true;
    const run = ++serial.current;
    const controller = new AbortController();
    readController.current = controller;
    setReview(null);
    setBusy(false);
    setError("");
    if (user && enabled)
      void (async () => {
        try {
          const headers = await pgrRequestHeaders(user);
          if (!active.current || run !== serial.current) return;
          const response = await fetch(
            "/api/pgr/agent-review?" + new URLSearchParams({ companyId, cardId, role }),
            { headers, cache: "no-store", signal: controller.signal }
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
      active.current = false;
      serial.current++;
      controller.abort();
      writeController.current?.abort();
    };
  }, [user, companyId, cardId, role, enabled]);
  async function run() {
    if (!user || !enabled || pending.current || !active.current) return;
    pending.current = true;
    const run = ++serial.current;
    readController.current?.abort();
    const controller = new AbortController();
    writeController.current = controller;
    setBusy(true);
    setError("");
    try {
      const headers = await pgrRequestHeaders(user, true);
      if (!active.current || run !== serial.current) return;
      const response = await fetch("/api/pgr/agent-review", {
        method: "POST",
        headers,
        body: JSON.stringify({ companyId, cardId, role }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Revisão indisponível.");
      if (run === serial.current) setReview(data.review);
    } catch (e) {
      if (run === serial.current) {
        setReview(null);
        setError(e instanceof Error ? e.message : "Falha na revisão.");
      }
    } finally {
      pending.current = false;
      if (writeController.current === controller) writeController.current = null;
      if (run === serial.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold">{PGR_AGENT_NAMES[role]}</p>
        <Button size="sm" variant="outline" onClick={run} disabled={busy || !user || !enabled}>
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Bot className="mr-2 size-4" />
          )}
          {busy ? "Consultando agente…" : review ? "Atualizar revisão" : "Revisar documento"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O agente revisa as evidências deste documento e salva uma proposta de trabalho para
        conferência da equipe.
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
