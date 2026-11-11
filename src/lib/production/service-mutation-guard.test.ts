import { describe, expect, it } from "vitest";
import { emptyFinanceBook } from "@/lib/financial/operations";
import { ContractCommercialTermsSchema } from "@/lib/financial/contract-flow";
import { CommandSchema, emptyBook, makeCards, TermsSchema } from "./model";
import { makeTasks } from "./obligations";
import { guardServiceAssociations } from "./service-mutation-guard";
import { serviceOccurrenceFingerprint } from "./service-allocation-validation";

function fixture() {
  const central = emptyBook();
  const terms = TermsSchema.parse({
    scope: "Produção técnica",
    units: "Unidade A",
    deliverables: "Documento",
    valueCents: 10000,
    startsOn: "2026-11-01",
    endsOn: "",
    paymentTerms: "Após entrega",
    recurring: true,
    obligations: [
      {
        id: "pgr",
        title: "Elaborar PGR",
        serviceType: "PGR",
        owner: "Técnico",
        due: "",
        trigger: "",
        deadlineRule: "Mensal",
        sourceReference: "Cláusula 1",
        sourceExcerpt: "Documento técnico mensal",
      },
    ],
  });
  central.records.push({
    id: "r1",
    companyId: "company1",
    companyName: "Cliente",
    cnpj: "11222333000181",
    name: "Contrato",
    owner: "Gestora",
    active: true,
    financeContractId: "f1",
    formalizedAt: "2026-11-01",
    documents: [],
    revisions: [
      {
        terms,
        effectiveOn: "2026-11-01",
        evidence: "Contrato assinado",
        actor: "admin",
        at: "2026-11-01",
        sourceHash: "",
      },
    ],
    commercial: makeCards(["budget", "proposal", "contract"]),
    createdAt: "2026-11-01",
    cycles: [
      {
        id: "c1",
        service: "Documento",
        period: "2026-11",
        revision: 0,
        contractedCents: 10000,
        cards: makeCards(["mobilize", "produce", "deliver", "measure", "invoice", "receive"]),
        tasks: makeTasks(terms.obligations),
        advanceEvidence: "",
        measuredCents: 10000,
        invoicedCents: 10000,
        receivedCents: 10000,
        adjustmentCents: 0,
        measurementEvidence: "Medição",
        invoiceReference: "NF1",
        invoiceEvidence: "Nota",
        receiptEvidence: "Extrato",
        adjustmentEvidence: "",
        financeTitleId: "",
      },
    ],
  });
  const finance = emptyFinanceBook();
  finance.contracts.push({
    id: "f1",
    name: "Contrato",
    client: "Cliente",
    center: "SST",
    monthlyCents: 10000,
    dueDay: 10,
    active: true,
    commercialTerms: ContractCommercialTermsSchema.parse({}),
  });
  finance.contractFlows.push({ contractId: "f1", customerDocument: "11222333000181" } as never);
  finance.titles.push({
    id: "t1",
    kind: "receivable",
    party: "Cliente",
    description: "Documento",
    amountCents: 10000,
    competence: "2026-11",
    dueDate: "2026-11-30",
    category: "SST",
    center: "SST",
    contractId: "f1",
    sourceKey: "manual1",
    source: "manual",
    externalReference: "NF1",
    evidence: "Nota conferida",
    status: "approved",
    createdBy: "admin",
    approvedBy: "outro",
  });
  finance.accounts.push({ id: "account1", name: "Conta" });
  finance.settlements.push({
    id: "s1",
    titleId: "t1",
    accountId: "account1",
    date: "2026-11-11",
    principalCents: 10000,
    interestCents: 0,
    fineCents: 0,
    discountCents: 0,
    withholdingCents: 0,
    evidence: "Extrato conferido",
    reversed: false,
  });
  finance.bank.push({
    id: "bank1",
    accountId: "account1",
    bankId: "bank-id1",
    date: "2026-11-11",
    amountCents: 10000,
    memo: "Crédito",
    settlementIds: ["s1"],
    transferPeer: null,
  });
  finance.serviceBillingAllocations.push({
    id: "billing1",
    recordId: "r1",
    cycleId: "c1",
    taskId: "pgr",
    sourceFingerprint: serviceOccurrenceFingerprint(central, {
      recordId: "r1",
      cycleId: "c1",
      taskId: "pgr",
    })!,
    titleId: "t1",
    amountCents: 10000,
    evidence: "Distribuição aprovada",
    voided: false,
  });
  finance.serviceSettlementAllocations.push({
    id: "receipt1",
    billingAllocationId: "billing1",
    settlementId: "s1",
    principalCents: 10000,
    interestCents: 0,
    fineCents: 0,
    discountCents: 0,
    withholdingCents: 0,
    evidence: "Recebimento conferido",
    voided: false,
  });
  const command = CommandSchema.parse({
    action: "active",
    requestId: "11111111-1111-4111-8111-111111111111",
    expectedVersion: 0,
    recordId: "r1",
    active: false,
    reason: "Encerramento conferido",
  });
  return { central, finance, command };
}

