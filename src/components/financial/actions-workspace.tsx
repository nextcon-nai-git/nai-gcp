"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FINANCIAL_ACTION_IMPORT_MAX_BYTES,
  FinancialActionImportSchema,
  SavedFinancialActionBatchSchema,
  financialActionPriorities,
  financialActionStatuses,
  priorityLabels,
  statusLabels,
  type FinancialActionEvidence,
  type FinancialActionImport,
  type FinancialActionList,
  type SavedFinancialAction,
  type SavedFinancialActionBatch,
} from "@/lib/financial/actions";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (date: string) => date.split("-").reverse().join("/");
const inputClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700";
const priorityClass = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  medium: "border-sky-200 bg-sky-50 text-sky-800",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};
class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function FinancialActionsWorkspace() {
  const { user } = useUser();
  // A different account gets a new component before rendering any financial data.
  return <FinancialActionsSession key={user?.uid || "signed-out"} user={user} />;
}

function FinancialActionsSession({ user }: { user: User | null }) {
  const [batches, setBatches] = useState<SavedFinancialActionBatch[]>([]);
  const [access, setAccess] = useState<"pending" | "granted" | "denied">("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [preview, setPreview] = useState<{ data: FinancialActionImport; name: string } | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<SavedFinancialAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const [source, setSource] = useState<{ url: string; title: string; page: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const session = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const loadSequence = useRef(0);

  const invalidateRequests = useCallback(() => {
    generation.current++;
    loadSequence.current++;
  }, []);
  const clearPrivateData = useCallback(() => {
    setBatches([]);
    setNextCursor(null);
    setPreview(null);
    setSelected(null);
    setSource(null);
    setSourceBusy(false);
    setQuery("");
    setEditError("");
    setNotice("");
    if (input.current) input.current.value = "";
  }, []);
  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      if (!user || !session.current || session.current.signal.aborted)
        throw new Error("Entre no NAI para acessar as ações financeiras.");
      const signal = AbortSignal.any([session.current.signal, AbortSignal.timeout(45000)]);
      const token = await user.getIdToken();
      signal.throwIfAborted();
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (!signal.aborted && (response.status === 401 || response.status === 403)) {
          invalidateRequests();
          session.current?.abort();
          clearPrivateData();
          setAccess("denied");
          setLoading(false);
          setImporting(false);
          setSaving(false);
          setError(data.error || "O acesso financeiro não está autorizado para esta sessão.");
        }
        throw new ApiError(
          data.error || "Não foi possível concluir a solicitação.",
          response.status
        );
      }
      return response;
    },
    [user, clearPrivateData, invalidateRequests]
  );

  const mergeBatch = (batch: SavedFinancialActionBatch) => {
    setBatches((current) => [batch, ...current.filter((item) => item.id !== batch.id)]);
  };
  const load = useCallback(
    async (cursor?: string) => {
      const current = generation.current;
      const request = ++loadSequence.current;
      setLoading(true);
      setError("");
      try {
        const response = await api(
          `/api/financial/actions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
        );
        const result = (await response.json()) as FinancialActionList;
        const records = result.batches.map((batch) => SavedFinancialActionBatchSchema.parse(batch));
        if (current !== generation.current || request !== loadSequence.current) return;
        setBatches((previous) =>
          cursor
            ? [
                ...previous,
                ...records.filter((batch) => !previous.some((item) => item.id === batch.id)),
              ]
            : records
        );
        setNextCursor(result.nextCursor || null);
        setAccess("granted");
      } catch (failure) {
        if (current === generation.current && request === loadSequence.current)
          setError(
            failure instanceof Error ? failure.message : "Não foi possível consultar as ações."
          );
      } finally {
        if (current === generation.current && request === loadSequence.current) setLoading(false);
      }
    },
    [api]
  );
  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    generation.current++;
    if (user) void load();
    return () => {
      invalidateRequests();
      controller.abort();
    };
  }, [user, load, invalidateRequests]);
  useEffect(() => {
    if (source) return () => URL.revokeObjectURL(source.url);
  }, [source]);

  const actions = useMemo(() => batches.flatMap((batch) => batch.actions), [batches]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return actions
      .filter(
        (action) =>
          (statusFilter === "all" || action.status === statusFilter) &&
          (priorityFilter === "all" || action.priority === priorityFilter) &&
          (!normalized ||
            `${action.title} ${action.action} ${action.suggestedOwner} ${action.period.label}`
              .toLocaleLowerCase("pt-BR")
              .includes(normalized))
      )
      .sort(
        (a, b) =>
          financialActionPriorities.indexOf(a.priority) -
            financialActionPriorities.indexOf(b.priority) ||
          (a.proposedDueDate || "9999").localeCompare(b.proposedDueDate || "9999") ||
          a.title.localeCompare(b.title, "pt-BR")
      );
  }, [actions, statusFilter, priorityFilter, query]);

  async function chooseFile(file?: File) {
    if (!file || access !== "granted") return;
    const current = generation.current;
    setError("");
    setNotice("");
    setPreview(null);
    try {
      if (file.size > FINANCIAL_ACTION_IMPORT_MAX_BYTES)
        throw new Error("Selecione um arquivo JSON de até 2 MB.");
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error("O arquivo não contém JSON válido.");
      }
      const parsed = FinancialActionImportSchema.safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`Arquivo de ações inválido: ${issue?.message || "confira os campos"}.`);
      }
      if (current === generation.current) setPreview({ data: parsed.data, name: file.name });
    } catch (failure) {
      if (current === generation.current)
        setError(failure instanceof Error ? failure.message : "Não foi possível ler o arquivo.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  async function importActions() {
    if (!preview || importing || access !== "granted") return;
    const current = generation.current;
    setImporting(true);
    setError("");
    try {
      const result = await (
        await api("/api/financial/actions", { method: "POST", body: JSON.stringify(preview.data) })
      ).json();
      const batch = SavedFinancialActionBatchSchema.parse(result.batch);
      if (current !== generation.current) return;
      loadSequence.current++;
      setLoading(false);
      mergeBatch(batch);
      setPreview(null);
      setNotice(
        result.alreadySaved
          ? "Este lote já estava salvo. O andamento e os checklists existentes foram preservados."
          : `${batch.actions.length} ações importadas. O registro foi confirmado no acervo financeiro.`
      );
    } catch (failure) {
      if (current === generation.current)
        setError(
          failure instanceof Error ? failure.message : "Não foi possível importar as ações."
        );
    } finally {
      if (current === generation.current) setImporting(false);
    }
  }
  async function saveAction() {
    if (!selected || saving || access !== "granted") return;
    const current = generation.current;
    setSaving(true);
    setEditError("");
    try {
      const result = await (
        await api("/api/financial/actions", {
          method: "PATCH",
          body: JSON.stringify({
            batchId: selected.batchId,
            actionId: selected.id,
            expectedVersion: selected.version,
            status: selected.status,
            checklist: selected.checklist.map(({ id, checked }) => ({ id, checked })),
          }),
        })
      ).json();
      const batch = SavedFinancialActionBatchSchema.parse(result.batch);
      if (current !== generation.current) return;
      loadSequence.current++;
      setLoading(false);
      mergeBatch(batch);
      setSelected(null);
      setNotice("Alterações salvas e confirmadas. O painel mostra o estado registrado.");
    } catch (failure) {
      if (current !== generation.current) return;
      if (failure instanceof ApiError && failure.status === 409) {
        setSelected(null);
        await load();
        if (current === generation.current)
          setError(
            "A ação foi alterada por outra sessão. Sua edição não foi aplicada; abra o card atualizado e revise as mudanças."
          );
      } else {
        const message =
          failure instanceof Error ? failure.message : "Não foi possível salvar a ação.";
        setEditError(message);
        setError(message);
      }
    } finally {
      if (current === generation.current) setSaving(false);
    }
  }
  async function openDocument(evidence: FinancialActionEvidence) {
    if (!evidence.document || sourceBusy) return;
    const current = generation.current;
    setSourceBusy(true);
    setEditError("");
    try {
      const segment = evidence.document.kind === "ledger" ? "ledger" : "balances";
      const blob = await (
        await api(`/api/financial/${segment}/${evidence.document.id}?source=1`)
      ).blob();
      if (current === generation.current)
        setSource({
          url: URL.createObjectURL(blob),
          title: evidence.sourceName || evidence.label,
          page: evidence.page || 1,
        });
    } catch (failure) {
      if (current === generation.current)
        setEditError(
          failure instanceof Error ? failure.message : "Não foi possível abrir a fonte."
        );
    } finally {
      if (current === generation.current) setSourceBusy(false);
    }
  }
  const completionBlocked =
    selected?.status === "done" &&
    selected.checklist.some((item) => item.required && !item.checked);
  const busy = loading || importing || saving;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href="/financial"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-teal-700"
        >
          <ArrowLeft size={16} /> Financeiro
        </Link>
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={15} /> Acesso da administração financeira
        </span>
      </div>
      <header className="rounded-3xl bg-[#092c3d] p-6 text-white md:p-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-200">
          <ClipboardList size={20} /> ACOMPANHAMENTO FINANCEIRO
        </div>
        <h1 className="text-3xl font-bold">Ações financeiras</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Transforme análises em prioridades com responsáveis sugeridos, prazos e evidências.
          Acompanhe as conferências até concluir cada decisão.
        </p>
        {access === "granted" && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={() => input.current?.click()}
              className="bg-teal-300 text-slate-950 hover:bg-teal-200"
            >
              <Upload size={16} className="mr-2" /> Importar ações
            </Button>
            <Button
              disabled={busy}
              onClick={() => void load()}
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={16} className={cn("mr-2", loading && "animate-spin")} /> Atualizar
            </Button>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="Arquivo de ações financeiras"
          className="hidden"
          onChange={(event) => void chooseFile(event.target.files?.[0])}
        />
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      )}
      {!user && (
        <p className="rounded-2xl border bg-white p-6">
          Entre no NAI para consultar as ações financeiras.
        </p>
      )}
      {user && access === "pending" && (
        <div className="rounded-2xl border bg-white p-6">
          {loading ? (
            <p role="status" className="flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" /> Verificando acesso e consultando ações…
            </p>
          ) : (
            <Button variant="outline" onClick={() => void load()}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      {access === "denied" && (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="font-semibold">Acesso financeiro restrito</h2>
          <p className="mt-2 text-sm text-slate-600">
            Este painel está disponível aos administradores financeiros com acesso global ao NAI.
          </p>
        </div>
      )}
      {access === "granted" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {financialActionStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
                aria-pressed={statusFilter === status}
                className={cn(
                  "rounded-2xl border bg-white p-5 text-left transition-colors hover:border-teal-300",
                  statusFilter === status && "border-teal-500 bg-teal-50"
                )}
              >
                <span className="text-xs font-medium text-slate-500">{statusLabels[status]}</span>
                <strong className="mt-2 block text-3xl">
                  {actions.filter((action) => action.status === status).length}
                </strong>
              </button>
            ))}
          </div>
          <section className="space-y-5" aria-label="Cards de ações financeiras">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-56 flex-1">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <Input
                  aria-label="Buscar ações"
                  placeholder="Buscar ação, responsável ou período…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="rounded-xl bg-white pl-9"
                />
              </div>
              <select
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">Todos os status</option>
                {financialActionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por prioridade"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">Todas as prioridades</option>
                {financialActionPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priorityLabels[priority]}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              {visible.length} de {actions.length} ações carregadas · {batches.length} lotes ·
              Ordenadas por prioridade e prazo proposto
            </p>
            {actions.length === 0 && (
              <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
                <ClipboardList className="mx-auto mb-4 size-9 text-teal-700" />
                <h2 className="text-xl font-semibold">Seu plano financeiro começa aqui</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm text-slate-500">
                  Importe o arquivo de ações da análise financeira para revisar prioridades,
                  consultar as fontes e acompanhar cada checklist.
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Arquivo NAI em JSON, versão 1 · até 100 ações por lote · 2 MB
                </p>
              </div>
            )}
            {actions.length > 0 && visible.length === 0 && (
              <p className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">
                Nenhuma ação corresponde aos filtros selecionados.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((action) => {
                const checked = action.checklist.filter((item) => item.checked).length;
                return (
                  <article
                    key={action.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          priorityClass[action.priority]
                        )}
                      >
                        Prioridade {priorityLabels[action.priority].toLowerCase()}
                      </span>
                      <span className="text-xs text-slate-500">{statusLabels[action.status]}</span>
                    </div>
                    <h2 className="text-lg font-semibold leading-snug">{action.title}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                      {action.action}
                    </p>
                    <dl className="mt-5 space-y-2 text-xs">
                      <div>
                        <dt className="text-slate-400">Responsável sugerido</dt>
                        <dd className="mt-0.5 font-medium">{action.suggestedOwner}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        <div>
                          <dt className="text-slate-400">Prazo proposto</dt>
                          <dd className="mt-0.5">
                            {action.proposedDueDate ? day(action.proposedDueDate) : "A definir"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Período da análise</dt>
                          <dd className="mt-0.5">{action.period.label}</dd>
                        </div>
                      </div>
                    </dl>
                    <div className="mt-auto pt-5">
                      <div className="mb-2 flex justify-between text-xs text-slate-500">
                        <span>
                          Checklist {checked}/{action.checklist.length}
                        </span>
                        <span>{action.evidence.length} evidência(s)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-600"
                          style={{ width: `${(checked / action.checklist.length) * 100}%` }}
                        />
                      </div>
                      <Button
                        variant="outline"
                        className="mt-4 w-full rounded-xl"
                        onClick={() => {
                          setEditError("");
                          setSelected({
                            ...action,
                            checklist: action.checklist.map((item) => ({ ...item })),
                          });
                        }}
                      >
                        Abrir e acompanhar <ArrowRight size={15} className="ml-2" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
            {nextCursor && (
              <Button variant="outline" disabled={busy} onClick={() => void load(nextCursor)}>
                Carregar mais ações
              </Button>
            )}
          </section>
        </>
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && !importing) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Revisar importação</DialogTitle>
            <DialogDescription>
              Confira o lote antes de registrar as ações no Financeiro.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold">{preview.data.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {preview.name} · {preview.data.actions.length} ações · versão{" "}
                  {preview.data.schemaVersion}
                </p>
              </div>
              <ul className="max-h-72 space-y-3 overflow-y-auto">
                {preview.data.actions.map((action) => (
                  <li key={action.key} className="rounded-xl border p-3">
                    <p className="font-medium">{action.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {priorityLabels[action.priority]} · {action.suggestedOwner} ·{" "}
                      {action.checklist.length} itens · {action.evidence.length} evidências
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-slate-600">
                As ações serão registradas com suas evidências e ressalvas. Uma importação repetida
                preserva o andamento existente.
              </p>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <Button disabled={importing} onClick={() => void importActions()} className="w-full">
                {importing ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Upload size={16} className="mr-2" />
                )}
                {importing ? "Importando…" : "Importar ações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !saving) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title || "Ação financeira"}</DialogTitle>
            <DialogDescription>
              Plano proposto, evidências e acompanhamento da decisão.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    priorityClass[selected.priority]
                  )}
                >
                  {priorityLabels[selected.priority]}
                </span>
                <span className="text-xs text-slate-500">
                  {selected.period.label} · {day(selected.period.start)} a{" "}
                  {day(selected.period.end)}
                </span>
              </div>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Ação proposta</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selected.action}
                </p>
                <h3 className="mb-2 mt-5 text-sm font-semibold">Justificativa</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {selected.rationale}
                </p>
              </section>
              <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Responsável sugerido</dt>
                  <dd className="mt-1 font-medium">{selected.suggestedOwner}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Prazo proposto</dt>
                  <dd className="mt-1 font-medium">
                    {selected.proposedDueDate ? day(selected.proposedDueDate) : "A definir"}
                  </dd>
                </div>
              </dl>
              {(selected.baseAmountCents !== null || selected.estimatedSavingsCents !== null) && (
                <section className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">Valores para avaliação</h3>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {selected.baseAmountCents !== null && (
                      <div>
                        <dt className="text-xs text-slate-500">Valor de referência</dt>
                        <dd className="mt-1 text-xl font-semibold">
                          {money(selected.baseAmountCents)}
                        </dd>
                      </div>
                    )}
                    {selected.estimatedSavingsCents !== null && (
                      <div>
                        <dt className="text-xs text-slate-500">Economia estimada</dt>
                        <dd className="mt-1 text-xl font-semibold">
                          {money(selected.estimatedSavingsCents)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                    {selected.estimateBasis}
                  </p>
                </section>
              )}
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900">
                  Ressalva e conferências pendentes
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                  {selected.caveat}
                </p>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Checklist de acompanhamento</h3>
                {selected.checklist.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-xl border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={saving}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelected(
                          (value) =>
                            value && {
                              ...value,
                              checklist: value.checklist.map((check) =>
                                check.id === item.id ? { ...check, checked } : check
                              ),
                            }
                        );
                      }}
                      className="mt-0.5 size-4 accent-teal-700"
                    />
                    <span className="flex-1">
                      {item.text}
                      {item.required && (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">
                          Obrigatório
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Evidências e fontes</h3>
                {selected.evidence.map((evidence, index) => (
                  <article key={index} className="rounded-xl border bg-slate-50 p-4">
                    <h4 className="flex items-center gap-2 text-sm font-medium">
                      <FileText size={15} />
                      {evidence.label}
                    </h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {evidence.detail}
                    </p>
                    {evidence.sourceName && (
                      <p className="mt-2 break-words text-xs text-slate-500">
                        {evidence.sourceName}
                        {evidence.page ? ` · página ${evidence.page}` : ""}
                      </p>
                    )}
                    {evidence.sourceSha256 && (
                      <details className="mt-2 text-xs text-slate-500">
                        <summary className="cursor-pointer">Identificação do arquivo</summary>
                        <code className="mt-1 block break-all">
                          SHA-256: {evidence.sourceSha256}
                        </code>
                      </details>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3">
                      {evidence.document && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sourceBusy}
                          onClick={() => void openDocument(evidence)}
                        >
                          <FileText size={14} className="mr-2" />
                          {sourceBusy ? "Abrindo…" : "Abrir documento"}
                        </Button>
                      )}
                      {evidence.url && (
                        <a
                          href={evidence.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800 hover:underline"
                        >
                          <ExternalLink size={14} />
                          Abrir fonte
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </section>
              <div className="space-y-3 rounded-xl border bg-white p-4">
                <label className="block space-y-2 text-sm font-medium">
                  <span>Status</span>
                  <select
                    value={selected.status}
                    disabled={saving}
                    onChange={(event) =>
                      setSelected(
                        (value) =>
                          value && {
                            ...value,
                            status: event.target.value as SavedFinancialAction["status"],
                          }
                      )
                    }
                    className={cn(inputClass, "w-full")}
                  >
                    {financialActionStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                {completionBlocked && (
                  <p role="alert" className="text-xs text-amber-800">
                    Conclua os itens obrigatórios ou reabra a ação antes de salvar.
                  </p>
                )}
                {editError && (
                  <p role="alert" className="text-sm text-red-700">
                    {editError}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Versão {selected.version} · Atualizada em{" "}
                  {new Date(selected.updatedAt).toLocaleString("pt-BR")}
                </p>
                <Button
                  disabled={saving || Boolean(completionBlocked)}
                  onClick={() => void saveAction()}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} className="mr-2" />
                  )}
                  {saving ? "Salvando e conferindo…" : "Salvar acompanhamento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(source)}
        onOpenChange={(open) => {
          if (!open) setSource(null);
        }}
      >
        <DialogContent className="max-w-5xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{source?.title || "Documento de referência"}</DialogTitle>
            <DialogDescription>Fonte do acervo financeiro restrito.</DialogDescription>
          </DialogHeader>
          {source && (
            <iframe
              title={source.title}
              src={`${source.url}#page=${source.page}`}
              className="h-[72vh] w-full rounded-lg border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
