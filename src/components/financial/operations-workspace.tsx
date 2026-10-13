"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ContractFlowWorkspace } from "./contract-flow-workspace";
import { ErpWorkspace } from "./erp-workspace";
import Papa from "papaparse";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FinanceBookSchema,
  FinanceCommandSchema,
  closingIssues,
  financeSummary,
  financeCsv,
  outstanding,
  principalByTitle,
  parseBrl,
  settlementCash,
  type FinanceBook,
  type FinanceCommand,
} from "@/lib/financial/operations";
import { brazilToday } from "@/lib/financial/treasury";

type Choice = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string;
  options?: Choice[];
  optional?: boolean;
  multiple?: boolean;
};
export type FinanceForm = {
  title: string;
  description: string;
  fields: Field[];
  build: (data: FormData) => Record<string, unknown>;
};
const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const value = (f: FormData, name: string) => String(f.get(name) ?? "").trim();
const cash = (f: FormData, name: string) => parseBrl(value(f, name) || "0");
const stateLabels: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Em aprovação",
  approved: "Aprovado",
  rejected: "Revisar",
  cancelled: "Cancelado",
};
const tabs = [
  ["overview", "Visão geral"],
  ["flow", "Contrato ao recebimento"],
  ["masters", "Cadastros"],
  ["orders", "Compras e vendas"],
  ["collections", "Cobrança"],
  ["reports", "Relatórios"],
  ["titles", "Pagar e receber"],
  ["contracts", "Contratos"],
  ["services", "Produção SST"],
  ["banks", "Bancos e conciliação"],
  ["budget", "Orçamento"],
  ["close", "Fechamento"],
  ["audit", "Histórico"],
];
const card = "rounded-2xl border border-slate-700 bg-slate-900 p-5";
const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-950";
const defaultReason: Field = {
  name: "reason",
  label: "Justificativa e referência da conferência",
  type: "textarea",
};
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function FinanceOperationsWorkspace() {
  const { user } = useUser();
  const [book, setBook] = useState<FinanceBook | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview"),
    [period, setPeriod] = useState(() => brazilToday().slice(0, 7)),
    [search, setSearch] = useState("");
  const [form, setForm] = useState<FinanceForm | null>(null),
    [formError, setFormError] = useState("");
  const [bankAccount, setBankAccount] = useState(""),
    [bankPreview, setBankPreview] = useState<Array<{
      bankId: string;
      date: string;
      amountCents: number;
      memo: string;
    }> | null>(null);
  const bankImportVersion = useRef(0);
  const active = useRef(0),
    controller = useRef<AbortController | null>(null),
    pending = useRef<FinanceCommand | null>(null);
  useEffect(() => {
    active.current++;
    bankImportVersion.current++;
    controller.current?.abort();
    setBook(null);
    setError("");
    setNotice("");
    setBusy(false);
    setForm(null);
    setBankPreview(null);
    pending.current = null;
    return () => {
      active.current++;
      controller.current?.abort();
    };
  }, [user]);
  async function request(command?: Record<string, unknown>) {
    if (!user || busy) return false;
    const seq = ++active.current,
      abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setFormError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      if (seq !== active.current) return false;
      let payload: FinanceCommand | undefined;
      if (command) {
        const candidate = FinanceCommandSchema.parse({
          ...command,
          requestId: pending.current?.requestId || crypto.randomUUID(),
          expectedVersion: pending.current?.expectedVersion ?? book?.version ?? 0,
        });
        // A failed response may have committed. Preserve its exact operation ID until refreshed.
        if (
          pending.current &&
          JSON.stringify({ ...candidate, requestId: "", expectedVersion: 0 }) !==
            JSON.stringify({ ...pending.current, requestId: "", expectedVersion: 0 })
        )
          throw new Error(
            "Atualize os dados antes de iniciar outra operação; a última resposta não foi confirmada."
          );
        payload = candidate;
        pending.current = payload;
      }
      const response = await fetch("/api/financial/operations", {
        method: command ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(command ? { "Content-Type": "application/json" } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      });
      if (seq !== active.current) return false;
      // A proxy or middleware can reject access without returning JSON.
      if (response.status === 401 || response.status === 403) {
        pending.current = null;
        setBook(null);
        setForm(null);
        setBankPreview(null);
      }
      const data = await response.json().catch(() => ({}));
      if (seq !== active.current) return false;
      if (!response.ok) {
        if (response.status < 500) pending.current = null;
        throw new Error(data.error || "Consulta indisponível.");
      }
      setBook(FinanceBookSchema.parse(data));
      pending.current = null;
      if (command) {
        setForm(null);
        setBankPreview(null);
        setNotice("Registro salvo e conferido no servidor.");
      }
      return true;
    } catch (e) {
      if (seq === active.current) {
        const message =
          e instanceof Error ? e.message : "Operação não concluída. Atualize os dados.";
        setError(message);
        setFormError(message);
      }
      return false;
    } finally {
      if (seq === active.current) setBusy(false);
    }
  }
  const today = brazilToday();
  const principal = useMemo(
    () => (book ? principalByTitle(book) : new Map<string, number>()),
    [book]
  );
  const summary = useMemo(
    () => (book ? financeSummary(book, period, today) : null),
    [book, period, today]
  );
  const issues = useMemo(() => (book ? closingIssues(book, period) : []), [book, period]);
  const accounts = book?.accounts.map((a) => ({ value: a.id, label: a.name })) || [];
  const contracts =
    book?.contracts.map((c) => ({ value: c.id, label: `${c.client} · ${c.name}` })) || [];
  const showForm = (f: FinanceForm) => {
    setFormError("");
    setForm(f);
  };
  const reason = (title: string, action: Record<string, unknown>) =>
    showForm({
      title,
      description: "A alteração ficará registrada no histórico financeiro.",
      fields: [defaultReason],
      build: (f) => ({ ...action, reason: value(f, "reason") }),
    });
  function newTitle() {
    showForm({
      title: "Novo título gerencial",
      description:
        "Registre a origem e envie para aprovação. Este controle não emite nota fiscal nem executa pagamento.",
      fields: [
        {
          name: "kind",
          label: "Carteira",
          options: [
            { value: "payable", label: "A pagar" },
            { value: "receivable", label: "A receber" },
          ],
        },
        { name: "party", label: "Cliente ou fornecedor" },
        { name: "description", label: "Descrição" },
        { name: "amount", label: "Valor total em reais" },
        { name: "installments", label: "Número de parcelas (1 a 36)", type: "number", value: "1" },
        { name: "competence", label: "Competência", type: "month", value: period },
        { name: "dueDate", label: "Vencimento", type: "date", value: today },
        { name: "category", label: "Categoria" },
        { name: "center", label: "Centro de custo" },
        {
          name: "contractId",
          label: "Contrato (opcional)",
          options: [{ value: "", label: "Sem contrato / custo compartilhado" }, ...contracts],
          optional: true,
        },
        { name: "sourceKey", label: "Identificador único da origem (NF, contrato ou documento)" },
        {
          name: "externalReference",
          label: "Referência no Omie (somente título único; vincule parcelas individualmente)",
          optional: true,
        },
        { name: "evidence", label: "Documento e evidência do lançamento", type: "textarea" },
      ],
      build: (f) => ({
        action: Number(value(f, "installments")) > 1 ? "installments" : "title",
        ...(Number(value(f, "installments")) > 1
          ? { count: Number(value(f, "installments")) }
          : {}),
        data: {
          kind: value(f, "kind"),
          party: value(f, "party"),
          description: value(f, "description"),
          amountCents: cash(f, "amount"),
          competence: value(f, "competence"),
          dueDate: value(f, "dueDate"),
          category: value(f, "category"),
          center: value(f, "center"),
          contractId: value(f, "contractId") || null,
          sourceKey: value(f, "sourceKey"),
          externalReference: value(f, "externalReference"),
          evidence: value(f, "evidence"),
        },
      }),
    });
  }
  function settle(titleId: string) {
    showForm({
      title: "Registrar baixa comprovada",
      description:
        "Informe uma movimentação já realizada. O NAI registra a baixa; não movimenta sua conta bancária. A data deve ser a efetiva do extrato.",
      fields: [
        { name: "accountId", label: "Conta bancária", options: accounts },
        { name: "date", label: "Data efetiva", type: "date", value: today },
        { name: "principal", label: "Principal liquidado (R$)" },
        { name: "interest", label: "Juros (R$)", value: "0" },
        { name: "fine", label: "Multa (R$)", value: "0" },
        { name: "discount", label: "Desconto (R$)", value: "0" },
        { name: "withholding", label: "Retenções (R$)", value: "0" },
        { name: "evidence", label: "Referência do comprovante", type: "textarea" },
      ],
      build: (f) => ({
        action: "settle",
        data: {
          titleId,
          accountId: value(f, "accountId"),
          date: value(f, "date"),
          principalCents: cash(f, "principal"),
          interestCents: cash(f, "interest"),
          fineCents: cash(f, "fine"),
          discountCents: cash(f, "discount"),
          withholdingCents: cash(f, "withholding"),
          evidence: value(f, "evidence"),
        },
      }),
    });
  }
  async function importCsv(file?: File) {
    setError("");
    setBankPreview(null);
    if (!file) return;
    const seq = active.current;
    const importVersion = ++bankImportVersion.current;
    try {
      if (!bankAccount) throw new Error("Selecione a conta bancária antes de importar.");
      if (file.size > 512 * 1024) throw new Error("Use um CSV de até 512 KB e 1.000 movimentos.");
      const parsed = Papa.parse<Record<string, string>>(await file.text(), {
        header: true,
        delimiter: ";",
        skipEmptyLines: "greedy",
        transformHeader: (h) =>
          h
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase(),
      });
      if (seq !== active.current || importVersion !== bankImportVersion.current) return;
      if (
        parsed.errors.length ||
        ["id", "data", "valor", "historico"].some((h) => !parsed.meta.fields?.includes(h))
      )
        throw new Error(
          "CSV inválido. Use as colunas id;data;valor;historico. Data AAAA-MM-DD; valores em reais com vírgula."
        );
      const rows = parsed.data.map((r) => ({
        bankId: r.id.trim(),
        date: r.data.trim(),
        amountCents: parseBrl(r.valor),
        memo: r.historico.trim(),
      }));
      const validated = FinanceCommandSchema.parse({
        action: "bank",
        accountId: bankAccount,
        rows,
        requestId: crypto.randomUUID(),
        expectedVersion: book?.version || 0,
      });
      if (validated.action === "bank") setBankPreview(validated.rows);
    } catch (e) {
      if (seq === active.current) setError(e instanceof Error ? e.message : "Falha na importação.");
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    try {
      const payload = form.build(new FormData(event.currentTarget));
      await request(payload);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Confira os campos.");
    }
  }
  if (!user)
    return <div className="p-8">Entre com seu perfil financeiro para acessar este módulo.</div>;
  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-4 text-slate-100 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/financial" className="text-sm text-cyan-300">
            ← Central financeira
          </Link>
          <p className="mt-5 text-xs uppercase tracking-widest text-cyan-300">
            NEXTCON · ERP financeiro
          </p>
          <h1 className="mt-2 text-3xl font-semibold">ERP financeiro NAI</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            Cadastros, compras, vendas, contratos e produção conectados ao financeiro. Gestão
            gerencial com aprovação, conciliação e histórico; a consulta Omie continua na central.
          </p>
        </div>
        <Button disabled={busy} onClick={() => void request()}>
          {busy ? "Conferindo…" : book ? "Atualizar dados" : "Abrir controle financeiro"}
        </Button>
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-red-700 bg-red-950 p-4 text-red-100">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-950 p-4 text-emerald-200">
          {notice}
        </p>
      )}
      {book && summary && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm">
              Competência{" "}
              <input
                aria-label="Competência do painel"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="ml-2 rounded-lg border border-slate-600 bg-slate-900 p-2"
              />
            </label>
            <span className="text-xs text-slate-400">
              Versão {book.version} ·{" "}
              {book.periods.some((p) => p.month === period && p.closed)
                ? "Período fechado"
                : "Período aberto"}
            </span>
            <Button
              variant="secondary"
              onClick={() =>
                download(financeCsv(book), `financeiro-${today}.csv`, "text/csv;charset=utf-8")
              }
            >
              Exportar títulos
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  JSON.stringify(book, null, 2),
                  `acervo-financeiro-${today}.json`,
                  "application/json"
                )
              }
            >
              Exportar acervo e histórico
            </Button>
          </div>
          <nav aria-label="Áreas do controle financeiro" className="flex flex-wrap gap-2">
            {tabs.map(([key, name]) => (
              <button
                key={key}
                aria-current={key === tab ? "page" : undefined}
                onClick={() => setTab(key)}
                className={`rounded-xl border px-4 py-2 text-sm ${key === tab ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-700 bg-slate-900 text-slate-200"}`}
              >
                {name}
              </button>
            ))}
          </nav>
          {["masters", "orders", "collections", "reports"].includes(tab) && (
            <ErpWorkspace
              key={user.uid}
              book={book}
              section={tab}
              period={period}
              today={today}
              actor={user.uid}
              busy={busy}
              showForm={showForm}
              request={request}
            />
          )}
          {tab === "flow" && (
            <ContractFlowWorkspace
              book={book}
              period={period}
              today={today}
              busy={busy}
              actor={user.uid}
              showForm={showForm}
              navigate={setTab}
            />
          )}
          {tab === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Receita aprovada · competência", summary.revenue],
                  ["Despesa aprovada · competência", summary.expense],
                  ["Resultado gerencial registrado", summary.result],
                  ["Fluxo líquido das baixas do mês", summary.cashNet],
                ].map(([label, n]) => (
                  <article className={card} key={String(label)}>
                    <p className="text-xs text-slate-300">{label}</p>
                    <p className="mt-3 text-2xl font-semibold">{money(Number(n))}</p>
                  </article>
                ))}
              </div>
              <p className="text-sm text-amber-200">
                Base: títulos gerenciais aprovados neste módulo. O resultado não substitui a DRE
                contábil nem incorpora automaticamente o Omie. Juros, multas, descontos, retenções e
                rateios exigem classificação na competência correta.
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <section className={card}>
                  <h2 className="text-lg font-semibold">Ações prioritárias</h2>
                  <ul className="mt-4 space-y-3 text-sm">
                    <li>{summary.overdue.length} títulos aprovados vencidos com saldo residual.</li>
                    <li>{summary.unbilled.length} serviços do mês sem faturamento gerencial.</li>
                    <li>
                      {book.titles.filter((t) => t.status === "submitted").length} títulos
                      aguardando outro aprovador.
                    </li>
                    <li>{issues.length} tipos de pendência para o fechamento.</li>
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={() => setTab("titles")}>Ver títulos</Button>
                    <Button variant="secondary" onClick={() => setTab("services")}>
                      Ver produção
                    </Button>
                    <Link href="/financial/actions" className="p-2 text-cyan-300">
                      Plano de ações CFO →
                    </Link>
                  </div>
                </section>
                <section className={card}>
                  <h2 className="text-lg font-semibold">Previsão nominal por vencimento</h2>
                  <p className="mt-2 text-xs text-slate-300">
                    Saldo residual aprovado; não inclui saldo bancário nem presume recebimento de
                    valores vencidos.
                  </p>
                  {[7, 30, 90].map((days) => {
                    const end = new Date(Date.parse(today) + days * 86400000)
                      .toISOString()
                      .slice(0, 10);
                    const list = book.titles.filter(
                      (t) => t.status === "approved" && t.dueDate >= today && t.dueDate <= end
                    );
                    const total = list.reduce(
                      (sum, t) =>
                        sum + outstanding(book, t, principal) * (t.kind === "receivable" ? 1 : -1),
                      0
                    );
                    return (
                      <div
                        key={days}
                        className="mt-4 flex justify-between border-b border-slate-700 pb-3 text-sm"
                      >
                        <span>Hoje até {days} dias</span>
                        <strong>{money(total)}</strong>
                      </div>
                    );
                  })}
                </section>
              </div>
              <section className={card}>
                <h2 className="text-lg font-semibold">Margem por contrato</h2>
                <p className="my-3 text-xs text-slate-300">
                  Contribuição = receita aprovada − despesas aprovadas atribuídas ao contrato.
                  Custos operacionais declarados são mostrados separadamente para conferência, sem
                  somar duas vezes. Custos compartilhados precisam de rateio explícito.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        {[
                          "Contrato",
                          "Receita",
                          "Despesa atribuída",
                          "Custo da produção",
                          "Contribuição",
                        ].map((h) => (
                          <th key={h} className="p-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.contracts.map((c) => (
                        <tr key={c.id} className="border-t border-slate-700">
                          <td className="p-3">
                            {c.client}
                            <br />
                            {c.name}
                          </td>
                          <td>{money(c.revenue)}</td>
                          <td>{money(c.cost)}</td>
                          <td>{money(c.operationalCost)}</td>
                          <td>{money(c.contribution)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!book.contracts.length && (
                  <p className="mt-3 text-sm text-slate-400">
                    Cadastre os contratos para acompanhar a contribuição.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "titles" && (
            <section className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy} onClick={newTitle}>
                  Novo título
                </Button>
                <input
                  aria-label="Buscar títulos"
                  placeholder="Cliente, fornecedor, descrição ou status"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-64 rounded-lg border border-slate-600 bg-slate-900 p-2"
                />
              </div>
              <p className="text-sm text-slate-300">
                Mostrando todas as competências para acompanhar baixas de períodos diferentes.
                Aprovação exige outro administrador financeiro.
              </p>
              {book.titles
                .filter((t) =>
                  `${t.party} ${t.description} ${stateLabels[t.status]}`
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((t) => (
                  <article className={card} key={t.id}>
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="text-xs text-cyan-300">
                          {t.kind === "payable" ? "A pagar" : "A receber"} · {stateLabels[t.status]}
                        </p>
                        <h2 className="mt-2 font-semibold">
                          {t.party} · {t.description}
                        </h2>
                        <p className="mt-2 text-xs text-slate-300">
                          Competência {t.competence} · vence {t.dueDate} · {t.category} · {t.center}
                        </p>
                        <p className="mt-2 text-xs">
                          Origem: {t.sourceKey} · Referência Omie:{" "}
                          {t.externalReference || "Não vinculada"}
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{money(t.amountCents)}</p>
                        <p className="text-sm text-slate-300">
                          Residual: {money(outstanding(book, t, principal))}
                        </p>
                      </div>
                    </div>
                    {book.omieExports.some((e) => e.sourceId === t.id) && (
                      <p className="mt-3 text-sm text-amber-200">
                        Envio Omie registrado: alterações e baixas locais bloqueadas.{" "}
                        <Link className="underline" href="/financial/omie/conectores">
                          Conferir resultado no conector
                        </Link>
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {t.source !== "order" &&
                        ["draft", "rejected"].includes(t.status) &&
                        !book.contractFlows.some(
                          (flow) =>
                            t.kind === "receivable" &&
                            flow.contractId === t.contractId &&
                            (!flow.migration || t.competence >= flow.migration.billingStartMonth)
                        ) && (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              showForm({
                                title: "Corrigir título",
                                description:
                                  "A correção fica no histórico e continua sujeita a aprovação.",
                                fields: [
                                  { name: "description", label: "Descrição", value: t.description },
                                  {
                                    name: "amount",
                                    label: "Valor (R$)",
                                    value: (t.amountCents / 100).toFixed(2).replace(".", ","),
                                  },
                                  {
                                    name: "competence",
                                    label: "Competência",
                                    type: "month",
                                    value: t.competence,
                                  },
                                  {
                                    name: "dueDate",
                                    label: "Vencimento",
                                    type: "date",
                                    value: t.dueDate,
                                  },
                                  { name: "category", label: "Categoria", value: t.category },
                                  { name: "center", label: "Centro de custo", value: t.center },
                                  {
                                    name: "contractId",
                                    label: "Contrato",
                                    optional: true,
                                    options: [{ value: "", label: "Sem contrato" }, ...contracts],
                                    value: t.contractId || "",
                                  },
                                  {
                                    name: "evidence",
                                    label: "Evidência",
                                    type: "textarea",
                                    value: t.evidence,
                                  },
                                  defaultReason,
                                ],
                                build: (f) => ({
                                  action: "editTitle",
                                  id: t.id,
                                  reason: value(f, "reason"),
                                  data: {
                                    description: value(f, "description"),
                                    amountCents: cash(f, "amount"),
                                    competence: value(f, "competence"),
                                    dueDate: value(f, "dueDate"),
                                    category: value(f, "category"),
                                    center: value(f, "center"),
                                    contractId: value(f, "contractId") || null,
                                    evidence: value(f, "evidence"),
                                  },
                                }),
                              })
                            }
                          >
                            Corrigir rascunho
                          </Button>
                        )}
                      {["draft", "rejected"].includes(t.status) && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            reason("Enviar para aprovação", {
                              action: "review",
                              id: t.id,
                              status: "submitted",
                            })
                          }
                        >
                          Enviar para aprovação
                        </Button>
                      )}
                      {t.status === "submitted" && (
                        <>
                          <Button
                            disabled={busy || t.createdBy === user.uid}
                            onClick={() =>
                              reason("Aprovar título", {
                                action: "review",
                                id: t.id,
                                status: "approved",
                              })
                            }
                          >
                            Aprovar
                          </Button>
                          <Button
                            disabled={busy || t.createdBy === user.uid}
                            variant="secondary"
                            onClick={() =>
                              reason("Solicitar revisão", {
                                action: "review",
                                id: t.id,
                                status: "rejected",
                              })
                            }
                          >
                            Solicitar revisão
                          </Button>
                        </>
                      )}
                      {t.status === "approved" && outstanding(book, t, principal) > 0 && (
                        <Button
                          disabled={
                            busy ||
                            !accounts.length ||
                            book.omieExports.some((e) => e.sourceId === t.id)
                          }
                          onClick={() => settle(t.id)}
                        >
                          Registrar baixa
                        </Button>
                      )}
                      {t.status !== "cancelled" && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            reason("Cancelar título", {
                              action: "review",
                              id: t.id,
                              status: "cancelled",
                            })
                          }
                        >
                          Cancelar
                        </Button>
                      )}
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() =>
                          showForm({
                            title: "Vincular referência Omie",
                            description:
                              "O NAI confere valor, vencimento e nome no Omie antes de vincular. A consulta não modifica o ERP.",
                            fields: [
                              {
                                name: "reference",
                                label: "Identificador Omie",
                                value: t.externalReference,
                              },
                              defaultReason,
                            ],
                            build: (f) => ({
                              action: "reference",
                              id: t.id,
                              reference: value(f, "reference"),
                              reason: value(f, "reason"),
                            }),
                          })
                        }
                      >
                        Referência Omie
                      </Button>
                    </div>
                    <details className="mt-4 text-sm">
                      <summary className="cursor-pointer text-cyan-300">
                        Evidências e baixas
                      </summary>
                      <p className="my-3 whitespace-pre-wrap">{t.evidence}</p>
                      {book.settlements
                        .filter((s) => s.titleId === t.id)
                        .map((s) => (
                          <div key={s.id} className="my-2 rounded-lg border border-slate-700 p-3">
                            <p>
                              {s.date} · caixa {money(settlementCash(s))} · principal{" "}
                              {money(s.principalCents)} ·{" "}
                              {s.reversed
                                ? "Estornada"
                                : book.bank.some((b) => b.settlementIds.includes(s.id))
                                  ? "Conciliada"
                                  : "A conciliar"}
                            </p>
                            <p className="mt-1 text-xs">{s.evidence}</p>
                            {!s.reversed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  reason("Estornar registro de baixa", {
                                    action: "reverse",
                                    id: s.id,
                                  })
                                }
                              >
                                Estornar registro
                              </Button>
                            )}
                          </div>
                        ))}
                    </details>
                  </article>
                ))}
              {!book.titles.length && (
                <p className={card}>
                  Nenhum título registrado. Cadastre um documento ou gere o faturamento de um
                  contrato.
                </p>
              )}
            </section>
          )}
          {tab === "contracts" && (
            <section className="space-y-4">
              <Button
                disabled={busy}
                onClick={() =>
                  showForm({
                    title: "Cadastrar contrato",
                    description:
                      "Use os valores e a vigência conferidos no contrato. A mensalidade gera rascunho para aprovação.",
                    fields: [
                      { name: "name", label: "Nome / número do contrato" },
                      { name: "client", label: "Cliente" },
                      { name: "center", label: "Centro de custo" },
                      {
                        name: "monthly",
                        label: "Mensalidade (R$; zero se somente avulso)",
                        value: "0",
                      },
                      {
                        name: "dueDay",
                        label: "Dia de vencimento (1 a 28)",
                        type: "number",
                        value: "10",
                      },
                    ],
                    build: (f) => ({
                      action: "contract",
                      data: {
                        name: value(f, "name"),
                        client: value(f, "client"),
                        center: value(f, "center"),
                        monthlyCents: cash(f, "monthly"),
                        dueDay: Number(value(f, "dueDay")),
                        active: true,
                      },
                    }),
                  })
                }
              >
                Novo contrato
              </Button>
              {book.contracts.map((c) => (
                <article key={c.id} className={card}>
                  <h2 className="font-semibold">
                    {c.client} · {c.name}
                  </h2>
                  <p className="my-3 text-sm">
                    {money(c.monthlyCents)}/mês · {c.center} · {c.active ? "Ativo" : "Inativo"}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={busy || !c.active || !c.monthlyCents}
                      onClick={() =>
                        showForm({
                          title: "Gerar mensalidade",
                          description:
                            "Gera um título por contrato e competência. A repetição é bloqueada.",
                          fields: [
                            { name: "month", label: "Competência", type: "month", value: period },
                            {
                              name: "dueDate",
                              label: "Vencimento excepcional (opcional)",
                              type: "date",
                              optional: true,
                            },
                            {
                              name: "reason",
                              label: "Justificativa se alterar o vencimento contratual",
                              type: "textarea",
                              optional: true,
                            },
                          ],
                          build: (f) => ({
                            action: "recurring",
                            contractId: c.id,
                            month: value(f, "month"),
                            ...(value(f, "dueDate") ? { dueDate: value(f, "dueDate") } : {}),
                            ...(value(f, "reason") ? { reason: value(f, "reason") } : {}),
                          }),
                        })
                      }
                    >
                      Gerar mensalidade
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || book.contractFlows.some((flow) => flow.contractId === c.id)}
                      title={
                        book.contractFlows.some((flow) => flow.contractId === c.id)
                          ? "Contrato vinculado a proposta aprovada; alterações comerciais exigem aditivo."
                          : undefined
                      }
                      onClick={() =>
                        showForm({
                          title: "Revisar contrato e reajuste",
                          description:
                            "Novos valores valem para mensalidades futuras ainda não geradas. Títulos existentes são preservados.",
                          fields: [
                            { name: "name", label: "Contrato", value: c.name },
                            { name: "client", label: "Cliente", value: c.client },
                            { name: "center", label: "Centro de custo", value: c.center },
                            {
                              name: "monthly",
                              label: "Mensalidade (R$)",
                              value: (c.monthlyCents / 100).toFixed(2).replace(".", ","),
                            },
                            {
                              name: "dueDay",
                              label: "Vencimento (1 a 28)",
                              type: "number",
                              value: String(c.dueDay),
                            },
                            defaultReason,
                          ],
                          build: (f) => ({
                            action: "editContract",
                            id: c.id,
                            reason: value(f, "reason"),
                            data: {
                              name: value(f, "name"),
                              client: value(f, "client"),
                              center: value(f, "center"),
                              monthlyCents: cash(f, "monthly"),
                              dueDay: Number(value(f, "dueDay")),
                              active: c.active,
                            },
                          }),
                        })
                      }
                    >
                      Revisar / reajustar
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        reason(c.active ? "Inativar contrato" : "Reativar contrato", {
                          action: "contractStatus",
                          id: c.id,
                          active: !c.active,
                        })
                      }
                    >
                      {c.active ? "Inativar" : "Reativar"}
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          )}
          {tab === "services" && (
            <section className="space-y-4">
              <Button
                disabled={busy || !contracts.length}
                onClick={() =>
                  showForm({
                    title: "Registrar produção SST",
                    description:
                      "Registre exames ou serviços executados com custo e receita unitários. Não inclua informação clínica.",
                    fields: [
                      { name: "contractId", label: "Contrato", options: contracts },
                      { name: "date", label: "Data da execução", type: "date", value: today },
                      { name: "description", label: "Serviço / exame" },
                      { name: "supplier", label: "Clínica ou prestador" },
                      { name: "city", label: "Município de execução / UF" },
                      { name: "quantity", label: "Quantidade", type: "number", value: "1" },
                      {
                        name: "billingMode",
                        label: "Regra de faturamento",
                        options: [
                          { value: "separate", label: "Cobrança avulsa" },
                          { value: "included", label: "Incluído na mensalidade" },
                        ],
                      },
                      { name: "revenue", label: "Receita unitária (R$)" },
                      { name: "cost", label: "Custo unitário (R$)" },
                      {
                        name: "evidence",
                        label: "Referência da medição / comprovante",
                        type: "textarea",
                      },
                    ],
                    build: (f) => ({
                      action: "service",
                      data: {
                        contractId: value(f, "contractId"),
                        date: value(f, "date"),
                        description: value(f, "description"),
                        supplier: value(f, "supplier"),
                        city: value(f, "city"),
                        quantity: Number(value(f, "quantity")),
                        billingMode: value(f, "billingMode"),
                        unitRevenueCents: cash(f, "revenue"),
                        unitCostCents: cash(f, "cost"),
                        evidence: value(f, "evidence"),
                      },
                    }),
                  })
                }
              >
                Registrar serviço realizado
              </Button>
              <p className="text-sm text-slate-300">
                Custos unitários são referências operacionais. Para reconhecer a despesa, registre e
                aprove o documento do prestador em Pagar e receber.
              </p>
              {book.services
                .filter((s) => s.date.startsWith(period))
                .map((s) => (
                  <article key={s.id} className={card}>
                    <h2 className="font-semibold">
                      {s.description} · {s.quantity} unidade(s)
                    </h2>
                    <p className="my-3 text-sm">
                      {s.date} · {s.supplier} · {s.city}
                    </p>
                    <p className="mb-3 text-sm">
                      Receita {money(s.quantity * s.unitRevenueCents)} · custo declarado{" "}
                      {money(s.quantity * s.unitCostCents)} · diferença{" "}
                      {money(s.quantity * (s.unitRevenueCents - s.unitCostCents))}
                    </p>
                    {s.voided ? (
                      <p className="text-sm text-amber-200">
                        Produção anulada. Registro preservado no histórico e excluído dos totais.
                      </p>
                    ) : s.billingMode === "included" ? (
                      <p className="text-sm text-cyan-300">
                        Incluído na mensalidade; custo disponível para análise do contrato.
                      </p>
                    ) : s.titleId ? (
                      <p className="text-sm text-cyan-300">
                        Título gerado · confira aprovação e referência fiscal.
                      </p>
                    ) : (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          showForm({
                            title: "Faturar serviço realizado",
                            description:
                              "Gera um título gerencial para aprovação. A emissão fiscal continua no Omie.",
                            fields: [
                              { name: "dueDate", label: "Vencimento", type: "date", value: today },
                            ],
                            build: (f) => ({
                              action: "billService",
                              id: s.id,
                              dueDate: value(f, "dueDate"),
                            }),
                          })
                        }
                      >
                        Gerar faturamento
                      </Button>
                    )}
                    {!s.voided && !s.titleId && (
                      <Button
                        className="mt-3"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          reason("Anular produção incorreta", { action: "voidService", id: s.id })
                        }
                      >
                        Anular registro de produção
                      </Button>
                    )}
                  </article>
                ))}
            </section>
          )}
          {tab === "banks" && (
            <section className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() =>
                    showForm({
                      title: "Identificar conta bancária",
                      description:
                        "Cadastre um nome de referência. Não solicita nem armazena senha bancária.",
                      fields: [{ name: "name", label: "Nome da conta" }],
                      build: (f) => ({ action: "account", name: value(f, "name") }),
                    })
                  }
                >
                  Cadastrar conta de referência
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    download("id;data;valor;historico\r\n", "modelo-extrato.csv", "text/csv")
                  }
                >
                  Modelo CSV
                </Button>
              </div>
              <div className={card}>
                <h2 className="font-semibold">Importar extrato para conferência</h2>
                <p className="my-3 text-xs text-slate-300">
                  CSV com id;data;valor;historico. Data AAAA-MM-DD, crédito positivo e débito
                  negativo, valores com vírgula. Use o identificador estável do banco para impedir
                  duplicações.
                </p>
                <label className="block text-sm">
                  Conta
                  <select
                    aria-label="Conta do extrato"
                    className="my-2 block rounded-lg bg-slate-800 p-2"
                    value={bankAccount}
                    disabled={busy}
                    onChange={(e) => {
                      bankImportVersion.current++;
                      setBankAccount(e.target.value);
                      setBankPreview(null);
                    }}
                  >
                    <option value="">Selecione</option>
                    {accounts.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  aria-label="Arquivo CSV de extrato"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy || !bankAccount}
                  onChange={(e) => void importCsv(e.target.files?.[0])}
                />
                {bankPreview && (
                  <div className="mt-4 space-y-3">
                    <p>
                      {bankPreview.length} movimentos para conferir · líquido{" "}
                      {money(bankPreview.reduce((s, r) => s + r.amountCents, 0))}
                    </p>
                    <div className="max-h-60 overflow-auto text-xs">
                      {bankPreview.map((r, i) => (
                        <p key={i} className="border-b border-slate-700 py-2">
                          {r.date} · {r.bankId} · {r.memo} · {money(r.amountCents)}
                        </p>
                      ))}
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void request({ action: "bank", accountId: bankAccount, rows: bankPreview })
                      }
                    >
                      Confirmar importação
                    </Button>
                  </div>
                )}
              </div>
              <Button
                disabled={busy || !accounts.length}
                onClick={() =>
                  showForm({
                    title: "Conferir saldos do extrato",
                    description:
                      "Informe saldos de abertura e encerramento do mês completo. A diferença deve corresponder aos movimentos importados.",
                    fields: [
                      { name: "accountId", label: "Conta", options: accounts },
                      { name: "month", label: "Mês", type: "month", value: period },
                      { name: "opening", label: "Saldo de abertura (R$)" },
                      { name: "closing", label: "Saldo de encerramento (R$)" },
                      { name: "evidence", label: "Referência do extrato", type: "textarea" },
                    ],
                    build: (f) => ({
                      action: "statement",
                      data: {
                        accountId: value(f, "accountId"),
                        month: value(f, "month"),
                        openingCents: cash(f, "opening"),
                        closingCents: cash(f, "closing"),
                        evidence: value(f, "evidence"),
                      },
                    }),
                  })
                }
              >
                Informar saldos mensais
              </Button>
              {book.bank
                .filter((b) => b.date.startsWith(period))
                .map((b) => {
                  const matched = b.settlementIds.length > 0 || Boolean(b.transferPeer);
                  const eligible = book.settlements.filter(
                    (s) =>
                      !s.reversed &&
                      s.accountId === b.accountId &&
                      s.date === b.date &&
                      !book.bank.some((row) => row.settlementIds.includes(s.id))
                  );
                  return (
                    <article key={b.id} className={card}>
                      <p className="text-xs text-cyan-300">
                        {book.accounts.find((a) => a.id === b.accountId)?.name} ·{" "}
                        {b.voided
                          ? "Anulado · preservado no histórico"
                          : matched
                            ? "Conciliado"
                            : "Pendente"}
                      </p>
                      <h2 className="my-2 font-semibold">
                        {b.date} · {b.memo} · {money(b.amountCents)}
                      </h2>
                      <p className="mb-3 text-xs">
                        Identificador: {b.bankId}
                        {b.transferPeer ? " · transferência interna, excluída do resultado" : ""}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {b.voided ? (
                          <p className="text-sm text-amber-200">
                            Movimento excluído dos saldos. Importe o registro corrigido para
                            conciliar.
                          </p>
                        ) : matched ? (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              reason("Desfazer conciliação", { action: "unmatch", id: b.id })
                            }
                          >
                            Desfazer conciliação
                          </Button>
                        ) : (
                          <>
                            <Button
                              disabled={busy || !eligible.length}
                              onClick={() =>
                                showForm({
                                  title: "Conciliar movimento",
                                  description: `Total do extrato: ${money(b.amountCents)}. Selecione uma ou mais baixas da mesma conta e data. A soma precisa conferir exatamente.`,
                                  fields: [
                                    {
                                      name: "settlementIds",
                                      label: "Baixas a vincular (seleção múltipla)",
                                      multiple: true,
                                      options: eligible.map((s) => ({
                                        value: s.id,
                                        label: `${book.titles.find((t) => t.id === s.titleId)?.party} · ${money(settlementCash(s))}`,
                                      })),
                                    },
                                  ],
                                  build: (f) => ({
                                    action: "match",
                                    id: b.id,
                                    settlementIds: f.getAll("settlementIds").map(String),
                                  }),
                                })
                              }
                            >
                              Conciliar baixa
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                showForm({
                                  title: "Conciliar transferência interna",
                                  description:
                                    "Selecione o movimento de valor oposto em outra conta da empresa, na mesma data.",
                                  fields: [
                                    {
                                      name: "peerId",
                                      label: "Contrapartida",
                                      options: book.bank
                                        .filter(
                                          (p) =>
                                            p.accountId !== b.accountId &&
                                            p.date === b.date &&
                                            p.amountCents === -b.amountCents &&
                                            !p.transferPeer &&
                                            !p.voided &&
                                            !p.settlementIds.length
                                        )
                                        .map((p) => ({
                                          value: p.id,
                                          label: `${book.accounts.find((a) => a.id === p.accountId)?.name} · ${p.memo} · ${money(p.amountCents)}`,
                                        })),
                                    },
                                    defaultReason,
                                  ],
                                  build: (f) => ({
                                    action: "transfer",
                                    id: b.id,
                                    peerId: value(f, "peerId"),
                                    reason: value(f, "reason"),
                                  }),
                                })
                              }
                            >
                              Transferência interna
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                reason("Anular movimento importado incorretamente", {
                                  action: "voidBank",
                                  id: b.id,
                                })
                              }
                            >
                              Anular movimento
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
            </section>
          )}
          {tab === "budget" && (
            <section className="space-y-4">
              <Button
                disabled={busy}
                onClick={() =>
                  showForm({
                    title: "Definir orçamento de despesas",
                    description:
                      "O realizado usa despesas aprovadas na competência e no centro de custo informado.",
                    fields: [
                      { name: "month", label: "Competência", type: "month", value: period },
                      { name: "center", label: "Centro de custo (mesmo nome dos títulos)" },
                      { name: "amount", label: "Limite planejado (R$)" },
                    ],
                    build: (f) => ({
                      action: "budget",
                      data: {
                        month: value(f, "month"),
                        center: value(f, "center"),
                        amountCents: cash(f, "amount"),
                      },
                    }),
                  })
                }
              >
                Definir / revisar orçamento
              </Button>
              {summary.budgets.map((b) => (
                <article key={b.id} className={card}>
                  <h2 className="font-semibold">{b.center}</h2>
                  <p className="mt-3 text-sm">
                    Planejado {money(b.amountCents)} · realizado {money(b.actual)}
                  </p>
                  <p
                    className={`mt-2 text-lg ${b.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}
                  >
                    {b.remaining < 0 ? "Excedente" : "Disponível"}: {money(Math.abs(b.remaining))}
                  </p>
                </article>
              ))}
            </section>
          )}
          {tab === "close" && (
            <section className={card}>
              <h2 className="text-xl font-semibold">Fechamento gerencial · {period}</h2>
              <p className="my-4 text-sm text-slate-300">
                O fechamento bloqueia alterações na competência e nas baixas e movimentos de caixa
                desse mês. A reabertura exige justificativa e permanece no histórico. Não equivale
                ao fechamento contábil oficial.
              </p>
              {issues.length ? (
                <ul className="mb-5 list-inside list-disc space-y-2 text-sm text-amber-200">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p className="mb-5 text-emerald-300">
                  Conferências operacionais concluídas para a base registrada.
                </p>
              )}
              <Button
                disabled={
                  busy ||
                  (!book.periods.some((p) => p.month === period && p.closed) && issues.length > 0)
                }
                onClick={() =>
                  showForm({
                    title: book.periods.some((p) => p.month === period && p.closed)
                      ? "Reabrir período"
                      : "Fechar período",
                    description:
                      "Registre a conferência e os documentos usados. A mudança ficará no histórico.",
                    fields: [
                      { name: "evidence", label: "Justificativa / evidência", type: "textarea" },
                    ],
                    build: (f) => ({
                      action: "period",
                      month: period,
                      close: !book.periods.some((p) => p.month === period && p.closed),
                      evidence: value(f, "evidence"),
                    }),
                  })
                }
              >
                {book.periods.some((p) => p.month === period && p.closed)
                  ? "Reabrir com justificativa"
                  : "Fechar período"}
              </Button>
            </section>
          )}
          {tab === "audit" && (
            <section className={card}>
              <h2 className="mb-4 text-xl font-semibold">Histórico de alterações</h2>
              <p className="mb-4 text-sm text-slate-300">
                Eventos preservados por operação. Exporte o acervo para conferir as referências e os
                registros completos.
              </p>
              {[...book.audit]
                .reverse()
                .slice(0, 200)
                .map((a) => (
                  <div className="border-b border-slate-700 py-3 text-sm" key={a.id}>
                    <p>
                      Versão {a.version} ·{" "}
                      {new Date(a.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ·{" "}
                      {a.action}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Responsável: {a.actor}</p>
                    <p className="mt-1">{a.reason}</p>
                  </div>
                ))}
              {book.audit.length > 200 && (
                <p className="mt-4">
                  Mostrando os 200 eventos mais recentes. A exportação contém o histórico completo.
                </p>
              )}
            </section>
          )}
        </>
      )}
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !busy) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-white text-slate-950">
          <DialogHeader>
            <DialogTitle>{form?.title}</DialogTitle>
            <DialogDescription>{form?.description}</DialogDescription>
          </DialogHeader>
          {form && (
            <form onSubmit={submit} className="space-y-4">
              {form.fields.map((f) => (
                <label key={f.name} className="block space-y-1 text-sm font-medium">
                  <span>{f.label}</span>
                  {f.options ? (
                    <select
                      className={fieldClass}
                      name={f.name}
                      required={!f.optional}
                      multiple={f.multiple}
                      defaultValue={f.multiple ? [] : f.value || f.options[0]?.value || ""}
                      disabled={busy}
                    >
                      {f.options.map((o) => (
                        <option value={o.value} key={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className={fieldClass}
                      name={f.name}
                      required={!f.optional}
                      maxLength={1000}
                      defaultValue={f.value}
                      disabled={busy}
                      rows={3}
                    />
                  ) : (
                    <input
                      className={fieldClass}
                      name={f.name}
                      type={f.type || "text"}
                      min={f.name === "installments" ? 1 : undefined}
                      max={f.name === "installments" ? 36 : undefined}
                      required={!f.optional}
                      maxLength={180}
                      defaultValue={f.value}
                      disabled={busy}
                    />
                  )}
                </label>
              ))}
              {formError && (
                <p role="alert" className="text-sm text-red-700">
                  {formError}
                </p>
              )}
              <Button className="w-full" disabled={busy} type="submit">
                {busy ? "Salvando e conferindo…" : "Confirmar registro"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
