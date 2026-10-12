import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  applyFinanceCommand,
  emptyFinanceBook,
  FinanceCommandSchema,
  closingIssues,
  financeSummary,
  outstanding,
  parseBrl,
  financeCsv,
  type FinanceBook,
} from "./operations";
const at = "2026-10-12T12:00:00Z";
const data = {
  kind: "receivable",
  party: "Cliente sintético",
  description: "Exame",
  amountCents: 10001,
  competence: "2026-09",
  dueDate: "2026-10-10",
  category: "Exames",
  center: "AVP",
  contractId: null,
  sourceKey: "NF-TEST-1",
  externalReference: "",
  evidence: "Documento sintético de teste",
};
function run(book: FinanceBook, payload: object, actor = "creator") {
  const c = FinanceCommandSchema.parse({
    requestId: randomUUID(),
    expectedVersion: book.version,
    ...payload,
  });
  return applyFinanceCommand(book, c, actor, at, JSON.stringify(c));
}
function base() {
  let b = run(emptyFinanceBook(), { action: "account", name: "Banco de teste" });
  b = run(b, { action: "title", data });
  const tid = b.titles[0].id;
  b = run(b, { action: "review", id: tid, status: "submitted", reason: "Conferido" });
  b = run(b, { action: "review", id: tid, status: "approved", reason: "Conferido" }, "approver");
  return b;
}
function settle(b: FinanceBook, principalCents = 4000) {
  return run(b, {
    action: "settle",
    data: {
      titleId: b.titles[0].id,
      accountId: b.accounts[0].id,
      date: "2026-10-10",
      principalCents,
      interestCents: 100,
      fineCents: 50,
      discountCents: 20,
      withholdingCents: 30,
      evidence: "Comprovante sintético",
    },
  });
}
describe("financial controls", () => {
  it("preserves exact cents and rejects ambiguous monetary input", () => {
    expect(parseBrl("1234,56")).toBe(123456);
    expect(parseBrl("-0,01")).toBe(-1);
    expect(() => parseBrl("1.234,56")).toThrow();
    expect(() => parseBrl("12,345")).toThrow();
  });
  it("requires independent approval and preserves failed transaction input", () => {
    let b = run(emptyFinanceBook(), { action: "title", data });
    const t = b.titles[0];
    expect(() =>
      run(b, { action: "review", id: t.id, status: "approved", reason: "Conferido" }, "approver")
    ).toThrow("Transição");
    b = run(b, { action: "review", id: t.id, status: "submitted", reason: "Conferido" });
    expect(() =>
      run(b, { action: "review", id: t.id, status: "approved", reason: "Conferido" })
    ).toThrow("outro administrador");
    expect(b.titles[0].status).toBe("submitted");
  });
  it("liquidates principal separately from cash and separates September competence / October cash", () => {
    const b = settle(base());
    expect(outstanding(b, b.titles[0])).toBe(6001);
    expect(financeSummary(b, "2026-09", "2026-10-12")).toMatchObject({
      revenue: 10001,
      cashNet: 0,
    });
    expect(financeSummary(b, "2026-10", "2026-10-12")).toMatchObject({ revenue: 0, cashNet: 4100 });
    expect(() => settle(b, 7000)).toThrow("saldo residual");
  });
  it("permits October payment of a closed September competence without changing September", () => {
    let b = base();
    b = run(b, {
      action: "statement",
      data: {
        accountId: b.accounts[0].id,
        month: "2026-09",
        openingCents: 0,
        closingCents: 0,
        evidence: "Extrato sem movimentos",
      },
    });
    b = run(b, {
      action: "period",
      month: "2026-09",
      close: true,
      evidence: "Competência conferida",
    });
    b = settle(b);
    expect(b.settlements).toHaveLength(1);
    expect(() =>
      run(b, { action: "review", id: b.titles[0].id, status: "cancelled", reason: "Conferido" })
    ).toThrow("fechado");
  });
  it("rejects unauthorized state fields and invalid real dates", () => {
    expect(
      FinanceCommandSchema.safeParse({
        action: "title",
        data: { ...data, dueDate: "2026-02-30" },
        requestId: randomUUID(),
        expectedVersion: 0,
        actor: "approver",
      }).success
    ).toBe(false);
  });
  it("deduplicates retries and rejects stale writes", () => {
    const b = emptyFinanceBook();
    const c = FinanceCommandSchema.parse({
      action: "account",
      name: "Banco",
      requestId: randomUUID(),
      expectedVersion: 0,
    });
    const saved = applyFinanceCommand(b, c, "creator", at, "same");
    expect(applyFinanceCommand(saved, c, "creator", at, "same")).toBe(saved);
    expect(() => applyFinanceCommand(saved, c, "creator", at, "different")).toThrow("Chave");
    expect(() =>
      applyFinanceCommand(saved, { ...c, requestId: randomUUID() }, "creator", at, "new")
    ).toThrow("outra sessão");
  });
  it("matches exact cash and prevents reuse or cancellation of settled titles", () => {
    let b = settle(base());
    b = run(b, {
      action: "bank",
      accountId: b.accounts[0].id,
      rows: [
        { bankId: "bank-1", date: "2026-10-10", amountCents: 4100, memo: "Recebimento teste" },
      ],
    });
    const bid = b.bank[0].id,
      sid = b.settlements[0].id;
    b = run(b, { action: "match", id: bid, settlementIds: [sid] });
    expect(() => run(b, { action: "match", id: bid, settlementIds: [sid] })).toThrow(
      "já conciliado"
    );
    expect(() => run(b, { action: "reverse", id: sid, reason: "Ajuste comprovado" })).toThrow(
      "Desfaça"
    );
    expect(() =>
      run(b, {
        action: "review",
        id: b.titles[0].id,
        status: "cancelled",
        reason: "Ajuste comprovado",
      })
    ).toThrow("Estorne");
    b = run(b, { action: "unmatch", id: bid, reason: "Ajuste comprovado" });
    b = run(b, { action: "reverse", id: sid, reason: "Ajuste comprovado" });
    expect(outstanding(b, b.titles[0])).toBe(10001);
  });
  it("rejects bank differences, duplicate matches and cross-account matches", () => {
    let b = settle(base());
    b = run(b, {
      action: "bank",
      accountId: b.accounts[0].id,
      rows: [{ bankId: "bank-1", date: "2026-10-10", amountCents: 4101, memo: "Recebimento" }],
    });
    expect(() =>
      run(b, { action: "match", id: b.bank[0].id, settlementIds: [b.settlements[0].id] })
    ).toThrow("difere");
    expect(() =>
      run(b, {
        action: "match",
        id: b.bank[0].id,
        settlementIds: [b.settlements[0].id, b.settlements[0].id],
      })
    ).toThrow("repetida");
    b = run(b, { action: "account", name: "Outro banco" });
    b = run(b, {
      action: "bank",
      accountId: b.accounts[1].id,
      rows: [{ bankId: "bank-2", date: "2026-10-10", amountCents: 4100, memo: "Recebimento" }],
    });
    expect(() =>
      run(b, { action: "match", id: b.bank[1].id, settlementIds: [b.settlements[0].id] })
    ).toThrow("incompatível");
  });
  it("imports the same bank transaction once and rejects conflicting stable IDs atomically", () => {
    let b = base();
    const cmd = {
      action: "bank",
      accountId: b.accounts[0].id,
      rows: [{ bankId: "bank-1", date: "2026-10-10", amountCents: 500, memo: "Teste" }],
    };
    b = run(b, cmd);
    b = run(b, cmd);
    expect(b.bank).toHaveLength(1);
    expect(() => run(b, { ...cmd, rows: [{ ...cmd.rows[0], amountCents: 501 }] })).toThrow(
      "conflitante"
    );
    expect(b.bank[0].amountCents).toBe(500);
  });
  it("requires balanced statements and complete reconciliation before closing and locks cash changes", () => {
    let b = settle(base());
    expect(closingIssues(b, "2026-10").join(" ")).toContain("sem conciliação");
    b = run(b, {
      action: "bank",
      accountId: b.accounts[0].id,
      rows: [{ bankId: "bank-1", date: "2026-10-10", amountCents: 4100, memo: "Teste" }],
    });
    b = run(b, { action: "match", id: b.bank[0].id, settlementIds: [b.settlements[0].id] });
    b = run(b, {
      action: "statement",
      data: {
        accountId: b.accounts[0].id,
        month: "2026-10",
        openingCents: 0,
        closingCents: 4101,
        evidence: "Extrato teste",
      },
    });
    expect(closingIssues(b, "2026-10").join(" ")).toContain("divergente");
    b = run(b, {
      action: "statement",
      data: { ...b.statements[0], id: undefined, closingCents: 4100 },
    });
    expect(closingIssues(b, "2026-10")).toEqual([]);
    b = run(b, {
      action: "period",
      month: "2026-10",
      close: true,
      evidence: "Conferido por responsável",
    });
    expect(() => run(b, { action: "unmatch", id: b.bank[0].id, reason: "Teste" })).toThrow(
      "fechado"
    );
    expect(() => settle(b)).toThrow("fechado");
    b = run(b, {
      action: "period",
      month: "2026-10",
      close: false,
      evidence: "Reabertura para correção",
    });
    expect(b.periods[0].closed).toBe(false);
  });
  it("handles internal transfers without recording fictitious income or expenses", () => {
    let b = run(emptyFinanceBook(), { action: "account", name: "Banco A" });
    b = run(b, { action: "account", name: "Banco B" });
    for (const [i, amount] of [-10000, 10000].entries())
      b = run(b, {
        action: "bank",
        accountId: b.accounts[i].id,
        rows: [
          { bankId: `bank-${i}`, date: "2026-10-10", amountCents: amount, memo: "Transferência" },
        ],
      });
    b = run(b, {
      action: "transfer",
      id: b.bank[0].id,
      peerId: b.bank[1].id,
      reason: "Transferência própria",
    });
    expect(financeSummary(b, "2026-10", "2026-10-12")).toMatchObject({
      revenue: 0,
      expense: 0,
      result: 0,
      cashNet: 0,
    });
    expect(b.bank.every((r) => r.transferPeer)).toBe(true);
  });
  it("splits installments without losing cents and clamps month-end dates", () => {
    const b = run(emptyFinanceBook(), {
      action: "installments",
      count: 3,
      data: { ...data, dueDate: "2026-01-31" },
    });
    expect(b.titles.map((t) => t.amountCents)).toEqual([3334, 3334, 3333]);
    expect(b.titles.map((t) => t.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(b.titles.every((t) => t.competence === "2026-09")).toBe(true);
  });
  it("generates recurring titles once and only applies price revisions to future titles", () => {
    let b = run(emptyFinanceBook(), {
      action: "contract",
      data: {
        name: "Contrato teste",
        client: "Cliente",
        center: "AVP",
        monthlyCents: 50000,
        dueDay: 10,
        active: true,
      },
    });
    const id = b.contracts[0].id;
    b = run(b, { action: "recurring", contractId: id, month: "2026-09" });
    expect(() => run(b, { action: "recurring", contractId: id, month: "2026-09" })).toThrow(
      "já possui"
    );
    b = run(b, {
      action: "editContract",
      id,
      data: { ...b.contracts[0], monthlyCents: 55000 },
      reason: "Reajuste contratual",
    });
    b = run(b, { action: "recurring", contractId: id, month: "2026-10" });
    expect(b.titles.map((t) => t.amountCents)).toEqual([50000, 55000]);
    expect(b.audit.at(-2)?.details).toContain("55000");
  });
  it("does not double-charge services included in monthly contracts", () => {
    let b = run(emptyFinanceBook(), {
      action: "contract",
      data: {
        name: "Contrato",
        client: "Cliente",
        center: "AVP",
        monthlyCents: 50000,
        dueDay: 10,
        active: true,
      },
    });
    b = run(b, {
      action: "service",
      data: {
        contractId: b.contracts[0].id,
        date: "2026-10-10",
        description: "Exame",
        supplier: "Clínica teste",
        city: "Curitiba PR",
        quantity: 2,
        unitRevenueCents: 0,
        unitCostCents: 4000,
        billingMode: "included",
        evidence: "Medição teste",
      },
    });
    expect(financeSummary(b, "2026-10", "2026-10-12").unbilled).toEqual([]);
    expect(() =>
      run(b, { action: "billService", id: b.services[0].id, dueDate: "2026-10-20" })
    ).toThrow("incluído");
  });
  it("requires explicit posted costs rather than double-counting operational production cost", () => {
    let b = base();
    b = run(b, { action: "budget", data: { month: "2026-09", center: "AVP", amountCents: 5000 } });
    expect(financeSummary(b, "2026-09", "2026-10-12").budgets[0]).toMatchObject({
      actual: 0,
      remaining: 5000,
    });
  });
  it("neutralizes spreadsheet formulas in exports", () => {
    const b = run(emptyFinanceBook(), {
      action: "title",
      data: { ...data, party: "=HYPERLINK(test)" },
    });
    expect(financeCsv(b)).toContain("'=HYPERLINK(test)");
  });
});

it("returns cancelled service billing to the unbilled queue while preserving its cancelled title", () => {
  let b = run(emptyFinanceBook(), {
    action: "contract",
    data: {
      name: "Contrato",
      client: "Cliente",
      center: "AVP",
      monthlyCents: 0,
      dueDay: 10,
      active: true,
    },
  });
  b = run(b, {
    action: "service",
    data: {
      contractId: b.contracts[0].id,
      date: "2026-10-10",
      description: "Exame",
      supplier: "Clínica teste",
      city: "Curitiba PR",
      quantity: 1,
      unitRevenueCents: 6000,
      unitCostCents: 4000,
      billingMode: "separate",
      evidence: "Medição teste",
    },
  });
  b = run(b, { action: "billService", id: b.services[0].id, dueDate: "2026-10-20" });
  b = run(b, {
    action: "review",
    id: b.titles[0].id,
    status: "cancelled",
    reason: "Correção da cobrança",
  });
  expect(financeSummary(b, "2026-10", "2026-10-12").unbilled).toHaveLength(1);
  b = run(b, { action: "billService", id: b.services[0].id, dueDate: "2026-10-25" });
  expect(b.titles).toHaveLength(2);
  expect(b.titles[0].status).toBe("cancelled");
});
