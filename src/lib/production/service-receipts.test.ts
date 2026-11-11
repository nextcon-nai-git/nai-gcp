import { describe, expect, it } from "vitest";
import { ContractCommercialTermsSchema } from "@/lib/financial/contract-flow";
import { emptyFinanceBook } from "@/lib/financial/operations";
import { applyCommand, CommandSchema, emptyBook } from "./model";
import { buildServiceReceiptsSnapshot } from "./service-receipts";
import { serviceOccurrenceFingerprint } from "./service-allocation-validation";

const now = "2026-11-11T18:00:00Z";
function fixture() {
  const central = applyCommand(
    emptyBook(),
    CommandSchema.parse({
      action: "create",
      requestId: "11111111-1111-4111-8111-111111111111",
      expectedVersion: 0,
      recordId: "r1",
      companyId: "company1",
      cnpj: "11222333000181",
      name: "Contrato de SST",
      owner: "Gestora",
      document: null,
      effectiveOn: "2026-11-01",
      evidence: "Contrato conferido",
      reviewed: true,
      terms: {
        scope: "Documentos técnicos",
        units: "Unidades A e B",
        deliverables: "PGR e AET",
        valueCents: 300000,
        startsOn: "2026-11-01",
        endsOn: "",
        paymentTerms: "Após entrega",
        recurring: false,
        obligations: ["PGR", "AET"].map((type) => ({
          id: type,
          title: `Elaborar ${type}`,
          serviceType: type,
          owner: "Engenheira",
          due: "2026-11-20",
          trigger: "",
          deadlineRule: "Conforme cronograma",
          sourceReference: `Cláusula ${type}`,
          sourceExcerpt: `Entregar ${type} revisado e assinado.`,
        })),
      },
    }),
    "admin",
    now,
    "hash",
    "Cliente sintético"
  );
  const record = central.records[0];
  record.financeContractId = "f1";
  record.formalizedAt = now;
  const cycle = record.cycles[0];
  cycle.period = "2026-11";
  cycle.tasks[0].status = "done";
  cycle.tasks[0].checks = [true, true, true, true];
  cycle.tasks[0].evidence = "PGR revisão 1 conferido";
  const finance = emptyFinanceBook();
  finance.contracts.push({
    id: "f1",
    name: "Contrato financeiro",
    client: "Cliente sintético",
    center: "SST",
    monthlyCents: 300000,
    dueDay: 10,
    active: true,
    commercialTerms: ContractCommercialTermsSchema.parse({}),
  });
  finance.contractFlows.push({ contractId: "f1", customerDocument: record.cnpj } as never);
  finance.accounts.push({ id: "a1", name: "Conta teste" });
  finance.titles.push({
    id: "t1",
    kind: "receivable",
    party: "Cliente sintético",
    description: "PGR e AET",
    amountCents: 300000,
    competence: "2026-11",
    dueDate: "2026-11-30",
    category: "SST",
    center: "Operação",
    contractId: "f1",
    sourceKey: "manual-t1",
    source: "manual",
    externalReference: "NF sintética 1",
    evidence: "Medição e nota conferidas",
    status: "approved",
    createdBy: "admin",
    approvedBy: "outro-admin",
  });
  finance.settlements.push({
    id: "s1",
    titleId: "t1",
    accountId: "a1",
    date: "2026-11-11",
    principalCents: 150000,
    interestCents: 0,
    fineCents: 0,
    discountCents: 0,
    withholdingCents: 3000,
    evidence: "Crédito e retenção conferidos",
    reversed: false,
  });
  finance.bank.push({
    id: "bank1",
    accountId: "a1",
    bankId: "transaction1",
    date: "2026-11-11",
    amountCents: 147000,
    memo: "Crédito parcial",
    settlementIds: ["s1"],
    transferPeer: null,
  });
  finance.serviceBillingAllocations.push(
    ...["PGR", "AET"].map((taskId, index) => ({
      id: `billing${index}`,
      recordId: record.id,
      cycleId: cycle.id,
      taskId,
      sourceFingerprint: serviceOccurrenceFingerprint(central, {
        recordId: record.id,
        cycleId: cycle.id,
        taskId,
      })!,
      titleId: "t1",
      amountCents: (index + 1) * 100000,
      evidence: "Distribuição individual conferida",
      voided: false,
    }))
  );
  finance.serviceSettlementAllocations.push(
    ...[0, 1].map((index) => ({
      id: `receipt${index}`,
      billingAllocationId: `billing${index}`,
      settlementId: "s1",
      principalCents: (index + 1) * 50000,
      withholdingCents: (index + 1) * 1000,
      interestCents: 0,
      fineCents: 0,
      discountCents: 0,
      evidence: "Recebimento atribuído",
      voided: false,
    }))
  );
  finance.services.push({
    id: "service1",
    contractId: "f1",
    date: "2026-11-10",
    description: "Visitas do PGR",
    supplier: "Prestador",
    city: "Curitiba",
    quantity: 2,
    unitRevenueCents: 0,
    unitCostCents: 15000,
    evidence: "Duas visitas realizadas",
    titleId: null,
    billingMode: "included",
    voided: false,
  });
  finance.serviceProductionLinks.push({
    serviceId: "service1",
    recordId: record.id,
    cycleId: cycle.id,
    taskId: "PGR",
    sourceFingerprint: serviceOccurrenceFingerprint(central, {
      recordId: record.id,
      cycleId: cycle.id,
      taskId: "PGR",
    })!,
    evidence: "Custo conferido",
  });
  return { central, finance, record, cycle };
}

