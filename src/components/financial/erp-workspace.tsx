"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { erpReports, reportCsv } from "@/lib/financial/erp-reports";
import { orderTotal } from "@/lib/financial/erp";
import { parseBrl, type FinanceBook } from "@/lib/financial/operations";
import type { FinanceForm } from "./operations-workspace";

const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const decimal = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const card = "rounded-2xl border border-slate-700 bg-slate-900 p-5";
const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950";
const reason = {
  name: "reason",
  label: "Justificativa e evidência da alteração",
  type: "textarea",
};
const activeOptions = [
  { value: "true", label: "Ativo" },
  { value: "false", label: "Inativo" },
];
const labels: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Em aprovação",
  approved: "Aprovado",
  rejected: "Devolvido",
  converted: "Título gerado",
  cancelled: "Cancelado",
  attempt: "Tentativa",
  contacted: "Contato realizado",
  promise: "Promessa de pagamento",
  disputed: "Contestação",
  resolved: "Tratativa encerrada",
};
const get = (f: FormData, key: string) => String(f.get(key) || "").trim();
type Order = FinanceBook["erp"]["orders"][number];
type Props = {
  book: FinanceBook;
  section: string;
  period: string;
  today: string;
  actor: string;
  busy: boolean;
  showForm: (form: FinanceForm) => void;
  request: (data: Record<string, unknown>) => Promise<boolean>;
};
function exportRows(rows: (string | number)[][], name: string) {
  const url = URL.createObjectURL(new Blob([reportCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function ErpWorkspace({
  book,
  section,
  period,
  today,
  actor,
  busy,
  showForm,
  request,
}: Props) {
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ order?: Order } | null>(null);
  const erp = book.erp;
  const contractedOrders = new Set(book.contractFlows.map((f) => f.orderId));
  const report = erpReports(book, period, today);
  const command = (title: string, data: Record<string, unknown>) =>
    showForm({
      title,
      description:
        "A alteração ficará registrada no histórico. Este fluxo não movimenta dinheiro nem emite documento fiscal.",
      fields: [reason],
      build: (f) => ({ ...data, reason: get(f, "reason") }),
    });
  const partyForm = (p?: FinanceBook["erp"]["parties"][number]) =>
    showForm({
      title: p ? "Editar cliente/fornecedor" : "Novo cliente/fornecedor",
      description:
        "Cadastro financeiro corporativo. Não altera cadastros clínicos ou o Omie. A identificação informada deve ser conferida na fonte.",
      fields: [
        { name: "name", label: "Nome ou razão social", value: p?.name },
        {
          name: "document",
          label: "CPF, CNPJ ou identificação (opcional)",
          value: p?.document,
          optional: true,
        },
        {
          name: "role",
          label: "Perfil",
          value: p?.role,
          options: [
            { value: "customer", label: "Cliente" },
            { value: "supplier", label: "Fornecedor" },
            { value: "both", label: "Cliente e fornecedor" },
          ],
        },
        {
          name: "email",
          label: "E-mail (opcional)",
          type: "email",
          value: p?.email,
          optional: true,
        },
        { name: "phone", label: "Telefone (opcional)", value: p?.phone, optional: true },
        {
          name: "active",
          label: "Situação",
          value: String(p?.active ?? true),
          options: activeOptions,
        },
        reason,
      ],
      build: (f) => ({
        action: "erpParty",
        id: p?.id ?? null,
        data: {
          name: get(f, "name"),
          document: get(f, "document"),
          role: get(f, "role"),
          email: get(f, "email"),
          phone: get(f, "phone"),
          active: get(f, "active") === "true",
        },
        reason: get(f, "reason"),
      }),
    });
  const categoryForm = (c?: FinanceBook["erp"]["categories"][number]) =>
    showForm({
      title: c ? "Editar conta gerencial" : "Nova conta gerencial",
      description:
        "Plano gerencial de receitas e despesas. Não equivale ao plano contábil oficial. Pedidos guardam a classificação aprovada no momento do registro.",
      fields: [
        { name: "code", label: "Código", value: c?.code },
        { name: "name", label: "Nome", value: c?.name },
        {
          name: "kind",
          label: "Natureza",
          value: c?.kind,
          options: [
            { value: "revenue", label: "Receita" },
            { value: "expense", label: "Despesa" },
          ],
        },
        {
          name: "active",
          label: "Situação",
          value: String(c?.active ?? true),
          options: activeOptions,
        },
        reason,
      ],
      build: (f) => ({
        action: "erpCategory",
        id: c?.id ?? null,
        data: {
          code: get(f, "code"),
          name: get(f, "name"),
          kind: get(f, "kind"),
          active: get(f, "active") === "true",
        },
        reason: get(f, "reason"),
      }),
    });
  const centerForm = (c?: FinanceBook["erp"]["centers"][number]) =>
    showForm({
      title: c ? "Editar centro de custo" : "Novo centro de custo",
      description:
        "Organize departamentos, unidades ou projetos. Alterações no cadastro não reclassificam o histórico.",
      fields: [
        { name: "code", label: "Código", value: c?.code },
        { name: "name", label: "Nome", value: c?.name },
        {
          name: "active",
          label: "Situação",
          value: String(c?.active ?? true),
          options: activeOptions,
        },
        reason,
      ],
      build: (f) => ({
        action: "erpCenter",
        id: c?.id ?? null,
        data: { code: get(f, "code"), name: get(f, "name"), active: get(f, "active") === "true" },
        reason: get(f, "reason"),
      }),
    });
  const followUp = (id: string) =>
    showForm({
      title: "Registrar acompanhamento",
      description:
        "Registro interno de uma tratativa. Não envia mensagens e não baixa o título. Confirme o recebimento na tesouraria.",
      fields: [
        { name: "date", label: "Data da tratativa", type: "date", value: today },
        {
          name: "outcome",
          label: "Resultado",
          options: ["attempt", "contacted", "promise", "disputed", "resolved"].map((v) => ({
            value: v,
            label: labels[v],
          })),
        },
        { name: "nextDate", label: "Próximo contato (opcional)", type: "date", optional: true },
        { name: "note", label: "Resumo e evidência", type: "textarea" },
      ],
      build: (f) => ({
        action: "erpFollowUp",
        data: {
          titleId: id,
          date: get(f, "date"),
          nextDate: get(f, "nextDate") || null,
          outcome: get(f, "outcome"),
          note: get(f, "note"),
        },
      }),
    });
  return (
    <div className="space-y-6">
      {section === "masters" && (
        <>
          <section className={card}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Clientes e fornecedores</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Cadastros compartilhados pelos pedidos de compra e venda.
                </p>
              </div>
              <Button disabled={busy} onClick={() => partyForm()}>
                Novo cadastro
              </Button>
            </div>
            <input
              aria-label="Buscar cadastro financeiro"
              className={`${input} my-4 max-w-md`}
              placeholder="Buscar por nome ou identificação"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Nome", "Identificação", "Perfil", "Situação", "Ações"].map((h) => (
                      <th className="p-2" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {erp.parties
                    .filter((p) =>
                      (p.name + " " + p.document).toLowerCase().includes(query.toLowerCase())
                    )
                    .map((p) => (
                      <tr className="border-t border-slate-700" key={p.id}>
                        <td className="p-2">{p.name}</td>
                        <td className="p-2">{p.document || "Não informada"}</td>
                        <td className="p-2">
                          {p.role === "both"
                            ? "Cliente e fornecedor"
                            : p.role === "customer"
                              ? "Cliente"
                              : "Fornecedor"}
                        </td>
                        <td className="p-2">{p.active ? "Ativo" : "Inativo"}</td>
                        <td className="p-2">
                          <Button variant="secondary" disabled={busy} onClick={() => partyForm(p)}>
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!erp.parties.length && (
              <p className="mt-4 text-slate-400">Cadastre as partes antes de criar os pedidos.</p>
            )}
          </section>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className={card}>
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-semibold">Plano de contas gerencial</h2>
                <Button disabled={busy} onClick={() => categoryForm()}>
                  Nova conta
                </Button>
              </div>
              <p className="my-3 text-sm text-slate-400">
                Receitas e despesas para classificação dos pedidos.
              </p>
              {erp.categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 border-t border-slate-700 py-3"
                >
                  <span>
                    {c.code} · {c.name}
                    <small className="block text-slate-400">
                      {c.kind === "revenue" ? "Receita" : "Despesa"} ·{" "}
                      {c.active ? "Ativa" : "Inativa"}
                    </small>
                  </span>
                  <Button variant="secondary" disabled={busy} onClick={() => categoryForm(c)}>
                    Editar
                  </Button>
                </div>
              ))}
              {!erp.categories.length && (
                <p className="text-slate-400">Nenhuma conta cadastrada.</p>
              )}
            </section>
            <section className={card}>
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-semibold">Centros de custo</h2>
                <Button disabled={busy} onClick={() => centerForm()}>
                  Novo centro
                </Button>
              </div>
              <p className="my-3 text-sm text-slate-400">Departamentos, unidades e projetos.</p>
              {erp.centers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 border-t border-slate-700 py-3"
                >
                  <span>
                    {c.code} · {c.name}
                    <small className="block text-slate-400">{c.active ? "Ativo" : "Inativo"}</small>
                  </span>
                  <Button variant="secondary" disabled={busy} onClick={() => centerForm(c)}>
                    Editar
                  </Button>
                </div>
              ))}
              {!erp.centers.length && <p className="text-slate-400">Nenhum centro cadastrado.</p>}
            </section>
          </div>
        </>
      )}
      {section === "orders" && (
        <section className={card}>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Compras e vendas</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Pedido → aprovação independente → título financeiro → baixa → conciliação. A geração
                de título é gerencial e não emite nota, boleto ou Pix.
              </p>
            </div>
            <Button
              disabled={
                busy ||
                !erp.parties.some((p) => p.active) ||
                !erp.categories.some((c) => c.active) ||
                !erp.centers.some((c) => c.active)
              }
              onClick={() => setEditor({})}
            >
              Novo pedido
            </Button>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Competência {period} · Configure clientes/fornecedores, contas e centros na aba
            Cadastros.
          </p>
          <div className="mt-5 space-y-4">
            {erp.orders
              .filter((o) => o.competence === period)
              .map((o) => (
                <article key={o.id} className="rounded-xl border border-slate-700 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {o.kind === "sale" ? "Venda" : "Compra"} {o.number} · {o.partyName}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {o.categoryName} · {o.centerName} · vence {o.dueDate}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong>{money(o.totalCents)}</strong>
                      <p className="text-sm text-cyan-300">
                        {contractedOrders.has(o.id)
                          ? "Vinculado a contrato · acompanhe em Contrato ao recebimento"
                          : labels[o.status]}
                      </p>
                    </div>
                  </div>
                  <details className="my-3 text-sm">
                    <summary className="cursor-pointer text-slate-300">Itens e evidência</summary>
                    <ul className="my-2 space-y-1">
                      {o.items.map((i, n) => (
                        <li key={n}>
                          {i.quantity} × {i.description} · {money(i.unitCents)} ={" "}
                          {money(i.quantity * i.unitCents)}
                        </li>
                      ))}
                    </ul>
                    <p>Desconto: {money(o.discountCents)}</p>
                    <p className="mt-2 whitespace-pre-wrap">{o.evidence}</p>
                    {o.titleId && (
                      <p className="mt-2">
                        Título: {o.titleId}. Acompanhe aprovação e baixa em Pagar e receber.
                      </p>
                    )}
                  </details>
                  <div className="flex flex-wrap gap-2">
                    {["draft", "rejected"].includes(o.status) && (
                      <>
                        <Button
                          variant="secondary"
                          disabled={busy || o.createdBy !== actor}
                          onClick={() => setEditor({ order: o })}
                        >
                          Editar pedido
                        </Button>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            command("Enviar pedido para aprovação", {
                              action: "erpReviewOrder",
                              id: o.id,
                              status: "submitted",
                            })
                          }
                        >
                          Enviar para aprovação
                        </Button>
                      </>
                    )}
                    {o.status === "submitted" && (
                      <>
                        <Button
                          disabled={busy || o.createdBy === actor}
                          onClick={() =>
                            command("Aprovar pedido", {
                              action: "erpReviewOrder",
                              id: o.id,
                              status: "approved",
                            })
                          }
                        >
                          Aprovar
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy || o.createdBy === actor}
                          onClick={() =>
                            command("Devolver pedido", {
                              action: "erpReviewOrder",
                              id: o.id,
                              status: "rejected",
                            })
                          }
                        >
                          Devolver
                        </Button>
                        {o.createdBy === actor && (
                          <p className="self-center text-sm text-amber-200">
                            Outro administrador deve revisar este pedido.
                          </p>
                        )}
                      </>
                    )}
                    {o.status === "approved" && !contractedOrders.has(o.id) && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          command("Gerar título financeiro", {
                            action: "erpConvertOrder",
                            id: o.id,
                          })
                        }
                      >
                        Gerar título em rascunho
                      </Button>
                    )}
                    {!["converted", "cancelled"].includes(o.status) &&
                      !contractedOrders.has(o.id) && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            command("Cancelar pedido", {
                              action: "erpReviewOrder",
                              id: o.id,
                              status: "cancelled",
                            })
                          }
                        >
                          Cancelar
                        </Button>
                      )}
                  </div>
                </article>
              ))}
          </div>
          {!erp.orders.some((o) => o.competence === period) && (
            <p className="mt-6 text-slate-400">Nenhum pedido nesta competência.</p>
          )}
        </section>
      )}
      {section === "collections" && (
        <section className={card}>
          <h2 className="text-xl font-semibold">Acompanhamento de recebíveis</h2>
          <p className="my-3 text-sm text-slate-400">
            Saldo residual atual dos títulos aprovados, em todas as competências. O registro de
            contato não envia cobrança nem confirma recebimento.
          </p>
          {report.receivables.map((t) => (
            <article key={t.id} className="space-y-3 border-t border-slate-700 py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {t.party} · {t.description}
                  </h3>
                  <p
                    className={
                      t.dueDate < today ? "text-sm text-amber-200" : "text-sm text-slate-400"
                    }
                  >
                    Vencimento {t.dueDate} · saldo {money(t.residual)}
                  </p>
                </div>
                <Button disabled={busy} onClick={() => followUp(t.id)}>
                  Registrar contato
                </Button>
              </div>
              {t.followUp && (
                <p className="text-sm text-slate-300">
                  Última tratativa: {t.followUp.date} · {labels[t.followUp.outcome]}
                  {t.followUp.nextDate ? ` · próximo contato ${t.followUp.nextDate}` : ""}
                </p>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer">Histórico de tratativas</summary>
                {erp.followUps
                  .filter((f) => f.titleId === t.id)
                  .map((f) => (
                    <p key={f.id} className="my-2 whitespace-pre-wrap">
                      {f.date} · {labels[f.outcome]} — {f.note}
                    </p>
                  ))}
              </details>
            </article>
          ))}
          {!report.receivables.length && (
            <p className="text-slate-400">Nenhum recebível aprovado com saldo em aberto.</p>
          )}
        </section>
      )}
      {section === "reports" && (
        <>
          <section className={card}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Vencimentos e inadimplência</h2>
                <p className="my-2 text-sm text-slate-400">
                  Posição atual em {today}, todas as competências. Não representa saldo histórico
                  retroativo.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  exportRows(
                    [
                      ["Faixa", "Receber (centavos)", "Pagar (centavos)", "Títulos"],
                      ...report.aging.map((a) => [a.label, a.receivable, a.payable, a.count]),
                    ],
                    `vencimentos-${today}.csv`
                  )
                }
              >
                Exportar vencimentos
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Faixa", "A receber", "A pagar", "Títulos"].map((h) => (
                      <th className="p-2" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.aging.map((a) => (
                    <tr key={a.label} className="border-t border-slate-700">
                      <td className="p-2">{a.label}</td>
                      <td className="p-2">{money(a.receivable)}</td>
                      <td className="p-2">{money(a.payable)}</td>
                      <td className="p-2">{a.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className={card}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Resultado por categoria · {period}</h2>
                <p className="my-2 max-w-3xl text-sm text-slate-400">
                  Títulos gerenciais aprovados por competência. Não substitui a DRE contábil:
                  tributos, depreciação, provisões e ajustes exigem lançamentos próprios e validação
                  contábil.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  exportRows(
                    [
                      ["Categoria", "Receita (centavos)", "Despesa (centavos)"],
                      ...report.result.map((r) => [r.category, r.revenue, r.expense]),
                    ],
                    `resultado-${period}.csv`
                  )
                }
              >
                Exportar resultado
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Categoria</th>
                    <th className="p-2">Receita</th>
                    <th className="p-2">Despesa</th>
                  </tr>
                </thead>
                <tbody>
                  {report.result.map((r) => (
                    <tr key={r.kind + r.category} className="border-t border-slate-700">
                      <td className="p-2">{r.category}</td>
                      <td className="p-2">{money(r.revenue)}</td>
                      <td className="p-2">{money(r.expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-semibold">
              Resultado registrado: {money(report.revenue - report.expense)}
            </p>
            {!report.result.length && (
              <p className="mt-2 text-slate-400">Nenhum título aprovado nesta competência.</p>
            )}
          </section>
          <section className={card}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Movimento de caixa registrado · {period}</h2>
                <p className="my-2 text-sm text-slate-400">
                  Baixas não estornadas, incluindo ajustes de caixa. Não é saldo bancário;
                  transferências internas não compõem entradas e saídas operacionais.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  exportRows(
                    [
                      ["Data", "Entradas (centavos)", "Saídas (centavos)", "Líquido (centavos)"],
                      ...report.cash.map((r) => [r.date, r.in, r.out, r.in - r.out]),
                    ],
                    `caixa-${period}.csv`
                  )
                }
              >
                Exportar caixa
              </Button>
            </div>
            {report.cash.map((r) => (
              <p key={r.date} className="border-t border-slate-700 py-3 text-sm">
                {r.date} · Entradas {money(r.in)} · Saídas {money(r.out)} · Líquido{" "}
                {money(r.in - r.out)}
              </p>
            ))}
            {!report.cash.length && <p className="text-slate-400">Nenhuma baixa neste mês.</p>}
          </section>
          <section className={card}>
            <h2 className="text-xl font-semibold">Integrações e abrangência</h2>
            <p className="mt-3 text-sm text-slate-300">
              O ERP gerencial funciona no NAI. A consulta Omie permanece na central financeira.
              Emissão fiscal, registro de boletos/Pix, transmissão de pagamentos e importação
              bancária automática exigem conectores configurados e homologados; não são executados
              por estes controles.
            </p>
          </section>
        </>
      )}
      {editor && (
        <OrderEditor
          key={editor.order?.id || "new"}
          book={book}
          order={editor.order}
          period={period}
          today={today}
          busy={busy}
          close={() => setEditor(null)}
          request={request}
        />
      )}
    </div>
  );
}
function OrderEditor({
  book,
  order,
  period,
  today,
  busy,
  close,
  request,
}: {
  book: FinanceBook;
  order?: Order;
  period: string;
  today: string;
  busy: boolean;
  close: () => void;
  request: Props["request"];
}) {
  const [kind, setKind] = useState<"sale" | "purchase">(order?.kind || "sale");
  const [items, setItems] = useState(
    order?.items.map((i) => ({
      description: i.description,
      quantity: String(i.quantity),
      price: decimal(i.unitCents),
    })) || [{ description: "", quantity: "1", price: "" }]
  );
  const [discount, setDiscount] = useState(decimal(order?.discountCents || 0));
  const [error, setError] = useState("");
  const parsedItems = () =>
    items.map((i) => ({
      description: i.description.trim(),
      quantity: Number(i.quantity),
      unitCents: parseBrl(i.price),
    }));
  let preview: string;
  try {
    preview = money(
      orderTotal({
        kind,
        number: "preview",
        partyId: "preview",
        categoryId: "preview",
        centerId: "preview",
        competence: period,
        dueDate: today,
        items: parsedItems(),
        discountCents: parseBrl(discount),
        evidence: "Preview",
      })
    );
  } catch {
    preview = "Confira os valores";
  }
  const parties = book.erp.parties.filter(
    (p) => p.active && (p.role === "both" || p.role === (kind === "sale" ? "customer" : "supplier"))
  );
  const categories = book.erp.categories.filter(
    (c) => c.active && c.kind === (kind === "sale" ? "revenue" : "expense")
  );
  const centers = book.erp.centers.filter((c) => c.active);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-white text-slate-950">
        <DialogHeader>
          <DialogTitle>{order ? "Editar pedido" : "Novo pedido"}</DialogTitle>
          <DialogDescription>
            Registre os itens e confira o total. A aprovação exige outro administrador. O pedido não
            emite nota fiscal nem efetua compra ou pagamento externo.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const f = new FormData(e.currentTarget);
              const ok = await request({
                action: "erpOrder",
                id: order?.id ?? null,
                data: {
                  kind,
                  number: get(f, "number"),
                  partyId: get(f, "partyId"),
                  categoryId: get(f, "categoryId"),
                  centerId: get(f, "centerId"),
                  competence: get(f, "competence"),
                  dueDate: get(f, "dueDate"),
                  items: parsedItems(),
                  discountCents: parseBrl(discount),
                  evidence: get(f, "evidence"),
                },
                reason: get(f, "reason"),
              });
              if (ok) close();
              else
                setError(
                  "Pedido não confirmado. Confira o erro exibido no painel antes de tentar novamente."
                );
            } catch (err) {
              setError(err instanceof Error ? err.message : "Confira os campos.");
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                Tipo
                <select
                  className={input}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as "sale" | "purchase")}
                >
                  <option value="sale">Venda / faturamento</option>
                  <option value="purchase">Compra / despesa</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Número do pedido
                <input
                  name="number"
                  required
                  maxLength={180}
                  className={input}
                  defaultValue={order?.number}
                />
              </label>
              <label className="space-y-1 text-sm">
                Cliente ou fornecedor
                <select
                  key={`party-${kind}`}
                  required
                  name="partyId"
                  className={input}
                  defaultValue={order?.partyId || ""}
                >
                  <option value="">Selecione</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Conta gerencial
                <select
                  key={`category-${kind}`}
                  required
                  name="categoryId"
                  className={input}
                  defaultValue={order?.categoryId || ""}
                >
                  <option value="">Selecione</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Centro de custo
                <select
                  required
                  name="centerId"
                  className={input}
                  defaultValue={order?.centerId || ""}
                >
                  <option value="">Selecione</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                Competência
                <input
                  required
                  type="month"
                  name="competence"
                  className={input}
                  defaultValue={order?.competence || period}
                />
              </label>
              <label className="space-y-1 text-sm">
                Vencimento
                <input
                  required
                  type="date"
                  name="dueDate"
                  className={input}
                  defaultValue={order?.dueDate || today}
                />
              </label>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Itens do pedido</h3>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border p-3">
                  {(
                    [
                      {
                        key: "description",
                        label: "Descrição",
                        width: "col-span-12 sm:col-span-6",
                      },
                      {
                        key: "quantity",
                        label: "Quantidade inteira",
                        width: "col-span-6 sm:col-span-2",
                      },
                      {
                        key: "price",
                        label: "Valor unitário (R$)",
                        width: "col-span-6 sm:col-span-3",
                      },
                    ] as const
                  ).map((field) => (
                    <label key={field.key} className={`${field.width} text-xs`}>
                      {field.label}
                      <input
                        aria-label={`${field.label} ${index + 1}`}
                        className={input}
                        required
                        type={field.key === "quantity" ? "number" : "text"}
                        min={field.key === "quantity" ? 1 : undefined}
                        step={field.key === "quantity" ? 1 : undefined}
                        maxLength={180}
                        value={item[field.key]}
                        onChange={(e) =>
                          setItems(
                            items.map((i, n) =>
                              n === index ? { ...i, [field.key]: e.target.value } : i
                            )
                          )
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="col-span-12 text-sm text-red-700 sm:col-span-1"
                    type="button"
                    aria-label={`Remover item ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, n) => n !== index))}
                  >
                    Excluir
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                disabled={items.length >= 100}
                onClick={() => setItems([...items, { description: "", quantity: "1", price: "" }])}
              >
                Adicionar item
              </Button>
            </div>
            <label className="block text-sm">
              Desconto total (R$)
              <input
                className={input}
                required
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </label>
            <p className="text-lg font-semibold" aria-live="polite">
              Total: {preview}
            </p>
            <label className="block text-sm">
              Evidência e referência do pedido
              <textarea
                name="evidence"
                required
                minLength={3}
                maxLength={1000}
                className={input}
                defaultValue={order?.evidence}
              />
            </label>
            <label className="block text-sm">
              Justificativa
              <textarea name="reason" required minLength={3} maxLength={1000} className={input} />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={!parties.length || !categories.length || !centers.length}
            >
              {busy ? "Salvando…" : "Salvar pedido em rascunho"}
            </Button>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
