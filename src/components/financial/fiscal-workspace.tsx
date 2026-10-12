"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { fiscalStatusLabel, type FiscalPage, type InvoiceQuery } from "@/lib/financial/nfse";
const card = "rounded-xl border border-slate-700 bg-slate-900 p-5";
const field = "mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white";
export function FiscalWorkspace() {
  const { user } = useUser();
  const [result, setResult] = useState<FiscalPage | null>(null);
  const [query, setQuery] = useState<InvoiceQuery | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const epoch = useRef(0),
    running = useRef(false);
  useEffect(() => {
    epoch.current++;
    running.current = false;
    setResult(null);
    setQuery(null);
    setError("");
    setBusy(false);
    return () => {
      epoch.current++;
    };
  }, [user]);
  async function load(q: InvoiceQuery) {
    if (!user || running.current) return;
    const current = epoch.current;
    running.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const token = await user.getIdToken();
      if (current !== epoch.current) return;
      const response = await fetch("/api/financial/nfse", {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
      const data = await response.json();
      if (current !== epoch.current) return;
      if (!response.ok) throw new Error(data.error || "Consulta indisponível.");
      setResult(data);
      setQuery(q);
    } catch (e) {
      if (current === epoch.current)
        setError(e instanceof Error ? e.message : "Consulta indisponível.");
    } finally {
      if (current === epoch.current) {
        running.current = false;
        setBusy(false);
      }
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void load({
      provider: "omie",
      page: 1,
      start: String(form.get("start")),
      end: String(form.get("end")),
      environment: form.get("environment") as "H" | "P",
    });
  }
  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-6 text-slate-100">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">NAI · Financeiro</p>
          <h1 className="mt-2 text-3xl font-semibold">Notas fiscais de serviço</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Consulte as NFS-e da empresa conectada ao Omie e acompanhe a preparação para emissão
            própria.
          </p>
        </div>
        <Link className="text-cyan-300 underline" href="/financial/omie">
          Conexão Omie
        </Link>
      </header>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Integrações fiscais">
        <article className={card}>
          <p className="text-sm text-cyan-300">Disponível nesta versão</p>
          <h2 className="mt-2 text-xl font-semibold">Consulta pelo Omie</h2>
          <p className="mt-3 text-sm text-slate-300">
            O certificado A1 permanece no Omie. A emissão e o cancelamento continuam sendo
            realizados lá; esta tela apenas consulta notas.
          </p>
          <p className="mt-3 text-sm">
            Certificado: Configurações → Principais → Certificado Digital.
          </p>
          <a
            className="mt-3 inline-block text-sm text-cyan-300 underline"
            href="https://ajuda.omie.com.br/pt-BR/articles/1369937-adicionando-ou-atualizando-o-certificado-digital"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instruções oficiais do Omie
          </a>
        </article>
        <article className={card}>
          <p className="text-sm text-amber-300">Ainda indisponível</p>
          <h2 className="mt-2 text-xl font-semibold">Emissão direta pelo NAI</h2>
          <p className="mt-3 text-sm text-slate-300">
            A mudança de provedor exige integração fiscal, custódia segura do certificado e
            homologação. Não há upload de certificado nesta versão.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>Validar emissão, consulta e cancelamento antes da migração.</li>
            <li>Preservar XML, PDF, histórico e vínculo com contas a receber.</li>
            <li>Definir uma data de corte e conferir pendências no Omie.</li>
          </ul>
        </article>
      </section>
      <section className={card}>
        <h2 className="text-xl font-semibold">Consultar NFS-e</h2>
        <form onSubmit={submit} className="mt-4 grid items-end gap-4 md:grid-cols-4">
          <label>
            Emissão inicial
            <input className={field} type="date" name="start" required disabled={busy} />
          </label>
          <label>
            Emissão final
            <input className={field} type="date" name="end" required disabled={busy} />
          </label>
          <label>
            Ambiente
            <select name="environment" className={field} defaultValue="P" disabled={busy}>
              <option value="P">Produção</option>
              <option value="H">Homologação</option>
            </select>
          </label>
          <Button type="submit" disabled={!user || busy}>
            {busy ? "Consultando…" : "Consultar notas"}
          </Button>
        </form>
        <p className="mt-3 text-sm text-slate-400">
          Até 12 meses por consulta. Esta operação não emite notas nem cria cobranças.
        </p>
        {!user && <p className="mt-3">Entre no NAI para consultar.</p>}
        {error && (
          <p role="alert" className="mt-4 text-rose-300">
            {error}
          </p>
        )}
      </section>
      {result && query && (
        <section className={card} aria-label="Resultado da consulta">
          <h2 className="text-xl font-semibold">{result.company}</h2>
          <p className="mt-2 text-sm">
            CNPJ {result.cnpj} · {result.environment === "P" ? "Produção" : "Homologação"} ·{" "}
            {query.start.split("-").reverse().join("/")} a{" "}
            {query.end.split("-").reverse().join("/")}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {result.total} registros no Omie. “Faturada” é o status do ERP e não substitui a
            conferência da autorização fiscal.
          </p>
          {result.invoices.length === 0 ? (
            <p className="mt-5">Nenhuma nota encontrada neste período e ambiente.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Nota / OS", "Tomador", "Emissão", "Valor", "Status", "Emissor"].map(
                      (label) => (
                        <th key={label} className="p-3">
                          {label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.invoices.map((invoice) => (
                    <tr className="border-t border-slate-700" key={invoice.id}>
                      <td className="p-3">
                        {invoice.number || "Sem número"}
                        <p className="text-slate-400">OS {invoice.orderNumber || "—"}</p>
                      </td>
                      <td className="p-3">{invoice.customer}</td>
                      <td className="whitespace-nowrap p-3">
                        {invoice.issuedOn.split("-").reverse().join("/")}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {(invoice.amountCents / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td className="p-3">{fiscalStatusLabel[invoice.status]}</td>
                      <td className="p-3">
                        {invoice.issuerCity || "Município não informado"}
                        <p className="text-slate-400">
                          IM {invoice.issuerMunicipalRegistration || "não informada"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center gap-4">
            <Button
              disabled={busy || result.page <= 1}
              onClick={() => void load({ ...query, page: result.page - 1 })}
            >
              Anterior
            </Button>
            <span>
              Página {result.page} de {Math.max(1, result.pages)}
            </span>
            <Button
              disabled={busy || result.page >= result.pages}
              onClick={() => void load({ ...query, page: result.page + 1 })}
            >
              Próxima
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
