"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileBarChart2,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exportOmieDreCsv,
  previousClosedMonthQuery,
  toOmieDate,
  type OmieDreCost,
  type OmieDreQuery,
  type OmieDreReport,
} from "@/lib/financial/omie-dre";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

function CostTable({ title, costs }: { title: string; costs: OmieDreCost[] }) {
  return (
    <section className="rounded-2xl border bg-white p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {!costs.length ? (
        <p className="mt-3 text-sm text-slate-600">
          Nenhum custo com classificação e sinal suficientes para este ranking. Confira categorias e
          sinais no relatório.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {costs.slice(0, 5).map((cost) => (
            <div
              key={cost.id}
              className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{cost.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {cost.cnpj ? `CNPJ ${cost.cnpj}` : "Identidade fiscal a conferir"} ·{" "}
                  {cost.entries} lançamentos
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {cost.categories.slice(0, 3).join(" · ")}
                </p>
              </div>
              <p className="whitespace-nowrap text-sm font-semibold tabular-nums">
                {money(cost.costCents)}
              </p>
            </div>
          ))}
          {costs.length > 5 && (
            <p className="text-xs text-slate-500">
              5 maiores entre {costs.length} fornecedores classificados.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function OmieDreWorkspace() {
  const { user } = useUser();
  const [query, setQuery] = useState<OmieDreQuery>(() => previousClosedMonthQuery());
  const [data, setData] = useState<{ uid: string; report: OmieDreReport } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [rowPage, setRowPage] = useState(0);
  const session = useRef({ generation: 0, requests: new Set<AbortController>() }).current;
  const report = data?.uid === user?.uid ? data?.report : null;

  useEffect(() => {
    session.generation++;
    for (const controller of session.requests) controller.abort();
    session.requests.clear();
    setData(null);
    setBusy(false);
    setSaving(false);
    setError("");
    setSavedMessage("");
    return () => {
      session.generation++;
      for (const controller of session.requests) controller.abort();
      session.requests.clear();
    };
  }, [session, user?.uid]);

  async function request(path: string, controller: AbortController, init?: RequestInit) {
    if (!user) throw new Error("Entre no NAI para consultar o financeiro.");
    const token = await user.getIdToken();
    if (controller.signal.aborted) throw new Error("Consulta cancelada.");
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const body = await response.json();
    if (
      (response.status === 401 || response.status === 403) &&
      !controller.signal.aborted &&
      session.requests.has(controller)
    ) {
      session.generation++;
      for (const pending of session.requests) pending.abort();
      session.requests.clear();
      setData(null);
      setSavedMessage("");
      setBusy(false);
      setSaving(false);
      setError(body.error || "O acesso à administração financeira não está disponível.");
    }
    if (!response.ok) throw new Error(body.error || "Não foi possível concluir a consulta.");
    return body;
  }

  async function consult(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy || saving) return;
    const current = session.generation;
    const uid = user.uid;
    const controller = new AbortController();
    session.requests.add(controller);
    setBusy(true);
    setError("");
    setSavedMessage("");
    setData(null);
    setRowPage(0);
    try {
      const params = new URLSearchParams(query);
      const result = await request(`/api/financial/omie/dre?${params}`, controller);
      if (session.generation === current && !controller.signal.aborted)
        setData({ uid, report: result });
    } catch (error) {
      if (session.generation === current && !controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Falha ao consultar a DRE.");
    } finally {
      session.requests.delete(controller);
      if (session.generation === current) setBusy(false);
    }
  }

  async function saveActions() {
    if (!report || busy || saving || !report.rows.length) return;
    const current = session.generation;
    const controller = new AbortController();
    session.requests.add(controller);
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const result = await request("/api/financial/actions", controller, {
        method: "POST",
        body: JSON.stringify(report.suggestedActions),
      });
      if (session.generation === current && !controller.signal.aborted)
        setSavedMessage(
          result.alreadySaved
            ? "Os cards desta consulta já estão salvos. O progresso foi preservado."
            : `${result.batch.actions.length} cards salvos no painel de ações financeiras.`
        );
    } catch (error) {
      if (session.generation === current && !controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Não foi possível salvar os cards.");
    } finally {
      session.requests.delete(controller);
      if (session.generation === current) setSaving(false);
    }
  }

  function changeQuery(next: Partial<OmieDreQuery>) {
    setQuery((current) => ({ ...current, ...next }));
    setData(null);
    setSavedMessage("");
    setError("");
  }

  function exportCsv() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([exportOmieDreCsv(report)], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `NAI_DRE_Omie_${report.query.start}_${report.query.end}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/financial" className="inline-flex items-center gap-2 text-slate-600">
          <ArrowLeft size={16} /> Financeiro
        </Link>
        <Link href="/financial/actions" className="inline-flex items-center gap-2 text-teal-700">
          Ações financeiras <ArrowRight size={16} />
        </Link>
      </nav>
      <header className="rounded-3xl bg-slate-950 p-7 text-white md:p-9">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium tracking-wide text-teal-300">
          <FileBarChart2 size={20} /> OMIE · NEXTCON
        </p>
        <h1 className="text-3xl font-bold">DRE e ações de custos</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Consulte a DRE do período, confira os fornecedores e transforme a análise em cards com
          evidências e checklists para a direção.
        </p>
        <Link
          href="/financial/omie"
          className="mt-5 inline-flex text-sm text-teal-300 underline underline-offset-4"
        >
          Gerenciar conexão com o Omie
        </Link>
      </header>

      {!user && (
        <p role="status" className="rounded-xl border p-4">
          Entre no NAI com acesso à administração financeira para consultar a DRE.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={consult} className="rounded-2xl border bg-white p-5">
        <fieldset disabled={!user || busy || saving} className="flex flex-wrap items-end gap-4">
          <label className="space-y-2 text-sm">
            <span className="block">Data inicial</span>
            <Input
              aria-label="Data inicial"
              type="date"
              min="2000-01-01"
              max={query.end}
              value={query.start}
              onChange={(e) => changeQuery({ start: e.target.value })}
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="block">Data final</span>
            <Input
              aria-label="Data final"
              type="date"
              min={query.start}
              max="2100-12-31"
              value={query.end}
              onChange={(e) => changeQuery({ end: e.target.value })}
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="block">Base de datas no Omie</span>
            <select
              aria-label="Base de datas no Omie"
              className="h-10 rounded-md border bg-white px-3"
              value={query.dateBasis}
              onChange={(e) =>
                changeQuery({ dateBasis: e.target.value as OmieDreQuery["dateBasis"] })
              }
            >
              <option value="emission">Emissão dos documentos</option>
              <option value="registration">Registro dos documentos</option>
            </select>
          </label>
          <Button type="submit" className="gap-2">
            <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            {busy ? "Consultando DRE…" : "Consultar DRE"}
          </Button>
        </fieldset>
        <p className="mt-4 text-xs text-slate-500">
          A base escolhida segue o relatório Omie. O fechamento por competência exige conferir
          provisões, estornos e documentos registrados depois da prestação.
        </p>
      </form>

      {report && (
        <>
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-white p-5">
            <div>
              <h2 className="font-semibold">{report.company}</h2>
              <p className="mt-1 text-sm text-slate-600">
                CNPJ {report.cnpj} · {toOmieDate(report.query.start)} a{" "}
                {toOmieDate(report.query.end)} ·{" "}
                {report.query.dateBasis === "emission" ? "Emissão" : "Registro"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Consultado em{" "}
                {new Date(report.queriedAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}{" "}
                (Brasília) · {report.rows.length.toLocaleString("pt-BR")} lançamentos retornados
              </p>
            </div>
            <Button variant="outline" onClick={exportCsv} className="gap-2">
              <Download size={16} /> Exportar lançamentos CSV
            </Button>
          </section>
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <h2 className="font-semibold">Conferências para usar esta análise</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
          {report.rows.length > 0 && (
            <>
              <section className="overflow-hidden rounded-2xl border bg-white">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
                  <div>
                    <h2 className="text-lg font-semibold">Contas da DRE</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Valores e sinais conforme retornados pelo Omie.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Soma algébrica das linhas consultadas</p>
                    <p className="text-xl font-bold tabular-nums">
                      {money(report.summary.totalSignedCents)}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Grupo / tipo</th>
                        <th className="px-5 py-3">Conta</th>
                        <th className="px-5 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.summary.accounts.slice(0, 100).map((account) => (
                        <tr className="border-t" key={account.key}>
                          <td className="px-5 py-3">
                            <p>{account.group}</p>
                            <p className="text-xs text-slate-500">{account.type}</p>
                          </td>
                          <td className="px-5 py-3">{account.account}</td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {money(account.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.summary.accounts.length > 100 && (
                  <p className="border-t p-4 text-xs text-slate-500">
                    Exibindo 100 de {report.summary.accounts.length} contas. O CSV inclui todos os
                    lançamentos retornados.
                  </p>
                )}
                <p className="border-t p-4 text-xs text-slate-500">
                  A soma acima precisa ser conciliada com a estrutura e os sinais da DRE no Omie
                  antes de ser usada como resultado contábil fechado.
                </p>
              </section>
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Prioridades de compras nos últimos meses
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {report.summary.analysisPeriod.label} · até três meses dentro do período
                    consultado. Classificação por contas e categorias financeiras.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <CostTable title="Engenharia de Segurança" costs={report.summary.engineering} />
                  <CostTable
                    title="Exames e serviços ocupacionais"
                    costs={report.summary.occupationalExams}
                  />
                </div>
              </section>
              <section className="rounded-2xl border bg-white p-5">
                <h2 className="text-lg font-semibold">
                  Cidade cadastral dos fornecedores de exames
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Use esta lista para priorizar a conferência de unidades. A cidade efetiva do
                  atendimento e a quantidade de exames precisam ser vinculadas à NF.
                </p>
                {report.summary.supplierCities.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {report.summary.supplierCities.slice(0, 9).map((city) => (
                      <div
                        key={`${city.city}:${city.state}`}
                        className="rounded-xl bg-slate-50 p-4"
                      >
                        <p className="text-sm font-medium">
                          {city.city}
                          {city.state ? `/${city.state}` : ""}
                        </p>
                        <p className="mt-2 text-lg font-semibold tabular-nums">
                          {money(city.costCents)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {city.entries} lançamentos · local a confirmar
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Sem despesas de exames com classificação suficiente para esta visão.
                  </p>
                )}
                {report.summary.supplierCities.length > 9 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Exibindo as 9 maiores entre {report.summary.supplierCities.length} localidades
                    cadastrais. Consulte o CSV para os demais registros.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-teal-950">
                  <ListChecks size={20} /> Ações sugeridas
                </h2>
                <p className="mt-2 text-sm text-teal-900">
                  Os cards abaixo incluem a base financeira, as ressalvas e um checklist. As
                  propostas ficam no painel restrito à administração financeira.
                </p>
                <ul className="my-4 grid gap-2 text-sm sm:grid-cols-2">
                  {report.suggestedActions.actions.map((action) => (
                    <li key={action.key} className="rounded-lg bg-white/80 p-3">
                      {action.title}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={saveActions} disabled={busy || saving} className="gap-2">
                    <ListChecks size={16} />
                    {saving
                      ? "Salvando cards…"
                      : `Criar ${report.suggestedActions.actions.length} cards de ações`}
                  </Button>
                  <Link
                    className="text-sm font-medium text-teal-800 underline underline-offset-4"
                    href="/financial/actions"
                  >
                    Abrir painel de ações
                  </Link>
                </div>
                {savedMessage && (
                  <p role="status" className="mt-4 text-sm font-medium text-teal-900">
                    {savedMessage}
                  </p>
                )}
              </section>
              <details className="rounded-2xl border bg-white p-5">
                <summary className="cursor-pointer font-semibold">
                  Conferir lançamentos e fonte
                </summary>
                <p className="mt-3 break-all text-xs text-slate-500">
                  SHA-256 da consulta: {report.sourceSha256}
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-3 pr-4">Data</th>
                        <th className="py-3 pr-4">Fornecedor</th>
                        <th className="py-3 pr-4">Categoria</th>
                        <th className="py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.slice(rowPage * 25, (rowPage + 1) * 25).map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="whitespace-nowrap py-3 pr-4">{toOmieDate(row.date)}</td>
                          <td className="py-3 pr-4">{row.partyName}</td>
                          <td className="py-3 pr-4">{row.category}</td>
                          <td className="whitespace-nowrap py-3 text-right tabular-nums">
                            {money(row.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Página {rowPage + 1} de {Math.ceil(report.rows.length / 25)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rowPage === 0}
                      onClick={() => setRowPage((page) => page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(rowPage + 1) * 25 >= report.rows.length}
                      onClick={() => setRowPage((page) => page + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
