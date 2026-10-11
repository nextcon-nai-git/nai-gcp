"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, RefreshCw, Wallet } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  amountCents,
  brazilToday,
  collectTitles,
  daysUntil,
  summarizeTitles,
  titlesCsv,
  type Portfolio,
} from "@/lib/financial/treasury";

type Kind = "receivable" | "payable";
type State = { data?: Portfolio; error?: string; progress?: string };
const labels: Record<Kind, string> = { receivable: "Contas a receber", payable: "Contas a pagar" };
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const links = [
  ["/financial/omie/dre", "Resultado e despesas", "DRE por período e categoria no Omie"],
  ["/financial/actions", "Plano de ação", "Responsáveis, prazos e checklists financeiros"],
  ["/financial/monthly-billing", "Faturamento mensal", "Acompanhamento por grupo e contrato"],
  ["/financial/livro-diario", "Livro diário", "Lançamentos com referência ao documento"],
  ["/financial/balanco", "Balanço 2025", "Acervo contábil do exercício"],
  ["/financial/faturamento", "Contratos e histórico", "Medições, SESMT e bases históricas"],
];

export function TreasuryWorkspace() {
  const { user } = useUser();
  const [states, setStates] = useState<Record<Kind, State>>({ receivable: {}, payable: {} });
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind>("receivable");
  const [search, setSearch] = useState("");
  const [window, setWindow] = useState("all");
  const [page, setPage] = useState(1);
  const [asOf, setAsOf] = useState(brazilToday);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    controller.current?.abort();
    setStates({ receivable: {}, payable: {} });
    setBusy(false);
    return () => {
      generation.current++;
      controller.current?.abort();
    };
  }, [user]);

  async function refresh() {
    if (!user || busy) return;
    const active = new AbortController();
    controller.current = active;
    const request = ++generation.current;
    const signal = AbortSignal.any([active.signal, AbortSignal.timeout(180000)]);
    setStates({ receivable: {}, payable: {} });
    setAsOf(brazilToday());
    setPage(1);
    setBusy(true);
    const update = (type: Kind, state: State) => {
      if (request === generation.current) setStates((old) => ({ ...old, [type]: state }));
    };
    try {
      await Promise.all(
        (["receivable", "payable"] as const).map(async (type) => {
          try {
            const data = await collectTitles(
              async (number) => {
                const token = await user.getIdToken();
                signal.throwIfAborted();
                const response = await fetch(
                  `/api/financial/omie?view=titles&kind=${type}&status=EMABERTO&page=${number}`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-store",
                    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
                  }
                );
                const body = await response.json();
                if (!response.ok)
                  throw new Error(body.error || "Consulta indisponível. Tente atualizar.");
                return body;
              },
              (loaded, total) =>
                update(type, { progress: `${loaded} de ${total} títulos consultados` }),
              signal
            );
            update(type, { data });
          } catch (error) {
            update(type, {
              error: signal.aborted
                ? "Consulta interrompida ou tempo limite atingido. Atualize para tentar novamente."
                : error instanceof Error
                  ? error.message
                  : "Consulta indisponível.",
            });
          }
        })
      );
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }

  const selected = states[kind];
  const rows = useMemo(
    () =>
      (selected.data?.rows || [])
        .filter((row) => {
          const text =
            `${row.id} ${row.document} ${row.partyCode} ${row.category}`.toLocaleLowerCase("pt-BR");
          if (!text.includes(search.trim().toLocaleLowerCase("pt-BR"))) return false;
          const days = daysUntil(row.dueDate, asOf);
          if (window === "overdue") return days !== null && days < 0;
          if (window === "week") return days !== null && days >= 0 && days <= 7;
          if (window === "month") return days !== null && days >= 0 && days <= 30;
          if (window === "invalid") return days === null || amountCents(row.amount) === null;
          return true;
        })
        .sort(
          (a, b) =>
            (daysUntil(a.dueDate, asOf) ?? Infinity) - (daysUntil(b.dueDate, asOf) ?? Infinity) ||
            a.id.localeCompare(b.id)
        ),
    [selected.data, search, window, asOf]
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const visible = rows.slice((page - 1) * 25, page * 25);
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([titlesCsv(rows, labels[kind])], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `nextcon-${kind}-${asOf}${selected.data?.complete ? "" : "-parcial"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16 text-white">
      <header className="rounded-3xl border border-white/10 bg-[#102640] p-6 md:p-9">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-200">
          <Wallet size={20} /> NEXTCON · FINANCEIRO
        </p>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold md:text-4xl">Controle financeiro</h1>
            <p className="mt-3 max-w-2xl text-slate-200">
              Organize cobranças, acompanhe vencimentos e conecte cada decisão aos registros da
              empresa.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={refresh}
              disabled={!user || busy}
              className="gap-2 bg-cyan-300 text-slate-950 hover:bg-cyan-200"
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
              {busy ? "Consultando…" : "Consultar Omie"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/financial/omie">Gerenciar conexão</Link>
            </Button>
            {busy && (
              <Button variant="outline" onClick={() => controller.current?.abort()}>
                Interromper
              </Button>
            )}
          </div>
        </div>
        <p className="mt-5 text-xs text-slate-300">
          Financeiro interno da NEXTCON · independente do cliente selecionado no menu · datas em
          Brasília
        </p>
      </header>

      <section aria-label="Agenda financeira" className="grid gap-5 lg:grid-cols-2">
        {(["receivable", "payable"] as const).map((type) => {
          const state = states[type];
          const summary = state.data ? summarizeTitles(state.data.rows, asOf) : null;
          return (
            <article key={type} className="rounded-2xl border border-white/10 bg-[#10213a] p-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                {type === "receivable" ? (
                  <ArrowDownLeft className="text-emerald-300" />
                ) : (
                  <ArrowUpRight className="text-amber-300" />
                )}
                {labels[type]}
              </h2>
              {state.error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-amber-400/40 p-3 text-amber-100"
                >
                  {state.error}
                </p>
              ) : !state.data ? (
                <p role="status" className="mt-4 text-slate-300">
                  {busy
                    ? state.progress || "Aguardando retorno do Omie…"
                    : "Consulte o Omie para carregar os títulos em aberto."}
                </p>
              ) : (
                <>
                  <p className="mt-3 text-sm text-slate-300">
                    {state.data.complete ? "Carteira consultada" : "Cobertura parcial"}:{" "}
                    {state.data.rows.length} de {state.data.total} títulos em aberto.
                  </p>
                  {state.data.warning && (
                    <p role="alert" className="mt-2 text-sm text-amber-200">
                      {state.data.warning}
                    </p>
                  )}
                  <dl className="mt-5 space-y-3">
                    {summary!.buckets.map((bucket) => (
                      <div
                        key={bucket.label}
                        className="flex items-center justify-between gap-3 border-b border-white/10 pb-3"
                      >
                        <dt className="text-sm text-slate-200">
                          {bucket.label}
                          <span className="ml-2 text-xs text-slate-400">
                            {bucket.count} títulos
                          </span>
                        </dt>
                        <dd className="font-semibold tabular-nums">{money(bucket.cents)}</dd>
                      </div>
                    ))}
                  </dl>
                  {!!summary!.invalid && (
                    <p className="mt-3 text-sm text-amber-200">
                      {summary!.invalid} títulos com data ou valor inválido, excluídos dos
                      indicadores.
                    </p>
                  )}
                  <p className="mt-4 text-xs text-slate-400">
                    Consulta:{" "}
                    {state.data.queriedAt
                      ? new Date(state.data.queriedAt).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })
                      : "incompleta"}
                  </p>
                </>
              )}
            </article>
          );
        })}
      </section>
      <p className="rounded-xl border border-cyan-300/20 bg-cyan-950/30 p-4 text-sm text-slate-200">
        Agenda baseada nos valores originais dos títulos retornados pelo filtro “Em aberto” do Omie.
        Pagamentos parciais podem reduzir o saldo devido. Saldo bancário, caixa disponível e
        previsão líquida dependem da conciliação das baixas e dos extratos.
      </p>

      <section
        aria-labelledby="titles-heading"
        className="space-y-5 rounded-2xl border border-white/10 bg-[#10213a] p-5 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="titles-heading" className="text-xl font-semibold">
              Fila de acompanhamento
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Vencimentos mais antigos primeiro. Localize o título pelo documento, código ou
              categoria.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!rows.length || busy}
            onClick={exportCsv}
            className="gap-2"
          >
            <Download size={16} />
            Exportar seleção CSV
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span>Carteira</span>
            <select
              className="block w-full rounded-lg border border-white/20 bg-[#0b1729] p-2.5 text-white"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setPage(1);
              }}
            >
              <option value="receivable">Contas a receber</option>
              <option value="payable">Contas a pagar</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>Vencimento</span>
            <select
              className="block w-full rounded-lg border border-white/20 bg-[#0b1729] p-2.5 text-white"
              value={window}
              onChange={(e) => {
                setWindow(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              <option value="overdue">Vencidos</option>
              <option value="week">Hoje e próximos 7 dias</option>
              <option value="month">Hoje e próximos 30 dias</option>
              <option value="invalid">Dados para conferir</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span>Buscar títulos</span>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Documento, código ou categoria"
            />
          </label>
        </div>
        {!selected.data ? (
          <p className="py-8 text-center text-slate-300">
            {selected.error
              ? "Carteira indisponível. Confira o aviso acima e atualize a consulta."
              : "A lista será exibida após a consulta."}
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              {rows.length} títulos nesta seleção ·{" "}
              {selected.data.complete ? "base consultada completa" : "base parcial"} · referência{" "}
              {asOf.split("-").reverse().join("/")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Títulos em aberto consultados no Omie, ordenados por vencimento
                </caption>
                <thead>
                  <tr className="border-b border-white/20 text-slate-300">
                    {[
                      "Título / documento",
                      "Cliente ou fornecedor (código)",
                      "Vencimento",
                      "Situação no Omie",
                      "Valor original",
                    ].map((text) => (
                      <th scope="col" key={text} className="p-3">
                        {text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const days = daysUntil(row.dueDate, asOf);
                    const cents = amountCents(row.amount);
                    return (
                      <tr key={row.id} className="border-b border-white/10">
                        <td className="p-3 font-medium">
                          {row.id}
                          <div className="font-normal text-slate-300">{row.document}</div>
                          <div className="text-xs text-slate-400">Categoria {row.category}</div>
                        </td>
                        <td className="p-3">{row.partyCode}</td>
                        <td className="whitespace-nowrap p-3">
                          {row.dueDate}
                          <div
                            className={
                              days !== null && days < 0 ? "text-amber-200" : "text-slate-300"
                            }
                          >
                            {days === null
                              ? "Data para conferir"
                              : days < 0
                                ? `${-days} dias em atraso`
                                : days === 0
                                  ? "Vence hoje"
                                  : `Em ${days} dias`}
                          </div>
                        </td>
                        <td className="p-3">{row.status}</td>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums">
                          {cents === null ? "Valor para conferir" : money(cents)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="py-6 text-center text-slate-300">Nenhum título nesta seleção.</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <span className="text-sm text-slate-300">
                Página {page} de {pages}
              </span>
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </>
        )}
      </section>
      <section
        aria-label="Módulos financeiros"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {links.map(([href, title, description]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-white/10 bg-[#10213a] p-5 transition hover:border-cyan-300/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <h2 className="font-semibold">
              {title} <span aria-hidden="true">→</span>
            </h2>
            <p className="mt-2 text-sm text-slate-300">{description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
