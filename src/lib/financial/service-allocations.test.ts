import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyFinanceCommand,
  emptyFinanceBook,
  FinanceBookSchema,
  FinanceCommandSchema,
  outstanding,
  type FinanceBook,
} from "./operations";
import {
  isServiceAllocationCommand,
  validateServiceAllocations,
  type ServiceSettlementAllocation,
} from "./service-allocations";

const at = "2026-11-11T18:00:00Z";
const evidence = "Conferência documental sintética";
const origin = {
  recordId: "record_1",
  cycleId: "cycle_1",
  taskId: "task_1",
  sourceFingerprint: "a".repeat(64),
};
function fixture(): FinanceBook {
  return FinanceBookSchema.parse({
    ...emptyFinanceBook(),
    accounts: [{ id: "account_1", name: "Conta sintética" }],
    contracts: [
      {
        id: "contract_1",
        name: "Contrato sintético",
        client: "Cliente sintético",
        center: "SST",
        monthlyCents: 300000,
        dueDay: 20,
        active: true,
      },
    ],
    titles: [
      {
        id: "title_1",
        kind: "receivable",
        party: "Cliente sintético",
        description: "Mensalidade",
        amountCents: 300000,
        competence: "2026-11",
        dueDate: "2026-11-20",
        category: "Serviços SST",
        center: "SST",
        contractId: "contract_1",
        sourceKey: "synthetic_1",
        source: "manual",
        externalReference: "",
        evidence,
        status: "approved",
        createdBy: "creator",
        approvedBy: "reviewer",
      },
    ],
    settlements: [
      {
        id: "settlement_1",
        titleId: "title_1",
        accountId: "account_1",
        date: "2026-11-11",
        principalCents: 150000,
        interestCents: 0,
        fineCents: 0,
        discountCents: 0,
        withholdingCents: 3000,
        evidence,
        reversed: false,
      },
    ],
    services: [
      {
        id: "service_1",
        contractId: "contract_1",
        date: "2026-11-10",
        description: "Dois exames clínicos",
        supplier: "Clínica sintética",
        city: "Curitiba",
        quantity: 2,
        unitRevenueCents: 5000,
        unitCostCents: 2500,
        evidence,
        titleId: null,
        billingMode: "included",
        voided: false,
      },
    ],
  });
}
function command(book: FinanceBook, payload: { action: string; [key: string]: unknown }) {
  return FinanceCommandSchema.parse({
    requestId: randomUUID(),
    expectedVersion: book.version,
    ...(isServiceAllocationCommand(payload)
      ? { expectedCentralVersion: 0, reviewed: true, reason: evidence }
      : {}),
    ...payload,
  });
}
function run(book: FinanceBook, payload: { action: string; [key: string]: unknown }) {
  const parsed = command(book, payload);
  return applyFinanceCommand(book, parsed, "operator", at, JSON.stringify(parsed));
}
function bill(book = fixture(), id = "allocation_1", amountCents = 100000, occurrence = origin) {
  return run(book, {
    action: "allocateServiceTitle",
    id,
    ...occurrence,
    titleId: "title_1",
    amountCents,
    evidence,
  });
}
function receipt(book: FinanceBook, overrides: Partial<ServiceSettlementAllocation> = {}) {
  return run(book, {
    action: "allocateServiceReceipt",
    id: "receipt_1",
    billingAllocationId: "allocation_1",
    settlementId: "settlement_1",
    principalCents: 50000,
    interestCents: 0,
    fineCents: 0,
    discountCents: 0,
    withholdingCents: 1000,
    evidence,
    ...overrides,
  });
}
function close(book: FinanceBook, month: string) {
  book.periods.push({ month, closed: true, evidence, updatedBy: "operator", updatedAt: at });
}

