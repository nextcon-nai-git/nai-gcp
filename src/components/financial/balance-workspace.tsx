"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { balanceTotals, type BalanceSummary, type SavedBalance } from "@/lib/financial/balance";
import { dayLabel, money } from "@/lib/financial/ledger";

export function BalanceWorkspace() {
  const { user } = useUser();
  const [books, setBooks] = useState<BalanceSummary[]>([]);
  const [loaded, setLoaded] = useState<{ uid: string; book: SavedBalance } | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [pdf, setPdf] = useState<{ uid: string; id: string; url: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const pdfGeneration = useRef(0);
  const book = loaded?.uid === user?.uid ? loaded?.book : null;
  const visiblePdf = pdf?.uid === user?.uid && pdf?.id === book?.id ? pdf : null;
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!user) throw new Error("Entre no NAI para acessar os balanços.");
      const token = await user.getIdToken();
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Não foi possível concluir a solicitação.");
      }
      return response;
    },
    [user]
  );
  const load = useCallback(
    async (id?: string) => {
      const current = ++generation.current;
      setLoading(true);
      setLoaded(null);
      setBooks([]);
      setError("");
      setSearch("");
      try {
        const result = (await (await authFetch("/api/financial/balances")).json()) as {
          balances: BalanceSummary[];
        };
        if (current !== generation.current) return;
        setBooks(result.balances);
        const chosen =
          id ||
          result.balances.find((b) => b.periodEnd.startsWith("2025"))?.id ||
          result.balances[0]?.id;
        if (chosen && user) {
          const data = (await (
            await authFetch(`/api/financial/balances/${chosen}`)
          ).json()) as SavedBalance;
          if (current === generation.current) setLoaded({ uid: user.uid, book: data });
        }
      } catch (e) {
        if (current === generation.current)
          setError(e instanceof Error ? e.message : "Falha ao carregar balanços.");
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [authFetch, user]
  );
  useEffect(() => {
    const guard = generation;
    setBooks([]);
    setLoaded(null);
    setNotice("");
    setUploading(false);
    if (user) void load();
    return () => {
      guard.current++;
    };
  }, [user, load]);
  useEffect(() => {
    const guard = pdfGeneration;
    pdfGeneration.current++;
    setPdf(null);
    setPdfLoading(false);
    return () => {
      guard.current++;
    };
  }, [user, book?.id]);
  useEffect(() => {
    if (pdf) return () => URL.revokeObjectURL(pdf.url);
  }, [pdf]);
  async function importPdf(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError("Selecione um PDF de até 10 MB.");
      return;
    }
    const current = generation.current;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("source", file);
      const result = await (
        await authFetch("/api/financial/balances", { method: "POST", body: form })
      ).json();
      if (current !== generation.current) return;
      setNotice(
        result.alreadySaved
          ? "Este balanço já estava no acervo. A versão original foi preservada."
          : "Balanço e PDF original salvos no Financeiro."
      );
      setUploading(false);
      await load(result.balance.id);
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      if (current === generation.current) setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  async function openPdf() {
    if (!book || !user) return;
    const current = ++pdfGeneration.current;
    setPdfLoading(true);
    try {
      const blob = await (await authFetch(`/api/financial/balances/${book.id}?source=1`)).blob();
      if (current !== pdfGeneration.current) return;
      setPdf({ uid: user.uid, id: book.id, url: URL.createObjectURL(blob) });
    } catch (e) {
      if (current === pdfGeneration.current)
        setError(e instanceof Error ? e.message : "Falha ao abrir PDF.");
    } finally {
      if (current === pdfGeneration.current) setPdfLoading(false);
    }
  }
  const totals = useMemo(() => (book ? balanceTotals(book) : null), [book]);
  const rows =
    book?.rows.filter((row) =>
      row.label.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))
    ) || [];
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <Link
        href="/financial"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-teal-700"
      >
        <ArrowLeft size={16} /> Financeiro
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-300">
            <Scale size={18} /> Acervo contábil
          </div>
          <h1 className="text-3xl font-semibold">
            Balanço Patrimonial {book?.periodEnd.slice(0, 4) || "2025"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Consulte a posição patrimonial, compare os saldos e confira cada conta no documento
            original.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={14} /> Acesso da administração financeira
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="text-slate-900"
            disabled={!user || loading || uploading}
            onClick={() => void load(book?.id)}
          >
            <RefreshCw size={16} className="mr-2" /> Atualizar
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            disabled={!user || loading || uploading}
            onClick={() => input.current?.click()}
          >
            {uploading ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Upload size={16} className="mr-2" />
            )}
            {uploading ? "Conferindo PDF…" : "Importar balanço"}
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            aria-label="Selecionar PDF do Balanço Patrimonial"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importPdf(file);
            }}
          />
        </div>
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
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800"
        >
          {notice}
        </div>
      )}
      {!user && <p className="p-6 text-slate-600">Entre no NAI para consultar o acervo.</p>}
      {loading && (
        <p role="status" className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Carregando balanços…
        </p>
      )}
      {user && !loading && !error && !book && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Scale className="mx-auto mb-4 text-teal-600" size={36} />
          <h2 className="text-xl font-semibold text-slate-900">Adicione o Balanço 2025</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            Importe o PDF textual do SPED com saldos inicial e final. O sistema lê as contas e
            guarda o original para consulta.
          </p>
        </section>
      )}
      {book && totals && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
            <div>
              <h2 className="font-semibold text-slate-900">{book.company}</h2>
              <p className="mt-1 text-sm text-slate-500">
                CNPJ {book.cnpj} · {dayLabel(book.periodStart)} a {dayLabel(book.periodEnd)}
              </p>
            </div>
            <label className="text-xs font-medium text-slate-500">
              Documento
              <select
                aria-label="Selecionar balanço"
                value={book.id}
                disabled={uploading}
                onChange={(e) => void load(e.target.value)}
                className="mt-1 block w-full max-w-sm rounded-lg border bg-white p-2 text-sm text-slate-700"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.periodEnd.slice(0, 4)} · {b.company} ·{" "}
                    {new Date(b.importedAt).toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Ativo total",
                value: totals.assets.closingCents,
                detail: `Saldo inicial: ${money(totals.assets.openingCents)}`,
              },
              {
                label: "Obrigações com terceiros",
                value: totals.liabilitiesCents,
                detail: "Passivo total menos patrimônio líquido",
              },
              {
                label: "Patrimônio líquido",
                value: totals.equity.closingCents,
                detail: `Saldo inicial: ${money(totals.equity.openingCents)}`,
              },
            ].map((card) => (
              <section key={card.label} className="rounded-2xl border bg-white p-5">
                <h3 className="text-sm text-slate-500">{card.label}</h3>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {money(card.value)}
                </p>
                <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
              </section>
            ))}
          </div>
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <h2 className="font-semibold text-slate-900">Contas e saldos</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Valores do documento. Grupos e subcontas não devem ser somados entre si.
                </p>
              </div>
              <input
                aria-label="Buscar conta"
                placeholder="Buscar conta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border p-2 text-sm"
              />
              <Button variant="outline" disabled={pdfLoading} onClick={() => void openPdf()}>
                <FileText size={16} className="mr-2" />
                {pdfLoading ? "Abrindo…" : "Ver PDF original"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-4">Descrição</th>
                    <th className="p-4 text-right">Saldo inicial</th>
                    <th className="p-4 text-right">Saldo final</th>
                    <th className="p-4 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.page}-${index}`} className="border-t hover:bg-slate-50">
                      <td className="min-w-64 p-4 text-slate-700">{row.label}</td>
                      <td className="whitespace-nowrap p-4 text-right tabular-nums">
                        {money(row.openingCents)}
                      </td>
                      <td className="whitespace-nowrap p-4 text-right font-medium tabular-nums">
                        {money(row.closingCents)}
                      </td>
                      <td className="whitespace-nowrap p-4 text-right tabular-nums text-slate-500">
                        {money(row.closingCents - row.openingCents)}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        Nenhuma conta encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {visiblePdf && (
            <section className="rounded-2xl border bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Documento original</h2>
                <a
                  href={visiblePdf.url}
                  download={`Balanco-${book.periodEnd.slice(0, 4)}.pdf`}
                  className="flex items-center gap-2 text-sm font-medium text-teal-700"
                >
                  Baixar PDF <ArrowUpRight size={16} />
                </a>
              </div>
              <iframe
                title="Balanço Patrimonial original"
                src={visiblePdf.url}
                className="h-[70vh] w-full rounded-lg border"
              />
              <p className="mt-2 text-xs text-slate-500">
                Se o navegador não exibir o documento, use Baixar PDF.
              </p>
            </section>
          )}
          <p className="text-xs text-slate-500">
            O balanço mostra saldos patrimoniais. Não representa receitas, despesas ou movimentações
            de caixa. Extração automática disponível para conferência no PDF original.
          </p>
        </>
      )}
    </div>
  );
}
