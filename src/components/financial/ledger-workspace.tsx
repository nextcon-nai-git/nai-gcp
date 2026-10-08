"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  Upload,
  ShieldCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Landmark,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  dayLabel,
  emptyFilters,
  entryKey,
  filterLedger,
  ledgerCsv,
  money,
  summarizeLedger,
  type LedgerFilters,
  type LedgerSummary,
  type SavedLedger,
} from "@/lib/financial/ledger";

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-600/30";
const monthLabel = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(s + "-15T12:00:00Z")
  );
const count = (n: number) => n.toLocaleString("pt-BR");
function Select({
  label,
  value,
  change,
  children,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-500">
      <span>{label}</span>
      <select className={inputClass} value={value} onChange={(e) => change(e.target.value)}>
        {children}
      </select>
    </label>
  );
}
function saveCsv(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LedgerWorkspace() {
  const { user } = useUser();
  const [books, setBooks] = useState<LedgerSummary[]>([]);
  const [book, setBook] = useState<SavedLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [filters, setFilters] = useState<LedgerFilters>(emptyFilters);
  const [advanced, setAdvanced] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState("date-desc");
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [notice, setNotice] = useState("");
  const [pdf, setPdf] = useState<{ url: string; page: number } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const generation = useRef(0);
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) throw new Error("Entre no NAI para consultar o livro.");
      const token = await user.getIdToken();
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível concluir a solicitação.");
      }
      return response;
    },
    [user]
  );
  const load = useCallback(
    async (id?: string) => {
      const current = ++generation.current;
      setLoading(true);
      setError("");
      setBook(null);
      setSelected(null);
      setFilters(emptyFilters);
      setPage(0);
      try {
        const result = (await (await authFetch("/api/financial/ledger")).json()) as {
          books: LedgerSummary[];
        };
        if (current !== generation.current) return;
        setBooks(result.books);
        const chosen = id || result.books[0]?.id;
        if (chosen) {
          const data = (await (
            await authFetch(`/api/financial/ledger/${chosen}`)
          ).json()) as SavedLedger;
          if (current === generation.current) setBook(data);
        }
      } catch (e) {
        if (current === generation.current) {
          setBooks([]);
          setError(e instanceof Error ? e.message : "Falha ao consultar o acervo.");
        }
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [authFetch]
  );
  useEffect(() => {
    setBooks([]);
    setBook(null);
    if (user) void load();
    return () => {
      generation.current++;
    };
  }, [user, load]);
  useEffect(() => {
    if (pdf) return () => URL.revokeObjectURL(pdf.url);
  }, [pdf]);
  useEffect(() => {
    setPdf(null);
  }, [user, book?.id]);
  const whole = useMemo(() => summarizeLedger(book?.rows || []), [book]);
  const rows = useMemo(() => filterLedger(book?.rows || [], filters), [book, filters]);
  const summary = useMemo(() => summarizeLedger(rows), [rows]);
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sort === "amount-desc"
          ? b.amountCents - a.amountCents || a.id.localeCompare(b.id)
          : sort === "date-asc"
            ? a.date.localeCompare(b.date) || Number(a.entry) - Number(b.entry)
            : b.date.localeCompare(a.date) || Number(b.entry) - Number(a.entry)
      ),
    [rows, sort]
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 40));
  const currentPage = Math.min(page, pages - 1);
  const visible = sorted.slice(currentPage * 40, (currentPage + 1) * 40);
  const entry = whole.entries.find((e) => e.key === selected);
  const filterActive = Object.keys(emptyFilters).some(
    (k) => filters[k as keyof LedgerFilters] !== emptyFilters[k as keyof LedgerFilters]
  );
  const change = (key: keyof LedgerFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };
  const reset = () => {
    setFilters(emptyFilters);
    setPage(0);
  };
  const inspect = (key: string) => setSelected(key);
  const highestMonth = [...whole.monthly].sort((a, b) => b.debit - a.debit)[0];
  const largest = [...whole.entries].sort((a, b) => b.debit - a.debit)[0];
  async function importBook() {
    if (!dataFile || !pdfFile) return;
    setImporting(true);
    setImportError("");
    try {
      const form = new FormData();
      form.set("data", dataFile);
      form.set("source", pdfFile);
      const saved = await (
        await authFetch("/api/financial/ledger", { method: "POST", body: form })
      ).json();
      setImportOpen(false);
      setDataFile(null);
      setPdfFile(null);
      setNotice(
        saved.alreadySaved
          ? "Este livro já estava salvo. A importação não gerou duplicidades."
          : "Livro e PDF original salvos no acervo privado."
      );
      await load(saved.book.id);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setImporting(false);
    }
  }
  async function openPdf(sourcePage: number) {
    if (!book) return;
    setPdfLoading(true);
    try {
      const blob = await (await authFetch(`/api/financial/ledger/${book.id}?source=1`)).blob();
      setPdf({ url: URL.createObjectURL(blob), page: sourcePage });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível abrir o PDF.");
    } finally {
      setPdfLoading(false);
    }
  }
  return (
    <div className="space-y-6 pb-16 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link
          href="/financial"
          className="flex items-center gap-2 text-slate-500 hover:text-teal-700"
        >
          <ArrowLeft size={15} />
          Financeiro <ChevronRight size={13} />
          <span className="font-semibold text-slate-800">Livro Diário</span>
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={14} />
          Acervo interno · acesso restrito
        </span>
      </div>
      <section className="relative overflow-hidden rounded-3xl bg-[#092c3d] p-6 text-white md:p-8">
        <div className="absolute -right-10 -top-20 size-72 rounded-full border-[42px] border-white/[0.025]" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] font-semibold tracking-widest text-teal-200">
              <BookOpen size={13} /> INTELIGÊNCIA CONTÁBIL
            </span>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Seu livro diário, em perspectiva.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Explore as movimentações, acompanhe as contas e encontre cada registro no documento
              original.
            </p>
            {book && (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-teal-100">
                <span className="font-semibold">{book.company}</span>
                <span>·</span>
                <span>CNPJ {book.cnpj}</span>
                <span>· Livro {book.bookNumber}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={15} className="mr-2" />
              Importar livro
            </Button>
            <Button
              className="rounded-xl bg-teal-300 text-[#092c3d] hover:bg-teal-200"
              disabled={!book || !rows.length}
              onClick={() =>
                saveCsv(ledgerCsv(rows), `livro-diario-${book?.periodStart.slice(0, 4)}.csv`)
              }
            >
              <Download size={15} className="mr-2" />
              Exportar recorte
            </Button>
          </div>
        </div>
      </section>
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm"
        >
          <span>{notice}</span>
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <AlertCircle className="mb-3 text-amber-600" />
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {loading && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-2xl border bg-white p-16 text-slate-500"
        >
          <Loader2 className="animate-spin" />
          Carregando o acervo contábil...
        </div>
      )}
      {!loading && !error && !book && (
        <section className="rounded-3xl border border-dashed bg-white px-6 py-16 text-center">
          <BookOpen size={42} className="mx-auto mb-4 text-teal-600" />
          <h2 className="text-xl font-semibold">Seu acervo contábil começa aqui</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
            Importe a extração estruturada do livro e o PDF original. O NAI confere a identidade do
            arquivo, preserva a origem e organiza a leitura.
          </p>
          <Button className="mt-6 rounded-xl" onClick={() => setImportOpen(true)}>
            Importar primeiro livro
          </Button>
        </section>
      )}
      {book && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 max-w-full">
              <label className="text-xs font-medium text-slate-500" htmlFor="book">
                Livro selecionado
              </label>
              <select
                id="book"
                value={book.id}
                onChange={(e) => void load(e.target.value)}
                className={cn(inputClass, "mt-1 max-w-full md:w-auto")}
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.company} · {b.periodStart.slice(0, 4)} · Livro {b.bookNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                {dayLabel(book.periodStart)} — {dayLabel(book.periodEnd)}
                <br />
                {count(book.pageCount)} páginas · {count(whole.rowCount)} partidas
              </span>
              <Button
                size="icon"
                variant="outline"
                className="rounded-xl"
                aria-label="Atualizar livro"
                onClick={() => void load(book.id)}
              >
                <RefreshCw size={15} />
              </Button>
            </div>
          </div>
          <section
            aria-label="Filtros do livro"
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="grid items-end gap-3 md:grid-cols-[minmax(200px,2fr)_1fr_1fr_auto]">
              <label className="space-y-1 text-xs font-medium text-slate-500">
                <span>Busca no livro</span>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    value={filters.query}
                    onChange={(e) => change("query", e.target.value)}
                    placeholder="Histórico, conta, fornecedor ou nº do lançamento"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
              </label>
              <Select label="Mês" value={filters.month} change={(v) => change("month", v)}>
                <option value="all">Ano completo</option>
                {whole.monthly.map((m) => (
                  <option key={m.month} value={m.month}>
                    {monthLabel(m.month)}
                  </option>
                ))}
              </Select>
              <Select
                label="Conta contábil"
                value={filters.account}
                change={(v) => change("account", v)}
              >
                <option value="all">Todas as contas</option>
                {whole.accounts.map((a) => (
                  <option key={a.account} value={a.account}>
                    {a.name} · {a.account}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                aria-expanded={advanced}
                onClick={() => setAdvanced((v) => !v)}
              >
                <SlidersHorizontal size={15} className="mr-2" />
                Mais filtros
              </Button>
            </div>
            {advanced && (
              <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-5">
                <Select
                  label="Natureza da partida"
                  value={filters.side}
                  change={(v) => change("side", v)}
                >
                  <option value="all">Débito e crédito</option>
                  <option value="D">Débito</option>
                  <option value="C">Crédito</option>
                </Select>
                <Select
                  label="Grupo contábil"
                  value={filters.group}
                  change={(v) => change("group", v)}
                >
                  <option value="all">Todos</option>
                  <option value="1">1 · Ativo</option>
                  <option value="2">2 · Passivo / patrimônio</option>
                  <option value="3">3 · Resultado</option>
                </Select>
                <label className="space-y-1 text-xs text-slate-500">
                  Valor mínimo (R$)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.min}
                    onChange={(e) => change("min", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-500">
                  Data inicial
                  <input
                    type="date"
                    value={filters.start}
                    onChange={(e) => change("start", e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-500">
                  Data final
                  <input
                    type="date"
                    value={filters.end}
                    onChange={(e) => change("end", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            {filterActive && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                <span className="text-teal-700">
                  {count(rows.length)} de {count(whole.rowCount)} partidas neste recorte.
                  Indicadores e exportação acompanham os filtros.
                </span>
                <button
                  className="flex items-center gap-1 font-semibold text-slate-500"
                  onClick={reset}
                >
                  <X size={13} />
                  Limpar filtros
                </button>
              </div>
            )}
          </section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Débitos no recorte",
                value: money(summary.debit),
                note: "Movimentação a débito",
                icon: ArrowDownLeft,
                color: "text-teal-700 bg-teal-50",
              },
              {
                label: "Créditos no recorte",
                value: money(summary.credit),
                note: "Movimentação a crédito",
                icon: ArrowUpRight,
                color: "text-indigo-600 bg-indigo-50",
              },
              {
                label: "Partidas contábeis",
                value: count(summary.rowCount),
                note: `Em ${count(summary.entryCount)} lançamentos`,
                icon: Layers,
                color: "text-sky-700 bg-sky-50",
              },
              {
                label: "Contas movimentadas",
                value: count(summary.accounts.length),
                note: `De ${whole.accounts.length} contas no livro`,
                icon: Landmark,
                color: "text-amber-700 bg-amber-50",
              },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{s.label}</span>
                  <span className={cn("rounded-lg p-2", s.color)}>
                    <s.icon size={17} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{s.value}</p>
                <p className="mt-1 text-xs text-slate-400">{s.note}</p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Débito e crédito representam os lados dos registros contábeis. Esses totais não
            representam, por si só, receitas, despesas ou fluxo de caixa.
          </p>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-5 flex h-auto w-fit max-w-full justify-start overflow-x-auto rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="overview" className="rounded-lg py-2.5">
                Visão geral
              </TabsTrigger>
              <TabsTrigger value="entries" className="rounded-lg py-2.5">
                Lançamentos
              </TabsTrigger>
              <TabsTrigger value="accounts" className="rounded-lg py-2.5">
                Razão por conta
              </TabsTrigger>
              <TabsTrigger value="checks" className="rounded-lg py-2.5">
                Conferência
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
                <section className="min-w-0 rounded-2xl border bg-white p-5 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold">Movimentação mensal</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Débitos e créditos do recorte selecionado
                      </p>
                    </div>
                    <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">
                      R$
                    </span>
                  </div>
                  <div className="mt-6 h-64" aria-label="Gráfico de débitos e créditos por mês">
                    {summary.monthly.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={summary.monthly}
                          margin={{ left: 8, right: 4, top: 4, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf1" />
                          <XAxis
                            dataKey="month"
                            tickFormatter={monthLabel}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                          />
                          <YAxis
                            width={65}
                            tickFormatter={(v) => `${Math.round(Number(v) / 100000)} mil`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                          />
                          <Tooltip
                            formatter={(v: number) => money(v)}
                            labelFormatter={(v) => monthLabel(String(v))}
                            contentStyle={{ borderRadius: 12, fontSize: 12 }}
                          />
                          <Legend
                            iconType="circle"
                            wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
                          />
                          <Bar
                            name="Débitos"
                            dataKey="debit"
                            fill="#0d9488"
                            radius={[3, 3, 0, 0]}
                          />
                          <Bar
                            name="Créditos"
                            dataKey="credit"
                            fill="#818cf8"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="pt-16 text-center text-sm text-slate-500">
                        Nenhuma movimentação neste recorte.
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Explorar mês">
                    {whole.monthly.map((m) => (
                      <button
                        key={m.month}
                        onClick={() => change("month", m.month)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs",
                          filters.month === m.month
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : "border-slate-100 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {monthLabel(m.month)}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border bg-white p-5 md:p-6">
                  <h2 className="font-semibold">Contas em destaque</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Volume por conta · soma de débitos e créditos
                  </p>
                  <div className="mt-5 space-y-4">
                    {summary.accounts.slice(0, 5).map((a, i) => (
                      <button
                        key={a.account}
                        className="block w-full text-left"
                        onClick={() => {
                          change("account", a.account);
                          setTab("accounts");
                        }}
                      >
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="truncate text-slate-600">{a.name}</span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {money(a.debit + a.credit)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              i === 0 ? "bg-teal-600" : "bg-teal-300"
                            )}
                            style={{
                              width: `${((a.debit + a.credit) / (summary.accounts[0].debit + summary.accounts[0].credit || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    className="mt-6 flex items-center gap-1 text-xs font-semibold text-teal-700"
                    onClick={() => setTab("accounts")}
                  >
                    Explorar todas as contas <ArrowRight size={14} />
                  </button>
                </section>
              </div>
              <section className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5">
                <h2 className="flex items-center gap-2 font-semibold text-teal-900">
                  <Sparkles size={18} />
                  Leitura inteligente do livro
                </h2>
                <p className="mt-1 text-xs text-teal-800/70">
                  Cálculos sobre o livro completo, com acesso aos registros que sustentam cada
                  destaque.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <button
                    className="rounded-xl border border-teal-100 bg-white p-4 text-left hover:border-teal-400"
                    onClick={() => setTab("checks")}
                  >
                    <CheckCircle2 size={18} className="mb-3 text-teal-600" />
                    <h3 className="text-sm font-semibold">
                      {whole.unbalanced.length
                        ? `${whole.unbalanced.length} lançamentos com diferença`
                        : "Partidas equilibradas"}
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {count(whole.entryCount)} lançamentos comparados individualmente. Diferença
                      total: {money(whole.debit - whole.credit)}.
                    </p>
                  </button>
                  {highestMonth && (
                    <button
                      className="rounded-xl border border-teal-100 bg-white p-4 text-left hover:border-teal-400"
                      onClick={() => {
                        reset();
                        change("month", highestMonth.month);
                        setTab("entries");
                      }}
                    >
                      <Layers size={18} className="mb-3 text-indigo-500" />
                      <h3 className="text-sm font-semibold">
                        Maior movimento: {monthLabel(highestMonth.month)}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {money(highestMonth.debit)} a débito, incluindo ajustes e encerramentos
                        presentes no livro.
                      </p>
                    </button>
                  )}
                  {largest && (
                    <button
                      className="rounded-xl border border-teal-100 bg-white p-4 text-left hover:border-teal-400"
                      onClick={() => inspect(largest.key)}
                    >
                      <FileText size={18} className="mb-3 text-amber-500" />
                      <h3 className="text-sm font-semibold">
                        Maior lançamento: nº {largest.entry}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {money(largest.debit)} a débito em {dayLabel(largest.date)}. Veja a
                        composição e o histórico.
                      </p>
                    </button>
                  )}
                </div>
              </section>
            </TabsContent>
            <TabsContent value="entries">
              <section className="overflow-hidden rounded-2xl border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                  <div>
                    <h2 className="font-semibold">Diário de lançamentos</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Cada linha é uma partida. Abra o detalhe para ver todas as contrapartidas.
                    </p>
                  </div>
                  <Select
                    label="Ordenação"
                    value={sort}
                    change={(v) => {
                      setSort(v);
                      setPage(0);
                    }}
                  >
                    <option value="date-desc">Mais recentes</option>
                    <option value="date-asc">Mais antigos</option>
                    <option value="amount-desc">Maior valor</option>
                  </Select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {[
                          "Data / Nº",
                          "Conta contábil",
                          "Histórico",
                          "Débito",
                          "Crédito",
                          "Origem",
                          "",
                        ].map((h, i) => (
                          <th key={i} className="px-4 py-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="font-medium">{dayLabel(r.date)}</span>
                            <span className="mt-1 block text-slate-400">#{r.entry}</span>
                          </td>
                          <td className="max-w-[200px] px-4 py-4">
                            <span className="block font-medium">{r.accountName}</span>
                            <span className="mt-1 block font-mono text-[10px] text-slate-400">
                              {r.account}
                            </span>
                          </td>
                          <td className="max-w-[340px] px-4 py-4 leading-5 text-slate-500">
                            <p className="line-clamp-2" title={r.history}>
                              {r.history}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-teal-700">
                            {r.side === "D" ? money(r.amountCents) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-indigo-600">
                            {r.side === "C" ? money(r.amountCents) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                            p. {r.page}
                            {r.endPage !== r.page ? `–${r.endPage}` : ""}
                          </td>
                          <td className="px-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-teal-700"
                              aria-label={`Detalhar lançamento ${r.entry} de ${dayLabel(r.date)} conta ${r.account}`}
                              onClick={() => inspect(entryKey(r))}
                            >
                              Detalhes
                              <ChevronRight size={13} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!rows.length && (
                  <div className="p-12 text-center text-sm text-slate-500">
                    Nenhuma partida encontrada.{" "}
                    <button className="font-semibold text-teal-700" onClick={reset}>
                      Limpar filtros
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-xs text-slate-500">
                  <span>
                    {rows.length
                      ? `${currentPage * 40 + 1}–${Math.min((currentPage + 1) * 40, rows.length)}`
                      : "0"}{" "}
                    de {count(rows.length)} partidas
                  </span>
                  <div className="flex items-center gap-3">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Página anterior"
                      disabled={!currentPage}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={15} />
                    </Button>
                    <span>
                      Página {currentPage + 1} de {pages}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Próxima página"
                      disabled={currentPage + 1 >= pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight size={15} />
                    </Button>
                  </div>
                </div>
              </section>
            </TabsContent>
            <TabsContent value="accounts">
              <section className="overflow-hidden rounded-2xl border bg-white">
                <div className="border-b p-5">
                  <h2 className="font-semibold">Razão por conta</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Saldo da movimentação = débitos − créditos. Não inclui saldos de abertura e não
                    equivale ao saldo patrimonial final.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        {[
                          "Conta",
                          "Partidas",
                          "Débitos",
                          "Créditos",
                          "Saldo da movimentação",
                          "",
                        ].map((s, i) => (
                          <th key={i} className="p-4 font-medium">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.accounts.map((a) => (
                        <tr key={a.account} className="border-t border-slate-100">
                          <td className="p-4">
                            <p className="font-medium">{a.name}</p>
                            <p className="mt-1 font-mono text-xs text-slate-400">{a.account}</p>
                          </td>
                          <td className="p-4 text-slate-500">{a.count}</td>
                          <td className="whitespace-nowrap p-4 tabular-nums">{money(a.debit)}</td>
                          <td className="whitespace-nowrap p-4 tabular-nums">{money(a.credit)}</td>
                          <td className="whitespace-nowrap p-4 font-medium tabular-nums">
                            {money(Math.abs(a.debit - a.credit))}{" "}
                            <span className="text-xs text-slate-400">
                              {a.debit === a.credit ? "zerado" : a.debit > a.credit ? "D" : "C"}
                            </span>
                          </td>
                          <td className="p-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                change("account", a.account);
                                setTab("entries");
                              }}
                            >
                              Explorar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!summary.accounts.length && (
                  <p className="p-10 text-center text-sm text-slate-500">
                    Nenhuma conta neste recorte.
                  </p>
                )}
              </section>
            </TabsContent>
            <TabsContent value="checks">
              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-2xl border bg-white p-6">
                  <h2 className="font-semibold">Conferência de partidas</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Considera todas as contrapartidas de cada lançamento no livro completo, mesmo
                    quando a tela está filtrada.
                  </p>
                  <dl className="mt-5 space-y-3 text-sm">
                    {[
                      ["Débitos do livro", money(whole.debit)],
                      ["Créditos do livro", money(whole.credit)],
                      ["Diferença D − C", money(whole.debit - whole.credit)],
                      ["Lançamentos com diferença", count(whole.unbalanced.length)],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between gap-4 border-b border-slate-100 pb-3"
                      >
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-semibold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {!whole.unbalanced.length ? (
                    <p className="mt-5 flex items-center gap-2 text-sm text-teal-700">
                      <CheckCircle2 size={18} />
                      Todos os lançamentos fecham em débitos e créditos.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {whole.unbalanced.map((e) => (
                        <button
                          key={e.key}
                          className="block text-sm text-amber-700 underline"
                          onClick={() => inspect(e.key)}
                        >
                          #{e.entry} · {dayLabel(e.date)} · diferença {money(e.debit - e.credit)}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 text-xs leading-5 text-slate-400">
                    A conferência verifica a igualdade aritmética. Classificação, competência e
                    documentação de suporte continuam sujeitas à revisão contábil.
                  </p>
                </section>
                <section className="rounded-2xl border bg-white p-6">
                  <h2 className="font-semibold">Origem e rastreabilidade</h2>
                  <dl className="mt-5 space-y-4 text-sm">
                    <div>
                      <dt className="text-xs text-slate-400">Documento original</dt>
                      <dd className="mt-1 break-words">{book.sourceName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Cobertura</dt>
                      <dd className="mt-1">
                        {book.pageCount} páginas · {count(whole.rowCount)} partidas ·{" "}
                        {count(whole.entryCount)} lançamentos
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">Importado em</dt>
                      <dd className="mt-1">
                        {new Date(book.importedAt).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}{" "}
                        (Brasília)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">
                        Identificador de integridade do PDF · SHA-256
                      </dt>
                      <dd className="mt-1 break-all font-mono text-[11px] text-slate-500">
                        {book.sourceSha256}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    className="mt-6 rounded-xl"
                    variant="outline"
                    disabled={pdfLoading}
                    onClick={() => void openPdf(1)}
                  >
                    <FileText size={15} className="mr-2" />
                    {pdfLoading ? "Abrindo..." : "Consultar PDF original"}
                  </Button>
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
      <Sheet open={!!entry} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Lançamento #{entry?.entry}</SheetTitle>
            <SheetDescription>
              {entry && dayLabel(entry.date)} · composição completa do lançamento
            </SheetDescription>
          </SheetHeader>
          {entry && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="text-teal-700">
                  Débitos<p className="mt-1 font-semibold">{money(entry.debit)}</p>
                </div>
                <div className="text-indigo-600">
                  Créditos<p className="mt-1 font-semibold">{money(entry.credit)}</p>
                </div>
              </div>
              {entry.rows.map((r) => (
                <article key={r.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold",
                        r.side === "D" ? "bg-teal-50 text-teal-700" : "bg-indigo-50 text-indigo-600"
                      )}
                    >
                      {r.side === "D" ? "Débito" : "Crédito"}
                    </span>
                    <span className="font-semibold tabular-nums">{money(r.amountCents)}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{r.accountName}</h3>
                  <p className="mt-1 font-mono text-xs text-slate-400">{r.account}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{r.history}</p>
                  {r.costCenter && (
                    <p className="mt-2 text-xs text-slate-500">Centro de custo: {r.costCenter}</p>
                  )}
                  <button
                    disabled={pdfLoading}
                    className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-teal-700"
                    onClick={() => void openPdf(r.page)}
                  >
                    <FileText size={14} />
                    {pdfLoading
                      ? "Abrindo PDF..."
                      : `Ver página ${r.page}${r.endPage !== r.page ? ` (continua na ${r.endPage})` : ""}`}
                  </button>
                </article>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={importOpen}
        onOpenChange={(v) => {
          if (!importing) setImportOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar livro diário</DialogTitle>
            <DialogDescription>
              Selecione a extração NAI (.nai.json) e o PDF original correspondente. O livro será
              salvo no acervo interno, com proteção contra duplicidades.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-3">
            <label className="block space-y-2 text-sm font-medium">
              Arquivo estruturado NAI
              <input
                type="file"
                accept=".json,application/json"
                className="block w-full text-xs"
                onChange={(e) => setDataFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              PDF original
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="block w-full text-xs"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              A extração preserva contas, históricos, datas, valores e páginas. Os totais e as
              contrapartidas são recalculados pelo NAI.
            </p>
            {importError && (
              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                {importError}
              </p>
            )}
            <Button
              className="w-full rounded-xl"
              disabled={!dataFile || !pdfFile || importing}
              onClick={() => void importBook()}
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Conferindo e salvando...
                </>
              ) : (
                "Conferir e salvar no NAI"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pdf} onOpenChange={(v) => !v && setPdf(null)}>
        <DialogContent className="h-[90vh] max-w-6xl">
          <DialogHeader>
            <DialogTitle>Livro Diário · documento original</DialogTitle>
            <DialogDescription>
              Referência: página {pdf?.page}. A navegação depende do visualizador PDF do navegador.
            </DialogDescription>
          </DialogHeader>
          {pdf && (
            <>
              <iframe
                title={`PDF original na página ${pdf.page}`}
                src={`${pdf.url}#page=${pdf.page}`}
                className="h-[68vh] w-full rounded-lg border"
              />
              <a
                href={pdf.url}
                download="livro-diario.pdf"
                className="text-sm font-semibold text-teal-700"
              >
                Baixar PDF original
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
