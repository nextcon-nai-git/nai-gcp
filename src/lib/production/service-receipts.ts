import { reconciliationIndex, sumCents, type FinanceBook } from "@/lib/financial/operations";
import {
  validateServiceAllocations,
  type ServiceBillingAllocation,
} from "@/lib/financial/service-allocations";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import type { ProductionBook } from "./model";
import {
  serviceAllocationOriginIssues,
  serviceOccurrenceFingerprint,
} from "./service-allocation-validation";

export type ReceiptComponents = {
  principalCents: number;
  interestCents: number;
  fineCents: number;
  discountCents: number;
  withholdingCents: number;
};
export type ServiceReceipt = ReceiptComponents & {
  id: string;
  settlementId: string;
  date: string;
  evidence: string;
  voided: boolean;
  reversed: boolean;
  reconciled: boolean;
};
export type ServiceBilling = {
  id: string;
  titleId: string;
  description: string;
  amountCents: number;
  outstandingCents: number;
  evidence: string;
  voided: boolean;
  receipts: ServiceReceipt[];
  issues: string[];
};
export type ServiceRecoveryOrigin = {
  recordId: string;
  cycleId: string;
  taskId: string;
  companyName: string;
  contractName: string;
  cycleName: string;
  period: string;
};
export type ProductionServiceCandidate = {
  id: string;
  contractId: string;
  date: string;
  description: string;
  supplier: string;
  city: string;
  quantity: number;
  costCents: number;
  billingMode: "separate" | "included";
  linked: boolean;
};
export type ServiceReceiptItem = {
  key: string;
  recordId: string;
  cycleId: string;
  taskId: string;
  sourceFingerprint: string;
  companyName: string;
  cnpj: string;
  contractName: string;
  financeContractId: string;
  cycleName: string;
  period: string;
  serviceType: string;
  title: string;
  owner: string;
  due: string;
  operationalStatus: "todo" | "doing" | "blocked" | "done" | "na";
  documentationStatus: "pending" | "reviewed" | "not_applicable";
  evidence: string;
  sourceReference: string;
  deliveryEvidence: string;
  revision: number;
  legacyCycleFinance: boolean;
  issues: string[];
  financialStatus: "unallocated" | "open" | "partial" | "settled" | "unreconciled" | "review";
  billedCents: number | null;
  principalSettledCents: number | null;
  receivedCents: number | null;
  adjustmentCents: number | null;
  cashCents: number | null;
  reconciledCashCents: number | null;
  outstandingCents: number | null;
  costCents: number | null;
  unallocatedReceiptCount: number;
  unreconciledCount: number;
  billings: ServiceBilling[];
  services: ProductionServiceCandidate[];
};
export type ServiceTitleCandidate = {
  id: string;
  contractId: string;
  description: string;
  party: string;
  competence: string;
  dueDate: string;
  amountCents: number;
  availableCents: number;
  externalReference: string;
};
export type ServiceSettlementCandidate = ReceiptComponents & {
  id: string;
  titleId: string;
  date: string;
  reconciled: boolean;
  available: ReceiptComponents;
};
export type ServiceReceiptsSnapshot = {
  centralVersion: number;
  financeVersion: number;
  generatedAt: string;
  items: ServiceReceiptItem[];
  titles: ServiceTitleCandidate[];
  settlements: ServiceSettlementCandidate[];
  services: ProductionServiceCandidate[];
  issues: string[];
  recovery: {
    billings: Array<ServiceBilling & ServiceRecoveryOrigin>;
    services: Array<
      ServiceRecoveryOrigin & {
        serviceId: string;
        description: string;
        evidence: string;
        issues: string[];
      }
    >;
  };
  summary: {
    count: number;
    unallocatedCount: number;
    reviewCount: number;
    billedCents: number;
    receivedCents: number;
    outstandingCents: number;
    costCents: number;
    withoutTasksCount: number;
  };
};

const components = [
  "principalCents",
  "interestCents",
  "fineCents",
  "discountCents",
  "withholdingCents",
] as const;
const occurrenceKey = (source: { recordId: string; cycleId: string; taskId: string }) =>
  `${source.recordId}/${source.cycleId}/${source.taskId}`;
const emptyComponents = (): ReceiptComponents => ({
  principalCents: 0,
  interestCents: 0,
  fineCents: 0,
  discountCents: 0,
  withholdingCents: 0,
});
const total = <T>(items: T[], select: (item: T) => number) => sumCents(items.map(select));
function indexMany<T>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const group = result.get(id) || [];
    group.push(item);
    result.set(id, group);
  }
  return result;
}

