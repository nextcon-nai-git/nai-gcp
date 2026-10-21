import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  applyFinanceCommand,
  closingIssues,
  emptyFinanceBook,
  FinanceCommandSchema,
  reconciliationIndex,
  type FinanceBook,
} from "./operations";

function fixture(): FinanceBook {
  const book = emptyFinanceBook();
  book.accounts.push({ id: "a1", name: "Conta sintética" });
  book.titles.push({
    id: "t1",
    kind: "receivable",
    party: "Cliente sintético",
    description: "ASO de teste",
    amountCents: 10000,
    competence: "2026-10",
    dueDate: "2026-10-20",
    category: "Exames",
    center: "SST",
    contractId: null,
    sourceKey: "teste",
    source: "manual",
    externalReference: "",
    evidence: "Documento sintético",
    status: "approved",
    createdBy: "creator",
    approvedBy: "approver",
  });
  book.settlements.push({
    id: "s1",
    titleId: "t1",
    accountId: "a1",
    date: "2026-10-20",
    principalCents: 10000,
    discountCents: 200,
    withholdingCents: 800,
    interestCents: 300,
    fineCents: 100,
    evidence: "Comprovante sintético",
    reversed: false,
  });
  book.bank.push({
    id: "b1",
    accountId: "a1",
    bankId: "linha1",
    date: "2026-10-20",
    amountCents: 9400,
    memo: "Depósito sintético",
    settlementIds: ["s1"],
    transferPeer: null,
  });
  book.statements.push({
    id: "st1",
    accountId: "a1",
    month: "2026-10",
    openingCents: 0,
    closingCents: 9400,
    evidence: "Extrato sintético",
  });
  return book;
}

function close(book: FinanceBook) {
  return applyFinanceCommand(
    book,
    FinanceCommandSchema.parse({
      requestId: randomUUID(),
      expectedVersion: book.version,
      action: "period",
      month: "2026-10",
      close: true,
      evidence: "Fechamento sintético conferido",
    }),
    "approver",
    "2026-10-20T12:00:00Z",
    "test"
  );
}

describe("persisted bank reconciliation at month closure", () => {
  it("closes a reconciled period with interest, discount and withholding separated", () => {
    const book = fixture();
    const original = structuredClone(book);
    expect(closingIssues(book, "2026-10")).toEqual([]);
    expect(close(book).periods[0].closed).toBe(true);
    expect(book).toEqual(original);
  });

  it.each([
    [
      "different account",
      (b: FinanceBook) => {
        b.settlements[0].accountId = "a2";
      },
    ],
    [
      "different date",
      (b: FinanceBook) => {
        b.settlements[0].date = "2026-10-19";
      },
    ],
    [
      "different month",
      (b: FinanceBook) => {
        b.settlements[0].date = "2026-09-20";
      },
    ],
    [
      "wrong amount",
      (b: FinanceBook) => {
        b.settlements[0].interestCents = 0;
      },
    ],
    [
      "reversed receipt",
      (b: FinanceBook) => {
        b.settlements[0].reversed = true;
      },
    ],
    [
      "cancelled title",
      (b: FinanceBook) => {
        b.titles[0].status = "cancelled";
      },
    ],
    [
      "missing title",
      (b: FinanceBook) => {
        b.titles = [];
      },
    ],
    [
      "missing settlement",
      (b: FinanceBook) => {
        b.bank[0].settlementIds = ["missing"];
      },
    ],
    [
      "duplicated settlement in one row",
      (b: FinanceBook) => {
        b.bank[0].settlementIds.push("s1");
      },
    ],
    [
      "duplicated settlement in another month",
      (b: FinanceBook) => {
        b.bank.push({ ...b.bank[0], id: "b2", date: "2026-09-20" });
      },
    ],
  ])("blocks closure for %s even when a settlement ID is present", (_, mutate) => {
    const book = fixture();
    mutate(book);
    const original = structuredClone(book);
    expect(closingIssues(book, "2026-10")).toContain(
      "Existem movimentos de extrato sem conciliação."
    );
    expect(() => close(book)).toThrow("conciliação");
    expect(book).toEqual(original);
  });

  it.each(["bank", "settlements", "titles"] as const)(
    "rejects ambiguous IDs in %s instead of taking the last record",
    (collection) => {
      const book = fixture();
      if (collection === "bank") book.bank.push({ ...book.bank[0] });
      if (collection === "settlements") book.settlements.push({ ...book.settlements[0] });
      if (collection === "titles") book.titles.push({ ...book.titles[0] });
      expect(reconciliationIndex(book).settlements.size).toBe(0);
      expect(reconciliationIndex(book).bank.size).toBe(0);
      expect(() => close(book)).toThrow("conciliação");
    }
  );

  it("rejects associations to an account no longer in the ledger", () => {
    const book = fixture();
    book.accounts = [];
    expect(reconciliationIndex(book).bank.size).toBe(0);
    expect(() => close(book)).toThrow("conciliação");
  });

  it("does not reconcile a negative receipt caused by excessive discounts", () => {
    const book = fixture();
    book.settlements[0].discountCents = 20000;
    book.bank[0].amountCents = -10400;
    book.statements[0].closingCents = -10400;
    expect(reconciliationIndex(book).bank.size).toBe(0);
    expect(() => close(book)).toThrow("conciliação");
  });

  it("ignores voided duplicate rows but detects voided original associations", () => {
    const book = fixture();
    book.bank.push({ ...book.bank[0], id: "b2", voided: true });
    expect(closingIssues(book, "2026-10")).toEqual([]);
    book.bank[0].voided = true;
    expect(closingIssues(book, "2026-10")).toContain("Existem baixas sem conciliação bancária.");
  });

  it("revalidates both sides of internal transfers", () => {
    const book = emptyFinanceBook();
    book.accounts.push({ id: "a1", name: "Origem" }, { id: "a2", name: "Destino" });
    book.bank.push(
      {
        id: "a",
        accountId: "a1",
        bankId: "1",
        date: "2026-10-20",
        amountCents: -100,
        memo: "Transferência",
        settlementIds: [],
        transferPeer: "b",
      },
      {
        id: "b",
        accountId: "a2",
        bankId: "2",
        date: "2026-10-20",
        amountCents: 100,
        memo: "Transferência",
        settlementIds: [],
        transferPeer: "a",
      }
    );
    expect([...reconciliationIndex(book).bank]).toEqual(["a", "b"]);
    for (const patch of [
      { transferPeer: null },
      { voided: true },
      { accountId: "a1" },
      { date: "2026-10-19" },
      { amountCents: 99 },
      { settlementIds: ["s1"] },
    ]) {
      const changed = structuredClone(book);
      Object.assign(changed.bank[1], patch);
      expect(reconciliationIndex(changed).bank.size).toBe(0);
    }
  });
});