describe("explicit service financial allocations", () => {
  it("adds empty collections to legacy books without assigning historic receipts", () => {
    const legacy = JSON.parse(JSON.stringify(fixture()));
    delete legacy.serviceBillingAllocations;
    delete legacy.serviceSettlementAllocations;
    delete legacy.serviceProductionLinks;
    const parsed = FinanceBookSchema.parse(legacy);
    expect(parsed.serviceBillingAllocations).toEqual([]);
    expect(parsed.serviceSettlementAllocations).toEqual([]);
    expect(parsed.serviceProductionLinks).toEqual([]);
    expect(parsed.settlements).toEqual(legacy.settlements);
    expect(legacy).not.toHaveProperty("serviceBillingAllocations");
  });

  it("requires explicit review, central version, whole cents and bounded evidence", () => {
    const base = command(fixture(), {
      action: "allocateServiceTitle",
      id: "allocation_1",
      ...origin,
      titleId: "title_1",
      amountCents: 100000,
      evidence,
    });
    for (const bad of [
      { reviewed: false },
      { expectedCentralVersion: -1 },
      { expectedCentralVersion: undefined },
      { sourceFingerprint: undefined },
      { sourceFingerprint: "" },
      { sourceFingerprint: "a".repeat(63) },
      { sourceFingerprint: "g".repeat(64) },
      { amountCents: 0 },
      { amountCents: 1.5 },
      { amountCents: Number.MAX_SAFE_INTEGER },
      { evidence: "" },
      { reason: "" },
    ])
      expect(FinanceCommandSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    expect(isServiceAllocationCommand(base)).toBe(true);
    expect(isServiceAllocationCommand({ action: "settle" })).toBe(false);
  });

  it("shares one title across service occurrences without duplicating its value", () => {
    const first = bill();
    const grouped = bill(first, "allocation_2", 200000, { ...origin, taskId: "task_2" });
    expect(grouped.serviceBillingAllocations.map((row) => row.amountCents)).toEqual([
      100000, 200000,
    ]);
    expect(grouped.titles).toEqual(first.titles);
    expect(grouped.settlements).toEqual(first.settlements);
    const snapshot = JSON.stringify(grouped);
    expect(() => bill(grouped, "allocation_3", 1, { ...origin, taskId: "task_3" })).toThrow(
      "excede o valor do título"
    );
    expect(JSON.stringify(grouped)).toBe(snapshot);
  });

  it("rejects a second active allocation for the same title and occurrence", () => {
    expect(() => bill(bill(), "duplicate", 1)).toThrow("já possui uma alocação ativa");
  });

  it("keeps each title within one record and cycle even when the financial contract is the same", () => {
    let book = bill();
    const before = structuredClone(book);
    const error =
      "Distribua cada título entre serviços do mesmo ciclo para preservar a referência fiscal única.";
    expect(() => bill(book, "allocation_2", 200000, { ...origin, cycleId: "cycle_2" })).toThrow(
      error
    );
    expect(() => bill(book, "allocation_2", 200000, { ...origin, recordId: "record_2" })).toThrow(
      error
    );
    expect(book).toEqual(before);
    book = run(book, { action: "voidServiceTitleAllocation", id: "allocation_1" });
    book = bill(book, "allocation_2", 200000, { ...origin, cycleId: "cycle_2" });
    expect(book.serviceBillingAllocations).toMatchObject([
      { id: "allocation_1", cycleId: "cycle_1", voided: true },
      { id: "allocation_2", cycleId: "cycle_2", voided: false },
    ]);
  });

  it("preserves separate cash, withholding and partial principal for grouped services", () => {
    let book = bill(bill(), "allocation_2", 200000, { ...origin, taskId: "task_2" });
    book = receipt(book);
    book = receipt(book, {
      id: "receipt_2",
      billingAllocationId: "allocation_2",
      principalCents: 100000,
      withholdingCents: 2000,
    });
    const rows = book.serviceSettlementAllocations;
    expect(rows.reduce((sum, row) => sum + row.principalCents, 0)).toBe(150000);
    expect(rows.reduce((sum, row) => sum + row.withholdingCents, 0)).toBe(3000);
    expect(
      rows.reduce(
        (sum, row) => sum + row.principalCents - row.discountCents - row.withholdingCents,
        0
      )
    ).toBe(147000);
    expect(outstanding(book, book.titles[0])).toBe(150000);
    expect(book.bank).toEqual([]);
  });

  it.each([
    ["principalCents", 150001, "principal"],
    ["interestCents", 1, "juros"],
    ["fineCents", 1, "multa"],
    ["discountCents", 1, "desconto"],
    ["withholdingCents", 3001, "retenção"],
  ] as const)("rejects one cent above the source %s", (key, value, label) => {
    const book = bill(fixture(), "allocation_1", 300000);
    expect(() => receipt(book, { [key]: value })).toThrow(`distribuição de ${label}`);
  });

  it("conserves each component across different services in the same cycle", () => {
    let book = bill(bill(), "allocation_2", 200000, { ...origin, taskId: "task_2" });
    book = receipt(book, { withholdingCents: 2000 });
    expect(() =>
      receipt(book, {
        id: "receipt_2",
        billingAllocationId: "allocation_2",
        withholdingCents: 1001,
      })
    ).toThrow("distribuição de retenção");
  });

  it("does not attribute principal cash while leaving impossible residual adjustments", () => {
    const book = bill(fixture(), "allocation_1", 300000);
    expect(() => receipt(book, { principalCents: 150000, withholdingCents: 0 })).toThrow(
      "dinheiro do principal"
    );
  });

  it("does not allow retention plus discount to exceed the assigned principal", () => {
    const book = bill();
    book.settlements[0].discountCents = 3000;
    expect(() =>
      receipt(book, { principalCents: 1000, withholdingCents: 1000, discountCents: 1 })
    ).toThrow("não podem exceder o principal");
  });

  it("rejects both a repeated receipt pair and excess principal for one service", () => {
    const book = receipt(bill(fixture(), "allocation_1", 50000));
    expect(() =>
      receipt(book, { id: "receipt_2", principalCents: 1, withholdingCents: 0 })
    ).toThrow("já possui uma alocação ativa");
    const withAnotherSource = structuredClone(book);
    withAnotherSource.settlements.push({
      ...book.settlements[0],
      id: "settlement_2",
      principalCents: 10000,
      withholdingCents: 0,
    });
    expect(() =>
      receipt(withAnotherSource, {
        id: "receipt_2",
        settlementId: "settlement_2",
        principalCents: 1,
        withholdingCents: 0,
      })
    ).toThrow("excede o faturamento alocado");
  });

  it("corrects the same allocation id with audit and refuses reduction below receipts", () => {
    const original = receipt(bill());
    const updated = bill(original, "allocation_1", 60000);
    expect(updated.serviceBillingAllocations).toHaveLength(1);
    expect(updated.serviceBillingAllocations[0].amountCents).toBe(60000);
    expect(updated.audit.slice(0, original.audit.length)).toEqual(original.audit);
    expect(JSON.parse(updated.audit.at(-1)!.details).amountCents).toBe(60000);
    expect(() => bill(updated, "allocation_1", 49999)).toThrow("excede o faturamento alocado");
    expect(() => bill(updated, "allocation_1", 60000, { ...origin, taskId: "other" })).toThrow(
      "mudar a origem"
    );
    const correctedReceipt = receipt(updated, { principalCents: 40000, withholdingCents: 800 });
    expect(correctedReceipt.serviceSettlementAllocations).toHaveLength(1);
    expect(correctedReceipt.serviceSettlementAllocations[0].principalCents).toBe(40000);
    expect(correctedReceipt.audit).toHaveLength(updated.audit.length + 1);
  });

  it("keeps the reviewed source fingerprint immutable even when task ids are unchanged", () => {
    let book = bill();
    const revisedOrigin = { ...origin, sourceFingerprint: "b".repeat(64) };
    expect(() => bill(book, "allocation_1", 100000, revisedOrigin)).toThrow("mudar a origem");
    expect(book.serviceBillingAllocations[0].sourceFingerprint).toBe(origin.sourceFingerprint);
    book = run(book, {
      action: "linkProductionService",
      serviceId: "service_1",
      ...origin,
      evidence,
    });
    expect(() =>
      run(book, {
        action: "linkProductionService",
        serviceId: "service_1",
        ...revisedOrigin,
        evidence,
      })
    ).toThrow("versão de origem");
    expect(book.serviceProductionLinks[0].sourceFingerprint).toBe(origin.sourceFingerprint);
    book = run(book, { action: "voidServiceTitleAllocation", id: "allocation_1" });
    book = bill(book, "allocation_2", 100000, revisedOrigin);
    book = run(book, { action: "unlinkProductionService", serviceId: "service_1" });
    book = run(book, {
      action: "linkProductionService",
      serviceId: "service_1",
      ...revisedOrigin,
      evidence,
    });
    expect(book.serviceBillingAllocations[0]).toMatchObject({
      sourceFingerprint: origin.sourceFingerprint,
      voided: true,
    });
    expect(book.serviceBillingAllocations[1].sourceFingerprint).toBe(
      revisedOrigin.sourceFingerprint
    );
    expect(book.serviceProductionLinks[0].sourceFingerprint).toBe(revisedOrigin.sourceFingerprint);
  });

  it("ignores a reversed source in totals while retaining its allocation history", () => {
    let book = receipt(bill());
    book = run(book, { action: "reverse", id: "settlement_1", reason: evidence });
    expect(book.serviceSettlementAllocations).toHaveLength(1);
    expect(book.serviceSettlementAllocations[0].voided).toBe(false);
    expect(outstanding(book, book.titles[0])).toBe(300000);
    expect(() => receipt(book)).toThrow("Baixa estornada");
    book = bill(book, "allocation_1", 1);
    expect(book.serviceBillingAllocations[0].amountCents).toBe(1);
    book = run(book, { action: "voidServiceTitleAllocation", id: "allocation_1" });
    expect(book.serviceBillingAllocations[0].voided).toBe(true);
    expect(book.serviceSettlementAllocations[0].principalCents).toBe(50000);
    expect(() => validateServiceAllocations(book)).not.toThrow();
  });

  it("requires receipt allocations to be voided first and never reuses voided ids", () => {
    let book = receipt(bill());
    expect(() => run(book, { action: "voidServiceTitleAllocation", id: "allocation_1" })).toThrow(
      "Anule as alocações de recebimento"
    );
    book = run(book, { action: "voidServiceReceiptAllocation", id: "receipt_1" });
    book = run(book, { action: "voidServiceTitleAllocation", id: "allocation_1" });
    expect(() => bill(book)).toThrow("Identificador de alocação anulado");
    book = bill(book, "allocation_2", 100000);
    expect(() => receipt(book, { billingAllocationId: "allocation_2" })).toThrow(
      "Identificador de alocação anulado"
    );
    expect(book.settlements[0].reversed).toBe(false);
  });

  it.each(["draft", "submitted", "rejected", "cancelled"] as const)(
    "rejects a %s title",
    (status) => {
      const book = fixture();
      book.titles[0].status = status;
      expect(() => bill(book)).toThrow("título a receber aprovado");
    }
  );

  it("rejects payable, missing contract, unrelated receipt and duplicate source identities", () => {
    const payable = fixture();
    payable.titles[0].kind = "payable";
    expect(() => bill(payable)).toThrow("título a receber aprovado");
    const noContract = fixture();
    noContract.titles[0].contractId = null;
    expect(() => bill(noContract)).toThrow("contrato financeiro existente");
    const unrelated = bill();
    unrelated.settlements[0].titleId = "other_title";
    expect(() => receipt(unrelated)).toThrow("mesmo título");
    const duplicate = fixture();
    duplicate.titles.push({ ...duplicate.titles[0] });
    expect(() => bill(duplicate)).toThrow("identificador duplicado");
  });

  it("rejects closed competence and closed settlement periods", () => {
    const closedTitle = fixture();
    close(closedTitle, "2026-11");
    expect(() => bill(closedTitle)).toThrow("2026-11 está fechado");
    const closedReceipt = bill();
    closedReceipt.settlements[0].date = "2026-12-01";
    close(closedReceipt, "2026-12");
    expect(() => receipt(closedReceipt)).toThrow("2026-12 está fechado");
    const allocated = receipt(bill());
    allocated.settlements[0].date = "2026-12-01";
    close(allocated, "2026-12");
    expect(() => bill(allocated, "allocation_1", 110000)).toThrow("2026-12 está fechado");
    expect(() =>
      run(allocated, { action: "voidServiceReceiptAllocation", id: "receipt_1" })
    ).toThrow("2026-12 está fechado");
  });

  it("rejects stale versions and preserves exact replay without duplicate allocations", () => {
    const book = fixture();
    const parsed = command(book, {
      action: "allocateServiceTitle",
      id: "allocation_1",
      ...origin,
      titleId: "title_1",
      amountCents: 100000,
      evidence,
    });
    const hash = JSON.stringify(parsed);
    const first = applyFinanceCommand(book, parsed, "operator", at, hash);
    expect(applyFinanceCommand(first, parsed, "operator", at, hash)).toBe(first);
    expect(first.serviceBillingAllocations).toHaveLength(1);
    expect(() => applyFinanceCommand(first, parsed, "other", at, hash)).toThrow(
      "Chave de operação"
    );
    expect(() =>
      applyFinanceCommand(first, { ...parsed, requestId: randomUUID() }, "operator", at, hash)
    ).toThrow("outra sessão");
  });

  it("keeps Omie reservations and financial records unchanged during attribution", () => {
    const book = fixture();
    book.omieExports.push({
      sourceId: "title_1",
      kind: "receivable",
      key: "export_1",
      scope: "synthetic",
      company: "synthetic",
      hash: "hash",
      payload: {},
      status: "reserved",
      remoteId: null,
      actor: "operator",
      at,
      confirmedAt: null,
      confirmedBy: null,
    });
    const next = receipt(bill(book));
    expect(next.omieExports).toEqual(book.omieExports);
    expect(next.titles).toEqual(book.titles);
    expect(next.settlements).toEqual(book.settlements);
    expect(() => run(next, { action: "reverse", id: "settlement_1", reason: evidence })).toThrow(
      "reservado ou enviado ao Omie"
    );
  });

  it("protects allocated titles against cancellation through existing commands", () => {
    const book = bill();
    book.settlements = [];
    expect(() =>
      run(book, { action: "review", id: "title_1", status: "cancelled", reason: evidence })
    ).toThrow("Desfaça a distribuição");
    expect(book.titles[0].status).toBe("approved");
  });

  it("links the entire explicit service quantity once and preserves declared cost", () => {
    let book = run(fixture(), {
      action: "linkProductionService",
      serviceId: "service_1",
      ...origin,
      evidence,
    });
    expect(book.serviceProductionLinks).toEqual([{ serviceId: "service_1", ...origin, evidence }]);
    expect(book.services[0].quantity * book.services[0].unitCostCents).toBe(5000);
    expect(() =>
      run(book, {
        action: "linkProductionService",
        serviceId: "service_1",
        ...origin,
        taskId: "other_task",
        evidence,
      })
    ).toThrow("Desvincule o serviço financeiro");
    expect(() => run(book, { action: "voidService", id: "service_1", reason: evidence })).toThrow(
      "Desvincule o custo"
    );
    book = run(book, { action: "unlinkProductionService", serviceId: "service_1" });
    expect(book.serviceProductionLinks).toEqual([]);
    expect(book.audit.some((entry) => entry.action === "linkProductionService")).toBe(true);
    book = run(book, { action: "voidService", id: "service_1", reason: evidence });
    expect(book.services[0].voided).toBe(true);
  });

  it("does not mix financial contracts in one occurrence or link a voided service", () => {
    const book = bill();
    book.contracts.push({ ...book.contracts[0], id: "contract_2" });
    book.services[0].contractId = "contract_2";
    expect(() =>
      run(book, { action: "linkProductionService", serviceId: "service_1", ...origin, evidence })
    ).toThrow("contratos financeiros diferentes");
    book.services[0].voided = true;
    expect(() =>
      run(book, { action: "linkProductionService", serviceId: "service_1", ...origin, evidence })
    ).toThrow("Serviço financeiro anulado");
  });

  it("fails closed on duplicate persisted allocation ids and overallocated source principal", () => {
    const duplicate = bill();
    duplicate.serviceBillingAllocations.push({
      ...duplicate.serviceBillingAllocations[0],
      voided: true,
    });
    expect(() => validateServiceAllocations(duplicate)).toThrow("Identificador duplicado");
    const excessive = bill();
    excessive.settlements.push({
      ...excessive.settlements[0],
      id: "settlement_2",
      principalCents: 150001,
    });
    expect(() => validateServiceAllocations(excessive)).toThrow("As baixas excedem");
  });
});
