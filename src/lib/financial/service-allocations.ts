import { z } from "zod/v3";
import { FinanceConflict, settlementCash, sumCents, type FinanceBook } from "./operations";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
// Keep schema initialization independent from operations.ts (which imports these schemas).
const cents = z.number().int().min(0).max(100_000_000_000);
const note = z.string().trim().min(3).max(1000);
const sourceFingerprint = z.string().regex(/^[a-f0-9]{64}$/);

export const ServiceOccurrenceSchema = z.object({ recordId: id, cycleId: id, taskId: id }).strict();
export type ServiceOccurrence = z.infer<typeof ServiceOccurrenceSchema>;

export const ServiceBillingAllocationSchema = ServiceOccurrenceSchema.extend({
  id,
  titleId: id,
  sourceFingerprint,
  amountCents: cents.refine((value) => value > 0),
  evidence: note,
  voided: z.boolean(),
}).strict();
export type ServiceBillingAllocation = z.infer<typeof ServiceBillingAllocationSchema>;

const components = {
  principalCents: cents.refine((value) => value > 0),
  interestCents: cents,
  fineCents: cents,
  discountCents: cents,
  withholdingCents: cents,
};
const ComponentsSchema = z.object(components);
export const ServiceSettlementAllocationSchema = z
  .object({
    id,
    billingAllocationId: id,
    settlementId: id,
    ...components,
    evidence: note,
    voided: z.boolean(),
  })
  .strict();
export type ServiceSettlementAllocation = z.infer<typeof ServiceSettlementAllocationSchema>;

export const ServiceProductionLinkSchema = ServiceOccurrenceSchema.extend({
  serviceId: id,
  sourceFingerprint,
  evidence: note,
}).strict();
export type ServiceProductionLink = z.infer<typeof ServiceProductionLinkSchema>;

const common = {
  requestId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  expectedCentralVersion: z.number().int().nonnegative(),
  reviewed: z.literal(true),
  reason: note,
};
export const serviceAllocationCommands = [
  z
    .object({
      ...common,
      action: z.literal("allocateServiceTitle"),
      ...ServiceBillingAllocationSchema.omit({ voided: true }).shape,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("allocateServiceReceipt"),
      ...ServiceSettlementAllocationSchema.omit({ voided: true }).shape,
    })
    .strict(),
  z.object({ ...common, action: z.literal("voidServiceTitleAllocation"), id }).strict(),
  z.object({ ...common, action: z.literal("voidServiceReceiptAllocation"), id }).strict(),
  z
    .object({
      ...common,
      action: z.literal("linkProductionService"),
      ...ServiceProductionLinkSchema.shape,
    })
    .strict(),
  z.object({ ...common, action: z.literal("unlinkProductionService"), serviceId: id }).strict(),
] as const;
export type ServiceAllocationCommand = z.infer<(typeof serviceAllocationCommands)[number]>;

const actions = new Set<string>(
  serviceAllocationCommands.map((schema) => schema.shape.action.value)
);
export function isServiceAllocationCommand(command: {
  action: string;
}): command is ServiceAllocationCommand {
  return actions.has(command.action);
}

function fail(message: string): never {
  throw new FinanceConflict(message);
}
const componentKeys = [
  "principalCents",
  "interestCents",
  "fineCents",
  "discountCents",
  "withholdingCents",
] as const;
const componentLabels = {
  principalCents: "principal",
  interestCents: "juros",
  fineCents: "multa",
  discountCents: "desconto",
  withholdingCents: "retenção",
} as const;
const occurrenceKey = (row: ServiceOccurrence) =>
  JSON.stringify([row.recordId, row.cycleId, row.taskId]);
