import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  applyFinanceCommand,
  emptyFinanceBook,
  FinanceBookSchema,
  FinanceCommandSchema,
  closingIssues,
  type FinanceBook,
} from "./operations";
import { contractFlowOverview } from "./contract-flow";
const now = "2026-10-12T15:00:00Z";
function run(book: FinanceBook, payload: object, actor = "creator") {
  const command = FinanceCommandSchema.parse({
    requestId: randomUUID(),
    expectedVersion: book.version,
    ...payload,
  });
  return applyFinanceCommand(book, command, actor, now, JSON.stringify(command));
}
function proposal() {
  let b = emptyFinanceBook();
  b = run(b, {
    action: "erpParty",
    id: null,
    data: {
      name: "Cliente sintético",
      document: "12345678000190",
      role: "customer",
      email: "",
      phone: "",
      active: true,
    },
    reason: "Cadastro sintético",
  });
  b = run(b, {
    action: "erpCategory",
    id: null,
    data: { code: "1.01", name: "Mensalidade", kind: "revenue", active: true },
    reason: "Cadastro sintético",
  });
  b = run(b, {
    action: "erpCenter",
    id: null,
    data: { code: "SST", name: "SST", active: true },
    reason: "Cadastro sintético",
  });
  b = run(b, {
    action: "erpOrder",
    id: null,
    data: {
      kind: "sale",
      number: "PROPOSTA-TESTE",
      partyId: b.erp.parties[0].id,
      categoryId: b.erp.categories[0].id,
      centerId: b.erp.centers[0].id,
      competence: "2026-10",
      dueDate: "2026-10-20",
      items: [{ description: "SST mensal", quantity: 1, unitCents: 10000 }],
      discountCents: 0,
      evidence: "Proposta sintética",
    },
    reason: "Proposta sintética",
  });
  b = run(b, {
    action: "erpReviewOrder",
    id: b.erp.orders[0].id,
    status: "submitted",
    reason: "Para revisão",
  });
  return run(
    b,
    {
      action: "erpReviewOrder",
      id: b.erp.orders[0].id,
      status: "approved",
      reason: "Preço conferido",
    },
    "approver"
  );
}
const create = (b: FinanceBook, extra = {}) => ({
  action: "contractFromOrder",
  orderId: b.erp.orders[0].id,
  owner: "Operação teste",
  acceptedOn: "2026-10-01",
  implementationDue: "2026-10-05",
  dueDay: 20,
  billingRequiresReadiness: true,
  monthlyPriceConfirmed: true,
  acceptanceEvidence: "Aceite sintético registrado",
  ...extra,
});
function contract(extra = {}) {
  const b = proposal();
  return run(b, create(b, extra));
}
const checklist = { clientData: true, scope: true, network: true, schedule: true };
const ready = (b: FinanceBook) =>
  run(b, {
    action: "flowChecklist",
    contractId: b.contracts[0].id,
    checklist,
    reason: "Implantação conferida",
  });
const service = (b: FinanceBook, extra = {}) =>
  run(b, {
    action: "service",
    data: {
      contractId: b.contracts[0].id,
      date: "2026-10-10",
      description: "Exame sintético",
      supplier: "Clínica teste",
      city: "Curitiba",
      quantity: 2,
      unitRevenueCents: 5000,
      unitCostCents: 2000,
      evidence: "Execução sintética",
      billingMode: "separate",
      ...extra,
    },
  });
