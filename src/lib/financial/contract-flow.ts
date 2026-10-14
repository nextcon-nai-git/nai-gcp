import { z } from "zod";
import { isCalendarDate } from "./omie-dre";
import type { FinanceBook } from "./operations";
import { financialLabel } from "./labels";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const note = z.string().trim().min(3).max(1000);
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const date = z.string().refine(isCalendarDate, "Data inválida.");
const common = { requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative() };
export const checklistLabels = {
  clientData: "Unidades e dados do cliente conferidos",
  scope: "Escopo e condições comerciais conferidos",
  network: "Equipe e rede de atendimento definidas",
  schedule: "Cronograma e responsáveis definidos",
} as const;
const Checklist = z
  .object({
    clientData: z.boolean(),
    scope: z.boolean(),
    network: z.boolean(),
    schedule: z.boolean(),
  })
  .strict();
export const ContractFlowSchema = z.object({
  contractId: id,
  orderId: id.nullable(),
  migration: z
    .object({
      partyId: id,
      billingStartMonth: month,
      billingEvidence: note,
      at: z.string(),
    })
    .optional(),
  customerDocument: z.string().max(30),
  owner: z.string().trim().min(1).max(180),
  acceptedOn: date,
  acceptanceEvidence: note,
  implementationDue: date,
  billingRequiresReadiness: z.boolean(),
  checklist: Checklist,
  createdBy: z.string(),
  serviceReviews: z
    .array(z.object({ serviceId: id, actor: z.string(), at: z.string(), evidence: note }))
    .max(20000),
});
export const flowCommands = [
  z
    .object({
      ...common,
      action: z.literal("enrollExistingContract"),
      contractId: id,
      partyId: id,
      owner: z.string().trim().min(1).max(180),
      acceptedOn: date,
      acceptanceEvidence: note,
      implementationDue: date,
      billingRequiresReadiness: z.boolean(),
      billingStartMonth: month,
      billingEvidence: note,
      existingBillingReviewed: z.literal(true),
      monthlyPriceConfirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("contractFromOrder"),
      orderId: id,
      owner: z.string().trim().min(1).max(180),
      acceptedOn: date,
      acceptanceEvidence: note,
      implementationDue: date,
      dueDay: z.number().int().min(1).max(28),
      billingRequiresReadiness: z.boolean(),
      monthlyPriceConfirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("flowChecklist"),
      contractId: id,
      checklist: Checklist,
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("flowReviewService"),
      contractId: id,
      serviceId: id,
      evidence: note,
    })
    .strict(),
] as const;
type FlowCommand = z.infer<(typeof flowCommands)[number]>;
export function flowReady(flow: z.infer<typeof ContractFlowSchema>) {
  return Object.values(flow.checklist).every(Boolean);
}
export function applyFlowCommand(
  book: FinanceBook,
  command: FlowCommand,
  actor: string,
  now: string,
  fail: (message: string) => never
) {
  if (command.action === "enrollExistingContract") {
    const contract =
      book.contracts.find((c) => c.id === command.contractId) || fail("Contrato não encontrado.");
    if (!contract.active) fail("Contrato inativo.");
    if (book.contractFlows.some((f) => f.contractId === contract.id))
      fail("Contrato já vinculado ao fluxo integrado.");
    const party = book.erp.parties.find((p) => p.id === command.partyId);
    if (!party?.active || party.role === "supplier" || !party.document.trim())
      fail("Selecione um cliente ativo com documento cadastrado.");
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(
      new Date(now)
    );
    if (command.acceptedOn > today || command.implementationDue < command.acceptedOn)
      fail("Confira a data do aceite e o prazo de implantação.");
    if (
      command.billingStartMonth < today.slice(0, 7) ||
      command.billingStartMonth < command.acceptedOn.slice(0, 7)
    )
      fail("A primeira competência deve ser o mês atual ou posterior ao aceite.");
    if (book.periods.some((p) => p.month === command.billingStartMonth && p.closed))
      fail("Primeira competência fechada.");
    if (
      book.titles.some(
        (t) =>
          t.contractId === contract.id &&
          t.kind === "receivable" &&
          t.status !== "cancelled" &&
          t.competence >= command.billingStartMonth
      )
    )
      fail(
        "Já existem cobranças a partir da primeira competência. Confira os títulos e selecione uma competência posterior."
      );
    if (
      book.services.some(
        (s) =>
          s.contractId === contract.id &&
          !s.voided &&
          s.billingMode === "separate" &&
          !s.titleId &&
          s.date.slice(0, 7) < command.billingStartMonth
      )
    )
      fail(
        "Existem serviços avulsos anteriores à entrada ainda sem cobrança. Confira e trate esses serviços antes de incluir o contrato."
      );
    book.contractFlows.push({
      contractId: contract.id,
      orderId: null,
      customerDocument: party.document,
      owner: command.owner,
      acceptedOn: command.acceptedOn,
      acceptanceEvidence: command.acceptanceEvidence,
      implementationDue: command.implementationDue,
      billingRequiresReadiness: command.billingRequiresReadiness,
      checklist: { clientData: false, scope: false, network: false, schedule: false },
      createdBy: actor,
      serviceReviews: [],
      migration: {
        partyId: party.id,
        billingStartMonth: command.billingStartMonth,
        billingEvidence: command.billingEvidence,
        at: now,
      },
    });
    return;
  }
  if (command.action === "contractFromOrder") {
    const order =
      book.erp.orders.find((o) => o.id === command.orderId) || fail("Pedido não encontrado.");
    if (order.kind !== "sale" || order.status !== "approved" || order.titleId)
      fail("Selecione um pedido de venda aprovado e sem título gerado.");
    if (book.contractFlows.some((f) => f.orderId === order.id))
      fail("Pedido já vinculado a um contrato.");
    if (book.periods.some((p) => p.month === order.competence && p.closed))
      fail("Competência do pedido fechada.");
    if (
      command.acceptedOn >
        new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(now)) ||
      command.implementationDue < command.acceptedOn
    )
      fail("Confira a data do aceite e o prazo de implantação.");
    if (
      !book.erp.parties.find((p) => p.id === order.partyId)?.active ||
      !book.erp.categories.find((p) => p.id === order.categoryId)?.active ||
      !book.erp.centers.find((p) => p.id === order.centerId)?.active
    )
      fail("Os cadastros do pedido precisam estar ativos.");
    const party = book.erp.parties.find((p) => p.id === order.partyId)!;
    if (party.role === "supplier" || !party.document.replace(/[^a-z0-9]/gi, ""))
      fail("Confira o documento e o perfil do cliente antes de criar o contrato.");
    book.contracts.push({
      id: command.requestId,
      name: financialLabel(`Contrato · ${order.number}`),
      client: order.partyName,
      center: order.centerName,
      monthlyCents: order.totalCents,
      dueDay: command.dueDay,
      active: true,
    });
    book.contractFlows.push({
      contractId: command.requestId,
      orderId: order.id,
      customerDocument: book.erp.parties.find((p) => p.id === order.partyId)!.document,
      owner: command.owner,
      acceptedOn: command.acceptedOn,
      acceptanceEvidence: command.acceptanceEvidence,
      implementationDue: command.implementationDue,
      billingRequiresReadiness: command.billingRequiresReadiness,
      checklist: { clientData: false, scope: false, network: false, schedule: false },
      createdBy: actor,
      serviceReviews: [],
    });
    return;
  }
  const flow =
    book.contractFlows.find((f) => f.contractId === command.contractId) ||
    fail("Contrato fora do fluxo integrado.");
  if (!book.contracts.find((c) => c.id === command.contractId)?.active) fail("Contrato inativo.");
  if (command.action === "flowChecklist") {
    flow.checklist = command.checklist;
  } else {
    const service =
      book.services.find((s) => s.id === command.serviceId && s.contractId === flow.contractId) ||
      fail("Serviço não pertence ao contrato.");
    if (service.voided) fail("Serviço anulado não pode ser conferido.");
    if (!flowReady(flow)) fail("Conclua a implantação antes da conferência operacional.");
    if (service.titleId || flow.serviceReviews.some((r) => r.serviceId === service.id))
      fail("Serviço já conferido ou faturado.");
    if (book.periods.some((p) => p.month === service.date.slice(0, 7) && p.closed))
      fail("Competência do serviço fechada.");
    const author = book.audit.find((a) => a.id === service.id && a.action === "service")?.actor;
    if (!author || author === actor)
      fail("A conferência exige outro administrador, diferente de quem registrou o serviço.");
    flow.serviceReviews.push({ serviceId: service.id, actor, at: now, evidence: command.evidence });
  }
}
export function contractFlowOverview(book: FinanceBook, month: string, today: string) {
  const flows = new Map(book.contractFlows.map((f) => [f.contractId, f]));
  const servicesByContract = new Map<string, FinanceBook["services"]>();
  const titlesByContract = new Map<string, FinanceBook["titles"]>();
  const titleContracts = new Map<string, string>();
  for (const service of book.services) {
    if (!service.voided && service.date.startsWith(month)) {
      const rows = servicesByContract.get(service.contractId) || [];
      rows.push(service);
      servicesByContract.set(service.contractId, rows);
    }
  }
  for (const title of book.titles) {
    if (
      title.contractId &&
      title.kind === "receivable" &&
      title.competence === month &&
      title.status !== "cancelled"
    ) {
      const rows = titlesByContract.get(title.contractId) || [];
      rows.push(title);
      titlesByContract.set(title.contractId, rows);
      titleContracts.set(title.id, title.contractId);
    }
  }
  const settlements = new Map<string, { principal: number; cash: number }>();
  for (const settlement of book.settlements) {
    const contractId = titleContracts.get(settlement.titleId);
    if (settlement.reversed || !contractId) continue;
    const total = settlements.get(contractId) || { principal: 0, cash: 0 };
    total.principal += settlement.principalCents;
    total.cash +=
      settlement.principalCents +
      settlement.interestCents +
      settlement.fineCents -
      settlement.discountCents -
      settlement.withholdingCents;
    settlements.set(contractId, total);
  }
  return book.contracts.map((contract) => {
    const flow = flows.get(contract.id);
    const services = servicesByContract.get(contract.id) || [];
    const titles = titlesByContract.get(contract.id) || [];
    const principal = settlements.get(contract.id)?.principal || 0;
    const billed = titles.reduce((n, t) => n + t.amountCents, 0);
    const received = settlements.get(contract.id)?.cash || 0;
    const monthEligible =
      !flow ||
      (month >= flow.acceptedOn.slice(0, 7) &&
        (!flow.migration || month >= flow.migration.billingStartMonth));
    const blocked = !contract.active
      ? "Contrato inativo"
      : flow?.migration && month < flow.migration.billingStartMonth
        ? "Competência anterior à entrada no fluxo"
        : flow && month < flow.acceptedOn.slice(0, 7)
          ? "Competência anterior ao aceite"
          : flow && flow.billingRequiresReadiness && !flowReady(flow)
            ? "Implantação pendente"
            : "";
    const recurringExists = titles.some((t) => t.sourceKey === `recurring:${contract.id}:${month}`);
    return {
      contract,
      flow,
      services,
      titles,
      blocked,
      recurringExists,
      readyForMonthly: !blocked && contract.monthlyCents > 0 && !recurringExists,
      implementationLate: Boolean(flow && !flowReady(flow) && flow.implementationDue < today),
      billed,
      received,
      remaining: billed - principal,
      // Costs are operational estimates recorded per service, not actual paid expenses.
      recordedCost: services.reduce((n, s) => n + s.quantity * s.unitCostCents, 0),
      expectedRevenue:
        (contract.active && monthEligible ? contract.monthlyCents : 0) +
        services
          .filter((s) => s.billingMode === "separate")
          .reduce((n, s) => n + s.quantity * s.unitRevenueCents, 0),
    };
  });
}