describe("production changes with attributed financial services", () => {
  it("permits a reconciled, fully attributed closure with matching cycle totals", () => {
    const { central, finance, command } = fixture();
    const after = structuredClone(central);
    after.records[0].active = false;
    expect(() => guardServiceAssociations(central, after, finance, command)).not.toThrow();
  });
  it.each(["reversed", "unreconciled", "undistributed", "mismatched totals"])(
    "prevents closing with %s",
    (mode) => {
      const { central, finance, command } = fixture();
      if (mode === "reversed") finance.settlements[0].reversed = true;
      if (mode === "unreconciled") finance.bank = [];
      if (mode === "undistributed") finance.serviceSettlementAllocations = [];
      if (mode === "mismatched totals") central.records[0].cycles[0].receivedCents = 9999;
      expect(() =>
        guardServiceAssociations(central, structuredClone(central), finance, command)
      ).toThrow();
    }
  );
  it("rejects removal or reassignment of a task while its financial allocation remains active", () => {
    const { central, finance, command } = fixture();
    const after = structuredClone(central);
    after.records[0].cycles[0].tasks = [];
    expect(() => guardServiceAssociations(central, after, finance, command)).toThrow(/invalidaria/);
  });
  it("allows closing one cycle while another cycle has an unchanged stale origin", () => {
    const { central, finance, command } = fixture();
    central.records[0].cycles.push({ ...structuredClone(central.records[0].cycles[0]), id: "c2" });
    finance.titles.push({ ...structuredClone(finance.titles[0]), id: "t2" });
    finance.serviceBillingAllocations.push({
      ...structuredClone(finance.serviceBillingAllocations[0]),
      id: "billing2",
      titleId: "t2",
      cycleId: "c2",
      sourceFingerprint: "a".repeat(64),
    });
    const closeCycle = CommandSchema.parse({
      action: "card",
      requestId: command.requestId,
      expectedVersion: 0,
      recordId: "r1",
      cycleId: "c1",
      card: {
        ...central.records[0].cycles[0].cards.find((card) => card.id === "receive")!,
        status: "done",
      },
      reason: "Recebimento do ciclo conferido",
    });
    expect(() =>
      guardServiceAssociations(central, structuredClone(central), finance, closeCycle)
    ).not.toThrow();
    expect(() =>
      guardServiceAssociations(central, structuredClone(central), finance, command)
    ).toThrow(/origem contratual/);
  });
  it("rejects changing the contract behind an existing service allocation", () => {
    const { central, finance, command } = fixture();
    const after = structuredClone(central);
    after.records[0].financeContractId = "other";
    expect(() => guardServiceAssociations(central, after, finance, command)).toThrow(/invalidaria/);
  });
  it("does not let a legacy cycle reserve a title already distributed to another cycle", () => {
    const { central, finance, command } = fixture();
    const after = structuredClone(central);
    after.records[0].cycles.push({
      ...structuredClone(after.records[0].cycles[0]),
      id: "c2",
      financeTitleId: "t1",
    });
    expect(() => guardServiceAssociations(central, after, finance, command)).toThrow(/outro ciclo/);
  });
  it("preserves ordinary legacy workflows when there are no service associations", () => {
    const { central, finance, command } = fixture();
    finance.serviceBillingAllocations = [];
    finance.serviceSettlementAllocations = [];
    expect(() =>
      guardServiceAssociations(central, structuredClone(central), finance, command)
    ).not.toThrow();
  });
});
