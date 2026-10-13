"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checklistLabels, contractFlowOverview, flowReady } from "@/lib/financial/contract-flow";
import type { FinanceBook } from "@/lib/financial/operations";
import type { FinanceForm } from "./operations-workspace";
const money = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const get = (f: FormData, key: string) => String(f.get(key) || "").trim();
const card = "rounded-2xl border border-slate-700 bg-slate-900 p-5";
const yesNo = [
  { value: "false", label: "Pendente" },
  { value: "true", label: "Conferido" },
];
type Props = {
  book: FinanceBook;
  period: string;
  today: string;
  busy: boolean;
  actor: string;
  showForm: (form: FinanceForm) => void;
  navigate: (tab: string) => void;
};
export function ContractFlowWorkspace({
  book,
  period,
  today,
  busy,
  actor,
  showForm,
  navigate,
}: Props) {
  const [selected, setSelected] = useState("");
  const rows = contractFlowOverview(book, period, today);
  const row = rows.find((r) => r.contract.id === selected) || rows[0];
  const availableOrders = book.erp.orders.filter(
    (o) =>
      o.kind === "sale" &&
      o.status === "approved" &&
      !o.titleId &&
      !book.contractFlows.some((f) => f.orderId === o.id)
  );
  function create() {
    showForm({
      title: "Criar contrato mensal a partir de proposta aprovada",
      description:
        "O pedido de venda representa o orçamento comercial. O valor aprovado será a mensalidade integral, sem pró-rata automático. Registre a referência do aceite do cliente. Esta ação não gera cobrança.",
      fields: [
        {
          name: "orderId",
          label: "Pedido aprovado / mensalidade",
          options: availableOrders.map((o) => ({
            value: o.id,
            label: `${o.number} · ${o.partyName} · ${money(o.totalCents)}/mês`,
          })),
        },
        {
          name: "monthlyPriceConfirmed",
          label: "Confirmação do preço mensal",
          value: "",
          options: [
            { value: "", label: "Selecione" },
            { value: "true", label: "Confirmo que o total aprovado é a mensalidade contratada" },
          ],
        },
        { name: "owner", label: "Responsável pela implantação" },
        { name: "acceptedOn", label: "Data do aceite do cliente", type: "date", value: today },
        { name: "implementationDue", label: "Prazo de implantação", type: "date", value: today },
        { name: "dueDay", label: "Dia de vencimento (1 a 28)", type: "number", value: "10" },
        {
          name: "billingRequiresReadiness",
          label: "Regra contratual de cobrança",
          value: "true",
          options: [
            { value: "true", label: "Cobrar somente após implantação conferida" },
            { value: "false", label: "Contrato permite mensalidade durante a implantação" },
          ],
        },
        {
          name: "acceptanceEvidence",
          label: "Referência do contrato/aceite e condições da cobrança",
          type: "textarea",
        },
      ],
      build: (f) => ({
        action: "contractFromOrder",
        orderId: get(f, "orderId"),
        monthlyPriceConfirmed: get(f, "monthlyPriceConfirmed") === "true",
        owner: get(f, "owner"),
        acceptedOn: get(f, "acceptedOn"),
        implementationDue: get(f, "implementationDue"),
        dueDay: Number(get(f, "dueDay")),
        billingRequiresReadiness: get(f, "billingRequiresReadiness") === "true",
        acceptanceEvidence: get(f, "acceptanceEvidence"),
      }),
    });
  }
  function enroll() {
    if (!row) return;
    showForm({
      title: "Incluir contrato existente no fluxo",
      description: `${row.contract.client} · ${row.contract.name} · ${money(row.contract.monthlyCents)}/mês · vencimento dia ${row.contract.dueDay}. Confirme o cliente e as condições já contratadas. O histórico permanece intacto. Não cria pedido, título ou nota fiscal. O checklist começa pendente.`,
      fields: [
        {
          name: "partyId",
          label: "Cliente correspondente ao contrato",
          value: "",
          options: [
            { value: "", label: "Selecione o cliente e confira o documento" },
            ...book.erp.parties
              .filter((p) => p.active && p.role !== "supplier" && p.document.trim())
              .map((p) => ({ value: p.id, label: `${p.name} · ${p.document}` })),
          ],
        },
        {
          name: "monthlyPriceConfirmed",
          label: "Conferência do contrato",
          value: "",
          options: [
            { value: "", label: "Selecione" },
            {
              value: "true",
              label: "Conferi o cliente, a mensalidade fixa e o vencimento exibidos",
            },
          ],
        },
        { name: "owner", label: "Responsável pela implantação" },
        { name: "acceptedOn", label: "Data original do aceite", type: "date" },
        { name: "acceptanceEvidence", label: "Referência do contrato/aceite", type: "textarea" },
        {
          name: "implementationDue",
          label: "Prazo para conferir implantação",
          type: "date",
          value: today,
        },
        {
          name: "billingStartMonth",
          label: "Primeira competência livre de cobranças (atual ou futura)",
          type: "month",
          value: period < today.slice(0, 7) ? today.slice(0, 7) : period,
        },
        {
          name: "billingRequiresReadiness",
          label: "Regra contratual de cobrança",
          value: "true",
          options: [
            { value: "true", label: "Cobrar somente após implantação conferida" },
            { value: "false", label: "Contrato permite mensalidade durante a implantação" },
          ],
        },
        {
          name: "existingBillingReviewed",
          label: "Conferência de cobranças no Omie e demais controles",
          value: "",
          options: [
            { value: "", label: "Selecione" },
            {
              value: "true",
              label: "Conferi: não há cobranças já emitidas a partir da competência escolhida",
            },
          ],
        },
        {
          name: "billingEvidence",
          label: "Evidência da conferência e última competência já cobrada",
          type: "textarea",
        },
      ],
      build: (f) => ({
        action: "enrollExistingContract",
        contractId: row.contract.id,
        partyId: get(f, "partyId"),
        owner: get(f, "owner"),
        acceptedOn: get(f, "acceptedOn"),
        acceptanceEvidence: get(f, "acceptanceEvidence"),
        implementationDue: get(f, "implementationDue"),
        billingStartMonth: get(f, "billingStartMonth"),
        billingRequiresReadiness: get(f, "billingRequiresReadiness") === "true",
        monthlyPriceConfirmed: get(f, "monthlyPriceConfirmed") === "true",
        existingBillingReviewed: get(f, "existingBillingReviewed") === "true",
        billingEvidence: get(f, "billingEvidence"),
      }),
    });
  }
  return (
    <section className="space-y-5" aria-label="Fluxo do contrato ao recebimento">
      <div className={card}>
        <h2 className="text-2xl font-semibold">Do orçamento ao recebimento</h2>
        <p className="mt-3 text-sm text-slate-300">
          Proposta → aprovação → implantação → operação → prévia de cobrança → recebimento. O fluxo
          usa os pedidos de venda e o controle financeiro do NAI.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => navigate("orders")}>Orçamentos e aprovação</Button>
          <Button disabled={busy || !availableOrders.length} onClick={create}>
            Criar contrato de pedido aprovado
          </Button>
          <Button variant="outline" onClick={() => navigate("services")}>
            Registrar produção SST
          </Button>
          <Button variant="outline" onClick={() => navigate("titles")}>
            Aprovar cobranças e registrar recebimentos
          </Button>
        </div>
        {!availableOrders.length && (
          <p className="mt-3 text-sm text-slate-400">
            Para iniciar, cadastre um pedido de venda e peça a aprovação a outro administrador
            financeiro. Use este fluxo para contratos de mensalidade fixa.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}>
          <p>Mensalidades prontas para prévia</p>
          <strong className="text-3xl">{rows.filter((r) => r.readyForMonthly).length}</strong>
        </div>
        <div className={card}>
          <p>Implantações em atraso</p>
          <strong className="text-3xl">
            {rows.filter((r) => r.contract.active && r.implementationLate).length}
          </strong>
        </div>
        <div className={card}>
          <p>Competência selecionada</p>
          <strong className="text-2xl">{period}</strong>
        </div>
      </div>
      {!rows.length ? (
        <p className={card}>
          Nenhum contrato cadastrado. Os dados existentes no Omie não são importados automaticamente
          para este controle.
        </p>
      ) : (
        <>
          <label className="block">
            Contrato
            <select
              className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3"
              value={row?.contract.id || ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {rows.map((r) => (
                <option key={r.contract.id} value={r.contract.id}>
                  {r.contract.client} · {r.contract.name}
                </option>
              ))}
            </select>
          </label>
          {row && (
            <>
              <article className={card}>
                <h3 className="text-xl font-semibold">
                  {row.contract.name} · {row.contract.client}
                </h3>
                <p className="mt-2">
                  Mensalidade {money(row.contract.monthlyCents)} · Vencimento dia{" "}
                  {row.contract.dueDay} · {row.contract.active ? "Ativo" : "Inativo"}
                </p>
                {row.flow ? (
                  <>
                    <p className="mt-3 text-sm">
                      {row.flow.migration
                        ? "Contrato existente incluído no fluxo"
                        : `Pedido ${book.erp.orders.find((o) => o.id === row.flow?.orderId)?.number}`}{" "}
                      · Responsável: {row.flow.owner} · Implantação até {row.flow.implementationDue}
                    </p>
                    <p className="mt-2 text-sm">
                      Documento do cliente: {row.flow.customerDocument || "não informado"}. Aceite
                      em {row.flow.acceptedOn}: {row.flow.acceptanceEvidence}
                    </p>
                    <p className="mt-2 text-sm">
                      {row.flow.billingRequiresReadiness
                        ? "Mensalidade depende da implantação conferida."
                        : "Mensalidade permitida durante a implantação, conforme aceite registrado."}
                    </p>
                    {row.flow.migration && (
                      <p className="mt-2 text-sm">
                        Primeira competência no fluxo: {row.flow.migration.billingStartMonth}.
                        Conferência de cobranças: {row.flow.migration.billingEvidence}
                      </p>
                    )}
                    <ul className="my-4 space-y-2 text-sm">
                      {Object.entries(checklistLabels).map(([key, label]) => (
                        <li key={key}>
                          {row.flow!.checklist[key as keyof typeof checklistLabels] ? "✓" : "○"}{" "}
                          {label}
                        </li>
                      ))}
                    </ul>
                    <Button
                      disabled={busy || !row.contract.active}
                      onClick={() =>
                        showForm({
                          title: "Conferir implantação",
                          description:
                            "Registre a conferência real de cada requisito e sua evidência. Pendências bloqueiam a operação e, conforme o contrato, a mensalidade.",
                          fields: [
                            ...Object.entries(checklistLabels).map(([key, label]) => ({
                              name: key,
                              label,
                              value: String(
                                row.flow!.checklist[key as keyof typeof checklistLabels]
                              ),
                              options: yesNo,
                            })),
                            {
                              name: "reason",
                              label: "Evidência e justificativa",
                              type: "textarea",
                            },
                          ],
                          build: (f) => ({
                            action: "flowChecklist",
                            contractId: row.contract.id,
                            checklist: Object.fromEntries(
                              Object.keys(checklistLabels).map((key) => [
                                key,
                                get(f, key) === "true",
                              ])
                            ),
                            reason: get(f, "reason"),
                          }),
                        })
                      }
                    >
                      Conferir implantação
                    </Button>
                  </>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-amber-300">
                      Contrato anterior ao fluxo integrado. Confira o contrato e as cobranças
                      existentes para incluí-lo com histórico preservado.
                    </p>
                    <Button disabled={busy || !row.contract.active} onClick={enroll}>
                      Incluir contrato existente no fluxo
                    </Button>
                  </div>
                )}
              </article>
              <article className={card}>
                <h3 className="text-xl font-semibold">Prévia de cobrança · {period}</h3>
                <p className="mt-3">
                  {row.blocked ||
                    (row.recurringExists
                      ? "Mensalidade já possui título nesta competência."
                      : row.contract.monthlyCents > 0
                        ? `Mensalidade disponível: ${money(row.contract.monthlyCents)}`
                        : "Contrato sem mensalidade.")}
                </p>
                <Button
                  className="mt-3"
                  disabled={busy || !row.readyForMonthly}
                  onClick={() =>
                    showForm({
                      title: "Gerar mensalidade em rascunho",
                      description: `${row.contract.client} · ${period} · ${money(row.contract.monthlyCents)}. Gera um título sujeito à aprovação financeira. Não emite nota nem envia cobrança ao cliente. Confira no Omie se esta competência já foi cobrada antes de continuar.`,
                      fields: [
                        {
                          name: "dueDate",
                          label: "Vencimento",
                          type: "date",
                          value:
                            row.flow &&
                            `${period}-${String(row.contract.dueDay).padStart(2, "0")}` <
                              row.flow.acceptedOn
                              ? row.flow.acceptedOn
                              : `${period}-${String(row.contract.dueDay).padStart(2, "0")}`,
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
                        contractId: row.contract.id,
                        month: period,
                        dueDate: String(f.get("dueDate") || ""),
                        ...(String(f.get("reason") || "").trim()
                          ? { reason: String(f.get("reason")).trim() }
                          : {}),
                      }),
                    })
                  }
                >
                  Gerar rascunho da mensalidade
                </Button>
                <p className="mt-3 text-sm text-slate-400">
                  A proteção de duplicidade usa contrato, competência e serviço no controle NAI.
                  Notas e recebimentos do Omie ainda exigem vínculo e conferência.
                </p>
                <div className="mt-4 space-y-4">
                  {row.services.map((s) => {
                    const reviewed = row.flow?.serviceReviews.some((r) => r.serviceId === s.id);
                    const author = book.audit.find(
                      (a) => a.id === s.id && a.action === "service"
                    )?.actor;
                    const canBill =
                      row.contract.active &&
                      s.billingMode === "separate" &&
                      !s.titleId &&
                      (!row.flow?.migration ||
                        s.date.slice(0, 7) >= row.flow.migration.billingStartMonth) &&
                      (!row.flow || (flowReady(row.flow) && reviewed));
                    return (
                      <div key={s.id} className="rounded-lg border border-slate-700 p-4">
                        <p>
                          {s.description} · {s.date} · {s.quantity} unidade(s) ·{" "}
                          {money(s.quantity * s.unitRevenueCents)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {s.billingMode === "included"
                            ? "Incluído na mensalidade"
                            : "Cobrança avulsa"}{" "}
                          ·{" "}
                          {s.titleId
                            ? "Título gerado"
                            : reviewed
                              ? "Serviço conferido"
                              : row.flow
                                ? "Aguardando conferência operacional"
                                : "Sem conferência do fluxo integrado"}
                        </p>
                        <p className="mt-1 text-sm">Evidência: {s.evidence}</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {row.flow && !reviewed && !s.titleId && (
                            <Button
                              disabled={
                                busy ||
                                !row.contract.active ||
                                !flowReady(row.flow) ||
                                author === actor ||
                                !author
                              }
                              onClick={() =>
                                showForm({
                                  title: "Conferir serviço realizado",
                                  description: `${s.description} · ${money(s.quantity * s.unitRevenueCents)}. Confirme a execução e a evidência. A revisão exige outra pessoa.`,
                                  fields: [
                                    {
                                      name: "evidence",
                                      label: "Evidência da conferência",
                                      type: "textarea",
                                    },
                                  ],
                                  build: (f) => ({
                                    action: "flowReviewService",
                                    contractId: row.contract.id,
                                    serviceId: s.id,
                                    evidence: get(f, "evidence"),
                                  }),
                                })
                              }
                            >
                              Conferir serviço
                            </Button>
                          )}
                          {s.billingMode === "separate" && !s.titleId && (
                            <Button
                              disabled={busy || !canBill || s.unitRevenueCents <= 0}
                              onClick={() =>
                                showForm({
                                  title: "Gerar cobrança avulsa em rascunho",
                                  description: `${s.description} · ${money(s.quantity * s.unitRevenueCents)}. Sujeita à aprovação financeira; não emite nota nem envia mensagem. Confira cobranças já existentes no Omie.`,
                                  fields: [
                                    {
                                      name: "dueDate",
                                      label: "Vencimento",
                                      type: "date",
                                      value: today,
                                    },
                                  ],
                                  build: (f) => ({
                                    action: "billService",
                                    id: s.id,
                                    dueDate: get(f, "dueDate"),
                                  }),
                                })
                              }
                            >
                              Gerar rascunho do serviço
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!row.services.length && (
                  <p className="mt-4 text-sm text-slate-400">
                    Nenhum serviço registrado nesta competência.
                  </p>
                )}
              </article>
              <article className={card}>
                <h3 className="text-xl font-semibold">Cobranças e recebimento · {period}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <p>
                    Títulos, incluindo rascunhos
                    <br />
                    <strong>{money(row.billed)}</strong>
                  </p>
                  <p>
                    Caixa registrado nas baixas
                    <br />
                    <strong>{money(row.received)}</strong>
                  </p>
                  <p>
                    Saldo dos títulos
                    <br />
                    <strong>{money(row.remaining)}</strong>
                  </p>
                </div>
                <p className="mt-4 text-sm text-slate-400">
                  Valores vinculados aos títulos desta competência, inclusive baixas em outros
                  meses. Não representam receita fiscal nem saldo bancário sincronizado com o Omie.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Descrição</th>
                        <th className="p-2">Valor</th>
                        <th className="p-2">Situação</th>
                        <th className="p-2">Vínculo Omie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.titles.map((t) => (
                        <tr key={t.id} className="border-t border-slate-700">
                          <td className="p-2">{t.description}</td>
                          <td className="p-2">{money(t.amountCents)}</td>
                          <td className="p-2">
                            {
                              {
                                draft: "Rascunho",
                                submitted: "Em aprovação",
                                approved: "Aprovado",
                                rejected: "Devolvido",
                                cancelled: "Cancelado",
                              }[t.status]
                            }
                          </td>
                          <td className="p-2">
                            {t.externalReference ||
                              (book.omieExports.some((e) => e.sourceId === t.id)
                                ? "Conferir no conector"
                                : "Não vinculado")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm">
                  Receita contratada e avulsa prevista: {money(row.expectedRevenue)} · Custos
                  operacionais registrados: {money(row.recordedCost)} · Diferença estimada:{" "}
                  {money(row.expectedRevenue - row.recordedCost)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Estimativa antes de impostos e despesas indiretas; custos registrados na produção
                  não equivalem a despesas efetivamente pagas.
                </p>
              </article>
            </>
          )}
        </>
      )}
    </section>
  );
}