describe("contract to cash", () => {
  it("does not leave an approved order blocking closing after its contract was created", () => {
    const b = contract();
    expect(b.erp.orders[0].status).toBe("approved");
    expect(closingIssues(b, "2026-10").join(" ")).not.toContain("pedidos sem conversão");
    expect(closingIssues(proposal(), "2026-10").join(" ")).toContain("pedidos sem conversão");
  });
  it("prevents attaching a manual receivable by edit while allowing genuine payable correction", () => {
    let b = contract();
    const manual = {
      kind: "receivable",
      party: "Cliente sintético",
      description: "Cobrança manual",
      amountCents: 10000,
      competence: "2026-10",
      dueDate: "2026-10-20",
      category: "SST",
      center: "SST",
      contractId: null,
      sourceKey: "manual-edit",
      externalReference: "",
      evidence: "Documento sintético",
    };
    b = run(b, { action: "title", data: manual });
    const edit = {
      description: manual.description,
      amountCents: 9000,
      competence: manual.competence,
      dueDate: manual.dueDate,
      category: manual.category,
      center: manual.center,
      contractId: b.contracts[0].id,
      evidence: manual.evidence,
    };
    expect(() =>
      run(b, {
        action: "editTitle",
        id: b.titles[0].id,
        data: edit,
        reason: "Tentativa de associação",
      })
    ).toThrow(/fluxo integrado/);
    b = run(b, {
      action: "title",
      data: { ...manual, kind: "payable", sourceKey: "cost-edit", contractId: b.contracts[0].id },
    });
    const corrected = run(b, {
      action: "editTitle",
      id: b.titles[1].id,
      data: edit,
      reason: "Correção da despesa",
    });
    expect(corrected.titles[1].amountCents).toBe(9000);
  });
  it("requires an evidenced first due date after acceptance and never forecasts a month before acceptance", () => {
    let b = contract({
      acceptedOn: "2026-10-12",
      implementationDue: "2026-10-20",
      dueDay: 5,
      billingRequiresReadiness: false,
    });
    const cmd = { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" };
    expect(() => run(b, cmd)).toThrow(/anteceder o aceite/);
    expect(() => run(b, { ...cmd, dueDate: "2026-10-15" })).toThrow(/justificativa/);
    expect(() => run(b, { ...cmd, dueDate: "2026-10-10", reason: "Exceção solicitada" })).toThrow(
      /anteceder o aceite/
    );
    b = run(b, { ...cmd, dueDate: "2026-10-15", reason: "Primeiro vencimento conforme aceite" });
    expect(b.titles[0].dueDate).toBe("2026-10-15");
    expect(b.audit.at(-1)?.reason).toContain("Primeiro vencimento");
    expect(contractFlowOverview(b, "2026-09", "2026-10-12")[0].expectedRevenue).toBe(0);
    expect(contractFlowOverview(b, "2026-10", "2026-10-12")[0].expectedRevenue).toBe(10000);
  });
  it("handles a maximum-length approved order number without losing its original identity", () => {
    const b = proposal();
    b.erp.orders[0].number = "P".repeat(180);
    const next = run(b, create(b));
    expect(next.contracts[0].name).toHaveLength(180);
    expect(next.erp.orders[0].number).toBe("P".repeat(180));
    const billed = run(ready(next), {
      action: "recurring",
      contractId: next.contracts[0].id,
      month: "2026-10",
    });
    expect(billed.titles[0].description.length).toBeLessThanOrEqual(180);
  });
  it("preserves old books without silently enrolling existing contracts", () => {
    const old = { ...emptyFinanceBook(), contractFlows: undefined };
    expect(FinanceBookSchema.parse(old).contractFlows).toEqual([]);
  });
  it("requires approved sales and explicit monthly price confirmation", () => {
    const b = proposal();
    b.erp.orders[0].status = "draft";
    expect(() => run(b, create(b))).toThrow(/aprovado/);
    expect(() => run(proposal(), create(proposal(), { monthlyPriceConfirmed: false }))).toThrow();
  });
  it("creates a traced contract once without creating a receivable", () => {
    const b = contract();
    expect(b.contracts[0].monthlyCents).toBe(10000);
    expect(b.contractFlows[0].orderId).toBe(b.erp.orders[0].id);
    expect(b.titles).toHaveLength(0);
    expect(() => run(b, create(b))).toThrow(/já vinculado/);
    expect(() =>
      run(b, { action: "erpConvertOrder", id: b.erp.orders[0].id, reason: "Converter" })
    ).toThrow(/paralela/);
    expect(() =>
      run(b, {
        action: "erpReviewOrder",
        id: b.erp.orders[0].id,
        status: "cancelled",
        reason: "Cancelar",
      })
    ).toThrow(/vinculado/);
  });
  it("blocks operation and monthly billing until implementation is ready", () => {
    let b = contract();
    expect(() => service(b)).toThrow(/implantação/);
    expect(() =>
      run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" })
    ).toThrow(/bloqueada/);
    expect(contractFlowOverview(b, "2026-10", "2026-10-12")[0]).toMatchObject({
      implementationLate: true,
      readyForMonthly: false,
    });
    b = ready(b);
    expect(contractFlowOverview(b, "2026-10", "2026-10-12")[0].readyForMonthly).toBe(true);
    expect(() => service(b, { date: "2026-09-30" })).toThrow(/aceite/);
    expect(() =>
      run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-09" })
    ).toThrow(/bloqueada/);
  });
  it("respects an explicit contract allowing billing during implementation", () => {
    let b = contract({ billingRequiresReadiness: false });
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" });
    expect(b.titles[0].status).toBe("draft");
    expect(() => service(b)).toThrow(/implantação/);
  });
  it("requires independent service review and prevents duplicate service billing", () => {
    let b = service(ready(contract()));
    const id = b.services[0].id;
    const review = {
      action: "flowReviewService",
      contractId: b.contracts[0].id,
      serviceId: id,
      evidence: "Execução conferida",
    };
    expect(() => run(b, { action: "billService", id, dueDate: "2026-10-20" })).toThrow(
      /conferência/
    );
    expect(() => run(b, review)).toThrow(/outro administrador/);
    b = run(b, review, "reviewer");
    b = run(b, { action: "billService", id, dueDate: "2026-10-20" });
    expect(b.titles[0]).toMatchObject({
      amountCents: 10000,
      contractId: b.contracts[0].id,
      status: "draft",
    });
    expect(() => run(b, { action: "billService", id, dueDate: "2026-10-20" })).toThrow(/já possui/);
  });
  it("keeps included services out of extra charges", () => {
    let b = service(ready(contract()), { billingMode: "included" });
    b = run(
      b,
      {
        action: "flowReviewService",
        contractId: b.contracts[0].id,
        serviceId: b.services[0].id,
        evidence: "Conferência sintética",
      },
      "reviewer"
    );
    expect(() =>
      run(b, { action: "billService", id: b.services[0].id, dueDate: "2026-10-20" })
    ).toThrow(/incluído/);
  });
  it("separates forecast, titles, principal settled and cash including retention", () => {
    let b = ready(contract());
    const cid = b.contracts[0].id;
    b = run(b, { action: "recurring", contractId: cid, month: "2026-10" });
    expect(() => run(b, { action: "recurring", contractId: cid, month: "2026-10" })).toThrow(
      /já possui/
    );
    const id = b.titles[0].id;
    b = run(b, { action: "review", id, status: "submitted", reason: "Para aprovar" });
    b = run(b, { action: "review", id, status: "approved", reason: "Aprovado" }, "approver");
    b = run(b, { action: "account", name: "Banco sintético" });
    b = run(b, {
      action: "settle",
      data: {
        titleId: id,
        accountId: b.accounts[0].id,
        date: "2026-11-10",
        principalCents: 6000,
        interestCents: 100,
        fineCents: 0,
        discountCents: 0,
        withholdingCents: 500,
        evidence: "Comprovante sintético",
      },
    });
    expect(contractFlowOverview(b, "2026-10", "2026-11-10")[0]).toMatchObject({
      billed: 10000,
      received: 5600,
      remaining: 4000,
      expectedRevenue: 10000,
      recurringExists: true,
    });
    b = run(b, { action: "reverse", id: b.settlements[0].id, reason: "Estorno sintético" });
    expect(contractFlowOverview(b, "2026-10", "2026-11-10")[0]).toMatchObject({
      received: 0,
      remaining: 10000,
    });
  });
  it("keeps replay idempotent and rejects stale writes", () => {
    const b = proposal();
    const command = FinanceCommandSchema.parse({
      ...create(b),
      requestId: randomUUID(),
      expectedVersion: b.version,
    });
    const next = applyFinanceCommand(b, command, "creator", now, "same");
    expect(applyFinanceCommand(next, command, "creator", now, "same")).toBe(next);
    expect(() => run(next, { ...create(b), expectedVersion: b.version })).toThrow(/outra sessão/);
  });
  it("blocks direct editing of the approved contract", () => {
    const b = contract();
    const { id, ...data } = b.contracts[0];
    expect(() =>
      run(b, {
        action: "editContract",
        id,
        data: { ...data, monthlyCents: 1 },
        reason: "Alterar preço",
      })
    ).toThrow(/aditivo/);
  });
  it("rejects manual charges against a managed contract", () => {
    const b = ready(contract());
    expect(() =>
      run(b, {
        action: "title",
        data: {
          kind: "receivable",
          party: "Cliente sintético",
          description: "Cobrança paralela",
          amountCents: 10000,
          competence: "2026-10",
          dueDate: "2026-10-20",
          category: "SST",
          center: "SST",
          contractId: b.contracts[0].id,
          sourceKey: "manual-duplicate",
          externalReference: "",
          evidence: "Documento sintético",
        },
      })
    ).toThrow(/Use mensalidade/);
  });
  it("blocks billing and service review on inactive contracts", () => {
    let b = service(ready(contract()));
    b = run(b, {
      action: "contractStatus",
      id: b.contracts[0].id,
      active: false,
      reason: "Suspenso",
    });
    expect(() =>
      run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" })
    ).toThrow(/inativo/);
    expect(() =>
      run(
        b,
        {
          action: "flowReviewService",
          contractId: b.contracts[0].id,
          serviceId: b.services[0].id,
          evidence: "Conferido",
        },
        "reviewer"
      )
    ).toThrow(/inativo/);
  });
});

describe("existing contract enrollment", () => {
  function legacy() {
    return run(proposal(), {
      action: "contract",
      data: {
        name: "Contrato existente",
        client: "Cliente sintético",
        center: "SST",
        monthlyCents: 10000,
        dueDay: 20,
        active: true,
      },
    });
  }
  const enroll = (b: FinanceBook, extra = {}) => ({
    action: "enrollExistingContract",
    contractId: b.contracts[0].id,
    partyId: b.erp.parties[0].id,
    owner: "Operação teste",
    acceptedOn: "2026-01-01",
    acceptanceEvidence: "Contrato sintético arquivado",
    implementationDue: "2026-10-20",
    billingRequiresReadiness: true,
    billingStartMonth: "2026-10",
    billingEvidence: "Omie conferido até setembro; sem cobranças futuras",
    existingBillingReviewed: true,
    monthlyPriceConfirmed: true,
    ...extra,
  });
  it("keeps historical drafts editable before cutover while rejecting a move into the managed period", () => {
    let b = legacy();
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-09" });
    b = run(b, enroll(b));
    const t = b.titles[0];
    const edit = {
      description: t.description,
      amountCents: 9000,
      competence: t.competence,
      dueDate: "2026-10-25",
      category: t.category,
      center: t.center,
      contractId: t.contractId,
      evidence: t.evidence,
    };
    b = run(b, {
      action: "editTitle",
      id: t.id,
      data: edit,
      reason: "Correção de rascunho histórico",
    });
    expect(b.titles[0].amountCents).toBe(9000);
    expect(() =>
      run(b, {
        action: "editTitle",
        id: t.id,
        data: { ...edit, competence: "2026-10" },
        reason: "Mover competência",
      })
    ).toThrow(/fluxo integrado/);
  });
  it("uses the explicitly selected customer for new monthly and service charges without rewriting history", () => {
    let b = legacy();
    b.contracts[0].client = "Nome legado abreviado";
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-09" });
    b = ready(run(b, enroll(b)));
    b.erp.parties[0].name = "Nome atual do cliente sintético";
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" });
    expect(b.titles[0].party).toBe("Nome legado abreviado");
    expect(b.titles[1].party).toBe("Nome atual do cliente sintético");
    b = service(b);
    b = run(
      b,
      {
        action: "flowReviewService",
        contractId: b.contracts[0].id,
        serviceId: b.services[0].id,
        evidence: "Execução conferida",
      },
      "reviewer"
    );
    b = run(b, { action: "billService", id: b.services[0].id, dueDate: "2026-10-20" });
    expect(b.titles[2].party).toBe("Nome atual do cliente sintético");
    expect(contractFlowOverview(b, "2026-09", "2026-10-12")[0].expectedRevenue).toBe(0);
    b.erp.parties[0].document = "98765432000100";
    expect(() =>
      run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-11" })
    ).toThrow(/documento/);
  });
  it("preserves contracts, historic titles, services and settlements without creating an order", () => {
    let b = legacy();
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-09" });
    const next = run(b, enroll(b));
    for (const key of ["contracts", "titles", "services", "settlements", "erp"] as const)
      expect(next[key]).toEqual(b[key]);
    expect(next.contractFlows[0]).toMatchObject({
      orderId: null,
      contractId: b.contracts[0].id,
      customerDocument: "12345678000190",
      migration: { billingStartMonth: "2026-10", partyId: b.erp.parties[0].id },
    });
    expect(FinanceBookSchema.parse(next).contractFlows).toEqual(next.contractFlows);
    expect(() => run(next, enroll(next))).toThrow(/já vinculado/);
    expect(contractFlowOverview(next, "2026-09", "2026-10-12")[0]).toMatchObject({
      billed: 10000,
      readyForMonthly: false,
    });
  });
  it("requires explicit price and previous billing confirmations", () => {
    const b = legacy();
    expect(() => run(b, enroll(b, { existingBillingReviewed: false }))).toThrow();
    expect(() => run(b, enroll(b, { monthlyPriceConfirmed: false }))).toThrow();
    expect(() => run(b, enroll(b, { billingEvidence: "" }))).toThrow();
  });
  it("rejects inactive contracts, suppliers and customers missing documents", () => {
    const b = legacy();
    b.contracts[0].active = false;
    expect(() => run(b, enroll(b))).toThrow(/inativo/);
    b.contracts[0].active = true;
    b.erp.parties[0].role = "supplier";
    expect(() => run(b, enroll(b))).toThrow(/cliente ativo/);
    b.erp.parties[0].role = "customer";
    b.erp.parties[0].document = "";
    expect(() => run(b, enroll(b))).toThrow(/documento/);
  });
  it("rejects backdated, closed, invalid and already billed cutovers", () => {
    let b = legacy();
    expect(() => run(b, enroll(b, { billingStartMonth: "2026-09" }))).toThrow(
      /primeira competência/
    );
    expect(() => run(b, enroll(b, { acceptedOn: "2026-10-13" }))).toThrow(/aceite/);
    expect(() => run(b, enroll(b, { implementationDue: "2025-12-31" }))).toThrow(/aceite/);
    b.periods.push({
      month: "2026-10",
      closed: true,
      evidence: "Fechamento teste",
      updatedBy: "reviewer",
      updatedAt: now,
    });
    expect(() => run(b, enroll(b))).toThrow(/fechada/);
    b.periods = [];
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-11" });
    expect(() => run(b, enroll(b))).toThrow(/Já existem cobranças/);
    expect(run(b, enroll(b, { billingStartMonth: "2026-12" })).contractFlows).toHaveLength(1);
  });
  it("enforces cutover on monthly charges, old unbilled services and new production", () => {
    let b = service(legacy(), { date: "2026-09-10" });
    const oldService = b.services[0].id;
    expect(() => run(b, enroll(b))).toThrow(/serviços avulsos anteriores/);
    b = run(b, { action: "billService", id: oldService, dueDate: "2026-10-20" });
    b = run(b, enroll(b));
    expect(() => service(b)).toThrow(/implantação/);
    b = ready(b);
    expect(() =>
      run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-09" })
    ).toThrow(/entrada no fluxo/);
    expect(() => service(b, { date: "2026-09-30" })).toThrow(/entrada no fluxo/);
    expect(() => run(b, { action: "billService", id: oldService, dueDate: "2026-10-20" })).toThrow(
      /entrada no fluxo/
    );
    b = run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" });
    expect(b.titles.at(-1)?.status).toBe("draft");
    expect(() =>
      run(b, { action: "recurring", contractId: b.contracts[0].id, month: "2026-10" })
    ).toThrow(/já possui/);
  });
  it("does not mistake a new order for the migrated contract's null order", () => {
    const before = legacy();
    const b = run(before, enroll(before));
    const order = b.erp.orders[0];
    expect(() =>
      run(b, {
        action: "erpOrder",
        id: null,
        data: {
          kind: "sale",
          number: "NOVA-PROPOSTA",
          partyId: order.partyId,
          categoryId: order.categoryId,
          centerId: order.centerId,
          competence: "2026-10",
          dueDate: "2026-10-20",
          items: order.items,
          discountCents: 0,
          evidence: "Nova proposta sintética",
        },
        reason: "Criar nova proposta",
      })
    ).not.toThrow();
  });
  it("keeps enrollment replay idempotent and records its evidence in audit", () => {
    const b = legacy();
    const command = FinanceCommandSchema.parse({
      ...enroll(b),
      requestId: randomUUID(),
      expectedVersion: b.version,
    });
    const next = applyFinanceCommand(b, command, "creator", now, "enrollment");
    expect(applyFinanceCommand(next, command, "creator", now, "enrollment")).toBe(next);
    expect(next.audit.at(-1)?.action).toBe("enrollExistingContract");
    expect(() => run(next, { ...enroll(b), expectedVersion: b.version })).toThrow(/outra sessão/);
  });
});
