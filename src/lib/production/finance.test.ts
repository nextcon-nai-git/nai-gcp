import { describe, it, expect } from "vitest";
import { emptyFinanceBook } from "@/lib/financial/operations";
import { checkCycleFinance, receiptIndex } from "./finance";

function fixture() {
  const book = emptyFinanceBook();
  book.titles.push({
    id: "t1",
    contractId: "f1",
    kind: "receivable",
    status: "approved",
    amountCents: 10000,
  } as never);
  book.settlements.push({
    id: "s1",
    titleId: "t1",
    accountId: "account1",
    date: "2026-10-18",
    principalCents: 10000,
    discountCents: 200,
    withholdingCents: 800,
    interestCents: 300,
    fineCents: 100,
    evidence: "Extrato",
    reversed: false,
  });
  book.bank.push({
    id: "b1",
    accountId: "account1",
    bankId: "extrato1",
    date: "2026-10-18",
    amountCents: 9400,
    memo: "Pagamento",
    settlementIds: ["s1"],
    transferPeer: null,
  });
  return book;
}
const record = { financeContractId: "f1" };
const cycle = {
  id: "c1",
  financeTitleId: "t1",
  invoicedCents: 10000,
  receivedCents: 9000,
  adjustmentCents: 1000,
};
describe("contract receipt reconciliation", () => {
  it("separates principal, retained amounts and bank cash without mutating either ledger", () => {
    const book = fixture(),
      original = structuredClone(book);
    expect(checkCycleFinance(record, cycle, book)).toMatchObject({
      status: "reconciled",
      outstandingCents: 0,
      issues: [],
      receipts: {
        receivedCents: 9000,
        adjustmentCents: 1000,
        cashCents: 9400,
        settlementCount: 1,
        unreconciledCount: 0,
      },
    });
    expect(book).toEqual(original);
  });
  it.each([
    { voided: true },
    { transferPeer: "transfer" },
    { accountId: "other" },
    { date: "2026-10-17" },
    { amountCents: 9000 },
    { settlementIds: ["missing"] },
    { settlementIds: ["s1", "s1"] },
  ])("rejects an invalid or stale bank association: %j", (patch) => {
    const book = fixture();
    Object.assign(book.bank[0], patch);
    expect(checkCycleFinance(record, cycle, book)).toMatchObject({
      status: "pending",
      receipts: { unreconciledCount: 1 },
    });
  });
  it("rejects one settlement assigned to multiple bank movements", () => {
    const book = fixture();
    book.bank.push({ ...book.bank[0], id: "b2" });
    expect(receiptIndex(book).get("t1")?.unreconciledCount).toBe(1);
  });
  it("validates grouped bank deposits including the signed payable component", () => {
    const book = fixture();
    book.titles.push({ ...book.titles[0], id: "t2", kind: "payable", amountCents: 400 } as never);
    book.settlements.push({
      ...book.settlements[0],
      id: "s2",
      titleId: "t2",
      principalCents: 400,
      discountCents: 0,
      withholdingCents: 0,
      interestCents: 0,
      fineCents: 0,
    });
    book.bank[0].settlementIds.push("s2");
    book.bank[0].amountCents = 9000;
    expect(checkCycleFinance(record, cycle, book).status).toBe("reconciled");
    book.settlements[1].reversed = true;
    expect(checkCycleFinance(record, cycle, book).status).toBe("pending");
  });
  it("detects a reversed receipt and does not call a partial payment fully reconciled", () => {
    const book = fixture();
    book.settlements[0].reversed = true;
    expect(checkCycleFinance(record, cycle, book)).toMatchObject({
      status: "divergent",
      outstandingCents: 10000,
      receipts: { receivedCents: 0, adjustmentCents: 0 },
    });
    expect(
      checkCycleFinance(record, { ...cycle, receivedCents: 0, adjustmentCents: 0 }, book).status
    ).toBe("pending");
  });
  it.each([{ status: "cancelled" }, { kind: "payable" }, { contractId: "other" }])(
    "flags changed or incompatible titles: %j",
    (patch) => {
      const book = fixture();
      Object.assign(book.titles[0], patch);
      expect(checkCycleFinance(record, cycle, book).status).toBe("divergent");
    }
  );
  it("never labels an unlinked manual cycle as ERP-reconciled", () => {
    expect(checkCycleFinance(record, { ...cycle, financeTitleId: "" }, fixture())).toMatchObject({
      status: "unlinked",
      receipts: null,
      outstandingCents: null,
    });
    expect(checkCycleFinance({ financeContractId: "" }, cycle, fixture()).status).toBe("divergent");
  });
  it("detects an invoice value mismatch and over-settled legacy title", () => {
    expect(
      checkCycleFinance(record, { ...cycle, invoicedCents: 20000 }, fixture()).issues.join(" ")
    ).toContain("faturado diverge");
    const book = fixture();
    book.titles[0].amountCents = 9000;
    expect(
      checkCycleFinance(record, { ...cycle, invoicedCents: 9000 }, book).issues.join(" ")
    ).toContain("excedem");
  });
});
