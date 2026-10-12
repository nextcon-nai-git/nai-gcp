import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  FinanceBookSchema,
  FinanceCommandSchema,
  applyFinanceCommand,
  emptyFinanceBook,
  closingIssues,
  type FinanceBook,
} from "./operations";
import { erpReports, reportCsv } from "./erp-reports";
const at = "2026-10-12T14:00:00Z";
function run(book: FinanceBook, input: object, actor = "author") {
  const c = FinanceCommandSchema.parse({
    ...input,
    requestId: randomUUID(),
    expectedVersion: book.version,
  });
  return applyFinanceCommand(book, c, actor, at, JSON.stringify(c));
}
function setup(kind: "sale" | "purchase" = "sale") {
  let b = run(emptyFinanceBook(), {
    action: "erpParty",
    id: null,
    data: {
      name: "Empresa sintética",
      document: "AB.123-test",
      role: "both",
      email: "",
      phone: "",
      active: true,
    },
    reason: "Teste sintético",
  });
  b = run(b, {
    action: "erpCategory",
    id: null,
    data: {
      code: "1.1",
      name: "Serviços",
      kind: kind === "sale" ? "revenue" : "expense",
      active: true,
    },
    reason: "Teste sintético",
  });
  b = run(b, {
    action: "erpCenter",
    id: null,
    data: { code: "SST", name: "Operação", active: true },
    reason: "Teste sintético",
  });
  const data = {
    kind,
    number: "PED-1",
    partyId: b.erp.parties[0].id,
    categoryId: b.erp.categories[0].id,
    centerId: b.erp.centers[0].id,
    competence: "2026-10",
    dueDate: "2026-10-10",
    items: [{ description: "Exame teste", quantity: 3, unitCents: 3333 }],
    discountCents: 1,
    evidence: "Documento de teste",
  };
  return { b, data };
}
function converted(kind: "sale" | "purchase" = "sale") {
  const initial = setup(kind);
  let b = initial.b;
  const data = initial.data;
  b = run(b, { action: "erpOrder", id: null, data, reason: "Teste sintético" });
  const id = b.erp.orders[0].id;
  b = run(b, { action: "erpReviewOrder", id, status: "submitted", reason: "Conferido" });
  b = run(b, { action: "erpReviewOrder", id, status: "approved", reason: "Conferido" }, "reviewer");
  b = run(b, { action: "erpConvertOrder", id, reason: "Documento conferido" });
  return b;
}
describe("ERP financeiro integrado", () => {
  it("reads the deployed schema without losing history and defaults the new module", () => {
    const legacy: Partial<FinanceBook> = emptyFinanceBook();
    delete legacy.erp;
    expect(FinanceBookSchema.parse(legacy).erp).toEqual({
      parties: [],
      categories: [],
      centers: [],
      orders: [],
      followUps: [],
    });
  });
  it("normalizes document duplication across active and inactive parties", () => {
    const { b } = setup();
    expect(() =>
      run(b, {
        action: "erpParty",
        id: null,
        data: { ...b.erp.parties[0], id: undefined, name: "Outro nome", document: "ab123test" },
        reason: "Teste",
      })
    ).toThrow("já cadastrado");
  });
  it.each(["sale", "purchase"] as const)(
    "converts %s once with exact cents and preserved provenance",
    (kind) => {
      const b = converted(kind),
        o = b.erp.orders[0],
        t = b.titles[0];
      expect(t).toMatchObject({
        amountCents: 9998,
        kind: kind === "sale" ? "receivable" : "payable",
        source: "order",
        status: "draft",
        sourceKey: `order:${o.id}`,
      });
      expect(o).toMatchObject({ status: "converted", titleId: t.id, approvedBy: "reviewer" });
      expect(() =>
        run(b, { action: "erpConvertOrder", id: o.id, reason: "Segunda tentativa" })
      ).toThrow("ainda não convertido");
      expect(() =>
        run(b, {
          action: "editTitle",
          id: t.id,
          data: {
            description: "Alterado",
            amountCents: 1,
            competence: t.competence,
            dueDate: t.dueDate,
            category: t.category,
            center: t.center,
            contractId: null,
            evidence: "Teste",
          },
          reason: "Teste",
        })
      ).toThrow("originado de pedido");
      expect(b.titles).toHaveLength(1);
    }
  );
  it("requires independent approval and rejects changing an approved order", () => {
    const initial = setup();
    let b = initial.b;
    const data = initial.data;
    b = run(b, { action: "erpOrder", id: null, data, reason: "Teste" });
    const id = b.erp.orders[0].id;
    expect(() => run(b, { action: "erpConvertOrder", id, reason: "Teste" })).toThrow("aprovado");
    b = run(b, { action: "erpReviewOrder", id, status: "submitted", reason: "Teste" });
    expect(() =>
      run(b, { action: "erpReviewOrder", id, status: "approved", reason: "Teste" })
    ).toThrow("outra pessoa");
    b = run(b, { action: "erpReviewOrder", id, status: "approved", reason: "Teste" }, "reviewer");
    expect(() =>
      run(b, { action: "erpOrder", id, data: { ...data, discountCents: 2 }, reason: "Teste" })
    ).toThrow("rascunho");
  });
  it("returns rejected edits to draft and blocks a reviewer from rewriting an author's order", () => {
    const initial = setup();
    let b = initial.b;
    const data = initial.data;
    b = run(b, { action: "erpOrder", id: null, data, reason: "Teste" });
    const id = b.erp.orders[0].id;
    b = run(b, { action: "erpReviewOrder", id, status: "submitted", reason: "Teste" });
    b = run(b, { action: "erpReviewOrder", id, status: "rejected", reason: "Teste" }, "reviewer");
    expect(() => run(b, { action: "erpOrder", id, data, reason: "Teste" }, "reviewer")).toThrow(
      "criador"
    );
    b = run(b, { action: "erpOrder", id, data: { ...data, discountCents: 2 }, reason: "Teste" });
    expect(b.erp.orders[0]).toMatchObject({ status: "draft", totalCents: 9997, approvedBy: null });
  });
  it("rejects duplicate order numbers, inactive masters, incompatible categories and negative totals", () => {
    const initial = setup();
    let b = initial.b;
    const data = initial.data;
    expect(() =>
      run(b, {
        action: "erpOrder",
        id: null,
        data: { ...data, discountCents: 10000 },
        reason: "Teste",
      })
    ).toThrow("Total");
    expect(() =>
      run(b, { action: "erpOrder", id: null, data: { ...data, kind: "purchase" }, reason: "Teste" })
    ).toThrow("Natureza");
    b = run(b, { action: "erpOrder", id: null, data, reason: "Teste" });
    expect(() => run(b, { action: "erpOrder", id: null, data, reason: "Teste" })).toThrow("Número");
    b = run(b, {
      action: "erpParty",
      id: b.erp.parties[0].id,
      data: { ...b.erp.parties[0], active: false },
      reason: "Teste",
    });
    expect(() =>
      run(b, { action: "erpOrder", id: null, data: { ...data, number: "PED-2" }, reason: "Teste" })
    ).toThrow("ativos");
  });
  it("preserves approved snapshots after master edits and cancels both order and unpaid title", () => {
    let b = converted();
    const p = b.erp.parties[0];
    b = run(b, {
      action: "erpParty",
      id: p.id,
      data: { ...p, name: "Novo nome" },
      reason: "Atualização",
    });
    expect(b.titles[0].party).toBe("Empresa sintética");
    b = run(b, {
      action: "review",
      id: b.titles[0].id,
      status: "cancelled",
      reason: "Cancelamento conferido",
    });
    expect(b.erp.orders[0]).toMatchObject({ status: "cancelled", titleId: b.titles[0].id });
    expect(b.titles[0].status).toBe("cancelled");
  });
  it("prevents mutation of closed competences and reports unconverted orders as closing issues", () => {
    const initial = setup();
    let b = initial.b;
    const data = initial.data;
    b = run(b, { action: "erpOrder", id: null, data, reason: "Teste" });
    expect(closingIssues(b, "2026-10").join(" ")).toContain("pedidos");
    b.periods.push({
      month: "2026-10",
      closed: true,
      evidence: "Teste",
      updatedAt: at,
      updatedBy: "reviewer",
    });
    expect(() =>
      run(b, {
        action: "erpOrder",
        id: b.erp.orders[0].id,
        data: { ...data, competence: "2026-11" },
        reason: "Teste",
      })
    ).toThrow("fechado");
    expect(() =>
      run(b, {
        action: "erpReviewOrder",
        id: b.erp.orders[0].id,
        status: "submitted",
        reason: "Teste",
      })
    ).toThrow("fechado");
  });
  it("keeps contact history separate from receipts and calculates residual aging and cash adjustments", () => {
    let b = converted();
    const id = b.titles[0].id;
    b = run(b, { action: "review", id, status: "submitted", reason: "Teste" });
    b = run(b, { action: "review", id, status: "approved", reason: "Teste" }, "reviewer");
    b = run(b, { action: "account", name: "Banco sintético" });
    b = run(b, {
      action: "settle",
      data: {
        titleId: id,
        accountId: b.accounts[0].id,
        date: "2026-10-11",
        principalCents: 3000,
        interestCents: 100,
        fineCents: 0,
        discountCents: 10,
        withholdingCents: 20,
        evidence: "Teste",
      },
    });
    const follow = {
      titleId: id,
      date: "2026-10-12",
      nextDate: "2026-10-13",
      outcome: "promise",
      note: "Promessa sintética",
    };
    b = run(b, { action: "erpFollowUp", data: follow });
    expect(() =>
      run(b, { action: "erpFollowUp", data: { ...follow, nextDate: "2026-10-01" } })
    ).toThrow("anteceder");
    const r = erpReports(b, "2026-10", "2026-10-12");
    expect(r.aging[2]).toMatchObject({ receivable: 6998, payable: 0, count: 1 });
    expect(r.cash).toEqual([{ date: "2026-10-11", in: 3070, out: 0 }]);
    expect(r.revenue).toBe(9998);
    expect(r.receivables[0].followUp?.outcome).toBe("promise");
    expect(b.settlements).toHaveLength(1);
  });
  it("protects report exports against spreadsheet formulas", () => {
    const csv = reportCsv([["=HYPERLINK(1)", " @test", -123, 'quote"test']]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("' @test");
    expect(csv).toContain('"-123"');
    expect(csv).toContain('quote""test');
  });
});
