"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, AlertCircle } from "lucide-react";
import {
  dayLabel,
  money,
  rankCashMovements,
  type CashMovement,
  type LedgerBook,
} from "@/lib/financial/ledger";
import { cn } from "@/lib/utils";

function Ranking({
  title,
  subtitle,
  items,
  outgoing,
  inspect,
}: {
  title: string;
  subtitle: string;
  items: CashMovement[];
  outgoing?: boolean;
  inspect: (key: string) => void;
}) {
  const top = items.slice(0, 10);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className={cn("border-b px-5 py-5", outgoing ? "bg-rose-50/60" : "bg-teal-50/70")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-lg p-2",
              outgoing ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-700"
            )}
          >
            {outgoing ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
          </span>
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {money(top.reduce((n, i) => n + i.amountCents, 0))}
          </p>
          <span className="text-xs text-slate-500">Soma dos {top.length} maiores</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {subtitle} · {items.length.toLocaleString("pt-BR")} movimentações
        </p>
      </div>
      <ol className="divide-y divide-slate-100">
        {top.map((item, index) => (
          <li key={item.key}>
            <button
              onClick={() => inspect(item.key)}
              title={item.history}
              className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-teal-600"
              aria-label={`${index + 1}. ${item.participant}, ${money(item.amountCents)}. Ver lançamento ${item.entry}`}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  index < 3
                    ? outgoing
                      ? "bg-rose-100 text-rose-700"
                      : "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 break-words text-xs font-semibold leading-5 text-slate-700">
                    {item.participant}
                  </p>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      outgoing ? "text-rose-700" : "text-teal-700"
                    )}
                  >
                    {money(item.amountCents)}
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  {dayLabel(item.date)} · Lanç. {item.entry} · Pág. {item.page}
                </p>
                {outgoing && (
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.category}</p>
                )}
                {item.identificationPending && (
                  <p className="mt-1 text-[11px] text-amber-700">Nome não informado no histórico</p>
                )}
              </div>
              <ChevronRight
                size={14}
                className="mt-1 shrink-0 text-slate-300 group-hover:text-teal-600"
              />
            </button>
          </li>
        ))}
      </ol>
      {!top.length && (
        <p className="p-8 text-center text-sm text-slate-500">
          Nenhuma movimentação identificada neste recorte.
        </p>
      )}
    </section>
  );
}

export function CashRankings({
  book,
  visibleKeys,
  inspect,
  filtered,
}: {
  book: LedgerBook;
  visibleKeys: Set<string>;
  inspect: (key: string) => void;
  filtered: boolean;
}) {
  const [providersOnly, setProvidersOnly] = useState(false);
  const rankings = useMemo(() => rankCashMovements(book, visibleKeys), [book, visibleKeys]);
  const outflows = providersOnly
    ? rankings.outflows.filter((r) => r.category === "Fornecedores / prestadores")
    : rankings.outflows;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Maiores movimentações de caixa</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Top 10 por recebimento ou pagamento ·{" "}
            {filtered ? "Recorte dos filtros ativos" : "Período completo"} · Clique para conferir a
            origem
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={providersOnly}
            onChange={(e) => setProvidersOnly(e.target.checked)}
            className="accent-teal-700"
          />
          Saídas: somente fornecedores e prestadores
        </label>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Ranking
          title="10 maiores recebimentos de clientes"
          subtitle="Entradas em caixa/bancos com contrapartida em Clientes"
          items={rankings.receipts}
          inspect={inspect}
        />
        <Ranking
          title={
            providersOnly
              ? "10 maiores pagamentos a prestadores"
              : "10 maiores saídas · prestadores e outros"
          }
          subtitle="Pagamentos com classificação contábil de origem"
          items={outflows}
          outgoing
          inspect={inspect}
        />
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Valores líquidos movimentados em caixa/bancos, a partir das contrapartidas do livro. Cada
        posição corresponde a um lançamento completo, sem agrupar por pessoa. Os filtros selecionam
        os lançamentos; os valores preservam todas as suas contrapartidas.{" "}
        {rankings.internalTransfers} transferências entre contas de caixa/bancos e{" "}
        {rankings.otherReceipts} entradas sem contrapartida em Clientes não compõem estes rankings.
      </p>
      {rankings.review.length > 0 && (
        <details className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium leading-5 text-amber-900">
            <AlertCircle size={14} className="mr-1.5 inline" />
            {rankings.review.length} movimentações para conferir · excluídas dos rankings
          </summary>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            A classificação contábil não comprova a identidade de quem pagou. Históricos com o CNPJ
            da própria empresa e contrapartidas ambíguas exigem conferência no extrato.
          </p>
          <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
            {rankings.review.map((item) => (
              <button
                key={item.key}
                onClick={() => inspect(item.key)}
                className="block w-full rounded-lg bg-white/70 p-2 text-left text-xs leading-5 text-amber-900 hover:bg-white"
              >
                Lanç. {item.entry} · {dayLabel(item.key.split("|")[0])} — {item.reason}{" "}
                <ChevronRight size={12} className="inline" />
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
