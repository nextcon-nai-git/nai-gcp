"use client";
import { SstJourney } from "@/components/dashboard/sst-journey";
import { activeClientCount } from "@/lib/client-portfolio";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  FileText,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard";
import type { DashboardClient, ExecutiveDashboard } from "@/lib/executive-dashboard";
import { cn } from "@/lib/utils";

const number = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("pt-BR");
const time = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Sem leitura";
const date = (value: string | null) => (value ? value.split("-").reverse().join("/") : "Sem prazo");
const panel =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_3px_16px_-10px_rgba(15,23,42,0.15)]";
const action =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2";

function sum(
  clients: DashboardClient[],
  get: (client: DashboardClient) => number | null | undefined
) {
  const values = clients.map(get);
  return values.some((v) => v == null)
    ? null
    : values.reduce<number>((total, value) => total + (value || 0), 0);
}
function Metric({
  label,
  value,
  detail,
  icon,
  alert,
  children,
}: {
  label: string;
  value: number | null;
  detail: string;
  icon: ReactNode;
  alert?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={cn(panel, "relative overflow-hidden p-5 lg:p-6")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-500">{label}</h2>
        <span
          className={cn(
            "rounded-lg p-2",
            alert ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-3 text-4xl font-semibold tracking-tight tabular-nums",
          alert ? "text-rose-600" : "text-slate-900"
        )}
      >
        {number(value)}
      </p>
      <div className="mt-3 flex min-h-5 items-center justify-between gap-2">
        <p className="text-xs leading-5 text-slate-500">{detail}</p>
        {children}
      </div>
    </section>
  );
}
function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {eyebrow}
        </p>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-8 text-sm leading-6 text-slate-500">
      {children}
    </div>
  );
}
function clientSignal(client: DashboardClient) {
  if (!client.tasks || client.pgr === null || client.risksToReview === null)
    return { label: "Leitura indisponível", className: "bg-slate-100 text-slate-600" };
  if (client.tasks.overdue)
    return { label: "Prazo vencido", className: "bg-rose-50 text-rose-700" };
  if (client.risksToReview)
    return { label: "Avaliação pendente", className: "bg-amber-50 text-amber-800" };
  if (!client.pgr) return { label: "Sem PGR registrado", className: "bg-slate-100 text-slate-600" };
  return { label: "Dados disponíveis", className: "bg-teal-50 text-teal-700" };
}
function downloadSnapshot(data: ExecutiveDashboard) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      "Cliente",
      "Localidade",
      "Cadastros de colaboradores",
      "PGRs registrados",
      "Ações abertas",
      "Ações vencidas",
      "Riscos aguardando avaliação",
      "Consultado em",
      "Dados parciais",
    ],
    ...data.clients.map((c) => [
      c.name,
      c.location,
      c.employees,
      c.pgr,
      c.tasks?.open,
      c.tasks?.overdue,
      c.risksToReview,
      data.generatedAt,
      c.tasks?.truncated || data.clientsTruncated ? "Sim" : "Não",
    ]),
  ];
  const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nai-carteira-${data.generatedAt.slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExecutiveDashboardView() {
  const { role, companyId } = useUser();
  const { activeClientId, setActiveClientId } = useSgi();
  const { data, loading, error, refresh } = useExecutiveDashboard(activeClientId);
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [days, setDays] = useState(30);
  const global =
    role === "SUPER_ADMIN" || (["ADMIN", "OPERATIONS"].includes(role || "") && !companyId);
  const clients = useMemo(() => data?.clients || [], [data]);
  const filtered = useMemo(
    () =>
      clients
        .filter(
          (c) =>
            c.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
            (!attentionOnly || (c.tasks?.overdue || 0) > 0 || (c.risksToReview || 0) > 0)
        )
        .sort(
          (a, b) =>
            (b.tasks?.overdue || 0) - (a.tasks?.overdue || 0) ||
            (b.risksToReview || 0) - (a.risksToReview || 0) ||
            a.name.localeCompare(b.name, "pt-BR")
        ),
    [clients, search, attentionOnly]
  );
  const overdue = data ? sum(clients, (c) => c.tasks?.overdue) : null;
  const open = data ? sum(clients, (c) => c.tasks?.open) : null;
  const dueSoon = data ? sum(clients, (c) => c.tasks?.dueSoon) : null;
  const employees = data ? sum(clients, (c) => c.employees) : null;
  const pgr = data ? sum(clients, (c) => c.pgr) : null;
  const risks = data ? sum(clients, (c) => c.risksToReview) : null;
  const undated = data ? sum(clients, (c) => c.tasks?.undated) : null;
  const unknown = data ? sum(clients, (c) => c.tasks?.unknownStatus) : null;
  const priorities = clients
    .flatMap((c) => c.tasks?.priorities || [])
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.priority === "critical") - Number(a.priority === "critical") ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
    )
    .slice(0, 5);
  const avp = data?.avp;
  const timeline = avp?.timeline.slice(-days) || [];
  const trendTotal = timeline.reduce((total, point) => total + point.count, 0);
  const max = Math.max(1, ...timeline.map((point) => point.count));
  const hasPartial = !!data?.issues.length || clients.some((c) => c.tasks?.truncated);
  const taskHref = (companyId: string, sourceType = "") =>
    `/action-plans?company=${encodeURIComponent(companyId)}${sourceType === "pgr" ? "&source=pgr" : ""}`;

  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16 text-left text-slate-900"
      data-testid="real-executive-dashboard"
    >
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <span>Workspace Nextcon</span>
            <ChevronRight className="size-3" />
            <span className="text-teal-700">Visão executiva</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Gestão de SST<span className="text-teal-600">.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Clientes, prazos e decisões. Uma visão da sua operação registrada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={cn(
              action,
              "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Atualizar indicadores"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            className={cn(
              action,
              "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            )}
            disabled={!data}
            onClick={() => data && downloadSnapshot(data)}
          >
            <ArrowDownToLine className="size-4" />
            Exportar carteira
          </button>
          <Link
            className={cn(action, "bg-[#102b3b] text-white hover:bg-[#1c4053]")}
            href="/risk-management/pgr-analysis"
          >
            <FileText className="size-4" />
            Importar PGR
          </Link>
        </div>
      </header>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 sm:flex-row sm:items-center">
        <label className="flex min-w-0 items-center gap-2 text-sm">
          <Building2 className="size-4 shrink-0 text-slate-400" />
          <span className="sr-only">Cliente do painel</span>
          <select
            aria-label="Cliente do painel"
            value={activeClientId}
            onChange={(e) => setActiveClientId(e.target.value)}
            className="max-w-full bg-transparent pr-6 font-medium focus:outline-teal-600"
          >
            {global && <option value="all">Toda a carteira</option>}
            {!data?.choices.some((c) => c.id === activeClientId) && activeClientId !== "all" && (
              <option value={activeClientId}>Cliente selecionado</option>
            )}
            {!global && activeClientId === "all" && <option value="all">Minha empresa</option>}
            {data?.choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p role="status" className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className={cn(
              "size-1.5 rounded-full",
              error || hasPartial ? "bg-amber-500" : data ? "bg-teal-500" : "bg-slate-300"
            )}
          />
          {loading
            ? "Consultando fontes…"
            : data
              ? `Consultado em ${time(data.generatedAt)} · Brasília`
              : "Aguardando leitura"}
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span>
            {error}
            {data && " Os números abaixo pertencem à última consulta concluída."}
          </span>
          <button onClick={() => void refresh()} className="shrink-0 font-semibold underline">
            Tentar novamente
          </button>
        </div>
      )}
      {hasPartial && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <strong>Leitura parcial.</strong> {data?.issues.join(" ")} Totais parciais não representam
          toda a carteira.
        </div>
      )}
      {!data && !error ? (
        <div
          aria-label="Carregando indicadores"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(panel, "h-44 animate-pulse bg-slate-100")} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Clientes ativos"
            value={data ? activeClientCount(clients) : null}
            detail={`${clients.length} registros e unidades vinculados`}
            icon={<Building2 className="size-4" />}
          />
          <Metric
            label="Ações com prazo vencido"
            value={overdue}
            detail={
              open == null
                ? "Fonte de ações indisponível"
                : `De ${number(open)} ações abertas registradas`
            }
            icon={<CalendarClock className="size-4" />}
            alert={!!overdue}
          />
          <Metric
            label="Colaboradores cadastrados"
            value={employees}
            detail="Cadastros totais, incluindo históricos"
            icon={<Users className="size-4" />}
          />
          <Metric
            label="PGRs registrados"
            value={pgr}
            detail="Documentos importados e salvos"
            icon={<FileText className="size-4" />}
          />
        </div>
      )}

      <SstJourney
        companyId={data?.scope || activeClientId}
        companyName={clients.length === 1 ? clients[0].name : undefined}
      />

      <section className="relative overflow-hidden rounded-2xl bg-[#102b3b] p-6 text-white sm:p-7">
        <div
          className="absolute -right-14 -top-24 size-72 rounded-full border-[35px] border-white/[0.025]"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300">
              <span className="size-1.5 rounded-full bg-teal-300" />
              Foco da operação
            </p>
            <h2 className="max-w-2xl text-xl font-medium leading-snug sm:text-2xl">
              {!data
                ? "Conectando sua visão de gestão."
                : overdue
                  ? `${number(overdue)} ações precisam de recuperação de prazo.`
                  : avp?.urgentWaiting
                    ? `${number(avp.urgentWaiting)} solicitações urgentes aguardam tratamento no AVP.`
                    : !clients.length
                      ? "Sua carteira começa com um cadastro conectado."
                      : "Transforme os registros da carteira em próximos passos."}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {overdue
                ? "Revise os responsáveis e priorize as entregas vencidas na fila abaixo."
                : "A ausência de pendências registradas não comprova conformidade. Confira a cobertura das fontes por cliente."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5 border-white/10 lg:border-l lg:pl-8">
            <div>
              <p className="text-3xl font-medium tabular-nums">{number(dueSoon)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                ações vencem
                <br />
                nos próximos 7 dias
              </p>
            </div>
            <div>
              <p className="text-3xl font-medium tabular-nums">{number(risks)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                riscos aguardam
                <br />
                avaliação técnica
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className={cn(panel, "min-w-0 p-5 sm:p-6")}>
          <SectionTitle eyebrow="Saúde ocupacional · Grupo AVP" title="Da solicitação ao exame">
            <Link
              href="/clients/grupo-avp"
              className="flex items-center gap-1 text-xs font-semibold text-teal-700"
            >
              Abrir operação <ArrowUpRight className="size-3.5" />
            </Link>
          </SectionTitle>
          {avp ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-semibold tracking-tight tabular-nums">
                    {number(avp.total)}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      solicitações na fonte
                    </span>
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-medium",
                    avp.stale ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-700"
                  )}
                >
                  {avp.stale ? "Verificar atualização" : "Fonte conectada"}
                </span>
              </div>
              <div
                className="my-5 flex h-3 overflow-hidden rounded-full bg-slate-100"
                aria-label="Distribuição das solicitações por status"
              >
                {avp.stages.map((stage) => (
                  <div
                    key={stage.label}
                    style={{
                      width: `${avp.total ? (stage.count / avp.total) * 100 : 0}%`,
                      backgroundColor: stage.color,
                    }}
                    title={`${stage.label}: ${stage.count}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {avp.stages.map((stage) => (
                  <div
                    key={stage.label}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2 text-slate-500">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.label}
                    </span>
                    <strong className="font-semibold tabular-nums">{number(stage.count)}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-lg font-semibold text-amber-700">
                    {number(avp.urgentWaiting)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">urgentes em tratamento</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-700">{number(avp.aboveTarget)}</p>
                  <p className="mt-1 text-xs text-slate-500">cotações acima de R$ 40</p>
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-5 text-slate-400">
                Última leitura: {time(avp.checkedAt)} · Fonte a cada 10 min.{" "}
                {number(avp.missingCost)} solicitações sem preço único válido. Agendado não
                significa exame realizado.
              </p>
            </>
          ) : (
            <Empty>
              {data?.avpAvailable
                ? "A leitura do AVP está indisponível. Nenhum valor foi estimado."
                : "A fila AVP é exibida na visão da carteira ou do Grupo AVP, para perfis autorizados."}
            </Empty>
          )}
        </section>

        <section className={cn(panel, "min-w-0 p-5 sm:p-6")}>
          <SectionTitle eyebrow="Demanda registrada · AVP" title="Entrada de solicitações">
            <select
              aria-label="Período do gráfico AVP"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500"
            >
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
            </select>
          </SectionTitle>
          {avp ? (
            <>
              <div className="flex items-baseline gap-2">
                <strong className="text-3xl font-semibold tracking-tight">
                  {number(trendTotal)}
                </strong>
                <span className="text-xs text-slate-500">pedidos no período</span>
              </div>
              <div
                className="relative mt-7 h-40 border-b border-slate-200"
                role="img"
                aria-label={`Pedidos registrados nos últimos ${days} dias: ${trendTotal}. Dados detalhados disponíveis abaixo.`}
              >
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-0">
                  <div className="border-t border-dashed border-slate-100" />
                  <div className="border-t border-dashed border-slate-100" />
                  <div className="border-t border-dashed border-slate-100" />
                </div>
                <div className="relative flex h-full items-end gap-1">
                  {timeline.map((point) => (
                    <div
                      className="group relative flex h-full min-w-0 flex-1 items-end"
                      key={point.date}
                    >
                      <div
                        className="w-full rounded-t-[3px] bg-teal-500 transition-colors hover:bg-teal-700"
                        style={{
                          height: `${(point.count / max) * 100}%`,
                          minHeight: point.count ? 3 : 0,
                        }}
                        title={`${date(point.date)}: ${point.count} pedidos`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{date(timeline[0]?.date || null)}</span>
                <span>Data do pedido</span>
                <span>{date(timeline.at(-1)?.date || null)}</span>
              </div>
              <details className="mt-4 text-xs text-slate-500">
                <summary className="cursor-pointer font-medium hover:text-teal-700">
                  Ver dados do gráfico
                </summary>
                <div className="mt-2 grid max-h-28 grid-cols-2 gap-2 overflow-auto rounded-lg bg-slate-50 p-3">
                  {timeline.map((point) => (
                    <p key={point.date}>
                      {date(point.date)} <strong className="float-right">{point.count}</strong>
                    </p>
                  ))}
                </div>
              </details>
              <p className="mt-4 text-[11px] leading-5 text-slate-400">
                Contagem por data do pedido na última versão da planilha. Não representa histórico
                de conclusão.{" "}
                {!!avp.invalidDates &&
                  `${avp.invalidDates} registros sem data válida foram excluídos do gráfico.`}
              </p>
            </>
          ) : (
            <Empty>
              O gráfico aparece quando existe uma leitura autorizada da fonte AVP. Sem dados, não há
              curva estimada.
            </Empty>
          )}
        </section>
      </div>

      <section className={cn(panel, "overflow-hidden")}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionTitle eyebrow="Carteira conectada" title="Onde concentrar sua atenção">
            <Link
              href="/clients"
              className="flex items-center gap-1 text-xs font-semibold text-teal-700"
            >
              Gerenciar clientes <ArrowRight className="size-3.5" />
            </Link>
          </SectionTitle>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <label className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 sm:max-w-xs">
              <Search className="size-4 text-slate-400" />
              <input
                aria-label="Buscar cliente na carteira"
                placeholder="Buscar cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <button
              aria-pressed={attentionOnly}
              onClick={() => setAttentionOnly(!attentionOnly)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                attentionOnly
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 text-slate-500"
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Só prazos vencidos e avaliações
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Cliente / unidade</th>
                <th className="px-3 py-3 text-right font-medium">Colaboradores</th>
                <th className="px-3 py-3 text-right font-medium">PGRs</th>
                <th className="px-3 py-3 text-right font-medium">Ações abertas</th>
                <th className="px-3 py-3 text-right font-medium">Vencidas</th>
                <th className="px-6 py-3 text-left font-medium">Sinal operacional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((client) => {
                const signal = clientSignal(client);
                return (
                  <tr key={client.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setActiveClientId(client.id)}
                        className="text-left font-semibold text-slate-800 hover:text-teal-700"
                      >
                        {client.name}
                      </button>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {client.location || "Localidade não informada"}
                        {client.active === false ? " · Cadastro inativo" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-600">
                      {number(client.employees)}
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-600">
                      {number(client.pgr)}
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-600">
                      <Link href={taskHref(client.id)}>
                        {number(client.tasks?.open)}
                        {client.tasks?.truncated ? "+" : ""}
                      </Link>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-4 text-right font-semibold tabular-nums",
                        client.tasks?.overdue ? "text-rose-600" : "text-slate-400"
                      )}
                    >
                      {number(client.tasks?.overdue)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium",
                          signal.className
                        )}
                      >
                        {signal.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="px-6 py-8 text-center text-sm text-slate-500">
            {!data
              ? "Aguardando consulta dos cadastros."
              : clients.length
                ? "Nenhum cliente corresponde a este filtro."
                : "Nenhum cliente salvo foi encontrado nesta visão. Cadastre ou importe os dados para começar."}
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-400">
          <span>
            {filtered.length} de {clients.length} clientes nesta visão
          </span>
          <span>“—” = fonte indisponível · zero = nenhum registro encontrado</span>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className={cn(panel, "p-5 sm:p-6")}>
          <SectionTitle eyebrow="Execução e responsabilidade" title="Próximas ações">
            <ListChecks className="size-5 text-slate-300" />
          </SectionTitle>
          {priorities.length ? (
            <div className="divide-y divide-slate-100">
              {priorities.map((task) => (
                <Link
                  key={`${task.companyId}:${task.id}`}
                  href={taskHref(task.companyId, task.sourceType)}
                  className="group flex items-start justify-between gap-3 py-4 first:pt-0"
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      className={cn(
                        "mt-1 rounded-lg p-2",
                        task.overdue ? "bg-rose-50 text-rose-500" : "bg-slate-50 text-slate-400"
                      )}
                    >
                      <Clock3 className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-5 text-slate-800 group-hover:text-teal-700">
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {task.companyName} · {task.owner}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        task.overdue ? "text-rose-600" : "text-slate-500"
                      )}
                    >
                      {date(task.dueDate)}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {task.overdue
                        ? "Prazo vencido"
                        : task.priority === "critical"
                          ? "Prioridade crítica"
                          : "Aberta"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>
              {data && open === 0
                ? "Não há ações abertas registradas nesta visão. Importe um PGR ou registre uma atividade para acompanhar prazos e responsáveis."
                : "A fila será exibida após a leitura das atividades."}
            </Empty>
          )}
          <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <CircleAlert className="size-3.5" />
            {number(undated)} abertas sem prazo válido · {number(unknown)} com status não
            reconhecido
          </div>
        </section>
        <section className={cn(panel, "p-5 sm:p-6")}>
          <SectionTitle eyebrow="Confiança nos indicadores" title="O que sustenta esta visão">
            <Database className="size-5 text-slate-300" />
          </SectionTitle>
          <div className="space-y-4 text-sm">
            {[
              [
                "Carteira e colaboradores",
                "Cadastros persistidos por empresa. Colaboradores incluem registros históricos.",
              ],
              [
                "PGRs, ações e riscos",
                "PGRs salvos, tarefas operacionais e riscos com avaliação técnica pendente.",
              ],
              [
                "Operação AVP",
                "Última leitura da planilha conectada, incluindo ajustes salvos no NAI.",
              ],
            ].map(([title, description]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-0.5 rounded-full bg-slate-50 p-1.5 text-slate-400">
                  <Check className="size-3" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-700">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-[#f4f7f9] p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <ShieldCheck className="size-4" />
              Indicadores que exigem mais evidências
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Taxas de acidentes, FAP/RAT, cobertura de ASOs e conformidade eSocial precisam de
              bases completas e períodos comparáveis. Não são calculados a partir de suposições.
            </p>
          </div>
        </section>
      </div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-400">
        <span>NAI · Gestão de saúde e segurança do trabalho</span>
        <span>Resumo operacional · validação técnica sob responsabilidade da equipe</span>
      </footer>
    </div>
  );
}
