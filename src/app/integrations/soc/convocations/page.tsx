"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import Link from "next/link";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CONVOCATION_MAX_BYTES,
  convocationKey,
  convocationStatus,
  type ConvocationRow,
  type summarizeConvocations,
} from "@/lib/integrations/soc-convocations";
type Snapshot = {
  importId?: string;
  importedAt: string;
  group: string;
  rows: ConvocationRow[];
  summary: ReturnType<typeof summarizeConvocations>;
};
export default function ConvocationsPage() {
  const { user, role, tenantId } = useUser();
  const canImport = !!user && (role === "SUPER_ADMIN" || (role === "ADMIN" && !tenantId));
  return (
    <ConvocationsSession
      key={JSON.stringify([user?.uid, role, tenantId])}
      user={user}
      canImport={canImport}
    />
  );
}
function ConvocationsSession({ user, canImport }: { user: User | null; canImport: boolean }) {
  const request = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>();
  const [busy, setBusy] = useState<"load" | "upload" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );
  const refresh = useCallback(
    async (file?: File) => {
      if (!user || request.current || (file && !canImport)) return;
      const controller = new AbortController();
      const { signal } = controller;
      request.current = controller;
      setBusy(file ? "upload" : "load");
      setError("");
      setNotice("");
      let saved: { importId?: string; summary: { rows: number } } | undefined;
      try {
        if (file && file.size > CONVOCATION_MAX_BYTES) throw Error("CSV acima de 4 MB.");
        const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
        if (signal.aborted) return;
        if (file) {
          const response = await fetch("/api/integrations/soc/convocations", {
            method: "POST",
            headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
            body: file,
            signal,
          });
          if (response.status === 401 || response.status === 403) setSnapshot(undefined);
          const data = await response.json();
          if (signal.aborted) return;
          if (!response.ok) throw Error(data.error || "Importação não concluída.");
          saved = data;
          setNotice(`Importação salva: ${data.summary.rows} linhas.`);
        }
        setSnapshot(undefined);
        const response = await fetch("/api/integrations/soc/convocations", {
          cache: "no-store",
          headers,
          signal,
        });
        const data = await response.json();
        if (signal.aborted) return;
        if (!response.ok) throw Error(data.error || "Falha ao carregar.");
        const next: Snapshot | null = data.snapshot;
        setSnapshot(next);
        setPage(0);
        setUnit((previous) => (next?.rows.some((row) => row.UNIDADE === previous) ? previous : ""));
        if (saved) {
          if (saved.importId && next?.importId !== saved.importId) {
            setNotice("Importação salva. A versão ativa mudou durante a releitura.");
          } else {
            setNotice(
              `Importação salva: ${saved.summary.rows} linhas. Os dados foram relidos do servidor.`
            );
          }
        }
      } catch (e) {
        if (signal.aborted) return;
        const message = e instanceof Error ? e.message : "Falha ao consultar as convocações.";
        setError(
          saved
            ? `A importação foi salva, mas não foi possível atualizar a consulta. Use Recarregar base salva. ${message}`
            : message
        );
      } finally {
        if (request.current === controller) {
          request.current = null;
          setBusy(null);
        }
      }
    },
    [user, canImport]
  );
  useEffect(() => {
    void refresh();
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  const rows = snapshot?.rows || [];
  const keys = new Map<string, number>();
  rows.forEach((r) => keys.set(convocationKey(r), (keys.get(convocationKey(r)) || 0) + 1));
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (!unit || r.UNIDADE === unit) &&
      (!status || convocationStatus(r, today) === status) &&
      (!query ||
        normalize(
          `${r.Nome} ${r["Código Funcionario"]} ${r["CNPJ DA UNIDADE"]} ${r.SETOR}`
        ).includes(normalize(query)))
  );
  const summary = snapshot?.summary;
  return (
    <main className="space-y-6 pb-16">
      <Link href="/integrations/soc" className="underline">
        Painel SOC
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Convocações SOC · Grupo AVP</h1>
        <p className="mt-2 text-muted-foreground">
          Base importada por funcionário, unidade e exame. Consulta interna da operação.
        </p>
      </header>
      <section className="rounded-lg border p-4 space-y-3" aria-label="Importar convocações">
        {canImport && (
          <>
            <label className="block font-medium" htmlFor="convocation-file">
              Importar CSV de convocação do Grupo AVP
            </label>
            <Input
              id="convocation-file"
              type="file"
              accept=".csv,text/csv"
              disabled={!user || busy !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void refresh(file);
                e.target.value = "";
              }}
            />
            <p className="text-sm text-muted-foreground">
              Até 4 MB e 15.000 linhas, com as 17 colunas originais. A importação atualiza esta
              base; mantém a versão anterior arquivada. Não altera a fila da planilha nem emite
              convocações.
            </p>
          </>
        )}
        <Button disabled={!user || busy !== null} variant="outline" onClick={() => void refresh()}>
          Recarregar base salva
        </Button>
        {busy && (
          <p role="status">
            {busy === "upload" ? "Importando e conferindo persistência…" : "Carregando base salva…"}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </section>
      {snapshot === null && <p>Nenhuma base importada neste módulo.</p>}
      {snapshot && summary && (
        <>
          <p>
            Fonte: CSV SOC · importado em{" "}
            {new Date(snapshot.importedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}{" "}
            · Brasília.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Linhas da fonte", summary.rows],
              ["Códigos de funcionários", summary.employees],
              ["Unidades", summary.units],
              ["Sem vencimento informado", summary.withoutDueDate],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border p-4">
                <p>{label}</p>
                <strong className="text-2xl">{value}</strong>
              </div>
            ))}
          </div>
          <p className="rounded-lg bg-muted p-4 text-sm">
            {summary.repeatedKeys} combinações de CNPJ, funcionário e exame repetidas (
            {summary.extraRowsForRepeatedKeys} linhas adicionais). Todas as linhas foram preservadas
            para conferência. {summary.withResultDate} linhas com data de resultado. Campo vazio não
            comprova exame pendente ou não realizado. Sem “Refazer em”, o vencimento permanece
            desconhecido; a periodicidade isolada não determina o vencimento. Esta base não comprova
            emissão de ASO.
          </p>
          <div className="flex flex-wrap gap-3">
            <label>
              Buscar funcionário, código, CNPJ ou setor
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Unidade
              <select
                className="block max-w-sm rounded border bg-background p-2"
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas as unidades</option>
                {[...new Set(rows.map((r) => r.UNIDADE))].sort().map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label>
              Vencimento
              <select
                className="block rounded border bg-background p-2"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas as situações</option>
                {[
                  "Sem vencimento informado",
                  "Vencido na fonte",
                  "Vence em até 30 dias",
                  "Vencimento posterior",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <p>
            {filtered.length} linhas encontradas de {rows.length}.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Convocações importadas do SOC</caption>
              <thead>
                <tr>
                  {[
                    "Funcionário / código SOC",
                    "Unidade / CNPJ",
                    "Setor / cargo",
                    "Exame / periodicidade",
                    "Último pedido",
                    "Resultado",
                    "Refazer em",
                    "Origem / conferência",
                  ].map((c) => (
                    <th className="p-3" key={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(page * 50, (page + 1) * 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">
                      {r.Nome}
                      <br />
                      {r["Código Funcionario"]}
                    </td>
                    <td className="p-3">
                      {r.UNIDADE}
                      <br />
                      {r["CNPJ DA UNIDADE"]}
                    </td>
                    <td className="p-3">
                      {r.SETOR}
                      <br />
                      {r.CARGO}
                    </td>
                    <td className="p-3">
                      {r.Exame}
                      <br />
                      Periodicidade na fonte: {r.Periodicidade || "—"}
                    </td>
                    <td className="p-3">{r["Último Pedido"] || "Não informado"}</td>
                    <td className="p-3">{r["Data Resultado"] || "Não informado"}</td>
                    <td className="p-3">
                      {r["Refazer em"] || "Não informado"}
                      <br />
                      {convocationStatus(r, today)}
                    </td>
                    <td className="p-3">
                      {r.Origem} · {r.Situação}
                      <br />
                      {(keys.get(convocationKey(r)) || 0) > 1 ? "Chave repetida: conferir" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 items-center">
            <Button variant="outline" disabled={!page} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span>
              Página {page + 1} de {Math.max(1, Math.ceil(filtered.length / 50))}
            </span>
            <Button
              variant="outline"
              disabled={(page + 1) * 50 >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
