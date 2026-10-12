import { z } from "zod";
import { isCalendarDate } from "./omie-dre";
import type { FinanceBook } from "./operations";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const note = z.string().trim().min(3).max(1000);
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
  orderId: id,
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
    book.contracts.push({
      id: command.requestId,
      name: `Contrato · ${order.number}`,
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
  return book.contracts.map((contract) => {
    const flow = book.contractFlows.find((f) => f.contractId === contract.id);
    const services = book.services.filter(
      (s) => s.contractId === contract.id && s.date.startsWith(month)
    );
    const titles = book.titles.filter(
      (t) =>
        t.contractId === contract.id &&
        t.kind === "receivable" &&
        t.competence === month &&
        t.status !== "cancelled"
    );
    const settlements = book.settlements.filter(
      (s) => !s.reversed && titles.some((t) => t.id === s.titleId)
    );
    const principal = settlements.reduce((n, s) => n + s.principalCents, 0);
    const billed = titles.reduce((n, t) => n + t.amountCents, 0);
    const received = settlements.reduce(
      (n, s) =>
        n + s.principalCents + s.interestCents + s.fineCents - s.discountCents - s.withholdingCents,
      0
    );
    const blocked = !contract.active
      ? "Contrato inativo"
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
        contract.monthlyCents +
        services
          .filter((s) => s.billingMode === "separate")
          .reduce((n, s) => n + s.quantity * s.unitRevenueCents, 0),
    };
  });
}