function uniqueIndex<T extends { id: string }>(rows: T[], label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    if (result.has(row.id))
      fail(`Identificador duplicado em ${label}. Confira a origem antes de alocar.`);
    result.set(row.id, row);
  }
  return result;
}
function find<T extends { id: string }>(rows: T[], key: string, label: string): T {
  const matches = rows.filter((row) => row.id === key);
  if (matches.length !== 1) fail(`${label} não encontrado ou com identificador duplicado.`);
  return matches[0];
}
function unlocked(book: FinanceBook, month: string) {
  if (book.periods.some((period) => period.month === month && period.closed))
    fail(
      `O período ${month} está fechado. Reabra com justificativa antes de alterar a distribuição.`
    );
}
function titleForChange(book: FinanceBook, titleId: string) {
  const title = find(book.titles, titleId, "Título");
  unlocked(book, title.competence);
  return title;
}
function add(totals: Map<string, number>, key: string, value: number) {
  totals.set(key, sumCents([totals.get(key) || 0, value]));
}

/** Validate the whole financial aggregate, including allocations in other contracts/cycles.
 * Central identity/CNPJ/occurrence validation is performed separately by the server.
 * No amount is inferred from a legacy cycle, a description or an Omie reservation.
 */
export function validateServiceAllocations(book: FinanceBook): void {
  const billingRows = book.serviceBillingAllocations || [];
  const receiptRows = book.serviceSettlementAllocations || [];
  const productionLinks = book.serviceProductionLinks || [];
  if (!billingRows.length && !receiptRows.length && !productionLinks.length) return;

  const titles = uniqueIndex(book.titles, "títulos");
  const settlements = uniqueIndex(book.settlements, "baixas");
  const services = uniqueIndex(book.services, "serviços financeiros");
  const contracts = uniqueIndex(book.contracts, "contratos");
  const billing = uniqueIndex(billingRows, "alocações de faturamento");
  uniqueIndex(receiptRows, "alocações de recebimento");
  const billedByTitle = new Map<string, number>();
  const cycleByTitle = new Map<string, string>();
  const principalByBilling = new Map<string, number>();
  const allocatedComponents = new Map<string, Map<string, number>>();
  const billingPairs = new Set<string>();
  const receiptPairs = new Set<string>();
  const linkedServices = new Set<string>();
  const occurrenceContracts = new Map<string, string>();
  const bindContract = (row: ServiceOccurrence, contractId: string) => {
    const key = occurrenceKey(row);
    const prior = occurrenceContracts.get(key);
    if (prior && prior !== contractId)
      fail("A mesma tarefa não pode receber valores de contratos financeiros diferentes.");
    occurrenceContracts.set(key, contractId);
  };

  for (const row of billingRows) {
    if (!ServiceBillingAllocationSchema.safeParse(row).success)
      fail("Alocação de faturamento inválida.");
    if (row.voided) continue;
    const title = titles.get(row.titleId);
    if (!title || title.kind !== "receivable" || title.status !== "approved")
      fail(
        "A alocação exige um título a receber aprovado. Desfaça a distribuição antes de cancelar ou alterar sua origem."
      );
    if (!title.contractId || !contracts.has(title.contractId))
      fail("O título precisa pertencer a um contrato financeiro existente.");
    const cycle = JSON.stringify([row.recordId, row.cycleId]);
    const priorCycle = cycleByTitle.get(row.titleId);
    if (priorCycle && priorCycle !== cycle)
      fail(
        "Distribua cada título entre serviços do mesmo ciclo para preservar a referência fiscal única."
      );
    cycleByTitle.set(row.titleId, cycle);
    const pair = JSON.stringify([row.titleId, row.recordId, row.cycleId, row.taskId]);
    if (billingPairs.has(pair)) fail("O título já possui uma alocação ativa para esta tarefa.");
    billingPairs.add(pair);
    bindContract(row, title.contractId);
    add(billedByTitle, title.id, row.amountCents);
  }
  for (const [titleId, amount] of billedByTitle) {
    const title = titles.get(titleId)!;
    if (!cents.safeParse(title.amountCents).success || title.amountCents <= 0)
      fail("Valor do título distribuído inválido.");
    if (amount > title.amountCents) fail("A distribuição dos serviços excede o valor do título.");
    const liveSettlements = book.settlements.filter(
      (row) => row.titleId === titleId && !row.reversed
    );
    for (const source of liveSettlements) {
      if (
        !ComponentsSchema.safeParse(source).success ||
        source.discountCents + source.withholdingCents > source.principalCents ||
        settlementCash(source) <= 0
      )
        fail("A baixa de origem possui componentes incompatíveis.");
    }
    const principal = sumCents(liveSettlements.map((row) => row.principalCents));
    if (principal > title.amountCents)
      fail("As baixas excedem o valor do título distribuído. Confira o financeiro.");
  }

  for (const row of receiptRows) {
    if (!ServiceSettlementAllocationSchema.safeParse(row).success)
      fail("Alocação de recebimento inválida.");
    if (row.voided) continue;
    const source = settlements.get(row.settlementId);
    const target = billing.get(row.billingAllocationId);
    if (!source || !target || source.titleId !== target.titleId)
      fail("A baixa e a alocação precisam pertencer ao mesmo título.");
    const pair = JSON.stringify([row.settlementId, row.billingAllocationId]);
    if (receiptPairs.has(pair)) fail("Esta baixa já possui uma alocação ativa para o serviço.");
    receiptPairs.add(pair);
    // A reversed source retains its original allocations for audit, but contributes nothing.
    if (source.reversed) continue;
    if (target.voided)
      fail("Anule as alocações de recebimento antes de anular o faturamento do serviço.");
    if (
      source.discountCents + source.withholdingCents > source.principalCents ||
      settlementCash(source) <= 0
    )
      fail("A baixa de origem possui componentes incompatíveis.");
    if (row.discountCents + row.withholdingCents > row.principalCents)
      fail("Desconto e retenção alocados não podem exceder o principal do serviço.");
    const totals = allocatedComponents.get(source.id) || new Map<string, number>();
    for (const key of componentKeys) {
      add(totals, key, row[key]);
      if (totals.get(key)! > source[key])
        fail(`A distribuição de ${componentLabels[key]} excede o componente da baixa.`);
    }
    allocatedComponents.set(source.id, totals);
    // Leaving more adjustments than principal unallocated would attribute money
    // that never entered the source settlement, even when each component fits.
    const principalCash = sumCents([
      totals.get("principalCents") || 0,
      -(totals.get("discountCents") || 0),
      -(totals.get("withholdingCents") || 0),
    ]);
    if (principalCash > source.principalCents - source.discountCents - source.withholdingCents)
      fail(
        "O dinheiro do principal alocado excede o recebido na baixa. Distribua também os descontos e retenções correspondentes."
      );
    add(principalByBilling, target.id, row.principalCents);
    if (principalByBilling.get(target.id)! > target.amountCents)
      fail("O principal recebido excede o faturamento alocado ao serviço.");
  }

  for (const link of productionLinks) {
    if (!ServiceProductionLinkSchema.safeParse(link).success)
      fail("Vínculo de custo declarado inválido.");
    if (linkedServices.has(link.serviceId))
      fail("Um serviço financeiro só pode estar vinculado a uma tarefa.");
    linkedServices.add(link.serviceId);
    const service = services.get(link.serviceId);
    if (!service || service.voided || !contracts.has(service.contractId))
      fail("Desvincule o custo antes de anular o serviço financeiro de origem.");
    if (
      !Number.isSafeInteger(service.quantity) ||
      service.quantity <= 0 ||
      !cents.safeParse(service.unitCostCents).success
    )
      fail("Quantidade ou custo declarado do serviço financeiro inválido.");
    sumCents([service.quantity * service.unitCostCents]);
    bindContract(link, service.contractId);
  }
}

