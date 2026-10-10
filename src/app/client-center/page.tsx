"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useUser } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REQUEST_DEPARTMENTS,
  PERIODIC_LABELS,
  periodicsCsv,
  requestStatusLabel,
  type ClientCenterData,
  type ClientRequestInput,
} from "@/lib/client-center";
const shortDate = (date: string | null) =>
  date ? date.slice(0, 10).split("-").reverse().join("/") : "Não informada";
export default function ClientCenterPage() {
  const { user } = useUser();
  const { activeClientId, isLoading } = useSgi();
  if (isLoading) return <p role="status">Carregando seu acesso…</p>;
  if (!user) return <p>Entre no sistema para acessar sua central.</p>;
  if (!activeClientId || ["all", "unauthorized"].includes(activeClientId))
    return (
      <div className="mx-auto max-w-3xl py-16 space-y-4">
        <h1 className="text-3xl font-bold text-primary">Central do Cliente</h1>
        <p>
          Selecione uma empresa no seletor do sistema para visualizar prazos, documentos e
          solicitações.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Ver painel executivo</Link>
        </Button>
      </div>
    );
  return (
    <Workspace
      key={`${user.uid}:${activeClientId}`}
      companyId={activeClientId}
      token={() => user.getIdToken()}
    />
  );
}
function Workspace({ companyId, token }: { companyId: string; token: () => Promise<string> }) {
  const [data, setData] = useState<ClientCenterData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "periodics" | "documents" | "requests">("overview");
  const [filter, setFilter] = useState("attention");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<ClientRequestInput["department"]>("scheduling");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"medium" | "high">("medium");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [sendError, setSendError] = useState("");
  const inFlight = useRef(false);
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const currentToken = useRef(token);
  currentToken.current = token;
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 30000);
    setLoading(true);
    setError("");
    try {
      const idToken = await currentToken.current();
      if (request.signal.aborted) return;
      const response = await fetch(`/api/client-center?company=${encodeURIComponent(companyId)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
        signal: request.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Falha ao atualizar a central.");
      if (!request.signal.aborted) setData(body);
    } catch (cause) {
      if (mounted.current && controller.current === request) {
        setData(null);
        setError(
          request.signal.aborted
            ? "A consulta demorou mais que o esperado. Tente novamente."
            : cause instanceof Error
              ? cause.message
              : "Falha ao atualizar."
        );
      }
    } finally {
      clearTimeout(timeout);
      if (mounted.current && controller.current === request) setLoading(false);
    }
  }, [companyId]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, [refresh]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setSendError("");
    setNotice("");
    const fields = { companyId, department, title, description, priority };
    const fingerprint = JSON.stringify(fields);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/client-center", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await currentToken.current()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...fields, requestId: pending.current.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível registrar a solicitação.");
      if (!mounted.current) return;
      setNotice(
        `Solicitação recebida. Protocolo: ${body.id}. Acompanhe o atendimento na lista abaixo.`
      );
      setTitle("");
      setDescription("");
      pending.current = null;
      await refresh();
    } catch (cause) {
      if (mounted.current)
        setSendError(
          cause instanceof Error ? cause.message : "Não foi possível registrar. Tente novamente."
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setSending(false);
    }
  }
  const items = (data?.periodics?.items || []).filter(
    (i) =>
      (filter === "all" ||
        (filter === "attention" && i.situation !== "current") ||
        i.situation === filter) &&
      `${i.name} ${i.department}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR"))
  );
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([periodicsCsv(items)], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prazos-periodicos.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const requestFor = (value: ClientRequestInput["department"], subject = "") => {
    setDepartment(value);
    setTitle(subject);
    setTab("requests");
    setNotice("");
  };
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-white md:p-9">
        <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-teal-400/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-200">
              NAI · Atendimento e acompanhamento
            </p>
            <h1 className="text-3xl font-bold md:text-4xl">
              Sua empresa, em dia com os próximos passos.
            </h1>
            <p className="text-white/75">
              Central do Cliente · {data?.company.name || "Carregando empresa"}
            </p>
            <p className="text-sm text-white/65">
              Prazos, documentos e atendimento em um só lugar.
            </p>
          </div>
          <Button variant="secondary" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => requestFor("scheduling")}>
            <Send className="mr-2 size-4" />
            Nova solicitação
          </Button>
          <Button
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            variant="outline"
            onClick={() => setTab("periodics")}
          >
            Ver prazos de periódicos
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </section>
      <nav aria-label="Seções da central" className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["overview", "Visão geral"],
            ["periodics", "Periódicos"],
            ["documents", "Documentos"],
            ["requests", "Solicitações"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            aria-pressed={tab === key}
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}
      {loading && !data && (
        <p role="status" className="flex gap-2">
          <Loader2 className="size-5 animate-spin" />
          Consultando os registros do cliente…
        </p>
      )}
      {data?.issues.map((issue) => (
        <p
          key={issue}
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {issue}
        </p>
      ))}
      {data && tab === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Prazos de ASO vencidos",
                value: data.periodics?.overdue,
                tone: "text-rose-700",
                action: () => {
                  setFilter("overdue");
                  setTab("periodics");
                },
              },
              {
                label: "Próximos 30 dias",
                value: data.periodics?.soon,
                tone: "text-amber-700",
                action: () => {
                  setFilter("soon");
                  setTab("periodics");
                },
              },
              {
                label: "Ações em aberto",
                value: data.tasks?.open,
                tone: "text-primary",
                action: () =>
                  document.getElementById("priorities")?.scrollIntoView({ behavior: "smooth" }),
              },
              {
                label: "Solicitações em atendimento",
                value: data.requests?.filter(
                  (r) => !["done", "cancelled", "archived"].includes(r.status)
                ).length,
                tone: "text-teal-700",
                action: () => setTab("requests"),
              },
            ].map((card) => (
              <button
                key={card.label}
                onClick={card.action}
                className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:border-teal-500 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className={`mt-3 text-4xl font-bold ${card.tone}`}>{card.value ?? "—"}</p>
                <p className="mt-3 text-xs text-muted-foreground">Ver detalhes →</p>
              </button>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <Card id="priorities">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-5" />O que precisa de atenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.tasks?.priorities.map((task) => (
                  <div key={task.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold">{task.title}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs ${task.overdue ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {task.overdue ? "Prazo vencido" : requestStatusLabel(task.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {task.owner} · Prazo: {shortDate(task.dueDate)}
                    </p>
                  </div>
                ))}
                {data.tasks?.open === 0 && (
                  <p className="text-muted-foreground">
                    Nenhuma ação em aberto nos registros consultados.
                  </p>
                )}
                {!data.tasks && <p>Ações indisponíveis. Tente atualizar.</p>}
                <Button asChild variant="outline">
                  <Link href="/action-plans">
                    Abrir Centro de Operação
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Como podemos ajudar?</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {Object.entries(REQUEST_DEPARTMENTS).map(([key, label]) => (
                    <Button
                      key={key}
                      variant="outline"
                      className="justify-between"
                      onClick={() => requestFor(key as ClientRequestInput["department"])}
                    >
                      {label}
                      <ArrowRight className="size-4" />
                    </Button>
                  ))}
                </CardContent>
              </Card>
              <div className="rounded-2xl bg-teal-50 p-5 text-sm text-teal-950">
                <ShieldCheck className="mb-2 size-5" />
                <p className="font-semibold">Informação útil, com contexto</p>
                <p className="mt-2">
                  {data.periodics?.missing ?? "—"} colaboradores sem próximo ASO informado. Os
                  prazos refletem o cadastro e precisam ser definidos conforme o acompanhamento
                  profissional.
                </p>
                <Button
                  variant="link"
                  className="px-0"
                  onClick={() => {
                    setFilter("missing");
                    setTab("periodics");
                  }}
                >
                  Conferir datas ausentes
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
      {data && tab === "periodics" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2">
              <CalendarClock className="size-5" />
              Gestão dos próximos periódicos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Datas cadastradas, sem inferir periodicidade clínica. Colaboradores demitidos ou
              inativos são excluídos desta visão.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                aria-label="Buscar colaborador ou setor"
                placeholder="Buscar colaborador ou setor"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <select
                aria-label="Filtrar prazo"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-md border bg-white px-3 py-2"
              >
                <option value="attention">Precisam de atenção</option>
                <option value="all">Todos</option>
                {Object.entries(PERIODIC_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button variant="outline" disabled={!items.length} onClick={exportCsv}>
                <Download className="mr-2 size-4" />
                Exportar CSV
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {items.length} registros nesta seleção
              {data.periodics?.truncated ? " · consulta parcial" : ""}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    {["Colaborador", "Setor", "Próximo ASO", "Situação", "Ação"].map((h) => (
                      <th key={h} className="p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 200).map((i) => (
                    <tr key={i.id} className="border-b">
                      <td className="p-3 font-medium">{i.name}</td>
                      <td className="p-3">{i.department}</td>
                      <td className="p-3 whitespace-nowrap">{shortDate(i.dueDate)}</td>
                      <td
                        className={`p-3 ${i.situation === "overdue" ? "text-rose-700" : "text-muted-foreground"}`}
                      >
                        {PERIODIC_LABELS[i.situation]}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            requestFor(
                              i.situation === "missing" ? "registration" : "scheduling",
                              `${i.situation === "missing" ? "Conferir data" : "Solicitar periódico"}: ${i.name}`.slice(
                                0,
                                160
                              )
                            )
                          }
                        >
                          Solicitar apoio
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length > 200 && (
              <p>
                Exibindo os primeiros 200 registros. Refine a busca ou exporte a seleção completa.
              </p>
            )}
            {!data.periodics ? (
              <p>Prazos indisponíveis.</p>
            ) : (
              !items.length && <p>Nenhum registro encontrado para este filtro.</p>
            )}
            <Button asChild variant="outline">
              <Link href="/employees">Abrir cadastro de colaboradores</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {data && tab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2">
              <FileText className="size-5" />
              Documentos recentes
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Até 50 registros do acervo de relatórios deste cliente. Programas PGR ficam no módulo
              de riscos.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.documents?.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-sm text-muted-foreground">{d.type}</p>
                </div>
                <span className="text-sm text-muted-foreground">{d.status}</span>
              </div>
            ))}
            {data.documents?.length === 0 && <p>Nenhum relatório cadastrado.</p>}
            {!data.documents && <p>Acervo indisponível. Tente atualizar.</p>}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/reports">Abrir acervo de relatórios</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/risk-management">Consultar PGR e riscos</Link>
              </Button>
              <Button variant="outline" onClick={() => requestFor("documents")}>
                Solicitar documento
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {data && tab === "requests" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Nova solicitação</CardTitle>
              <p className="text-sm text-muted-foreground">
                O pedido gera um card para a equipe. Datas de atendimento e valores dependem de
                confirmação.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <fieldset disabled={sending} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="request-department">Departamento</label>
                    <select
                      id="request-department"
                      className="w-full rounded-md border bg-white p-2"
                      value={department}
                      onChange={(e) =>
                        setDepartment(e.target.value as ClientRequestInput["department"])
                      }
                    >
                      {Object.entries(REQUEST_DEPARTMENTS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="request-title">Assunto</label>
                    <Input
                      id="request-title"
                      required
                      minLength={5}
                      maxLength={160}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="request-description">O que você precisa?</label>
                    <Textarea
                      id="request-description"
                      required
                      minLength={15}
                      maxLength={3000}
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Informe unidade, necessidade e preferência de atendimento. Não inclua CPF, diagnóstico ou prontuário."
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="request-priority">Prioridade solicitada</label>
                    <select
                      id="request-priority"
                      className="w-full rounded-md border bg-white p-2"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as "medium" | "high")}
                    >
                      <option value="medium">Normal</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                  <Button type="submit">
                    {sending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 size-4" />
                    )}
                    Registrar solicitação
                  </Button>
                </fieldset>
                {sendError && (
                  <p role="alert" className="text-red-700">
                    {sendError}
                  </p>
                )}
                {notice && (
                  <p
                    role="status"
                    className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900 break-all"
                  >
                    {notice}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Acompanhe seus protocolos</CardTitle>
              <p className="text-sm text-muted-foreground">
                O status acompanha o card no Centro de Operação.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.requests?.map((r) => (
                <article key={r.id} className="space-y-2 rounded-xl border p-4">
                  <div className="flex justify-between gap-2">
                    <h2 className="font-semibold">{r.title}</h2>
                    <span className="shrink-0 text-xs text-teal-700">
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {REQUEST_DEPARTMENTS[r.department as keyof typeof REQUEST_DEPARTMENTS] ||
                      "Atendimento"}{" "}
                    · {shortDate(r.createdAt)} ·{" "}
                    {r.priority === "high" ? "Alta prioridade" : "Prioridade normal"}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">Protocolo: {r.id}</p>
                </article>
              ))}
              {data.requests?.length === 0 && (
                <p className="text-muted-foreground">
                  Nenhuma solicitação registrada nesta central.
                </p>
              )}
              {!data.requests && <p>Protocolos indisponíveis. Tente atualizar.</p>}
            </CardContent>
          </Card>
        </div>
      )}
      {data && (
        <p className="text-xs text-muted-foreground">
          Atualizado em{" "}
          {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ·
          Horário de Brasília. Indicadores não substituem avaliação técnica.
        </p>
      )}
    </div>
  );
}
