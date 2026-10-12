import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  applyFinanceCommand,
  emptyFinanceBook,
  FinanceBookSchema,
  FinanceCommandSchema,
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
