"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  RefreshCw,
  Users,
  CalendarDays,
  ExternalLink,
  Link2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Row = Record<string, string>;
type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  cnpj: string;
  link: { companyId: string; companyName: string; employeeId: string; employeeName: string } | null;
};
type List<T> = {
  data: T[];
  page?: number;
  pages?: number | null;
  total?: number | null;
  summary?: { loaded: number; opened: number; closed: number; operators: number };
};
type Status = {
  connected: boolean;
  checkedAt: string;
  historyKeyConfigured: boolean;
  webhookConfigured: boolean;
};
type Directory = { data: { id: string; name: string }[]; next: string | null };
type Draft = { draftId: string; contactId: string; operatorId: string; message: string };
type Tab = "contacts" | "reports" | "operators" | "operation";
const labels: Record<Tab, string> = {
  contacts: "Contatos",
  reports: "Atendimentos e indicadores",
  operators: "Operadores",
  operation: "Operação ASO",
};
const dateText = (v: string) =>
  v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString("pt-BR") : v || "—";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function DataTable({ rows, columns }: { rows: Row[]; columns: [string, string][] }) {
  return rows.length ? (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map(([key, title]) => (
              <th key={key} className="p-3 font-medium">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index} className="border-t">
              {columns.map(([key]) => (
                <td key={key} className="max-w-md whitespace-pre-wrap break-words p-3">
                  {key.endsWith("At") ? dateText(row[key]) : row[key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
      Nenhum registro nesta consulta.
    </p>
  );
}

export default function TallosWorkspace() {
  const { user } = useUser();
  const identity = useRef(user?.uid);
  identity.current = user?.uid;
  const [tab, setTab] = useState<Tab>("contacts");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contacts, setContacts] = useState<List<Contact> | null>(null);
  const [reports, setReports] = useState<List<Row> | null>(null);
  const [operators, setOperators] = useState<Row[]>([]);
  const [operation, setOperation] = useState<{ messages: Row[]; requests: Row[] } | null>(null);
  const [start, setStart] = useState(() => today().slice(0, 8) + "01");
  const [end, setEnd] = useState(today);
  const [reportStatus, setReportStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [history, setHistory] = useState<List<Row> | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [companies, setCompanies] = useState<Directory>({ data: [], next: null });
  const [employees, setEmployees] = useState<Directory>({ data: [], next: null });
  const [companyId, setCompanyId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmation, setConfirmation] = useState("");

  async function api<T>(params: Record<string, string>, body?: unknown): Promise<T> {
    if (!user) throw Error("Entre no NAI para consultar o Tallos.");
    const uid = user.uid;
    const token = await user.getIdToken();
    const response = await fetch("/api/integrations/rd-conversas?" + new URLSearchParams(params), {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (identity.current !== uid) throw Error("Sessão alterada. Atualize a página.");
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Consulta indisponível.");
    return data;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operação indisponível.");
    } finally {
      setBusy(false);
    }
  }
  async function load(nextTab: Tab, page = 1) {
    setTab(nextTab);
    await run(async () => {
      if (nextTab === "contacts")
        setContacts(await api({ resource: "contacts", page: String(page) }));
      if (nextTab === "reports")
        setReports(
          await api({ resource: "reports", start, end, status: reportStatus, page: String(page) })
        );
      if (nextTab === "operators")
        setOperators((await api<List<Row>>({ resource: "operators" })).data);
      if (nextTab === "operation") setOperation(await api({ resource: "operation" }));
    });
  }
  useEffect(() => {
    setStatus(null);
    setContacts(null);
    setReports(null);
    setOperators([]);
    setOperation(null);
    setSelected(null);
    setDraft(null);
    setMessage("");
    setCompanies({ data: [], next: null });
    setEmployees({ data: [], next: null });
    setError("");
    setNotice("");
  }, [user?.uid]);

  async function openContact(contact: Contact) {
    setSelected(contact);
    setHistory(null);
    setHistoryError("");
    setDraft(null);
    setConfirmation("");
    setMessage("");
    setOperatorId("");
    setCompanyId(contact.link?.companyId || "");
    setEmployeeId(contact.link?.employeeId || "");
    setEmployees({ data: [], next: null });
    await run(async () => {
      const [directory, staff] = await Promise.all([
        api<Directory>({ resource: "directory" }),
        api<List<Row>>({ resource: "operators" }),
      ]);
      setCompanies(directory);
      setOperators(staff.data);
      if (contact.link?.companyId)
        setEmployees(await api({ resource: "directory", companyId: contact.link.companyId }));
    });
  }
  const list = tab === "contacts" ? contacts : reports;
  const page = list?.page || 1;
  const hasNext = list?.pages != null ? page < list.pages : (list?.data.length || 0) === 50;

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-700">
            Central de relacionamento
          </p>
          <h1 className="flex items-center gap-3 text-3xl font-semibold">
            <MessageSquare className="text-teal-600" /> RD Conversas · Tallos
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Atendimentos, contatos e solicitações de ASO conectados à operação NAI.
          </p>
        </div>
        <Button asChild variant="outline">
          <a
            href="https://app.tallos.com.br/app/analytics/dashboard"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir Tallos <ExternalLink className="ml-2 size-4" />
          </a>
        </Button>
      </header>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">
              {status?.connected
                ? "Conexão verificada"
                : "Conexão ainda não verificada nesta sessão"}
            </p>
            <p className="text-sm text-muted-foreground">
              {status
                ? "Última consulta: " + dateText(status.checkedAt)
                : "Consulte a API para confirmar o acesso do aplicativo."}
            </p>
            {status && (
              <p className="mt-1 text-xs text-muted-foreground">
                Histórico completo:{" "}
                {status.historyKeyConfigured
                  ? "chave configurada; acesso depende do plano"
                  : "requer chave privada e plano Advanced"}{" "}
                · Webhook:{" "}
                {status.webhookConfigured
                  ? "segredos configurados; confira os recebimentos"
                  : "configuração pendente"}
              </p>
            )}
          </div>
          <Button
            disabled={busy || !user}
            onClick={() => run(async () => setStatus(await api({ resource: "status" })))}
          >
            <RefreshCw className="mr-2 size-4" />
            Testar conexão
          </Button>
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        >
          {notice}
        </p>
      )}
      <nav aria-label="Áreas Tallos" className="flex flex-wrap gap-2">
        {(Object.keys(labels) as Tab[]).map((key) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "outline"}
            disabled={busy || !user}
            onClick={() => load(key)}
          >
            {labels[key]}
          </Button>
        ))}
      </nav>
      <section aria-busy={busy} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{labels[tab]}</h2>
          <Button variant="outline" disabled={busy || !user} onClick={() => load(tab)}>
            {busy ? "Consultando…" : "Atualizar consulta"}
          </Button>
        </div>
        {tab === "contacts" && (
          <>
            <Input
              aria-label="Buscar na página de contatos"
              placeholder="Buscar nome, empresa ou telefone nesta página"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {contacts?.total != null
                ? `${contacts.total} contatos informados pelo Tallos.`
                : "Consulta paginada, até 50 contatos por página."}{" "}
              O vínculo NAI é confirmado pela equipe.
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {contacts?.data
                .filter((c) =>
                  [c.name, c.phone, c.company]
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((c) => (
                  <Card key={c.id}>
                    <CardContent className="space-y-3 pt-5">
                      <div className="flex gap-3">
                        <Users className="mt-1 size-5 shrink-0 text-teal-600" />
                        <div className="min-w-0">
                          <p className="font-semibold">{c.name || "Contato sem nome"}</p>
                          <p className="break-all text-sm text-muted-foreground">
                            {c.phone || c.email || "Sem telefone"}
                          </p>
                          <p className="text-sm">{c.company || "Empresa não informada"}</p>
                        </div>
                      </div>
                      <p className="rounded-lg bg-muted p-2 text-xs">
                        {c.link
                          ? `NAI: ${c.link.companyName}${c.link.employeeName ? " · " + c.link.employeeName : ""}`
                          : "Vínculo NAI pendente"}
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={busy}
                        onClick={() => openContact(c)}
                      >
                        Vínculo, histórico e mensagem
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
            {contacts && !contacts.data.length && <p>Nenhum contato nesta página.</p>}
          </>
        )}
        {tab === "reports" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-sm">
                Início
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setReports(null);
                  }}
                />
              </label>
              <label className="space-y-1 text-sm">
                Fim
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setReports(null);
                  }}
                />
              </label>
              <label className="space-y-1 text-sm">
                Situação
                <select
                  className="block h-10 rounded-md border bg-background px-3"
                  value={reportStatus}
                  onChange={(e) => {
                    setReportStatus(e.target.value);
                    setReports(null);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="opened">Abertos</option>
                  <option value="closed">Encerrados</option>
                </select>
              </label>
              <Button disabled={busy} onClick={() => load("reports")}>
                Consultar período
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Até 90 dias. Os indicadores abaixo representam apenas a página carregada, não toda a
              operação.
            </p>
            {reports?.summary && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Registros carregados", reports.summary.loaded],
                  ["Abertos identificados", reports.summary.opened],
                  ["Encerrados identificados", reports.summary.closed],
                  ["Operadores identificados", reports.summary.operators],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <CardContent className="pt-5">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-2 text-3xl font-semibold">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {reports && (
              <DataTable
                rows={reports.data}
                columns={[
                  ["contact", "Contato"],
                  ["operator", "Operador"],
                  ["department", "Departamento"],
                  ["status", "Situação"],
                  ["channel", "Canal"],
                  ["openedAt", "Início"],
                  ["closedAt", "Encerramento"],
                ]}
              />
            )}
          </>
        )}
        {tab === "operators" && (
          <DataTable
            rows={operators}
            columns={[
              ["name", "Operador"],
              ["email", "E-mail"],
            ]}
          />
        )}
        {tab === "operation" && (
          <>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/aso-scheduler">
                  <CalendarDays className="mr-2 size-4" />
                  Abrir agendador de ASO
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/clients/grupo-avp">Abrir operação Grupo AVP</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Últimas 100 solicitações e mensagens recebidas pelo webhook AVP. O agendador mantém a
              conferência de cadastro, PGR e PCMSO.
            </p>
            {operation && (
              <>
                <h3 className="font-semibold">Solicitações de ASO · {operation.requests.length}</h3>
                <DataTable
                  rows={operation.requests}
                  columns={[
                    ["employeeName", "Colaborador"],
                    ["companyName", "Empresa"],
                    ["examType", "Exame"],
                    ["city", "Cidade"],
                    ["status", "Etapa"],
                    ["createdAt", "Recebido"],
                  ]}
                />
                <h3 className="font-semibold">Mensagens recebidas · {operation.messages.length}</h3>
                <DataTable
                  rows={operation.messages}
                  columns={[
                    ["phone", "Contato"],
                    ["text", "Mensagem"],
                    ["status", "Tratamento"],
                    ["receivedAt", "Recebido"],
                  ]}
                />
              </>
            )}
          </>
        )}
        {(tab === "contacts" || tab === "reports") && list && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={busy || page === 1}
              onClick={() => load(tab, page - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {page}
              {list.pages != null ? ` de ${list.pages}` : ""}
            </span>
            <Button
              variant="outline"
              disabled={busy || !hasNext}
              onClick={() => load(tab, page + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setSelected(null);
            setDraft(null);
            setConfirmation("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name || "Contato Tallos"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {selected.phone} · ID {selected.id}
              </p>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-emerald-700">
                  {notice}
                </p>
              )}
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Link2 className="size-4" />
                  Vínculo no NAI
                </h3>
                <label className="block text-sm">
                  Cliente
                  <select
                    aria-label="Cliente NAI"
                    className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                    value={companyId}
                    disabled={busy}
                    onChange={(e) => {
                      const id = e.target.value;
                      setCompanyId(id);
                      setEmployeeId("");
                      setEmployees({ data: [], next: null });
                      if (id)
                        run(async () =>
                          setEmployees(await api({ resource: "directory", companyId: id }))
                        );
                    }}
                  >
                    <option value="">Selecione o cliente</option>
                    {companies.data.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {companies.next && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const more = await api<Directory>({
                          resource: "directory",
                          after: companies.next!,
                        });
                        setCompanies({ data: [...companies.data, ...more.data], next: more.next });
                      })
                    }
                  >
                    Carregar mais clientes
                  </Button>
                )}
                <label className="block text-sm">
                  Colaborador (opcional)
                  <select
                    aria-label="Colaborador NAI"
                    className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                    value={employeeId}
                    disabled={busy || !companyId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  >
                    <option value="">Somente cliente</option>
                    {employees.data.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {employees.next && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const more = await api<Directory>({
                          resource: "directory",
                          companyId,
                          after: employees.next!,
                        });
                        setEmployees({ data: [...employees.data, ...more.data], next: more.next });
                      })
                    }
                  >
                    Carregar mais colaboradores
                  </Button>
                )}
                <Button
                  disabled={busy || !companyId}
                  onClick={() =>
                    run(async () => {
                      const result = await api<{ link: NonNullable<Contact["link"]> }>(
                        {},
                        {
                          action: "link",
                          contactId: selected.id,
                          companyId,
                          ...(employeeId ? { employeeId } : {}),
                        }
                      );
                      setContacts((current) =>
                        current
                          ? {
                              ...current,
                              data: current.data.map((c) =>
                                c.id === selected.id ? { ...c, link: result.link } : c
                              ),
                            }
                          : current
                      );
                      setNotice("Vínculo salvo no NAI.");
                    })
                  }
                >
                  Salvar vínculo
                </Button>
              </section>
              <section className="space-y-3 border-t pt-4">
                <h3 className="font-semibold">Histórico completo</h3>
                <p className="text-xs text-muted-foreground">
                  Período: {start} a {end}. Requer plano Advanced e chave privada configurada no
                  servidor.
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setHistoryError("");
                      try {
                        setHistory(
                          await api({ resource: "history", contactId: selected.id, start, end })
                        );
                      } catch (e) {
                        setHistory(null);
                        setHistoryError(e instanceof Error ? e.message : "Histórico indisponível.");
                      }
                    })
                  }
                >
                  Consultar histórico
                </Button>
                {historyError && (
                  <p role="status" className="text-sm text-amber-800">
                    {historyError}
                  </p>
                )}
                {history && (
                  <>
                    <DataTable
                      rows={history.data}
                      columns={[
                        ["sentBy", "Remetente"],
                        ["text", "Mensagem"],
                        ["createdAt", "Data"],
                      ]}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={busy || (history.page || 1) <= 1}
                        onClick={() =>
                          run(async () =>
                            setHistory(
                              await api({
                                resource: "history",
                                contactId: selected.id,
                                start,
                                end,
                                page: String((history.page || 1) - 1),
                              })
                            )
                          )
                        }
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          busy ||
                          (history.pages != null
                            ? (history.page || 1) >= history.pages
                            : history.data.length < 50)
                        }
                        onClick={() =>
                          run(async () =>
                            setHistory(
                              await api({
                                resource: "history",
                                contactId: selected.id,
                                start,
                                end,
                                page: String((history.page || 1) + 1),
                              })
                            )
                          )
                        }
                      >
                        Próxima
                      </Button>
                    </div>
                  </>
                )}
              </section>
              <section className="space-y-3 border-t pt-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="size-4" />
                  Mensagem com revisão e autorização
                </h3>
                {!draft ? (
                  <>
                    <label className="block text-sm">
                      Operador Tallos
                      <select
                        aria-label="Operador Tallos"
                        className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                        value={operatorId}
                        onChange={(e) => setOperatorId(e.target.value)}
                      >
                        <option value="">Selecione o operador</option>
                        {operators.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name || o.email || o.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Texto
                      <textarea
                        aria-label="Texto da mensagem"
                        className="mt-1 min-h-28 w-full rounded-md border bg-background p-3"
                        value={message}
                        maxLength={4000}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Prepare um rascunho para revisar. O Tallos pode exigir janela de atendimento
                      aberta para mensagens livres.
                    </p>
                    <Button
                      disabled={busy || !operatorId || !message.trim()}
                      onClick={() =>
                        run(async () => {
                          setDraft(
                            await api(
                              {},
                              { action: "draft", contactId: selected.id, operatorId, message }
                            )
                          );
                          setConfirmation("");
                        })
                      }
                    >
                      Preparar revisão
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-slate-900">
                    <p className="font-semibold">Confira antes de autorizar</p>
                    <p className="text-sm">
                      Destinatário: {selected.name} · {selected.phone} · {draft.contactId}
                    </p>
                    <p className="text-sm">
                      Operador:{" "}
                      {operators.find((o) => o.id === draft.operatorId)?.name || draft.operatorId}
                    </p>
                    <p className="whitespace-pre-wrap rounded-lg bg-white p-3 text-sm">
                      {draft.message}
                    </p>
                    <label className="block text-sm">
                      Para enviar esta mensagem, digite AUTORIZAR ENVIO
                      <Input
                        aria-label="Confirmação de envio"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setDraft(null);
                          setConfirmation("");
                        }}
                      >
                        Voltar e editar
                      </Button>
                      <Button
                        disabled={busy || confirmation !== "AUTORIZAR ENVIO"}
                        onClick={() =>
                          run(async () => {
                            const reviewedDraft = draft;
                            setDraft(null);
                            setMessage("");
                            setConfirmation("");
                            const result = await api<{ message: string }>(
                              {},
                              { action: "send", draftId: reviewedDraft.draftId, confirmation }
                            );
                            setNotice(result.message);
                          })
                        }
                      >
                        <Send className="mr-2 size-4" />
                        Autorizar e enviar agora
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