describe("service-to-receipt projection", () => {
  it("conserves grouped billing, partial receipts, retention and declared costs without mutating either book", () => {
    const { central, finance } = fixture();
    const original = structuredClone({ central, finance });
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items[0]).toMatchObject({
      billedCents: 100000,
      receivedCents: 49000,
      adjustmentCents: 1000,
      principalSettledCents: 50000,
      outstandingCents: 50000,
      reconciledCashCents: 49000,
      costCents: 30000,
      financialStatus: "partial",
      documentationStatus: "reviewed",
      revision: 0,
    });
    expect(result.items[1]).toMatchObject({
      billedCents: 200000,
      receivedCents: 98000,
      adjustmentCents: 2000,
      outstandingCents: 100000,
      costCents: null,
      documentationStatus: "pending",
    });
    expect(result.summary).toMatchObject({
      billedCents: 300000,
      receivedCents: 147000,
      outstandingCents: 150000,
      costCents: 30000,
    });
    expect(result.services[0]).toMatchObject({ quantity: 2, costCents: 30000, linked: true });
    expect(result.titles[0].availableCents).toBe(0);
    expect(result.settlements[0].available.principalCents).toBe(0);
    expect(result.recovery).toEqual({ billings: [], services: [] });
    expect({ central, finance }).toEqual(original);
  });

  it("leaves legacy cycle values undistributed and does not repeat them on each task", () => {
    const { central, finance, cycle } = fixture();
    finance.serviceBillingAllocations = [];
    finance.serviceSettlementAllocations = [];
    finance.serviceProductionLinks = [];
    cycle.financeTitleId = "t1";
    cycle.invoicedCents = 300000;
    cycle.receivedCents = 147000;
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items).toHaveLength(2);
    for (const item of result.items)
      expect(item).toMatchObject({
        billedCents: null,
        receivedCents: null,
        outstandingCents: null,
        costCents: null,
        financialStatus: "unallocated",
        legacyCycleFinance: true,
      });
    expect(result.summary.receivedCents).toBe(0);
    expect(result.summary.unallocatedCount).toBe(2);
  });

  it("reopens allocated balances immediately after a reversal while preserving receipt history", () => {
    const { central, finance } = fixture();
    finance.settlements[0].reversed = true;
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items[0]).toMatchObject({
      receivedCents: 0,
      outstandingCents: 100000,
      financialStatus: "open",
    });
    expect(result.items[0].billings[0].receipts[0]).toMatchObject({
      reversed: true,
      voided: false,
      reconciled: false,
    });
    expect(result.summary.receivedCents).toBe(0);
    expect(result.settlements).toEqual([]);
  });

  it("distinguishes allocated cash from bank-confirmed cash and never closes an unreconciled balance", () => {
    const { central, finance } = fixture();
    finance.settlements[0].principalCents = 300000;
    finance.serviceSettlementAllocations[0].principalCents = 100000;
    finance.serviceSettlementAllocations[1].principalCents = 200000;
    finance.bank = [];
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items[0]).toMatchObject({
      outstandingCents: 0,
      receivedCents: 99000,
      reconciledCashCents: 0,
      financialStatus: "unreconciled",
    });
  });

  it("flags payments still awaiting attribution instead of implying the customer has not paid", () => {
    const { central, finance } = fixture();
    finance.serviceSettlementAllocations = [];
    const item = buildServiceReceiptsSnapshot(central, finance, now).items[0];
    expect(item.financialStatus).toBe("review");
    expect(item.unallocatedReceiptCount).toBe(1);
    expect(item.issues.join(" ")).toContain("antes de cobrar");
  });

  it("excludes a stale customer association from identifiable totals and candidates", () => {
    const { central, finance } = fixture();
    finance.contractFlows[0].customerDocument = "44337647000189";
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items[0]).toMatchObject({
      billedCents: null,
      receivedCents: null,
      financialStatus: "review",
      costCents: null,
    });
    expect(result.titles).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.summary.receivedCents).toBe(0);
    expect(result.items[0].services).toEqual([]);
    expect(result.recovery.services).toHaveLength(1);
    expect(result.recovery.services[0]).toMatchObject({
      serviceId: "service1",
      recordId: "r1",
      cycleId: central.records[0].cycles[0].id,
      taskId: "PGR",
      companyName: "Cliente sintético",
      contractName: "Contrato de SST",
      cycleName: "Contrato de SST",
      period: "2026-11",
      description: "Visitas do PGR",
      evidence: "Custo conferido",
    });
    expect(result.recovery.services[0].issues.join(" ")).toContain("CNPJ");
    expect(result.summary.costCents).toBe(0);
  });

  it("keeps valid financial history visible for completed inactive contracts", () => {
    const { central, finance, record } = fixture();
    record.active = false;
    finance.contracts[0].active = false;
    expect(buildServiceReceiptsSnapshot(central, finance, now).items[0].receivedCents).toBe(49000);
  });

  it("preserves annulled history without including it in balances or allocations", () => {
    const { central, finance } = fixture();
    finance.serviceSettlementAllocations[0].voided = true;
    finance.serviceBillingAllocations[0].voided = true;
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items[0]).toMatchObject({ billedCents: null, receivedCents: null });
    expect(result.items[0].billings[0]).toMatchObject({ voided: true });
    expect(result.items[0].billings[0].receipts[0]).toMatchObject({
      voided: true,
      reversed: false,
    });
    expect(result.titles[0].availableCents).toBe(100000);
    expect(result.summary.receivedCents).toBe(98000);
  });

  it("fails closed on invalid component allocation and exposes an actionable problem", () => {
    const { central, finance } = fixture();
    finance.serviceSettlementAllocations[0].withholdingCents += 1;
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.issues.join(" ")).toContain("retenção");
    expect(result.items[0].receivedCents).toBeNull();
    expect(result.titles).toEqual([]);
  });

  it("reports orphaned associations and unstructured cycles instead of inventing individual services", () => {
    const { central, finance, cycle } = fixture();
    cycle.tasks = [];
    finance.serviceSettlementAllocations.push({
      ...finance.serviceSettlementAllocations[0],
      id: "receipt_old_voided",
      evidence: "Distribuição anterior anulada",
      voided: true,
    });
    finance.settlements.push({
      ...finance.settlements[0],
      id: "settlement_old_reversed",
      reversed: true,
    });
    finance.serviceSettlementAllocations.push({
      ...finance.serviceSettlementAllocations[0],
      id: "receipt_old_reversed",
      settlementId: "settlement_old_reversed",
      evidence: "Distribuição de baixa estornada",
    });
    const before = structuredClone({ central, finance });
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.items).toEqual([]);
    expect(result.summary.withoutTasksCount).toBe(1);
    expect(result.issues.join(" ")).toContain("sem tarefa de origem");
    expect(result.recovery.billings).toHaveLength(2);
    expect(result.recovery.billings[0]).toMatchObject({
      id: "billing0",
      titleId: "t1",
      recordId: "r1",
      cycleId: cycle.id,
      taskId: "PGR",
      companyName: "Cliente sintético",
      contractName: "Contrato de SST",
      cycleName: "Contrato de SST",
      period: "2026-11",
      amountCents: 100000,
      outstandingCents: 50000,
    });
    expect(result.recovery.billings[0].issues.join(" ")).toContain("tarefa existente");
    expect(result.recovery.billings[0].receipts).toMatchObject([
      {
        id: "receipt0",
        principalCents: 50000,
        withholdingCents: 1000,
        voided: false,
        reversed: false,
        reconciled: true,
      },
      { id: "receipt_old_voided", voided: true, reversed: false },
      { id: "receipt_old_reversed", voided: false, reversed: true, reconciled: false },
    ]);
    expect(result.recovery.services).toHaveLength(1);
    expect(result.recovery.services[0]).toMatchObject({
      serviceId: "service1",
      recordId: "r1",
      cycleId: cycle.id,
      taskId: "PGR",
      description: "Visitas do PGR",
      evidence: "Custo conferido",
    });
    expect(result.summary).toMatchObject({
      billedCents: 0,
      receivedCents: 0,
      outstandingCents: 0,
      costCents: 0,
    });
    expect({ central, finance }).toEqual(before);
  });

  it("keeps recovery identifiers with explicit names when the entire origin is unavailable", () => {
    const { central, finance, cycle } = fixture();
    central.records = [];
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    const missingOrigin = {
      recordId: "r1",
      cycleId: cycle.id,
      taskId: "PGR",
      companyName: "Cliente de origem indisponível",
      contractName: "Contrato de origem indisponível",
      cycleName: "Ciclo de origem indisponível",
      period: "Período de origem indisponível",
    };
    expect(result.recovery.billings[0]).toMatchObject(missingOrigin);
    expect(result.recovery.services[0]).toMatchObject(missingOrigin);
    expect(result.recovery.billings[0].receipts[0].id).toBe("receipt0");
    expect(result.summary.billedCents).toBe(0);
  });

  it("omits annulled orphan billing from recovery without releasing its other active siblings", () => {
    const { central, finance, cycle } = fixture();
    cycle.tasks = [];
    finance.serviceSettlementAllocations[0].voided = true;
    finance.serviceBillingAllocations[0].voided = true;
    const result = buildServiceReceiptsSnapshot(central, finance, now);
    expect(result.recovery.billings.map((billing) => billing.id)).toEqual(["billing1"]);
    expect(result.recovery.services.map((service) => service.serviceId)).toEqual(["service1"]);
    expect(result.summary.billedCents).toBe(0);
  });
});
