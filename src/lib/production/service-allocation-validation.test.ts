import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  emptyFinanceBook,
  FinanceCommandSchema,
  type FinanceBook,
} from "@/lib/financial/operations";
import { ContractCommercialTermsSchema, ContractFlowSchema } from "@/lib/financial/contract-flow";
import { isServiceAllocationCommand } from "@/lib/financial/service-allocations";
import { emptyBook, makeCards, RecordSchema, TermsSchema } from "./model";
import { makeTasks } from "./obligations";
import {
  serviceOccurrenceFingerprint,
  serviceAllocationOriginIssues,
  validateServiceAllocationCommand,
} from "./service-allocation-validation";

const origin = { recordId: "record1", cycleId: "cycle1", taskId: "task1" };
function fixture() {
  const central = emptyBook();
  central.version = 4;
  const terms = TermsSchema.parse({
    scope: "Relatório sintético contratado",
    units: "Unidade sintética",
    deliverables: "Relatório técnico revisado",
    valueCents: 10000,
    startsOn: "2026-10-01",
    endsOn: "",
    paymentTerms: "Após medição",
    recurring: false,
    obligations: [
      {
        id: origin.taskId,
        title: "Relatório técnico",
        serviceType: "OUTRO",
        owner: "Responsável sintético",
        due: "2026-10-20",
        deadlineRule: "Prazo contratual",
        sourceReference: "Cláusula 1",
        sourceExcerpt: "Relatório técnico contratado",
      },
    ],
  });
  central.records.push(
    RecordSchema.parse({
      id: origin.recordId,
      companyId: "company1",
      companyName: "Cliente sintético",
      cnpj: "11222333000181",
      name: "Contrato sintético",
      owner: "Gestor sintético",
      active: true,
      financeContractId: "contract1",
      formalizedAt: "2026-10-01T12:00:00Z",
      documents: [],
      revisions: [
        {
          terms,
          effectiveOn: "2026-10-01",
          evidence: "Contrato sintético formalizado",
          actor: "admin",
          at: "2026-10-01T12:00:00Z",
          sourceHash: "",
        },
      ],
      commercial: makeCards(["budget", "proposal", "contract"]),
      cycles: [
        {
          id: origin.cycleId,
          service: "Relatório técnico",
          period: "2026-10",
          revision: 0,
          contractedCents: 10000,
          cards: makeCards(["mobilize", "produce", "deliver", "measure", "invoice", "receive"]),
          tasks: makeTasks(terms.obligations),
          advanceEvidence: "",
          measuredCents: 0,
          invoicedCents: 0,
          receivedCents: 0,
          adjustmentCents: 0,
          measurementEvidence: "",
          invoiceReference: "",
          invoiceEvidence: "",
          receiptEvidence: "",
          adjustmentEvidence: "",
          financeTitleId: "",
        },
      ],
      createdAt: "2026-10-01T12:00:00Z",
    })
  );
  const finance = emptyFinanceBook();
  finance.version = 7;
  finance.contracts.push({
    id: "contract1",
    name: "Contrato sintético",
    client: "Cliente sintético",
    center: "SST",
    monthlyCents: 0,
    dueDay: 10,
    active: true,
    commercialTerms: ContractCommercialTermsSchema.parse({}),
  });
  finance.contractFlows.push(
    ContractFlowSchema.parse({
      contractId: "contract1",
      orderId: null,
      customerDocument: "11.222.333/0001-81",
      owner: "Gestor sintético",
      acceptedOn: "2026-10-01",
      acceptanceEvidence: "Aceite contratual",
      implementationDue: "2026-10-10",
      billingRequiresReadiness: false,
      checklist: { clientData: true, scope: true, network: true, schedule: true },
      createdBy: "admin",
      serviceReviews: [],
    })
  );
  finance.titles.push({
    id: "title1",
    kind: "receivable",
    party: "Cliente sintético",
    description: "Relatório contratado",
    amountCents: 10000,
    competence: "2026-10",
    dueDate: "2026-10-30",
    category: "SST",
    center: "SST",
    contractId: "contract1",
    sourceKey: "synthetic",
    source: "manual",
    externalReference: "",
    evidence: "Título sintético aprovado",
    status: "approved",
    createdBy: "admin",
    approvedBy: "reviewer",
  });
  finance.services.push({
    id: "service1",
    contractId: "contract1",
    date: "2026-10-20",
    description: "Custo declarado do relatório",
    supplier: "Equipe sintética",
    city: "Curitiba",
    quantity: 1,
    unitRevenueCents: 0,
    unitCostCents: 2000,
    evidence: "Execução documentada",
    titleId: null,
    billingMode: "included",
  });
  return { central, finance };
}
function command(patch: object = {}) {
  const parsed = FinanceCommandSchema.parse({
    action: "allocateServiceTitle",
    id: "billing1",
    ...origin,
    sourceFingerprint: serviceOccurrenceFingerprint(fixture().central, origin)!,
    titleId: "title1",
    amountCents: 10000,
    evidence: "Medição sintética aprovada",
    requestId: randomUUID(),
    expectedVersion: 7,
    expectedCentralVersion: 4,
    reviewed: true,
    reason: "Conferência sintética",
    ...patch,
  });
  if (!isServiceAllocationCommand(parsed)) throw new Error("Invalid fixture");
  return parsed;
}
function billing(finance: FinanceBook) {
  finance.serviceBillingAllocations.push({
    id: "billing1",
    ...origin,
    sourceFingerprint: serviceOccurrenceFingerprint(fixture().central, origin)!,
    titleId: "title1",
    amountCents: 10000,
    evidence: "Medição conferida",
    voided: false,
  });
}

