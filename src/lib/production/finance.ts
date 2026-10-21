import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import { reconciliationIndex, settlementCash, type FinanceBook } from "@/lib/financial/operations";
import type { Cycle, ProductionRecord } from "./model";
import { billingCompetence } from "./billing-queue";

export type ReceiptSummary = {
  receivedCents: number;
  adjustmentCents: number;
  cashCents: number;
  settlementCount: number;
  unreconciledCount: number;
};
export const emptyReceipts = (): ReceiptSummary => ({
  receivedCents: 0,
  adjustmentCents: 0,
  cashCents: 0,
  settlementCount: 0,
  unreconciledCount: 0,
});

/** Reuse the ERP's account, date, signed cash and one-to-one matching rules.
 * Principal receipts exclude interest/fines; bank reconciliation includes them.
 * This is a read-only snapshot, never a bank import or automatic settlement.
 */
export function receiptIndex(book: FinanceBook): Map<string, ReceiptSummary> {
  const reconciled = reconciliationIndex(book).settlements;
  const result = new Map<string, ReceiptSummary>();
  for (const s of book.settlements) {
    if (s.reversed) continue;
    const summary = result.get(s.titleId) || emptyReceipts();
    summary.receivedCents += s.principalCents - s.discountCents - s.withholdingCents;
    summary.adjustmentCents += s.discountCents + s.withholdingCents;
    summary.cashCents += settlementCash(s);
    summary.settlementCount++;
    if (!reconciled.has(s.id)) summary.unreconciledCount++;
    result.set(s.titleId, summary);
  }
  return result;
}

/** Revalidate the customer when reading or closing, since ERP data may change after linking. */
export function matchesFinanceContract(
  record: Pick<ProductionRecord, "financeContractId" | "cnpj">,
  book: FinanceBook
): boolean {
  return Boolean(
    record.financeContractId &&
    isValidCnpj(record.cnpj) &&
    book.contracts.some(
      (contract) => contract.id === record.financeContractId && contract.active
    ) &&
    book.contractFlows.some(
      (flow) =>
        flow.contractId === record.financeContractId &&
        normalizeCnpj(flow.customerDocument) === normalizeCnpj(record.cnpj)
    )
  );
}

type FinancialCycle = Pick<
  Cycle,
  "id" | "period" | "financeTitleId" | "invoicedCents" | "receivedCents" | "adjustmentCents"
>;
export type CycleFinanceCheck = {
  cycleId: string;
  titleId: string;
  status: "unlinked" | "divergent" | "pending" | "reconciled";
  issues: string[];
  receipts: ReceiptSummary | null;
  outstandingCents: number | null;
};

export function checkCycleFinance(
  record: Pick<ProductionRecord, "financeContractId" | "cnpj">,
  cycle: FinancialCycle,
  book: FinanceBook,
  receipts = receiptIndex(book)
): CycleFinanceCheck {
  const result: CycleFinanceCheck = {
    cycleId: cycle.id,
    titleId: cycle.financeTitleId,
    status: "unlinked",
    issues: [],
    receipts: null,
    outstandingCents: null,
  };
  if (!cycle.financeTitleId) return result;
  if (!matchesFinanceContract(record, book))
    return {
      ...result,
      status: "divergent",
      issues: ["Confira o contrato financeiro ativo e o CNPJ correspondente no ERP."],
    };
  const title = book.titles.find((t) => t.id === cycle.financeTitleId);
  if (
    !record.financeContractId ||
    !title ||
    title.contractId !== record.financeContractId ||
    title.kind !== "receivable" ||
    title.status !== "approved"
  ) {
    return {
      ...result,
      status: "divergent",
      issues: ["Título deve ser aprovado e pertencer ao contrato financeiro vinculado."],
    };
  }
  const competence = billingCompetence(cycle.period);
  if (competence && competence !== title.competence)
    return {
      ...result,
      status: "divergent",
      issues: ["A competência do título vinculado diverge do período do ciclo."],
    };
  const summary = receipts.get(title.id) || emptyReceipts();
  result.receipts = summary;
  result.outstandingCents = title.amountCents - summary.receivedCents - summary.adjustmentCents;
  if (title.amountCents !== cycle.invoicedCents)
    result.issues.push("Valor faturado diverge do título aprovado no ERP.");
  if (
    cycle.receivedCents !== summary.receivedCents ||
    cycle.adjustmentCents !== summary.adjustmentCents
  )
    result.issues.push(
      "Recebimento e ajustes divergem das baixas não estornadas no ERP. Juros e multas permanecem no ERP, fora do principal deste ciclo."
    );
  if (result.outstandingCents < 0)
    result.issues.push("As baixas excedem o valor do título. Revise o ERP antes de encerrar.");
  if (result.issues.length) result.status = "divergent";
  else
    result.status =
      result.outstandingCents > 0 || summary.unreconciledCount > 0 ? "pending" : "reconciled";
  if (summary.unreconciledCount)
    result.issues.push(
      `${summary.unreconciledCount} baixa(s) sem conciliação bancária válida. Confira conta, data e valor no extrato do ERP antes de encerrar.`
    );
  return result;
}
