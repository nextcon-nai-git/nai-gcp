"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Clock3, LockKeyhole, RefreshCw } from "lucide-react";
import { useUser } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OperationEvidence, OperationalStatus } from "@/lib/operational-status";

const labels: Record<OperationEvidence["state"], string> = {
  unobserved: "Sem execução registrada",
  invalid: "Registro requer conferência",
  stale: "Registro desatualizado",
  completed: "Execução registrada",
  partial: "Pendências registradas",
  failed: "Falha registrada",
  unverified: "Resultado não confirmado",
};
const counterLabels: Record<string, string> = {
  checked: "Consultados",
  waiting: "Aguardando",
  unavailable: "Indisponíveis",
  saved: "Arquivos recebidos",
  skipped: "Ignorados",
  examined: "Itens examinados",
  hasMore: "Próximo lote pendente",
  queueUpdated: "Fila atualizada",
  periodicUpdated: "Periódicos atualizados",
  rowCount: "Linhas da fila",
  sourceRows: "Linhas da campanha",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

export function OperationalStatusPanel() {
  const { user, role, isUserLoading } = useUser();
  const uid = user?.uid;
  const allowed = !!user && role === "SUPER_ADMIN";
  const [report, setReport] = useState<OperationalStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!allowed || !uid) return;
    const id = ++requestId.current;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    await Promise.resolve();
    if (active.signal.aborted || requestId.current !== id) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const token = await getActionIdToken();
      if (active.signal.aborted) return;
      const response = await fetch("/api/admin/operations", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: active.signal,
      });
      const body = await response.json();
      if (!response.ok || !body.controls || !Array.isArray(body.operations)) throw new Error();
      if (requestId.current === id && !active.signal.aborted) setReport(body);
    } catch {
      if (requestId.current === id && !active.signal.aborted)
        setError("Não foi possível consultar os registros. Confira seu acesso e tente novamente.");
    } finally {
      if (requestId.current === id && !active.signal.aborted) setBusy(false);
    }
  }, [allowed, uid]);

  useEffect(() => {
    if (allowed) void refresh();
    return () => {
      requestId.current++;
      controller.current?.abort();
    };
  }, [allowed, refresh]);

  if (isUserLoading) return <p role="status">Carregando acesso…</p>;
  if (!allowed) return <p>Acompanhamento disponível para a administração global.</p>;

  return (
    <section className="space-y-5" aria-label="Acompanhamento operacional">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Activity className="h-6 w-6" />
          Operações
        </h1>
        <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Consultando…" : "Atualizar registros"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando execuções registradas no NAI.
        </p>
      )}
      {report && (
        <>
          <div className="flex flex-wrap gap-3" aria-label="Controles de envio">
            <Badge
              variant={report.controls.esocialTransmissionBlocked ? "secondary" : "destructive"}
            >
              <LockKeyhole className="mr-1 h-3 w-3" />
              eSocial:{" "}
              {report.controls.esocialTransmissionBlocked ? "envio bloqueado" : "envio habilitado"}
            </Badge>
            <Badge variant={report.controls.clientEmailBlocked ? "secondary" : "destructive"}>
              <LockKeyhole className="mr-1 h-3 w-3" />
              E-mail ao cliente:{" "}
              {report.controls.clientEmailBlocked ? "envio bloqueado" : "envio habilitado"}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {report.operations.map(({ id, label, configuration, evidence, staleAfterMinutes }) => (
              <Card key={id}>
                <CardHeader className="space-y-3 pb-3">
                  <CardTitle className="text-lg">{label}</CardTitle>
                  <div>
                    <Badge variant={evidence.state === "failed" ? "destructive" : "outline"}>
                      {labels[evidence.state]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {configuration.present
                      ? "Configuração de invocação presente"
                      : `Configuração pendente: ${configuration.missing.join(", ")}`}
                  </p>
                  {evidence.latest && (
                    <>
                      <p className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        {date(evidence.latest.finishedAt)}
                      </p>
                      <dl className="grid grid-cols-2 gap-2">
                        {Object.entries(evidence.latest.counters).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-xs text-muted-foreground">
                              {counterLabels[key] || "Itens"}
                            </dt>
                            <dd className="font-semibold">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                  {evidence.state === "stale" && (
                    <p className="text-muted-foreground">
                      Sem registro recente nos últimos {staleAfterMinutes} minutos.
                    </p>
                  )}
                  {evidence.lastFailure &&
                    evidence.lastFailure.runId !== evidence.latest?.runId && (
                      <p className="text-xs text-muted-foreground">
                        Última pendência: {date(evidence.lastFailure.finishedAt)}
                      </p>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Consultado em {date(report.generatedAt)} · horário de Brasília.
          </p>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Uma execução registrada pode não ter itens para processar. Certificados, permissões em
            nuvem e homologações externas precisam de validação própria.
          </p>
        </>
      )}
    </section>
  );
}
