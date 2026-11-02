"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { Building2, Clock3, FileClock, ListChecks, RefreshCw, Upload } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SOC_DASHBOARD_MAX_BYTES,
  reportStatuses,
  socDashboardSchema,
  consolidateSocSnapshot,
  summarizeSocDashboard,
  type SocDashboardResponse,
  type SocDashboardSnapshot,
} from "@/lib/integrations/soc-dashboard";

import { SocConvocationPanel } from "./soc-convocation-panel";

const date = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const timestamp = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const categories = {
  convocation: "Convocação",
  attendance: "Atendimentos",
  documents: "Documentos",
  esocial: "eSocial",
  registration: "Cadastros",
  exams: "Exames",
};

export function SocDashboard() {
  const { user } = useUser();
  const identity = useRef(user?.uid);
  useLayoutEffect(() => {
    identity.current = user?.uid;
  }, [user?.uid]);
  const [data, setData] = useState<SocDashboardResponse | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [draft, setDraft] = useState<SocDashboardSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setData(null);
    setOwner(null);
    setDraft(null);
    setError("");
    setNotice("");
    setSearch("");
    setPage(0);
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/integrations/soc/dashboard", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Falha ao carregar o painel.");
        if (!controller.signal.aborted && identity.current === user.uid) {
          setData(result);
          setOwner(user.uid);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Falha ao carregar o painel.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [user, reload]);

  async function importFile(file: File | undefined) {
    if (!file || !user) return;
    const uid = user.uid;
    setError("");
    setNotice("");
    try {
      if (file.size > SOC_DASHBOARD_MAX_BYTES - 1000)
        throw Error("Arquivo maior que o limite permitido.");
      const parsed = socDashboardSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success)
        throw Error(
          "Arquivo fora do formato de levantamento SOC. Confira campos, datas e códigos únicos."
        );
      const consolidated = consolidateSocSnapshot(
        parsed.data,
        draft ?? data?.snapshot ?? undefined
      );
      if (identity.current === uid) setDraft(consolidated);
    } catch (error) {
      if (identity.current === uid)
        setError(
          error instanceof SyntaxError
            ? "Arquivo JSON inválido."
            : error instanceof Error
              ? error.message
              : "Falha ao ler arquivo."
        );
    }
  }

  async function publish() {
    if (!user || !draft || !data?.canPublish || publishing || owner !== user.uid) return;
    const uid = user.uid;
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/integrations/soc/dashboard", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: draft, expectedVersion: data.version }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Falha ao publicar levantamento.");
      if (identity.current !== uid) return;
      setData(result);
      setDraft(null);
      setPage(0);
      setNotice("Levantamento publicado no painel interno.");
    } catch (error) {
      if (identity.current === uid)
        setError(error instanceof Error ? error.message : "Falha ao publicar.");
    } finally {
      setPublishing(false);
    }
  }

  const visibleData = owner === user?.uid ? data : null;
  const snapshot = visibleData?.snapshot;
  const summary = snapshot ? summarizeSocDashboard(snapshot) : null;
  const companies =
    snapshot?.activeCompanies.filter((company) =>
      normalize(`${company.id} ${company.name}`).includes(normalize(search))
    ) ?? [];
  const reports =
    snapshot?.reports.filter(
      (report) =>
        (!category || report.category === category) && (!status || report.status === status)
    ) ?? [];

  return (
    <section aria-label="Painel operacional SOC" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Operação dos clientes ativos</h2>
          <p className="text-sm text-muted-foreground">
            Levantamento do SOC com data e escopo de cada consulta.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!user || loading || publishing}
          onClick={() => setReload((value) => value + 1)}
        >
          <RefreshCw className="mr-2 size-4" /> Recarregar painel
        </Button>
      </div>
      {loading && <p role="status">Carregando levantamento protegido…</p>}
      {!user && <p>Entre no NAI com uma conta interna autorizada para consultar o painel.</p>}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border p-4">
          {notice}
        </p>
      )}
      {visibleData && !snapshot && (
        <Card>
          <CardContent className="pt-6">
            Nenhum levantamento publicado. Os indicadores ficam indisponíveis até a publicação de
            uma consulta verificada do SOC.
          </CardContent>
        </Card>
      )}
      {snapshot && summary && (
        <>
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">
              Consulta realizada em {timestamp(snapshot.observedAt)} · horário de Brasília
            </p>
            <p className="mt-1 text-muted-foreground">
              {snapshot.source}. Atualização manual; recarregar o painel não executa novas consultas
              no SOC.
            </p>
            <p className="mt-2">{snapshot.limitation}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={<Building2 className="size-5" />}
              title="Clientes ativos"
              value={String(summary.activeCompanies)}
              detail={`${snapshot.inactiveExcluded} inativos excluídos · código SOC preservado`}
            />
            <Metric
              icon={<Clock3 className="size-5" />}
              title="ASOs vencidos / vencendo"
              value="Aguardando leitura"
              detail={`Vencendo: prazo-alvo até ${date(snapshot.dueSoonEnd)}. Contagens ainda não confirmadas.`}
            />
            <Metric
              icon={<FileClock className="size-5" />}
              title="Relatórios para leitura"
              value={snapshot.reports.length ? String(summary.readyReports) : "Não levantado"}
              detail={`${summary.scheduledReports} com processamento agendado. Disponibilidade não confirma quantidade de pendências.`}
            />
            <Metric
              icon={<ListChecks className="size-5" />}
              title="Tarefas administrativas"
              value={
                snapshot.administrativeTasks.length
                  ? String(summary.administrativeTasks)
                  : "Não levantado"
              }
              detail="Etapas encontradas no Maestro; não representam uma contagem de ASOs parados."
            />
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <p>
              <strong>
                Vidas na última contagem SOC:{" "}
                {snapshot.activeCompanies.some((c) => c.lastReportedLives !== undefined)
                  ? snapshot.activeCompanies
                      .reduce((total, c) => total + (c.lastReportedLives ?? 0), 0)
                      .toLocaleString("pt-BR")
                  : "Não informado"}
              </strong>
            </p>
            <p className="mt-1 text-muted-foreground">
              Cobertura:{" "}
              {snapshot.activeCompanies.filter((c) => c.lastReportedLives !== undefined).length} de{" "}
              {snapshot.activeCompanies.length} empresas. A data da contagem não consta no
              relatório; não representa confirmação do quadro atual.
            </p>
          </div>
          <SocConvocationPanel
            key={`${owner}:${visibleData.version}`}
            snapshot={draft ?? snapshot}
            isDraft={!!draft}
            canPublish={visibleData.canPublish}
            busy={publishing}
            onDraft={(value) => {
              setDraft(value);
              setError("");
              setNotice("Resumo preparado. Revise a prévia e publique abaixo.");
            }}
          />
          <Card>
            <CardHeader>
              <CardTitle>Relatórios e próximos passos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ASOs parados e pendências por colaborador aguardam a leitura dos arquivos e o
                cruzamento com os clientes ativos. “Sem resultado” vale apenas para o filtro
                indicado.
              </p>
              <div className="flex flex-wrap gap-4">
                <label className="space-y-1 text-sm">
                  Tipo de relatório
                  <select
                    className="block rounded-md border bg-background p-2"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="">Todos os tipos</option>
                    {Object.entries(categories).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  Situação do relatório
                  <select
                    className="block max-w-full rounded-md border bg-background p-2"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">Todas as situações</option>
                    {Object.entries(reportStatuses).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <caption className="sr-only">Pedidos de processamento observados no SOC</caption>
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3">Relatório / pedido</th>
                      <th className="p-3">Escopo / período</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3">Próximo passo / ressalva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr className="border-t align-top" key={report.id}>
                        <td className="p-3">
                          <p className="font-medium">{report.title}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {report.id}
                          </p>
                        </td>
                        <td className="p-3">
                          <p>{report.scope}</p>
                          {report.periodStart && report.periodEnd && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {date(report.periodStart)} a {date(report.periodEnd)}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${report.status === "scheduled" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-foreground"}`}
                          >
                            {reportStatuses[report.status]}
                          </span>
                          {report.scheduledFor && (
                            <p className="mt-2">Previsto: {date(report.scheduledFor)}</p>
                          )}
                        </td>
                        <td className="max-w-sm p-3">{report.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!reports.length && <p className="text-sm">Nenhum relatório neste filtro.</p>}
            </CardContent>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Clientes no escopo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="block space-y-2 text-sm">
                  Buscar cliente por nome ou código SOC
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                    placeholder="Nome ou código SOC"
                  />
                </label>
                <p className="text-sm text-muted-foreground">
                  {companies.length} de {summary.activeCompanies} clientes · ATIVO = 1 no cadastro
                  SOC. Pendências individuais ainda não conciliadas.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3">Código SOC</th>
                        <th className="p-3">Cliente ativo</th>
                        <th className="p-3">Última contagem de vidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.slice(page * 15, (page + 1) * 15).map((company) => (
                        <tr key={company.id} className="border-t">
                          <td className="p-3 font-mono text-xs">{company.id}</td>
                          <td className="p-3">{company.name}</td>
                          <td className="p-3">
                            {company.lastReportedLives === undefined
                              ? "Não informado"
                              : company.lastReportedLives.toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!companies.length && <p className="text-sm">Nenhum cliente encontrado.</p>}
                {companies.length > 15 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-sm">
                      Página {page + 1} de {Math.ceil(companies.length / 15)}
                    </span>
                    <Button
                      variant="outline"
                      disabled={(page + 1) * 15 >= companies.length}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fluxos administrativos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Etapas exibidas pelo Maestro na data da consulta. Confirmar responsável e
                  andamento antes de cobrar uma ação.
                </p>
                {snapshot.administrativeTasks.map((task) => (
                  <div key={task.id} className="space-y-1 rounded-lg border p-3">
                    <p className="font-medium">{task.task}</p>
                    <p>{task.company}</p>
                    <p className="font-mono text-xs">Processo {task.id}</p>
                  </div>
                ))}
                {!snapshot.administrativeTasks.length && (
                  <p>
                    Nenhuma tarefa registrada neste levantamento; isso não comprova ausência de
                    pendências.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            Publicado no NAI em {visibleData.savedAt ? timestamp(visibleData.savedAt) : "—"}. As
            consultas diretas abaixo têm escopo e atualização independentes.
          </p>
        </>
      )}
      {visibleData?.canPublish && (
        <details className="rounded-lg border p-4" open={!!draft || undefined}>
          <summary className="cursor-pointer font-medium">Publicar levantamento verificado</summary>
          <div className="mt-4 space-y-4 text-sm">
            <p>
              Importe um JSON no formato do painel: clientes ativos (código e nome), pedidos de
              processamento e tarefas administrativas. Não inclua prontuários, CPF, RG, senhas ou
              chaves. A publicação substitui o levantamento anterior.
            </p>
            <label className="block space-y-2">
              Arquivo do levantamento SOC
              <Input
                type="file"
                accept="application/json,.json"
                disabled={publishing}
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            {draft && (
              <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                <p className="font-medium">
                  Prévia: {draft.activeCompanies.length} clientes ativos · {draft.reports.length}{" "}
                  relatórios · {draft.administrativeTasks.length} tarefas
                </p>
                <p>
                  Consulta: {timestamp(draft.observedAt)} · Inativos excluídos:{" "}
                  {draft.inactiveExcluded}
                </p>
                <p>{draft.limitation}</p>
                <p>
                  Convocação: {draft.examSummaries?.length ?? 0} empresas com resumo de exames.
                  Confira as datas de referência por empresa.
                </p>
                <Button onClick={publish} disabled={publishing}>
                  <Upload className="mr-2 size-4" />
                  {publishing ? "Publicando…" : "Publicar levantamento"}
                </Button>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function Metric({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {title}
        </p>
        <p className={value.length > 10 ? "text-xl font-semibold" : "text-3xl font-semibold"}>
          {value}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
