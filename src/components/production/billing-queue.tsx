"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  billingStatusNames,
  searchBillingItem,
  type BillingQueueSnapshot,
  type BillingQueueStatus,
} from "@/lib/production/billing-queue";

const field = "rounded-md border border-input bg-background p-2 text-sm";
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const titleStatus = {
  draft: "Rascunho",
  submitted: "Em aprovação",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};
const titleSource = {
  manual: "Manual",
  recurring: "Recorrência",
  service: "Serviço",
  order: "Pedido",
};

export function BillingQueue({
  centralVersion,
  loadSnapshot,
  onOpen,
}: {
  centralVersion: number;
  loadSnapshot: (signal: AbortSignal, expectedVersion: number) => Promise<BillingQueueSnapshot>;
  onOpen: (recordId: string, cycleId: string) => void;
}) {
  const [snapshot, setSnapshot] = React.useState<BillingQueueSnapshot | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(true);
  const [refresh, setRefresh] = React.useState(0);
  const [status, setStatus] = React.useState<BillingQueueStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [limit, setLimit] = React.useState(20);

  React.useEffect(() => {
    const controller = new AbortController();
    setSnapshot(null);
    setError("");
    setBusy(true);
    setLimit(20);
    void (async () => {
      try {
        const result = await loadSnapshot(controller.signal, centralVersion);
        if (controller.signal.aborted) return;
        if (result.centralVersion !== centralVersion)
          throw new Error("A Central mudou. Atualize a Central e consulte a fila novamente.");
        setSnapshot(result);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setSnapshot(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível consultar a fila. Atualize para tentar novamente."
        );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [centralVersion, loadSnapshot, refresh]);

  // A new book version hides the previous snapshot during render, before the
  // effect starts its replacement request. Aborted responses never restore it.
  const current = snapshot?.centralVersion === centralVersion ? snapshot : null;
  const filtered = (current?.items || []).filter(
    (item) => (status === "all" || item.status === status) && searchBillingItem(item, search)
  );

  return (
    <section aria-label="Operação e faturamento" className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl space-y-1">
          <h2 className="text-lg font-semibold">Operação e faturamento</h2>
          <p className="text-sm text-muted-foreground">
            Entregas, antecipações e medições dos contratos ativos que precisam de conferência para
            faturamento. Abra o ciclo para revisar evidências e registrar os próximos passos.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setSnapshot(null);
            setRefresh((value) => value + 1);
          }}
        >
          {busy ? "Consultando fila…" : "Atualizar fila"}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!current && !error && (
        <p role="status" className="text-sm">
          Consultando a Central e o ERP…
        </p>
      )}
      {current && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["Ciclos para conferir", current.summary.cycles],
              ["Aguardando medição concluída", current.summary.awaitingMeasurement],
              ["Com revisão necessária", current.summary.needsReview],
              ["Saldo medido para conferência", money(current.summary.measuredBalanceCents)],
            ].map(([label, value]) => (
              <div className="rounded-md bg-muted p-3" key={label}>
                <p className="text-xs">{label}</p>
                <strong className="text-xl">{value}</strong>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              {current.summary.delivered} ciclo(s) com entrega conferida ·{" "}
              {current.summary.advances} antecipação(ões) documentada(s). O saldo do indicador reúne
              apenas medições concluídas com saldo, sem pendências identificadas; mensalidades,
              antecipações e revisões ficam fora desse total.
            </p>
            <p>
              Obrigações e serviços do ERP não são somados como novas cobranças. A emissão e a
              aprovação continuam no fluxo financeiro existente.
            </p>
            <p>
              Consulta de{" "}
              {new Date(current.generatedAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
              {" (Brasília)"} · Central v{current.centralVersion} · ERP v{current.financeVersion}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Buscar para faturamento
              <input
                className={field}
                value={search}
                placeholder="Cliente, CNPJ, contrato, serviço ou responsável"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(20);
                }}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Filtrar situação de faturamento
              <select
                className={field}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as BillingQueueStatus | "all");
                  setLimit(20);
                }}
              >
                <option value="all">Todas as situações</option>
                {Object.entries(billingStatusNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p role="status" className="text-sm">
            {filtered.length} ciclo(s) no filtro · exibindo {Math.min(limit, filtered.length)}
          </p>
          {filtered.length === 0 ? (
            <p className="text-sm">
              {current.items.length
                ? "Nenhum ciclo corresponde a este filtro."
                : "Nenhum ciclo pendente de conferência de faturamento nesta consulta."}
            </p>
          ) : (
            <div className="max-h-144 overflow-auto rounded border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <caption className="sr-only">
                  Ciclos e pendências entre operação e faturamento
                </caption>
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {[
                      "Cliente e ciclo",
                      "Evidências",
                      "Valores registrados",
                      "Conferência e próximo passo",
                      "Ação",
                    ].map((label) => (
                      <th key={label} scope="col" className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((item) => (
                    <tr key={item.key} className="border-t align-top">
                      <td className="space-y-1 p-3">
                        <p className="font-medium">{item.company}</p>
                        <p className="text-xs text-muted-foreground">{item.cnpj}</p>
                        <p>{item.contract}</p>
                        <p className="text-xs">
                          {item.service} · {item.period}
                        </p>
                        <p className="text-xs">
                          Competência: {item.competence || "a conferir no ERP"} · Versão contratual{" "}
                          {item.revision + 1}
                        </p>
                      </td>
                      <td className="space-y-1 p-3">
                        <p>
                          {item.delivered
                            ? "Entrega conferida"
                            : item.origin === "advance"
                              ? "Antecipação documentada"
                              : "Execução a conferir"}
                        </p>
                        <p className="text-xs">
                          {item.obligations.completed} obrigação(ões) concluída(s) ·{" "}
                          {item.obligations.waived} dispensada(s) · {item.obligations.total} no
                          ciclo
                        </p>
                        <p className="text-xs">
                          {item.measurementApproved
                            ? "Medição concluída com evidência"
                            : "Medição ainda não concluída"}
                        </p>
                        {item.recurring && (
                          <p className="text-xs">Cobertura recorrente a conferir</p>
                        )}
                      </td>
                      <td className="space-y-1 whitespace-nowrap p-3 text-xs">
                        <p>Medido: {money(item.measuredCents)}</p>
                        <p>Faturado: {money(item.invoicedCents)}</p>
                        <p className="font-medium">
                          Saldo registrado:{" "}
                          {item.balanceCents === null ? "a conferir" : money(item.balanceCents)}
                        </p>
                        {item.balanceCents !== null && item.status !== "invoice" && (
                          <p className="max-w-48 whitespace-normal text-muted-foreground">
                            Fora do saldo do indicador.
                          </p>
                        )}
                      </td>
                      <td className="max-w-md space-y-2 p-3">
                        <p
                          className={
                            item.status === "review"
                              ? "font-medium text-amber-700 dark:text-amber-300"
                              : "font-medium"
                          }
                        >
                          {billingStatusNames[item.status]}
                        </p>
                        {item.issues.length > 0 && (
                          <details className="text-xs" open>
                            <summary className="cursor-pointer">
                              {item.issues.length} ponto(s) para revisar
                            </summary>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                              {item.issues.map((issue, index) => (
                                <li key={index}>{issue}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <p className="text-xs">{item.nextAction}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.owner || "Responsável pendente"} ·{" "}
                          {item.due
                            ? item.due.split("-").reverse().join("/")
                            : "Prazo não programado"}
                        </p>
                        {item.financeTitleId && (
                          <p className="text-xs">
                            Título vinculado: {item.financeTitleId}
                            {item.linkedTitle && (
                              <>
                                {" · "}
                                {titleStatus[item.linkedTitle.status]} · competência{" "}
                                {item.linkedTitle.competence} ·{" "}
                                {money(item.linkedTitle.amountCents)}
                              </>
                            )}
                          </p>
                        )}
                        {item.candidateCount > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer">
                              Conferir {item.candidateCount} título(s) no ERP
                            </summary>
                            <ul className="mt-1 space-y-1">
                              {item.candidates.map((title) => (
                                <li key={title.id}>
                                  {title.id} · {titleStatus[title.status]} ·{" "}
                                  {titleSource[title.source]} · {title.competence} ·{" "}
                                  {money(title.amountCents)}
                                </li>
                              ))}
                            </ul>
                            {item.candidateCount > item.candidates.length && (
                              <p className="mt-1">
                                Exibindo {item.candidates.length} de {item.candidateCount}. Confira
                                a lista completa no ERP.
                              </p>
                            )}
                          </details>
                        )}
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Conferir ciclo ${item.service} de ${item.company}`}
                          onClick={() => onOpen(item.recordId, item.cycleId)}
                        >
                          Conferir ciclo
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {limit < filtered.length && (
            <Button type="button" variant="outline" onClick={() => setLimit((value) => value + 20)}>
              Mostrar mais 20
            </Button>
          )}
        </>
      )}
      <Button asChild variant="outline">
        <Link href="/financial/operacoes">Conferir títulos no ERP</Link>
      </Button>
    </section>
  );
}
