"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FinancialReport } from "@/lib/financial/reports";
export function FinancialReportsWorkspace() {
  const { user } = useUser();
  return <Session key={user?.uid || "signed-out"} user={user} />;
}
function Session({ user }: { user: User | null }) {
  const [reports, setReports] = useState<FinancialReport[]>([]),
    [query, setQuery] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [allowed, setAllowed] = useState(false);
  const [source, setSource] = useState<{
    url: string;
    title: string;
    filename: string;
  } | null>(null);
  const active = useRef(true),
    form = useRef<HTMLFormElement>(null);
  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!user) throw new Error("Entre no NAI para consultar relatórios.");
      const token = await user.getIdToken();
      if (!active.current) throw new Error("Sessão encerrada.");
      const response = await fetch(path, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (active.current && (response.status === 401 || response.status === 403)) {
          setAllowed(false);
          setReports([]);
          setSource(null);
        }
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível concluir. Atualize para conferir.");
      }
      return response;
    },
    [user]
  );
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await (await request("/api/financial/reports")).json();
      if (active.current) {
        setReports(data.reports);
        setAllowed(true);
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Consulta indisponível.");
    } finally {
      if (active.current) setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    active.current = true;
    if (user) void load();
    return () => {
      active.current = false;
    };
  }, [user, load]);
  useEffect(() => {
    if (source) return () => URL.revokeObjectURL(source.url);
  }, [source]);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !allowed) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await (
        await request("/api/financial/reports", { method: "POST", body: data })
      ).json();
      if (active.current) {
        setReports((old) => [result.report, ...old.filter((r) => r.id !== result.report.id)]);
        setNotice(
          result.alreadySaved
            ? "Este relatório já estava salvo. Original preservado."
            : "Relatório salvo no acervo financeiro."
        );
        form.current?.reset();
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function open(r: FinancialReport) {
    setBusy(true);
    setError("");
    try {
      const blob = await (await request(`/api/financial/reports/${r.id}?source=1`)).blob();
      if (active.current)
        setSource({ url: URL.createObjectURL(blob), title: r.title, filename: r.sourceName });
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "Falha ao abrir.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-6 p-4 text-slate-900 md:p-8">
      <nav className="flex gap-5 text-sm text-teal-800">
        <Link href="/financial">Financeiro</Link>
        <Link href="/financial/actions">Ações financeiras</Link>
        <Link href="/financial/balanco">Balanços patrimoniais</Link>
      </nav>
      <header>
        <h1 className="text-3xl font-bold">Contabilidade · DRE e documentos</h1>
        <p className="mt-2 text-slate-600">
          Arquive DREs oficiais e outros demonstrativos contábeis no acervo privado. Para balanços patrimoniais, use a importação estruturada em Balanços patrimoniais. Esta tela preserva o PDF e seus metadados; não contabiliza lançamentos nem envia dados ao Omie.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-800">
          {notice}
        </p>
      )}
      <Button disabled={busy || !user} variant="outline" onClick={() => void load()}>
        Atualizar relatórios
      </Button>
      {allowed && (
        <>
          <form
            ref={form}
            onSubmit={upload}
            className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2"
          >
            <h2 className="text-lg font-semibold md:col-span-2">Registrar DRE ou outro demonstrativo</h2>
            <label className="text-sm">
              Título
              <Input name="title" required maxLength={200} />
            </label>
            <label className="text-sm">
              PDF original (até 10 MB)
              <Input type="file" name="source" accept="application/pdf,.pdf" required />
            </label>
            <label className="text-sm">
              Início do período
              <Input type="date" name="periodStart" required />
            </label>
            <label className="text-sm">
              Fim do período
              <Input type="date" name="periodEnd" required />
            </label>
            <label className="text-sm md:col-span-2">
              Resumo e critérios
              <textarea
                name="description"
                maxLength={4000}
                rows={4}
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
            <Button disabled={busy} type="submit">
              {busy ? "Processando…" : "Salvar relatório"}
            </Button>
          </form>
          <label className="block text-sm">
            Buscar relatórios
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Título, período ou arquivo"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {reports
              .filter((r) =>
                `${r.title} ${r.sourceName} ${r.periodStart} ${r.periodEnd}`
                  .toLowerCase()
                  .includes(query.toLowerCase())
              )
              .map((r) => (
                <article key={r.id} className="space-y-3 rounded-2xl border bg-white p-5">
                  <h2 className="text-xl font-semibold">{r.title}</h2>
                  <p className="text-sm text-slate-500">
                    {r.periodStart.split("-").reverse().join("/")} a{" "}
                    {r.periodEnd.split("-").reverse().join("/")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.description}</p>
                  <p className="break-all text-xs text-slate-500">{r.sourceName}</p>
                  <div className="flex gap-4">
                    <Button disabled={busy} onClick={() => void open(r)}>
                      Acessar PDF
                    </Button>
                    <Link
                      className="self-center text-sm text-teal-800 underline"
                      href="/financial/actions"
                    >
                      Acompanhar ações
                    </Link>
                  </div>
                </article>
              ))}
          </div>
          {!reports.length && <p>Nenhum relatório importado.</p>}
          {source && (
            <section className="space-y-3 rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between">
                <h2>{source.title}</h2>
                <Button variant="outline" onClick={() => setSource(null)}>
                  Fechar PDF
                </Button>
              </div>
              <p className="text-sm">O PDF original está pronto para download.</p>
              <a
                href={source.url}
                download={source.filename}
                className="inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
              >
                Baixar PDF original
              </a>
            </section>
          )}
        </>
      )}
    </div>
  );
}
