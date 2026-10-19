import { describe, expect, it } from "vitest";
import { emptyFinanceBook, FinanceBookSchema, type FinanceTitle } from "@/lib/financial/operations";
import { applyCommand, CommandSchema, emptyBook, type Cycle } from "./model";
import {
  billingCompetence,
  billingQueue,
  billingQueueSummary,
  searchBillingItem,
} from "./billing-queue";

function fixture() {
  const central = applyCommand(
    emptyBook(),
    CommandSchema.parse({
      action: "create",
      requestId: "8c7c5546-2ea6-4b18-ae48-bb566ba9bcdb",
      expectedVersion: 0,
      recordId: "r1",
      companyId: "c1",
      cnpj: "11222333000181",
      name: "Contrato técnico",
      owner: "Gestora",
      document: null,
      effectiveOn: "2026-10-01",
      evidence: "Revisão do contrato",
      reviewed: true,
      terms: {
        scope: "Saúde e segurança",
        units: "Matriz",
        deliverables: "PGR e PCMSO",
        valueCents: 90000,
        startsOn: "2026-10-01",
        endsOn: "",
        paymentTerms: "Após aceite da medição",
        recurring: false,
        obligations: ["pgr", "pcmso"].map((id) => ({
          id,
          serviceType: id.toUpperCase(),
          title: `Elaborar ${id.toUpperCase()}`,
          owner: "José",
          due: "2026-10-18",
          trigger: "",
          deadlineRule: "Conforme contrato",
          sourceReference: "Cláusula 4",
          sourceExcerpt: "Documentos contratados",
        })),
      },
    }),
    "admin",
    "2026-10-18T12:00:00Z",
    "hash",
    "Saúde Exemplo"
  );
  const record = central.records[0];
  record.financeContractId = "f1";
  record.formalizedAt = "2026-10-01T12:00:00Z";
  for (const card of record.commercial)
    Object.assign(card, {
      status: "done",
      owner: "Comercial",
      checks: [true, true, true, true],
      evidence: "Aceite documentado",
    });
  const cycle = record.cycles[0];
  cycle.service = "PGR e PCMSO";
  cycle.period = "2026-10";
  for (const card of cycle.cards)
    Object.assign(card, {
      status: ["mobilize", "produce", "deliver"].includes(card.id) ? "done" : "todo",
      owner: "José",
      due: "2026-10-20",
      checks: [true, true, true, true],
      evidence: "Conferência documentada",
    });
  for (const task of cycle.tasks)
    Object.assign(task, {
      status: "done",
      checks: [true, true, true, true],
      evidence: "Entregável aprovado",
    });
  const finance = FinanceBookSchema.parse({
    ...emptyFinanceBook(),
    version: 3,
    contracts: [
      {
        id: "f1",
        name: "Contrato ERP",
        client: "Saúde Exemplo",
        center: "SST",
        monthlyCents: 0,
        dueDay: 20,
        active: true,
      },
    ],
    contractFlows: [
      {
        contractId: "f1",
        orderId: null,
        customerDocument: "11.222.333/0001-81",
        owner: "Gestora",
        acceptedOn: "2026-10-01",
        acceptanceEvidence: "Contrato assinado",
        implementationDue: "2026-10-05",
        billingRequiresReadiness: true,
        checklist: { clientData: true, scope: true, network: true, schedule: true },
        createdBy: "admin",
        serviceReviews: [],
      },
    ],
  });
  return { central, finance, record, cycle };
}
function measure(cycle: Cycle, amount = 90000) {
  cycle.measuredCents = amount;
  cycle.measurementEvidence = "Medição aprovada pelo cliente";
  cycle.cards.find((card) => card.id === "measure")!.status = "done";
}
function invoice(cycle: Cycle, amount = cycle.measuredCents) {
  cycle.invoicedCents = amount;
  cycle.invoiceReference = "NF 123";
  cycle.invoiceEvidence = "Nota emitida e conferida";
  cycle.cards.find((card) => card.id === "invoice")!.status = "done";
}
function title(id: string, overrides: Partial<FinanceTitle> = {}): FinanceTitle {
  return {
    id,
    kind: "receivable",
    party: "Saúde Exemplo",
    description: "Serviço contratado",
    amountCents: 90000,
    competence: "2026-10",
    dueDate: "2026-10-20",
    category: "Serviços",
    center: "SST",
    contractId: "f1",
    sourceKey: `manual:${id}`,
    source: "manual",
    externalReference: "",
    evidence: "Documento financeiro",
    status: "approved",
    createdBy: "operador",
    approvedBy: "gestora",
    ...overrides,
  };
}

