import type { FinanceBook } from "@/lib/financial/operations";
import { validateServiceAllocations } from "@/lib/financial/service-allocations";
import { ProductionError, type Command, type ProductionBook } from "./model";
import { serviceAllocationOriginIssues } from "./service-allocation-validation";
import { buildServiceReceiptsSnapshot } from "./service-receipts";

/** A Central edit cannot silently repurpose an occurrence already attributed in Finance.
 * Finance and Central have separate CAS versions; current associations are also checked on reads.
 */
export function guardServiceAssociations(
  before: ProductionBook,
  after: ProductionBook,
  finance: FinanceBook,
  command: Command
): void {
  const closing =
    (command.action === "active" && !command.active) ||
    (command.action === "card" && command.card.id === "receive" && command.card.status === "done");
  const billing = (finance.serviceBillingAllocations || []).filter(
    (allocation) => !allocation.voided
  );
  const links = finance.serviceProductionLinks || [];
  const relevant = [...billing, ...links].filter((source) => source.recordId === command.recordId);
  if (!billing.length && !links.length) return;
  const fail = (message: string): never => {
    throw new ProductionError(message, 409);
  };
  // Check all references because a legacy title newly reserved by this record can affect another cycle.
  for (const source of [...billing, ...links]) {
    const options =
      "titleId" in source
        ? { titleId: source.titleId, requireActive: false }
        : { serviceId: source.serviceId, requireActive: false };
    const previousIssues = new Set(serviceAllocationOriginIssues(before, finance, source, options));
    const nextIssues = serviceAllocationOriginIssues(after, finance, source, options);
    const introduced = nextIssues.find((issue) => !previousIssues.has(issue));
    if (introduced) fail(`Esta alteração invalidaria a distribuição por serviço: ${introduced}`);
    if (
      closing &&
      source.recordId === command.recordId &&
      (command.action !== "card" || source.cycleId === command.cycleId) &&
      nextIssues.length
    )
      fail(nextIssues[0]);
  }
  if (["replan", "revise"].includes(command.action)) {
    for (const source of relevant) {
      const oldCycle = before.records
        .find((record) => record.id === source.recordId)
        ?.cycles.find((cycle) => cycle.id === source.cycleId);
      const newCycle = after.records
        .find((record) => record.id === source.recordId)
        ?.cycles.find((cycle) => cycle.id === source.cycleId);
      const oldTask = oldCycle?.tasks.find((task) => task.obligation.id === source.taskId);
      const newTask = newCycle?.tasks.find((task) => task.obligation.id === source.taskId);
      if (
        oldCycle?.revision !== newCycle?.revision ||
        JSON.stringify(oldTask?.obligation) !== JSON.stringify(newTask?.obligation)
      )
        fail(
          "Há valores ou custos vinculados à tarefa. Resolva os vínculos antes de alterar sua revisão ou replanejar o serviço."
        );
    }
  }
  if (!closing || !relevant.length) return;
  try {
    validateServiceAllocations(finance);
  } catch (error) {
    fail(
      error instanceof Error ? error.message : "Revise a distribuição financeira antes de encerrar."
    );
  }
  const snapshot = buildServiceReceiptsSnapshot(after, finance, new Date().toISOString());
  const record = after.records.find((item) => item.id === command.recordId)!;
  const closingCycles =
    command.action === "card" ? [command.cycleId] : record.cycles.map((cycle) => cycle.id);
  for (const cycleId of closingCycles) {
    const rows = snapshot.items.filter(
      (item) =>
        item.recordId === record.id &&
        item.cycleId === cycleId &&
        item.billings.some((allocation) => !allocation.voided)
    );
    if (!rows.length) continue;
    if (rows.some((row) => row.financialStatus !== "settled" || row.issues.length))
      fail(
        "Os serviços deste ciclo têm saldo, distribuição ou conciliação pendente. Confira Serviços e recebimentos antes de encerrar."
      );
    const cycle = record.cycles.find((item) => item.id === cycleId)!;
    const amounts = rows.reduce(
      (sum, row) => ({
        billed: sum.billed + (row.billedCents || 0),
        received: sum.received + (row.receivedCents || 0),
        adjustments: sum.adjustments + (row.adjustmentCents || 0),
      }),
      { billed: 0, received: 0, adjustments: 0 }
    );
    if (
      amounts.billed !== cycle.invoicedCents ||
      amounts.received !== cycle.receivedCents ||
      amounts.adjustments !== cycle.adjustmentCents
    )
      fail(
        "Os valores distribuídos por serviço devem corresponder ao faturamento, recebimento e ajustes do ciclo antes do encerramento."
      );
  }
}
