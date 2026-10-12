"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import type { ExportSelectionType, OmieExportRecord } from "@/lib/financial/omie-export";
type Overview = {
  suppliers: { id: string; name: string; document: string }[];
  titles: {
    id: string;
    kind: "payable" | "receivable";
    party: string;
    description: string;
    amountCents: number;
    dueDate: string;
    externalReference: string;
  }[];
  exports: OmieExportRecord[];
};
type Preview = {
  selection: ExportSelectionType;
  payload: Record<string, unknown>;
  hash: string;
  company: string;
  cnpj: string;
};
type Catalog = {
  kind: string;
  page: number;
  pages: number;
  total: number;
  rows: {
    code: string | number;
    name: string;
    document?: string;
    inactive?: string;
    total?: string;
  }[];
};
const card = "rounded-xl border border-slate-700 bg-slate-900 p-5",
  field = "mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white";
const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function OmieConnectorsWorkspace() {
  const { user } = useUser();
  const [overview, setOverview] = useState<Overview | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [kind, setKind] = useState<ExportSelectionType["kind"]>("supplier"),
    [catalogKind, setCatalogKind] = useState("catalogParties");
  const epoch = useRef(0),
    running = useRef(false);
  useEffect(() => {
    epoch.current++;
    running.current = false;
    setOverview(null);
    setPreview(null);
    setCatalog(null);
    setBusy(false);
    setError("");
    return () => {
      epoch.current++;
    };
  }, [user]);
  async function request(action?: string, data?: unknown) {
    if (!user || running.current) return;
    const seq = epoch.current;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      if (seq !== epoch.current) return;
      const r = await fetch("/api/financial/omie/connectors", {
        method: action ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(action ? { "Content-Type": "application/json" } : {}),
        },
        body: action ? JSON.stringify({ action, data }) : undefined,
        cache: "no-store",
      });
      const result = await r.json();
      if (seq !== epoch.current) return;
      if (!r.ok) throw new Error(result.error || "Consulta indisponível.");
      if (!action) {
        setOverview(result);
        setPreview(null);
      } else if (action === "catalog") setCatalog(result);
      else if (action === "preview") setPreview(result);
      else {
        setPreview(null);
        setOverview(null);
        setNotice(result.message + " Atualize o painel para conferir o histórico.");
      }
    } catch (e) {
      if (seq === epoch.current) {
        setError(e instanceof Error ? e.message : "Falha na comunicação.");
        if (action === "execute") {
          setPreview(null);
          setOverview(null);
        }
      }
    } finally {
      if (seq === epoch.current) {
        running.current = false;
        setBusy(false);
      }
    }
  }
  const available = overview
    ? (kind === "supplier"
        ? overview.suppliers.map((s) => ({ id: s.id, label: `${s.name} · ${s.document}` }))
        : overview.titles
            .filter((t) => t.kind === kind && !t.externalReference)
            .map((t) => ({
              id: t.id,
              label: `${t.party} · ${money(t.amountCents)} · ${t.dueDate} · ${t.description}`,
            }))
      ).filter((x) => !overview.exports.some((e) => e.sourceId === x.id))
    : [];
  function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPreview(null);
    void request("preview", {
      kind,
      sourceId: String(f.get("sourceId")),
      ...(kind !== "supplier"
        ? {
            partyCode: Number(f.get("partyCode")),
            categoryCode: String(f.get("categoryCode")),
            accountCode: Number(f.get("accountCode")),
          }
        : {}),
    });
  }
  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-6 text-slate-100">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-sm text-cyan-300">NAI · Integração financeira</p>
          <h1 className="mt-2 text-3xl font-semibold">Conectores Omie</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            Consulte cadastros e envie fornecedores homologados e títulos aprovados. Cada inclusão
            exige conferência da prévia.
          </p>
        </div>
        <Button disabled={busy || !user} onClick={() => void request()}>
          {busy ? "Processando…" : "Atualizar painel"}
        </Button>
      </header>
      <nav className="flex flex-wrap gap-5 text-sm text-cyan-300 underline">
        <Link href="/financial/omie">Conexão e contas a pagar/receber</Link>
        <Link href="/financial/omie/dre">DRE Omie</Link>
        <Link href="/financial/operacoes">ERP financeiro</Link>
        <Link href="/suppliers/qualification">Homologação de fornecedores</Link>
      </nav>
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 p-4 text-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-950 p-4 text-emerald-200">
          {notice}
        </p>
      )}
      <section className={card}>
        <h2 className="text-xl font-semibold">Consultar cadastros do Omie</h2>
        <div className="my-4 flex flex-wrap items-end gap-3">
          <label>
            Cadastro
            <select
              className={field}
              value={catalogKind}
              onChange={(e) => {
                setCatalogKind(e.target.value);
                setCatalog(null);
              }}
              disabled={busy}
            >
              <option value="catalogParties">Clientes e fornecedores</option>
              <option value="categories">Categorias financeiras</option>
              <option value="accounts">Contas correntes</option>
            </select>
          </label>
          <Button
            disabled={busy}
            onClick={() => void request("catalog", { kind: catalogKind, page: 1 })}
          >
            Consultar cadastro
          </Button>
        </div>
        {catalog && (
          <>
            <p className="mb-3 text-sm text-slate-300">
              Página {catalog.page} de {catalog.pages} · {catalog.total} registros. Copie os códigos
              conferidos para o envio abaixo.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Código</th>
                    <th className="p-2">Nome</th>
                    <th className="p-2">Identificação / situação</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.rows.map((r, i) => (
                    <tr key={`${r.code}-${i}`} className="border-t border-slate-700">
                      <td className="p-2 font-mono">{r.code}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">
                        {r.document} {r.inactive === "S" ? "Inativo" : ""}{" "}
                        {r.total === "S" ? "Totalizadora" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                disabled={busy || catalog.page <= 1}
                onClick={() =>
                  void request("catalog", { kind: catalog.kind, page: catalog.page - 1 })
                }
              >
                Anterior
              </Button>
              <Button
                disabled={busy || catalog.page >= catalog.pages}
                onClick={() =>
                  void request("catalog", { kind: catalog.kind, page: catalog.page + 1 })
                }
              >
                Próxima
              </Button>
            </div>
          </>
        )}
      </section>
      {!overview && (
        <p>Atualize o painel para carregar os registros disponíveis e o histórico de envios.</p>
      )}
      {overview && (
        <>
          <form className={card + " space-y-4"} onSubmit={prepare}>
            <h2 className="text-xl font-semibold">Preparar inclusão no Omie</h2>
            <p className="text-sm text-slate-300">
              Títulos enviados ficam protegidos contra alteração e baixa local. Baixas,
              cancelamentos e alterações posteriores devem ser conferidos no Omie; a sincronização
              dessas operações não é automática.
            </p>
            <label className="block">
              Tipo
              <select
                className={field}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as typeof kind);
                  setPreview(null);
                }}
                disabled={busy}
              >
                <option value="supplier">Fornecedor homologado</option>
                <option value="payable">Conta a pagar aprovada</option>
                <option value="receivable">Conta a receber aprovada</option>
              </select>
            </label>
            <label className="block">
              Registro de origem
              <select
                className={field}
                name="sourceId"
                key={kind}
                required
                disabled={busy}
                onChange={() => setPreview(null)}
              >
                <option value="">Selecione</option>
                {available.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            {!available.length && (
              <p className="text-sm text-amber-200">
                Nenhum registro elegível para este tipo. Confira a homologação ou a aprovação no
                ERP.
              </p>
            )}
            {kind !== "supplier" && (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["partyCode", "Código do cliente/fornecedor"],
                  ["categoryCode", "Código da categoria"],
                  ["accountCode", "Código da conta corrente"],
                ].map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      className={field}
                      type={name === "categoryCode" ? "text" : "number"}
                      min="1"
                      required
                      disabled={busy}
                      onChange={() => setPreview(null)}
                    />
                  </label>
                ))}
              </div>
            )}
            <Button disabled={busy || !available.length}>Gerar prévia</Button>
          </form>
          {preview && (
            <section className="rounded-xl border border-cyan-600 bg-slate-900 p-5">
              <h2 className="text-xl font-semibold">Conferir envio para {preview.company}</h2>
              <p className="my-3">CNPJ da empresa: {preview.cnpj}</p>
              <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs">
                {JSON.stringify(preview.payload, null, 2)}
              </pre>
              <p className="my-4 text-sm text-amber-200">
                A confirmação cria um registro real no Omie. Não emite nota, boleto, pagamento ou
                baixa. Se houver falha, consulte o resultado pelo histórico.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void request("execute", { selection: preview.selection, hash: preview.hash })
                }
              >
                Confirmar inclusão no Omie
              </Button>
            </section>
          )}
          <section className={card}>
            <h2 className="text-xl font-semibold">Histórico de envios</h2>
            <p className="my-3 text-sm text-slate-300">
              “Sem confirmação” pode significar que o Omie recebeu a inclusão. Consultar resultado
              apenas lê o Omie e nunca repete a criação. Reservas sem registro correspondente exigem
              conferência técnica.
            </p>
            {!overview.exports.length && (
              <p className="text-sm text-slate-400">Nenhum envio registrado.</p>
            )}
            {overview.exports
              .slice()
              .reverse()
              .map((e) => (
                <article key={e.key} className="space-y-3 border-t border-slate-700 py-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <strong>
                        {e.kind === "supplier"
                          ? "Fornecedor"
                          : e.kind === "payable"
                            ? "Conta a pagar"
                            : "Conta a receber"}{" "}
                        · {e.status === "confirmed" ? "Confirmado" : "Sem confirmação"}
                      </strong>
                      <p className="mt-1 text-sm">
                        {e.company} · {e.at} {e.remoteId && `· Código Omie ${e.remoteId}`}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-400">{e.key}</p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void request("reconcile", { kind: e.kind, sourceId: e.sourceId })
                      }
                    >
                      Consultar resultado
                    </Button>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm">Prévia preservada</summary>
                    <pre className="mt-2 overflow-auto text-xs">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </article>
              ))}
          </section>
        </>
      )}
    </main>
  );
}