// The projection joins current facts; historical cycle totals are never distributed implicitly.
export function buildServiceReceiptsSnapshot(
  central: ProductionBook,
  finance: FinanceBook,
  generatedAt: string
): ServiceReceiptsSnapshot {
  const billingAllocations = finance.serviceBillingAllocations || [];
  const receiptAllocations = finance.serviceSettlementAllocations || [];
  const serviceLinks = finance.serviceProductionLinks || [];
  const billingsBySource = indexMany(billingAllocations, occurrenceKey);
  const receiptsByBilling = indexMany(
    receiptAllocations,
    (allocation) => allocation.billingAllocationId
  );
  const linksBySource = indexMany(serviceLinks, occurrenceKey);
  const titles = new Map(finance.titles.map((title) => [title.id, title]));
  const settlements = new Map(finance.settlements.map((settlement) => [settlement.id, settlement]));
  const reconciled = reconciliationIndex(finance).settlements;
  const issues: string[] = [];
  let invalidFinance = false;
  try {
    validateServiceAllocations(finance);
  } catch (error) {
    invalidFinance = true;
    issues.push(
      error instanceof Error ? error.message : "Revise a distribuição financeira dos serviços."
    );
  }
  const projectBilling = (allocation: ServiceBillingAllocation): ServiceBilling => {
    const title = titles.get(allocation.titleId);
    const allocationIssues = allocation.voided
      ? []
      : serviceAllocationOriginIssues(central, finance, allocation, {
          titleId: allocation.titleId,
          requireActive: false,
          sourceFingerprint: allocation.sourceFingerprint,
        });
    const receipts: ServiceReceipt[] = (receiptsByBilling.get(allocation.id) || []).map(
      (receipt) => {
        const settlement = settlements.get(receipt.settlementId);
        return {
          id: receipt.id,
          settlementId: receipt.settlementId,
          principalCents: receipt.principalCents,
          interestCents: receipt.interestCents,
          fineCents: receipt.fineCents,
          discountCents: receipt.discountCents,
          withholdingCents: receipt.withholdingCents,
          date: settlement?.date || "",
          evidence: receipt.evidence,
          voided: receipt.voided,
          reversed: !settlement || settlement.reversed,
          reconciled: Boolean(settlement && !settlement.reversed && reconciled.has(settlement.id)),
        };
      }
    );
    const activeReceipts = receipts.filter((receipt) => !receipt.voided && !receipt.reversed);
    return {
      id: allocation.id,
      titleId: allocation.titleId,
      description: title?.description || "Título indisponível",
      amountCents: allocation.amountCents,
      outstandingCents:
        allocation.amountCents - total(activeReceipts, (receipt) => receipt.principalCents),
      evidence: allocation.evidence,
      voided: allocation.voided,
      receipts,
      issues: allocationIssues,
    };
  };

  const allowedContracts = new Set(
    central.records
      .filter(
        (record) =>
          isValidCnpj(record.cnpj) &&
          finance.contracts.some((contract) => contract.id === record.financeContractId) &&
          finance.contractFlows.some(
            (flow) =>
              flow.contractId === record.financeContractId &&
              normalizeCnpj(flow.customerDocument) === normalizeCnpj(record.cnpj)
          )
      )
      .map((record) => record.financeContractId)
  );
  const linkedServiceIds = new Set(serviceLinks.map((link) => link.serviceId));
  const serviceCandidates: ProductionServiceCandidate[] = finance.services
    .filter((service) => !service.voided && allowedContracts.has(service.contractId))
    .map((service) => ({
      id: service.id,
      contractId: service.contractId,
      date: service.date,
      description: service.description,
      supplier: service.supplier,
      city: service.city,
      quantity: service.quantity,
      costCents: sumCents([service.quantity * service.unitCostCents]),
      billingMode: service.billingMode,
      linked: linkedServiceIds.has(service.id),
    }));
  const serviceCandidatesById = new Map(serviceCandidates.map((service) => [service.id, service]));
  const billedByTitle = indexMany(
    billingAllocations.filter((allocation) => !allocation.voided),
    (allocation) => allocation.titleId
  );
  const receiptsBySettlement = indexMany(
    receiptAllocations.filter((allocation) => !allocation.voided),
    (allocation) => allocation.settlementId
  );
  const titleCandidates: ServiceTitleCandidate[] = invalidFinance
    ? []
    : finance.titles
        .filter(
          (title) =>
            title.kind === "receivable" &&
            title.status === "approved" &&
            title.contractId &&
            allowedContracts.has(title.contractId)
        )
        .map((title) => ({
          id: title.id,
          contractId: title.contractId!,
          description: title.description,
          party: title.party,
          competence: title.competence,
          dueDate: title.dueDate,
          amountCents: title.amountCents,
          availableCents:
            title.amountCents -
            total(billedByTitle.get(title.id) || [], (allocation) => allocation.amountCents),
          externalReference: title.externalReference,
        }));
  const allowedTitles = new Set(titleCandidates.map((title) => title.id));
  const settlementCandidates: ServiceSettlementCandidate[] = finance.settlements
    .filter((settlement) => !settlement.reversed && allowedTitles.has(settlement.titleId))
    .map((settlement) => {
      const allocated = receiptsBySettlement.get(settlement.id) || [];
      const available = emptyComponents();
      for (const component of components)
        available[component] =
          settlement[component] - total(allocated, (allocation) => allocation[component]);
      return {
        id: settlement.id,
        titleId: settlement.titleId,
        date: settlement.date,
        principalCents: settlement.principalCents,
        interestCents: settlement.interestCents,
        fineCents: settlement.fineCents,
        discountCents: settlement.discountCents,
        withholdingCents: settlement.withholdingCents,
        reconciled: reconciled.has(settlement.id),
        available,
      };
    });
  const settlementCandidatesByTitle = indexMany(
    settlementCandidates,
    (settlement) => settlement.titleId
  );
  const items: ServiceReceiptItem[] = [];
  let withoutTasksCount = 0;
  for (const record of central.records) {
    for (const cycle of record.cycles) {
      if (!cycle.tasks.length) withoutTasksCount++;
      for (const task of cycle.tasks) {
        const origin = { recordId: record.id, cycleId: cycle.id, taskId: task.obligation.id };
        const key = occurrenceKey(origin);
        const rowIssues: string[] = [];
        const sourceBillings = billingsBySource.get(key) || [];
        const activeBillings = sourceBillings.filter((allocation) => !allocation.voided);
        let validMoney = !invalidFinance;
        const billings = sourceBillings.map(projectBilling);
        for (const billing of billings) {
          if (billing.issues.length) validMoney = false;
          rowIssues.push(...billing.issues);
        }
        if (invalidFinance && activeBillings.length) rowIssues.push(...issues);
        const validBills = billings.filter((allocation) => !allocation.voided);
        const activeReceipts = validBills
          .flatMap((billing) => billing.receipts)
          .filter((receipt) => !receipt.voided && !receipt.reversed);
        const hasAmounts = activeBillings.length > 0 && validMoney;
        const principal = hasAmounts
          ? total(activeReceipts, (receipt) => receipt.principalCents)
          : null;
        const adjustments = hasAmounts
          ? total(activeReceipts, (receipt) => receipt.discountCents + receipt.withholdingCents)
          : null;
        const billed = hasAmounts
          ? total(activeBillings, (allocation) => allocation.amountCents)
          : null;
        const received =
          principal === null || adjustments === null ? null : principal - adjustments;
        const cash =
          received === null
            ? null
            : received +
              total(activeReceipts, (receipt) => receipt.interestCents + receipt.fineCents);
        const outstanding = billed === null || principal === null ? null : billed - principal;
        const unreconciledCount = new Set(
          activeReceipts
            .filter((receipt) => !receipt.reconciled)
            .map((receipt) => receipt.settlementId)
        ).size;
        const linkedTitles = new Set(activeBillings.map((allocation) => allocation.titleId));
        const unallocatedReceiptCount = [...linkedTitles]
          .flatMap((titleId) => settlementCandidatesByTitle.get(titleId) || [])
          .filter((settlement) =>
            components.some((component) => settlement.available[component] > 0)
          ).length;
        if (unallocatedReceiptCount && outstanding !== null && outstanding > 0)
          rowIssues.push(
            "Há baixas do título ainda sem distribuição completa por serviço. Confira antes de cobrar este saldo."
          );

        const links = linksBySource.get(key) || [];
        const linkedServices: ProductionServiceCandidate[] = [];
        let validCosts = !invalidFinance;
        for (const link of links) {
          const linkIssues = serviceAllocationOriginIssues(central, finance, origin, {
            serviceId: link.serviceId,
            requireActive: false,
            sourceFingerprint: link.sourceFingerprint,
          });
          rowIssues.push(...linkIssues);
          if (linkIssues.length) validCosts = false;
          const service = serviceCandidatesById.get(link.serviceId);
          if (service) linkedServices.push(service);
          else validCosts = false;
        }
        let financialStatus: ServiceReceiptItem["financialStatus"] = "unallocated";
        if (activeBillings.length) {
          financialStatus = !validMoney
            ? "review"
            : unallocatedReceiptCount && outstanding! > 0
              ? "review"
              : outstanding === 0
                ? unreconciledCount
                  ? "unreconciled"
                  : "settled"
                : principal! > 0
                  ? "partial"
                  : "open";
        }
        const delivery = cycle.cards.find((card) => card.id === "deliver");
        items.push({
          key,
          ...origin,
          sourceFingerprint: serviceOccurrenceFingerprint(central, origin) || "",
          companyName: record.companyName,
          cnpj: record.cnpj,
          contractName: record.name,
          financeContractId: record.financeContractId,
          cycleName: cycle.service,
          period: cycle.period,
          serviceType: task.obligation.serviceType,
          title: task.obligation.title,
          owner: task.owner,
          due: task.due,
          operationalStatus: task.status,
          documentationStatus:
            task.status === "na"
              ? "not_applicable"
              : task.checks[2] && task.evidence.trim()
                ? "reviewed"
                : "pending",
          evidence: task.evidence,
          sourceReference: task.obligation.sourceReference,
          deliveryEvidence: delivery?.status === "done" ? delivery.evidence : "",
          revision: cycle.revision,
          legacyCycleFinance: Boolean(
            cycle.financeTitleId || cycle.invoicedCents || cycle.receivedCents
          ),
          issues: [...new Set(rowIssues)],
          financialStatus,
          billedCents: billed,
          principalSettledCents: principal,
          receivedCents: received,
          adjustmentCents: adjustments,
          cashCents: cash,
          reconciledCashCents: hasAmounts
            ? total(
                activeReceipts.filter((receipt) => receipt.reconciled),
                (receipt) =>
                  receipt.principalCents -
                  receipt.discountCents -
                  receipt.withholdingCents +
                  receipt.interestCents +
                  receipt.fineCents
              )
            : null,
          outstandingCents: outstanding,
          costCents:
            links.length && validCosts
              ? total(linkedServices, (service) => service.costCents)
              : null,
          unallocatedReceiptCount,
          unreconciledCount,
          billings,
          services: linkedServices,
        });
      }
    }
  }
  const itemsBySource = new Map(items.map((item) => [item.key, item]));
  const recoveryOrigin = (source: {
    recordId: string;
    cycleId: string;
    taskId: string;
  }): ServiceRecoveryOrigin => {
    const record = central.records.find((candidate) => candidate.id === source.recordId);
    const cycle = record?.cycles.find((candidate) => candidate.id === source.cycleId);
    return {
      recordId: source.recordId,
      cycleId: source.cycleId,
      taskId: source.taskId,
      companyName: record?.companyName || "Cliente de origem indisponível",
      contractName: record?.name || "Contrato de origem indisponível",
      cycleName: cycle?.service || "Ciclo de origem indisponível",
      period: cycle?.period || "Período de origem indisponível",
    };
  };
  // Recovery rows retain identifiers and child receipts, but never contribute to totals.
  // An obsolete cost link may still have a task while its source is outside the allowed scope.
  const recovery: ServiceReceiptsSnapshot["recovery"] = {
    billings: billingAllocations
      .filter((allocation) => !allocation.voided && !itemsBySource.has(occurrenceKey(allocation)))
      .map((allocation) => {
        const billing = projectBilling(allocation);
        return {
          ...billing,
          ...recoveryOrigin(allocation),
          issues: [...new Set([...billing.issues, ...(invalidFinance ? issues : [])])],
        };
      }),
    services: serviceLinks
      .filter((link) => {
        const item = itemsBySource.get(occurrenceKey(link));
        return !item || !item.services.some((service) => service.id === link.serviceId);
      })
      .map((link) => {
        const service = finance.services.find((candidate) => candidate.id === link.serviceId);
        return {
          ...recoveryOrigin(link),
          serviceId: link.serviceId,
          description: service?.description || "Serviço financeiro de origem indisponível",
          evidence: link.evidence,
          issues: [
            ...new Set([
              ...serviceAllocationOriginIssues(central, finance, link, {
                serviceId: link.serviceId,
                requireActive: false,
                sourceFingerprint: link.sourceFingerprint,
              }),
              ...(invalidFinance ? issues : []),
            ]),
          ],
        };
      }),
  };
  const orphanCount =
    recovery.billings.length +
    serviceLinks.filter((link) => !itemsBySource.has(occurrenceKey(link))).length;
  if (orphanCount)
    issues.push(
      `${orphanCount} vínculo(s) sem tarefa de origem disponível. Revise as associações antes de encerrar o contrato.`
    );
  return {
    centralVersion: central.version,
    financeVersion: finance.version,
    generatedAt,
    items,
    titles: titleCandidates,
    settlements: settlementCandidates,
    services: serviceCandidates,
    issues,
    recovery,
    summary: {
      count: items.length,
      unallocatedCount: items.filter((item) => item.billedCents === null).length,
      reviewCount: items.filter(
        (item) => item.issues.length || item.financialStatus === "unreconciled"
      ).length,
      billedCents: total(items, (item) => item.billedCents || 0),
      receivedCents: total(items, (item) => item.receivedCents || 0),
      outstandingCents: total(items, (item) => item.outstandingCents || 0),
      costCents: total(items, (item) => item.costCents || 0),
      withoutTasksCount,
    },
  };
}
