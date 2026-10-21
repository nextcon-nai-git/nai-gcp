import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), central: vi.fn(), finance: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/services/production-central", () => ({ getProductionBook: mock.central }));
vi.mock("@/services/financial-operations", () => ({ getFinanceBook: mock.finance }));
import { GET } from "./route";
const req = () => new NextRequest("https://nai.test/api/production/finance?recordId=r1");
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ role: "SUPER_ADMIN", tenantId: null });
  mock.central.mockResolvedValue({
    records: [{ id: "r1", cnpj: "11222333000181", financeContractId: "f1", cycles: [] }],
  });
  mock.finance.mockResolvedValue({
    version: 3,
    accounts: [{ id: "bank1", name: "Conta sintética" }],
    bank: [],
    contracts: [
      { id: "f1", name: "Mesmo cliente", client: "Cliente A", active: true, monthlyCents: 10000 },
      { id: "f2", name: "Outro cliente", active: true },
    ],
    contractFlows: [
      { contractId: "f1", customerDocument: "11.222.333/0001-81" },
      { contractId: "f2", customerDocument: "other" },
    ],
    titles: [
      {
        id: "t1",
        contractId: "f1",
        status: "approved",
        kind: "receivable",
        amountCents: 10000,
        description: "Mensalidade",
        competence: "2026-10",
      },
      { id: "t2", contractId: "f2", status: "approved", kind: "receivable" },
      { id: "t3", contractId: "f1", status: "draft", kind: "receivable" },
    ],
    settlements: [
      {
        id: "s1",
        accountId: "bank1",
        date: "2026-10-18",
        interestCents: 0,
        fineCents: 0,
        titleId: "t1",
        principalCents: 10000,
        discountCents: 500,
        withholdingCents: 500,
        reversed: false,
      },
      {
        titleId: "t1",
        principalCents: 20000,
        discountCents: 0,
        withholdingCents: 0,
        reversed: true,
      },
    ],
  });
});
describe("ERP selectors", () => {
  it("returns matching contracts and approved titles with non-reversed principal receipts", async () => {
    const r = await GET(req());
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.contracts.map((c: { id: string }) => c.id)).toEqual(["f1"]);
    expect(data.titles).toEqual([
      {
        id: "t1",
        description: "Mensalidade",
        competence: "2026-10",
        amountCents: 10000,
        receivedCents: 9000,
        adjustmentCents: 1000,
        unreconciledCount: 1,
      },
    ]);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["inactive", "other customer", "missing flow"])(
    "withholds stale linked titles after an ERP change: %s",
    async (scenario) => {
      const book = await mock.finance();
      if (scenario === "inactive") book.contracts[0].active = false;
      if (scenario === "other customer") book.contractFlows[0].customerDocument = "44337647000189";
      if (scenario === "missing flow") book.contractFlows = [];
      const response = await GET(req());
      expect(response.status).toBe(200);
      expect((await response.json()).titles).toEqual([]);
    }
  );
  it("denies tenant admins before reading either ledger", async () => {
    mock.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await GET(req())).status).toBe(403);
    expect(mock.central).not.toHaveBeenCalled();
    expect(mock.finance).not.toHaveBeenCalled();
  });
  it("does not read finance for unknown records", async () => {
    mock.central.mockResolvedValue({ records: [] });
    expect((await GET(req())).status).toBe(400);
    expect(mock.finance).not.toHaveBeenCalled();
  });
});
