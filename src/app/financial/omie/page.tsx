"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CloudLightning, RefreshCw, ShieldCheck } from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OmieConnection, OmiePage } from "@/lib/financial/omie";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export default function OmieFinancialPage() {
  const { user } = useUser();
  const [connection, setConnection] = useState<OmieConnection | null>(null);
  const [result, setResult] = useState<OmiePage | null>(null);
  const [kind, setKind] = useState("receivable"),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [key, setKey] = useState(""),
    [secret, setSecret] = useState(""),
    [consent, setConsent] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const api = useCallback(
    async (query = "", init?: RequestInit) => {
      if (!user) throw new Error("Entre no NAI para acessar o financeiro.");
      const token = await user.getIdToken();
      const response = await fetch(`/api/financial/omie${query}`, {
        ...init,
        cache: "no-store",
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar o Omie.");
      return body;
    },
    [user]
  );
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    setConnection(null);
    setResult(null);
    setKey("");
    setSecret("");
    setConsent(false);
    setError("");
    if (user) {
      setBusy(true);
      api("", { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setConnection(data);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }
    return () => controller.abort();
  }, [api, user]);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    if (connection?.connected) {
      setBusy(true);
      setError("");
      api(`?view=titles&kind=${kind}&status=${status}&page=${page}`, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted) setResult(data);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }
    return () => controller.abort();
  }, [api, connection, kind, status, page, reload]);
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!consent || busy) return;
    const current = generation.current;
    setBusy(true);
    setError("");
    const payload = JSON.stringify({ appKey: key, appSecret: secret });
    setKey("");
    setSecret("");
    try {
      const data = await api("", { method: "POST", body: payload });
      if (current === generation.current) setConnection(data);
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Falha na conexão.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function disconnect() {
    if (
      !window.confirm(
        "Desconectar o Omie do NAI? A chave será removida desta integração. Os dados no Omie serão preservados."
      )
    )
      return;
    const current = generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await api("", { method: "DELETE" });
      if (current === generation.current) {
        setConnection(data);
        setResult(null);
        setConsent(false);
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <Link
        href="/financial"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> Financeiro
      </Link>
      <header className="rounded-3xl bg-slate-950 p-8 text-white">
        <div className="mb-3 flex items-center gap-2 text-teal-300">
          <CloudLightning size={22} />
          <span>OMIE · NEXTCON</span>
        </div>
        <h1 className="text-3xl font-bold">Integração financeira</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Consulte títulos a pagar e a receber do aplicativo NEXTCON. A conexão pertence ao
          financeiro interno, independentemente do cliente selecionado no NAI.
        </p>
      </header>
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}
      {!connection && (
        <p role="status">
          {busy
            ? "Verificando conexão…"
            : "A conexão não pôde ser verificada. Recarregue a página para tentar novamente."}
        </p>
      )}
      {connection && !connection.connected && (
        <form onSubmit={connect} className="max-w-2xl space-y-5 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Conectar aplicativo NEXTCON</h2>
          <p className="text-sm text-slate-600">
            O login Google permite entrar no Omie. Para integrar os sistemas, informe a App Key e a
            App Secret existentes em Meus aplicativos → NEXTCON → Configurações → Resumo do App.
          </p>
          <label className="block space-y-2">
            <span>App Key</span>
            <Input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="block space-y-2">
            <span>App Secret</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            Autorizo o NAI a guardar estas credenciais no servidor e consultar o financeiro da
            NEXTCON no Omie.
          </label>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck size={18} className="shrink-0" />
            Acesso restrito à administração financeira. Esta integração consulta dados; pagamentos,
            baixas e alterações de títulos continuam no Omie.
          </p>
          <Button disabled={busy || !consent || !key || !secret} type="submit">
            {busy ? "Validando conexão…" : "Validar e conectar"}
          </Button>
        </form>
      )}
      {connection?.connected && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5">
            <div>
              <h2 className="font-semibold">{connection.company}</h2>
              <p className="text-sm text-slate-500">
                CNPJ {connection.cnpj} · Credenciais verificadas em{" "}
                {new Date(connection.verifiedAt!).toLocaleString("pt-BR")}
              </p>
            </div>
            <Button variant="outline" onClick={disconnect} disabled={busy}>
              Desconectar
            </Button>
          </section>
          <section className="space-y-5 rounded-2xl border bg-white p-6">
            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-2">
                <span className="block text-sm">Tipo de título</span>
                <select
                  className="rounded-lg border p-2"
                  value={kind}
                  disabled={busy}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="receivable">Contas a receber</option>
                  <option value="payable">Contas a pagar</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-sm">Situação no Omie</span>
                <select
                  className="rounded-lg border p-2"
                  value={status}
                  disabled={busy}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">Todas</option>
                  <option value="EMABERTO">Em aberto</option>
                  <option value="ATRASADO">Atrasados</option>
                  <option value="VENCEHOJE">Vencem hoje</option>
                  <option value="AVENCER">A vencer</option>
                  <option value="LIQUIDADO">Liquidados</option>
                  <option value="CANCELADO">Cancelados</option>
                </select>
              </label>
              <Button variant="outline" disabled={busy} onClick={() => setReload((n) => n + 1)}>
                <RefreshCw size={16} className={busy ? "mr-2 animate-spin" : "mr-2"} />
                Atualizar consulta
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              Consulta sob demanda, com até 50 títulos por página. Valores originais dos documentos;
              não representam o saldo restante após pagamentos parciais.
            </p>
            {busy && <p role="status">Consultando Omie…</p>}
            {result && (
              <>
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <span>
                    {result.total} títulos no filtro · Página {result.page} de{" "}
                    {Math.max(1, result.pages)}
                  </span>
                  <span>Consultado em {new Date(result.queriedAt).toLocaleString("pt-BR")}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-slate-500">
                        {[
                          "Título / documento",
                          "Cliente / fornecedor (código)",
                          "Vencimento",
                          "Situação",
                          "Valor original",
                        ].map((t) => (
                          <th key={t} className="p-3 font-medium">
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="p-3">
                            <strong>{r.id}</strong>
                            <div className="text-slate-500">{r.document}</div>
                          </td>
                          <td className="p-3">{r.partyCode}</td>
                          <td className="p-3">{r.dueDate}</td>
                          <td className="p-3">{r.status}</td>
                          <td className="whitespace-nowrap p-3">{money.format(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!result.rows.length && (
                  <p className="py-6 text-center text-slate-500">
                    Nenhum título encontrado para este filtro.
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    disabled={busy || page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || page >= result.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
