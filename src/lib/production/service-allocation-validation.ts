import { createHash } from "node:crypto";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import { FinanceConflict, type FinanceBook } from "@/lib/financial/operations";
import type { ServiceAllocationCommand } from "@/lib/financial/service-allocations";
import type { ProductionBook } from "./model";
import { billingCompetence } from "./billing-queue";

export type ServiceAllocationOrigin = {
  recordId: string;
  cycleId: string;
  taskId: string;
  sourceFingerprint?: string;
};
export type ServiceAllocationOriginOptions = {
  titleId?: string;
  serviceId?: string;
  requireActive?: boolean;
  sourceFingerprint?: string;
};

/** Pins the contractual identity approved by the reviewer across the two independent books.
 * Execution updates live on the task, outside its immutable contractual obligation.
 */
export function serviceOccurrenceFingerprint(
  central: ProductionBook,
  origin: ServiceAllocationOrigin
): string | null {
  const records = central.records.filter((record) => record.id === origin.recordId);
  if (records.length !== 1) return null;
  const record = records[0];
  const cycles = record.cycles.filter((cycle) => cycle.id === origin.cycleId);
  if (cycles.length !== 1) return null;
  const cycle = cycles[0];
  const revision = record.revisions[cycle.revision];
  const tasks = cycle.tasks.filter((task) => task.obligation.id === origin.taskId);
  if (
    !revision ||
    tasks.length !== 1 ||
    !revision.terms.obligations.some((obligation) => obligation.id === origin.taskId)
  )
    return null;
  const obligation = Object.fromEntries(
    Object.entries(tasks[0].obligation).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
  const source = {
    recordId: record.id,
    companyId: record.companyId,
    cnpjNormalized: normalizeCnpj(record.cnpj),
    financeContractId: record.financeContractId,
    cycleId: cycle.id,
    period: cycle.period,
    revision: cycle.revision,
    revisionEffectiveOn: revision.effectiveOn,
    contractedCents: cycle.contractedCents,
    obligation,
  };
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

/** An allocation identifies a reviewed task; names and aggregate cycle values never infer it.
 * Read projections pass requireActive:false so a closed contract retains its valid history.
 * Both books are snapshots: callers must recheck these associations on every later read.
 */
export function serviceAllocationOriginIssues(
  central: ProductionBook,
  finance: FinanceBook,
  origin: ServiceAllocationOrigin,
  options: ServiceAllocationOriginOptions = {}
): string[] {
  const issues: string[] = [];
  const active = options.requireActive !== false;
  const records = central.records.filter((record) => record.id === origin.recordId);
  if (records.length !== 1)
    return ["Registro de produção não encontrado ou com identificador ambíguo."];
  const record = records[0];
  if (active && !record.active) issues.push("Reative o contrato antes de criar uma associação.");
  if (!record.formalizedAt?.trim())
    issues.push("Formalize o contrato antes de associar valores aos serviços.");
  const cycles = record.cycles.filter((cycle) => cycle.id === origin.cycleId);
  if (cycles.length !== 1)
    return [...issues, "Ciclo de produção não encontrado ou com identificador ambíguo."];
  const cycle = cycles[0];
  const revision = record.revisions[cycle.revision];
  if (!revision) issues.push("A revisão contratual do ciclo não foi encontrada.");
  const tasks = cycle.tasks.filter((task) => task.obligation.id === origin.taskId);
  if (
    tasks.length !== 1 ||
    !revision?.terms.obligations.some((obligation) => obligation.id === origin.taskId)
  )
    issues.push("Selecione uma tarefa existente do ciclo e da revisão contratual aplicável.");
  else if (tasks[0].status === "na")
    issues.push("Uma tarefa não aplicável não pode receber valores de um serviço executado.");

  const contracts = finance.contracts.filter(
    (contract) => contract.id === record.financeContractId
  );
  const flows = finance.contractFlows.filter(
    (flow) => flow.contractId === record.financeContractId
  );
  if (
    !record.financeContractId ||
    !isValidCnpj(record.cnpj) ||
    contracts.length !== 1 ||
    flows.length !== 1 ||
    (active && !contracts[0].active) ||
    normalizeCnpj(flows[0]?.customerDocument || "") !== normalizeCnpj(record.cnpj)
  )
    issues.push("Confira o contrato financeiro e o CNPJ correspondente ao registro de produção.");
  if (
    record.financeContractId &&
    central.records.some(
      (other) => other.id !== record.id && other.financeContractId === record.financeContractId
    )
  )
    issues.push("O contrato financeiro está associado a mais de um registro de produção.");

  // Free-form periods remain free-form. Never replace them with the current month.
  const competence = billingCompetence(cycle.period);
  if (options.titleId) {
    const titles = finance.titles.filter((title) => title.id === options.titleId);
    const title = titles.length === 1 ? titles[0] : undefined;
    if (
      !title ||
      title.kind !== "receivable" ||
      title.status !== "approved" ||
      title.contractId !== record.financeContractId
    )
      issues.push("O título deve estar aprovado e pertencer ao mesmo contrato financeiro.");
    else if (competence && title.competence !== competence)
      issues.push("A competência do título diverge do ciclo de produção.");
    const legacyUses = central.records.flatMap((other) =>
      other.cycles
        .filter((otherCycle) => otherCycle.financeTitleId === options.titleId)
        .map((otherCycle) => ({ recordId: other.id, cycleId: otherCycle.id }))
    );
    if (
      legacyUses.length > 1 ||
      legacyUses.some((use) => use.recordId !== origin.recordId || use.cycleId !== origin.cycleId)
    )
      issues.push(
        "O título integral já está vinculado a outro ciclo; preserve o vínculo existente."
      );
  }
  if (options.serviceId) {
    const services = finance.services.filter((service) => service.id === options.serviceId);
    const service = services.length === 1 ? services[0] : undefined;
    if (!service || service.voided || service.contractId !== record.financeContractId)
      issues.push("O serviço financeiro deve existir e pertencer ao mesmo contrato.");
    else if (competence && service.date.slice(0, 7) !== competence)
      issues.push("A competência do serviço financeiro diverge do ciclo de produção.");
  }
  const fingerprint = options.sourceFingerprint ?? origin.sourceFingerprint;
  if (fingerprint !== undefined && fingerprint !== serviceOccurrenceFingerprint(central, origin))
    issues.push(
      "A origem contratual do serviço mudou desde a conferência. Revise e refaça a associação à versão correta."
    );
  return issues;
}

/** Only the financial book is mutated. Removal remains possible after an external
 * association becomes stale, so administrators can correct it without inventing an origin.
 */
export function validateServiceAllocationCommand(
  central: ProductionBook,
  finance: FinanceBook,
  command: ServiceAllocationCommand
): void {
  if (central.version !== command.expectedCentralVersion)
    throw new FinanceConflict("A Central mudou. Atualize os serviços e revise a associação.");
  let issues: string[] = [];
  if (command.action === "allocateServiceTitle")
    issues = serviceAllocationOriginIssues(central, finance, command, { titleId: command.titleId });
  else if (command.action === "allocateServiceReceipt") {
    const allocations = finance.serviceBillingAllocations.filter(
      (allocation) => allocation.id === command.billingAllocationId && !allocation.voided
    );
    if (allocations.length !== 1)
      throw new FinanceConflict("Selecione uma alocação de faturamento existente e não anulada.");
    const allocation = allocations[0];
    issues = serviceAllocationOriginIssues(central, finance, allocation, {
      titleId: allocation.titleId,
    });
  } else if (command.action === "linkProductionService")
    issues = serviceAllocationOriginIssues(central, finance, command, {
      serviceId: command.serviceId,
    });
  else if (command.action === "voidServiceTitleAllocation") {
    if (
      finance.serviceBillingAllocations.filter(
        (allocation) => allocation.id === command.id && !allocation.voided
      ).length !== 1
    )
      throw new FinanceConflict("Alocação de faturamento não encontrada ou já anulada.");
  } else if (command.action === "voidServiceReceiptAllocation") {
    if (
      finance.serviceSettlementAllocations.filter(
        (allocation) => allocation.id === command.id && !allocation.voided
      ).length !== 1
    )
      throw new FinanceConflict("Alocação de recebimento não encontrada ou já anulada.");
  } else if (
    finance.serviceProductionLinks.filter((link) => link.serviceId === command.serviceId).length !==
    1
  )
    throw new FinanceConflict("Vínculo do serviço não encontrado ou com identificador ambíguo.");
  if (issues.length) throw new FinanceConflict(issues[0]);
}
