"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  WorkSourceQuery,
  currentWorkWeek,
  type WorkSourceSelection,
} from "@/lib/work-source-query";

type Result = { query: WorkSourceSelection; answer: string };
type Props = {
  companyId: string;
  lastRead: Result | null;
  request: (body: unknown) => Promise<{ answer: string }>;
};
const labels = {
  rd: "Pedidos recebidos pelo RD",
  rd_atendimentos: "Atendimentos no RD Conversas",
  soc: "ASOs emitidos no SOC",
  rd_soc: "Conciliação RD e SOC",
  omie: "Contas a receber no Omie",
};

export function WorkSourcePanel({ companyId, lastRead, request }: Props) {
  const [query, setQuery] = React.useState<WorkSourceSelection>(
    () => lastRead?.query ?? { source: "rd_soc", ...currentWorkWeek() }
  );
  const [minutes, setMinutes] = React.useState(0);
  const [result, setResult] = React.useState(lastRead?.answer ?? "");
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState("");
  const version = React.useRef(0);
  const inFlight = React.useRef(false);
  function edit(next: WorkSourceSelection) {
    version.current++;
    inFlight.current = false;
    setBusy(false);
    setResult("");
    setFailure("");
    setQuery(next);
  }
  const refresh = React.useCallback(async () => {
    if (inFlight.current) return;
    if (!WorkSourceQuery.safeParse(query).success) {
      setFailure("Escolha um período válido de até 31 dias.");
      return;
    }
    const id = version.current;
    inFlight.current = true;
    setFailure("");
    setBusy(true);
    try {
      const reply = await request({ action: "read_sources", companyId, query });
      if (id === version.current) setResult(reply.answer);
    } catch {
      if (id === version.current) {
        setResult("");
        setFailure("Não foi possível consultar. Confira o acesso às fontes e tente novamente.");
      }
    } finally {
      if (id === version.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }, [companyId, query, request]);
  React.useEffect(() => {
    if (!minutes) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, minutes * 60000);
    return () => window.clearInterval(timer);
  }, [minutes, refresh]);
  return (
    <section aria-label="Consultar fontes do cliente" className="space-y-3 rounded-xl border p-4">
      <h2 className="font-bold">Consultas SOC, Omie e RD</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          Fonte{" "}
          <select
            value={query.source}
            onChange={(e) =>
              edit({ ...query, source: e.target.value as WorkSourceSelection["source"] })
            }
          >
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          De{" "}
          <input
            type="date"
            value={query.start}
            onChange={(e) => edit({ ...query, start: e.target.value })}
          />
        </label>
        <label>
          Até{" "}
          <input
            type="date"
            value={query.end}
            onChange={(e) => edit({ ...query, end: e.target.value })}
          />
        </label>
        <label>
          Atualização com o painel aberto{" "}
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            <option value={0}>Manual</option>
            <option value={5}>A cada 5 minutos</option>
            <option value={15}>A cada 15 minutos</option>
          </select>
        </label>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Consultando…" : "Consultar fontes"}
        </Button>
      </div>
      {failure && <p role="alert">{failure}</p>}
      {result && (
        <p role="status" className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm">
          {result}
        </p>
      )}
    </section>
  );
}