describe("production origin validation for service allocations", () => {
  it("validates the explicit task and preserves both books", () => {
    const { central, finance } = fixture();
    const before = structuredClone({ central, finance });
    expect(serviceAllocationOriginIssues(central, finance, origin, { titleId: "title1" })).toEqual(
      []
    );
    expect(
      serviceAllocationOriginIssues(central, finance, origin, { serviceId: "service1" })
    ).toEqual([]);
    expect(() => validateServiceAllocationCommand(central, finance, command())).not.toThrow();
    expect({ central, finance }).toEqual(before);
  });

  it("allows historical inactive contracts only in read projections", () => {
    const { central, finance } = fixture();
    central.records[0].active = false;
    finance.contracts[0].active = false;
    expect(() => validateServiceAllocationCommand(central, finance, command())).toThrow(/Reative/);
    expect(
      serviceAllocationOriginIssues(central, finance, origin, {
        titleId: "title1",
        requireActive: false,
      })
    ).toEqual([]);
  });

  it("rejects stale Central versions before approving an association", () => {
    const { central, finance } = fixture();
    expect(() =>
      validateServiceAllocationCommand(central, finance, command({ expectedCentralVersion: 3 }))
    ).toThrow(/Central mudou/);
  });

  it.each(["record", "cycle", "task", "revision", "formalization", "not applicable"])(
    "does not invent a missing or unusable production origin: %s",
    (scenario) => {
      const { central, finance } = fixture();
      const record = central.records[0];
      const cycle = record.cycles[0];
      if (scenario === "record") central.records = [];
      if (scenario === "cycle") record.cycles = [];
      if (scenario === "task") cycle.tasks = [];
      if (scenario === "revision") cycle.revision = 5;
      if (scenario === "formalization") record.formalizedAt = null;
      if (scenario === "not applicable") cycle.tasks[0].status = "na";
      expect(() => validateServiceAllocationCommand(central, finance, command())).toThrow();
    }
  );

  it.each(["cnpj", "contract", "draft", "competence", "duplicate title", "duplicate flow"])(
    "rejects mismatched or ambiguous financial source: %s",
    (scenario) => {
      const { central, finance } = fixture();
      if (scenario === "cnpj") finance.contractFlows[0].customerDocument = "44337647000189";
      if (scenario === "contract") finance.titles[0].contractId = "another";
      if (scenario === "draft") finance.titles[0].status = "draft";
      if (scenario === "competence") finance.titles[0].competence = "2026-09";
      if (scenario === "duplicate title") finance.titles.push({ ...finance.titles[0] });
      if (scenario === "duplicate flow")
        finance.contractFlows.push({ ...finance.contractFlows[0] });
      expect(() => validateServiceAllocationCommand(central, finance, command())).toThrow();
    }
  );

  it("permits detailing a legacy whole-title link only inside its existing cycle", () => {
    const { central, finance } = fixture();
    const cycle = central.records[0].cycles[0];
    cycle.financeTitleId = "title1";
    expect(() => validateServiceAllocationCommand(central, finance, command())).not.toThrow();
    central.records[0].cycles.push({ ...structuredClone(cycle), id: "cycle2", financeTitleId: "" });
    expect(() =>
      validateServiceAllocationCommand(central, finance, command({ cycleId: "cycle2" }))
    ).toThrow(/título integral/);
  });

  it("keeps free-form periods unchanged without guessing their competence", () => {
    const { central, finance } = fixture();
    central.records[0].cycles[0].period = "Entrega inicial";
    expect(() =>
      validateServiceAllocationCommand(
        central,
        finance,
        command({ sourceFingerprint: serviceOccurrenceFingerprint(central, origin)! })
      )
    ).not.toThrow();
    expect(central.records[0].cycles[0].period).toBe("Entrega inicial");
  });

  it("revalidates a receipt through its billed service origin", () => {
    const { central, finance } = fixture();
    billing(finance);
    const receipt = FinanceCommandSchema.parse({
      action: "allocateServiceReceipt",
      requestId: randomUUID(),
      expectedVersion: 7,
      expectedCentralVersion: 4,
      reviewed: true,
      reason: "Recebimento conferido",
      id: "receipt1",
      billingAllocationId: "billing1",
      settlementId: "settlement1",
      principalCents: 10000,
      interestCents: 0,
      fineCents: 0,
      discountCents: 0,
      withholdingCents: 0,
      evidence: "Baixa conferida",
    });
    if (!isServiceAllocationCommand(receipt)) throw new Error("Invalid fixture");
    expect(() => validateServiceAllocationCommand(central, finance, receipt)).not.toThrow();
    finance.contractFlows[0].customerDocument = "44337647000189";
    expect(() => validateServiceAllocationCommand(central, finance, receipt)).toThrow(/CNPJ/);
    finance.serviceBillingAllocations[0].voided = true;
    expect(() => validateServiceAllocationCommand(central, finance, receipt)).toThrow(
      /não anulada/
    );
  });

  it("detects a cost from another competence without inferring a billing allocation", () => {
    const { central, finance } = fixture();
    finance.services[0].date = "2026-09-20";
    expect(
      serviceAllocationOriginIssues(central, finance, origin, { serviceId: "service1" })
    ).toEqual(["A competência do serviço financeiro diverge do ciclo de produção."]);
    expect(finance.serviceBillingAllocations).toEqual([]);
  });

  it("permits explicit removal of a stale association while preserving version checks", () => {
    const { central, finance } = fixture();
    billing(finance);
    central.records = [];
    const removal = FinanceCommandSchema.parse({
      action: "voidServiceTitleAllocation",
      requestId: randomUUID(),
      expectedVersion: 7,
      expectedCentralVersion: 4,
      reviewed: true,
      reason: "Corrigir associação antiga",
      id: "billing1",
    });
    if (!isServiceAllocationCommand(removal)) throw new Error("Invalid fixture");
    expect(() => validateServiceAllocationCommand(central, finance, removal)).not.toThrow();
    central.version++;
    expect(() => validateServiceAllocationCommand(central, finance, removal)).toThrow(
      /Central mudou/
    );
  });

  it("hashes contractual identity deterministically while allowing normal execution changes", () => {
    const { central } = fixture();
    const fingerprint = serviceOccurrenceFingerprint(central, origin);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const cycle = central.records[0].cycles[0];
    cycle.tasks[0].owner = "Outra técnica executora";
    cycle.tasks[0].due = "2026-10-21";
    cycle.tasks[0].status = "done";
    cycle.tasks[0].checks = [true, true, true, true];
    cycle.tasks[0].evidence = "Documento técnico entregue";
    cycle.cards[2].status = "done";
    central.version++;
    cycle.tasks[0].obligation = Object.fromEntries(
      Object.entries(cycle.tasks[0].obligation).reverse()
    ) as (typeof cycle.tasks)[number]["obligation"];
    expect(serviceOccurrenceFingerprint(central, origin)).toBe(fingerprint);
  });

  it("rejects a stale fingerprint in writes and current read projections", () => {
    const { central, finance } = fixture();
    const fingerprint = serviceOccurrenceFingerprint(central, origin)!;
    central.records[0].cycles[0].contractedCents = 20000;
    expect(serviceOccurrenceFingerprint(central, origin)).not.toBe(fingerprint);
    const originIssues = serviceAllocationOriginIssues(central, finance, {
      ...origin,
      sourceFingerprint: fingerprint,
    });
    expect(originIssues).toHaveLength(1);
    expect(originIssues[0]).toMatch(/origem contratual/);
    expect(
      serviceAllocationOriginIssues(central, finance, origin, { sourceFingerprint: fingerprint })
    ).toEqual(originIssues);
    expect(() =>
      validateServiceAllocationCommand(
        central,
        finance,
        command({ sourceFingerprint: fingerprint })
      )
    ).toThrow(/origem contratual/);
  });

  it("returns no fingerprint for an unavailable or ambiguous task origin", () => {
    const { central } = fixture();
    expect(serviceOccurrenceFingerprint(central, { ...origin, taskId: "missing" })).toBeNull();
    central.records[0].cycles[0].tasks.push(structuredClone(central.records[0].cycles[0].tasks[0]));
    expect(serviceOccurrenceFingerprint(central, origin)).toBeNull();
  });
});