/** Mutates only explicit attribution metadata, never titles, settlements or Omie exports.
 * applyFinanceCommand owns the clone, audit, idempotency and financial version.
 */
export function applyServiceAllocationCommand(
  book: FinanceBook,
  command: ServiceAllocationCommand
): void {
  book.serviceBillingAllocations ||= [];
  book.serviceSettlementAllocations ||= [];
  book.serviceProductionLinks ||= [];
  if (command.action === "allocateServiceTitle") {
    const title = titleForChange(book, command.titleId);
    if (title.kind !== "receivable" || title.status !== "approved")
      fail("Selecione um título a receber aprovado.");
    const previous = book.serviceBillingAllocations.find((row) => row.id === command.id);
    if (previous) {
      if (previous.voided) fail("Identificador de alocação anulado. Registre uma nova alocação.");
      if (
        previous.titleId !== command.titleId ||
        occurrenceKey(previous) !== occurrenceKey(command) ||
        previous.sourceFingerprint !== command.sourceFingerprint
      )
        fail("Para mudar a origem, anule a alocação e registre outra com novo identificador.");
      for (const row of book.serviceSettlementAllocations.filter(
        (row) => row.billingAllocationId === previous.id && !row.voided
      )) {
        const settlement = find(book.settlements, row.settlementId, "Baixa");
        if (!settlement.reversed) unlocked(book, settlement.date.slice(0, 7));
      }
      previous.amountCents = command.amountCents;
      previous.evidence = command.evidence;
    } else {
      book.serviceBillingAllocations.push(
        ServiceBillingAllocationSchema.strip().parse({ ...command, voided: false })
      );
    }
  } else if (command.action === "allocateServiceReceipt") {
    const billing = find(
      book.serviceBillingAllocations,
      command.billingAllocationId,
      "Alocação de faturamento"
    );
    if (billing.voided) fail("Alocação de faturamento anulada.");
    titleForChange(book, billing.titleId);
    const settlement = find(book.settlements, command.settlementId, "Baixa");
    unlocked(book, settlement.date.slice(0, 7));
    if (settlement.reversed) fail("Baixa estornada não pode receber novas alocações.");
    if (settlement.titleId !== billing.titleId)
      fail("A baixa e a alocação precisam pertencer ao mesmo título.");
    const previous = book.serviceSettlementAllocations.find((row) => row.id === command.id);
    if (previous) {
      if (previous.voided) fail("Identificador de alocação anulado. Registre uma nova alocação.");
      if (
        previous.billingAllocationId !== command.billingAllocationId ||
        previous.settlementId !== command.settlementId
      )
        fail("Para mudar a origem, anule a alocação e registre outra com novo identificador.");
      for (const key of componentKeys) previous[key] = command[key];
      previous.evidence = command.evidence;
    } else {
      book.serviceSettlementAllocations.push(
        ServiceSettlementAllocationSchema.strip().parse({ ...command, voided: false })
      );
    }
  } else if (command.action === "voidServiceTitleAllocation") {
    const row = find(book.serviceBillingAllocations, command.id, "Alocação de faturamento");
    if (row.voided) fail("Alocação já anulada.");
    titleForChange(book, row.titleId);
    row.voided = true;
  } else if (command.action === "voidServiceReceiptAllocation") {
    const row = find(book.serviceSettlementAllocations, command.id, "Alocação de recebimento");
    if (row.voided) fail("Alocação já anulada.");
    const settlement = find(book.settlements, row.settlementId, "Baixa");
    titleForChange(book, settlement.titleId);
    unlocked(book, settlement.date.slice(0, 7));
    row.voided = true;
  } else if (command.action === "linkProductionService") {
    const service = find(book.services, command.serviceId, "Serviço financeiro");
    unlocked(book, service.date.slice(0, 7));
    if (service.voided) fail("Serviço financeiro anulado.");
    const previous = book.serviceProductionLinks.find((row) => row.serviceId === command.serviceId);
    if (previous) {
      if (
        occurrenceKey(previous) !== occurrenceKey(command) ||
        previous.sourceFingerprint !== command.sourceFingerprint
      )
        fail(
          "Desvincule o serviço financeiro antes de associá-lo a outra tarefa ou versão de origem."
        );
      previous.evidence = command.evidence;
    } else {
      book.serviceProductionLinks.push(ServiceProductionLinkSchema.strip().parse(command));
    }
  } else {
    const index = book.serviceProductionLinks.findIndex(
      (row) => row.serviceId === command.serviceId
    );
    if (index < 0) fail("Vínculo de custo declarado não encontrado.");
    const service = find(book.services, command.serviceId, "Serviço financeiro");
    unlocked(book, service.date.slice(0, 7));
    book.serviceProductionLinks.splice(index, 1);
  }
  validateServiceAllocations(book);
}