describe("operation to billing handoff", () => {
  it.each(["2000-01", "2026-10", "2100-12"])(
    "preserves explicit monthly competence %s",
    (month) => {
      expect(billingCompetence(month)).toBe(month);
      const [year, value] = month.split("-");
      expect(billingCompetence(`${value}/${year}`)).toBe(month);
    }
  );
  it.each([
    "2026-10-01",
    "Inicial",
    "outubro",
    "2026-00",
    "2026-13",
    "1999-12",
    "2101-01",
    "10/26",
  ])("does not infer a billing month from %s", (period) =>
    expect(billingCompetence(period)).toBeNull()
  );

  it("excludes untouched and inactive cycles, keeping a delivered cycle as one measurement pending", () => {
    const { central, finance, record, cycle } = fixture();
    const item = billingQueue(central, finance)[0];
    expect(item).toMatchObject({
      status: "measurement",
      delivered: true,
      balanceCents: null,
      measuredCents: 0,
      obligations: { total: 2, completed: 2, waived: 0 },
    });
    expect(billingQueueSummary([item])).toMatchObject({
      cycles: 1,
      awaitingMeasurement: 1,
      measuredBalanceCents: 0,
    });
    cycle.cards.find((card) => card.id === "deliver")!.status = "todo";
    expect(billingQueue(central, finance)).toEqual([]);
    measure(cycle);
    record.active = false;
    expect(billingQueue(central, finance)).toEqual([]);
  });

  it("uses the cycle measurement once, subtracts invoiced values, and never adds contract totals or ERP services", () => {
    const { central, finance, cycle } = fixture();
    measure(cycle, 30000);
    invoice(cycle, 10000);
    cycle.cards.find((card) => card.id === "invoice")!.status = "doing";
    finance.services.push({
      id: "s1",
      contractId: "f1",
      date: "2026-10-18",
      description: "PGR",
      supplier: "Equipe",
      city: "São Paulo",
      quantity: 2,
      unitRevenueCents: 30000,
      unitCostCents: 10000,
      evidence: "Serviço lançado",
      billingMode: "separate",
      titleId: null,
    });
    const original = structuredClone({ central, finance });
    const items = billingQueue(central, finance);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: "invoice",
      measuredCents: 30000,
      invoicedCents: 10000,
      balanceCents: 20000,
    });
    expect(billingQueueSummary(items).measuredBalanceCents).toBe(20000);
    expect({ central, finance }).toEqual(original);
  });

  it("does not total a measurement value whose approval stage has not been completed", () => {
    const { central, finance, cycle } = fixture();
    cycle.measuredCents = 90000;
    cycle.measurementEvidence = "Rascunho da medição";
    const items = billingQueue(central, finance);
    expect(items[0]).toMatchObject({
      status: "measurement",
      measurementApproved: false,
      balanceCents: 90000,
    });
    expect(billingQueueSummary(items).measuredBalanceCents).toBe(0);
  });

  it.each(["terms", "erp"])(
    "requires a coverage review for recurring charges identified in %s",
    (source) => {
      const { central, finance, record, cycle } = fixture();
      measure(cycle);
      if (source === "terms") record.revisions[0].terms.recurring = true;
      else finance.contracts[0].monthlyCents = 10000;
      const items = billingQueue(central, finance);
      expect(items[0].status).toBe("review");
      expect(items[0].issues.join(" ")).toContain("cobertura da mensalidade");
      expect(billingQueueSummary(items).measuredBalanceCents).toBe(0);
    }
  );

  it("keeps a documented advance distinct from delivered work and out of the delivery balance", () => {
    const { central, finance, cycle } = fixture();
    for (const card of cycle.cards) card.status = "todo";
    for (const task of cycle.tasks) task.status = "todo";
    cycle.advanceEvidence = "Cláusula 5 autoriza antecipação";
    measure(cycle);
    const items = billingQueue(central, finance);
    expect(items[0]).toMatchObject({ status: "advance", origin: "advance", delivered: false });
    expect(billingQueueSummary(items)).toMatchObject({
      advances: 1,
      delivered: 0,
      measuredBalanceCents: 0,
    });
  });

  it("reviews incomplete delivery evidence and conditionally waived obligations", () => {
    const { central, finance, cycle } = fixture();
    cycle.tasks[0].evidence = "";
    expect(billingQueue(central, finance)[0]).toMatchObject({ delivered: false, status: "review" });
    for (const task of cycle.tasks) {
      task.status = "na";
      task.evidence = "Condição não acionada";
      task.obligation.trigger = "Quando necessário";
    }
    const item = billingQueue(central, finance)[0];
    expect(item).toMatchObject({
      delivered: true,
      status: "review",
      obligations: { total: 2, completed: 0, waived: 2 },
    });
    expect(item.issues.join(" ")).toContain("Todas as obrigações foram dispensadas");
  });

  it.each(["draft", "submitted", "approved", "rejected"] as const)(
    "shows an existing %s title as a candidate requiring review, without linking or adding its amount",
    (status) => {
      const { central, finance, cycle } = fixture();
      measure(cycle);
      finance.titles.push(title("t1", { status, amountCents: 10000 }));
      const items = billingQueue(central, finance);
      expect(items[0]).toMatchObject({
        status: "review",
        financeTitleId: "",
        candidateCount: 1,
        candidates: [{ id: "t1", status, amountCents: 10000 }],
      });
      expect(cycle.financeTitleId).toBe("");
      expect(billingQueueSummary(items).measuredBalanceCents).toBe(0);
    }
  );
  it("does not include cancelled, payable, foreign-contract or other-competence titles among candidates", () => {
    const { central, finance, cycle } = fixture();
    measure(cycle);
    finance.titles.push(
      title("cancelled", { status: "cancelled" }),
      title("payable", { kind: "payable" }),
      title("foreign", { contractId: "f2" }),
      title("future", { competence: "2026-11" })
    );
    expect(billingQueue(central, finance)[0]).toMatchObject({
      status: "invoice",
      candidateCount: 0,
    });
  });
  it("limits candidate detail while preserving the full count and all affected cycle targets", () => {
    const { central, finance, record, cycle } = fixture();
    measure(cycle);
    for (let i = 0; i < 8; i++) finance.titles.push(title(`t${i}`));
    record.cycles.push({ ...structuredClone(cycle), id: "second" });
    const items = billingQueue(central, finance);
    expect(items).toHaveLength(2);
    expect(new Set(items.map((item) => item.key)).size).toBe(2);
    expect(items.every((item) => item.candidateCount === 8 && item.candidates.length === 5)).toBe(
      true
    );
  });

  it("retains daily periods without inventing competence and displays the explicitly linked title month separately", () => {
    const { central, finance, cycle } = fixture();
    measure(cycle);
    cycle.period = "2026-10-01";
    cycle.financeTitleId = "t1";
    cycle.invoicedCents = 10000;
    cycle.invoiceReference = "NF 123";
    cycle.invoiceEvidence = "Nota conferida";
    finance.titles.push(title("t1", { amountCents: 10000 }));
    const item = billingQueue(central, finance)[0];
    expect(item).toMatchObject({
      competence: null,
      status: "review",
      linkedTitle: { competence: "2026-10" },
    });
    expect(item.issues.join(" ")).toContain("confira contrato e título no ERP");
    expect(item.issues.join(" ")).not.toContain("Defina a competência");
  });

  it("removes a valid completed invoice from the handoff even when payment is still outstanding", () => {
    const { central, finance, cycle } = fixture();
    measure(cycle);
    invoice(cycle);
    cycle.financeTitleId = "t1";
    finance.titles.push(title("t1"));
    expect(cycle.receivedCents).toBe(0);
    expect(billingQueue(central, finance)).toEqual([]);
  });
  it.each(["invoice", "measure", "commercial", "contract"])(
    "keeps fully registered amounts under review when %s is reopened or incompatible",
    (field) => {
      const { central, finance, record, cycle } = fixture();
      measure(cycle);
      invoice(cycle);
      if (field === "invoice" || field === "measure")
        cycle.cards.find((card) => card.id === field)!.status = "todo";
      if (field === "commercial") record.commercial[2].status = "todo";
      if (field === "contract") finance.contractFlows[0].customerDocument = "99888777000100";
      const items = billingQueue(central, finance);
      expect(items[0]).toMatchObject({ status: "review", balanceCents: 0 });
      expect(billingQueueSummary(items).measuredBalanceCents).toBe(0);
    }
  );
  it.each(["cancelled", "missing", "foreign", "amount", "competence", "duplicate"])(
    "keeps an invalid %s title link visible even after full invoice registration",
    (problem) => {
      const { central, finance, record, cycle } = fixture();
      measure(cycle);
      invoice(cycle);
      cycle.financeTitleId = "t1";
      if (problem !== "missing") finance.titles.push(title("t1"));
      if (problem === "cancelled") finance.titles[0].status = "cancelled";
      if (problem === "foreign") finance.titles[0].contractId = "f2";
      if (problem === "amount") finance.titles[0].amountCents = 10000;
      if (problem === "competence") finance.titles[0].competence = "2026-11";
      if (problem === "duplicate") record.cycles.push({ ...structuredClone(cycle), id: "other" });
      expect(billingQueue(central, finance)[0].status).toBe("review");
    }
  );

  it.each(["unlinked", "inactive", "missing-flow", "wrong-cnpj", "empty-cnpj", "shared"])(
    "requires a valid finance contract for %s associations",
    (problem) => {
      const { central, finance, record, cycle } = fixture();
      measure(cycle);
      finance.titles.push(title("t1"));
      if (problem === "unlinked") record.financeContractId = "";
      if (problem === "inactive") finance.contracts[0].active = false;
      if (problem === "missing-flow") finance.contractFlows = [];
      if (problem === "wrong-cnpj") finance.contractFlows[0].customerDocument = "99888777000100";
      if (problem === "empty-cnpj") record.cnpj = finance.contractFlows[0].customerDocument = "";
      if (problem === "shared") central.records.push({ ...structuredClone(record), id: "r2" });
      const item = billingQueue(central, finance)[0];
      expect(item.status).toBe("review");
      if (problem !== "shared") expect(item.candidates).toEqual([]);
    }
  );
  it.each(["readiness", "acceptance", "migration", "closed", "payment"])(
    "respects the existing ERP %s gate",
    (gate) => {
      const { central, finance, cycle } = fixture();
      measure(cycle);
      if (gate === "readiness") finance.contractFlows[0].checklist.schedule = false;
      if (gate === "acceptance") finance.contractFlows[0].acceptedOn = "2026-11-01";
      if (gate === "migration")
        finance.contractFlows[0].migration = {
          partyId: "p1",
          billingStartMonth: "2026-11",
          billingEvidence: "Entrada revisada",
          at: "now",
        };
      if (gate === "closed")
        finance.periods.push({
          month: "2026-10",
          closed: true,
          evidence: "Fechamento",
          updatedBy: "admin",
          updatedAt: "now",
        });
      if (gate === "payment")
        finance.contracts[0].commercialTerms = {
          ...finance.contracts[0].commercialTerms,
          paymentBasis: "days_after_invoice",
          paymentDetails: "30 dias após emissão",
        };
      const items = billingQueue(central, finance);
      expect(items[0].status).toBe("review");
      expect(billingQueueSummary(items).measuredBalanceCents).toBe(0);
    }
  );
  it("matches formatted alphanumeric CNPJ, accents and the next responsible person", () => {
    const { central, finance, record } = fixture();
    record.cnpj = "12.ABC.345/01DE-35";
    finance.contractFlows[0].customerDocument = "12ABC34501DE35";
    const item = billingQueue(central, finance)[0];
    expect(item.status).toBe("measurement");
    for (const query of ["saude", "jose", "12ABC34501DE35", "12.ABC.345/01DE-35", "PGR", "  "])
      expect(searchBillingItem(item, query)).toBe(true);
    expect(searchBillingItem(item, "outro cliente")).toBe(false);
  });
});
