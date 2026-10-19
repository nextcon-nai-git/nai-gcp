import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { emptyFinanceBook } from "@/lib/financial/operations";
const mock = vi.hoisted(() => ({ auth: vi.fn(), central: vi.fn(), finance: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/services/production-central", () => ({ getProductionBook: mock.central }));
vi.mock("@/services/financial-operations", () => ({ getFinanceBook: mock.finance }));
import { GET } from "./route";

const req = (query = "expectedVersion=12") =>
  new NextRequest(`https://nai.test/api/production/billing-queue?${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ role: "SUPER_ADMIN", tenantId: null });
  mock.central.mockResolvedValue({
    version: 12,
    records: [],
    audit: [{ details: "confidential source" }],
  });
  mock.finance.mockResolvedValue({
    ...emptyFinanceBook(),
    version: 8,
    audit: [{ details: "private ledger" }],
  });
});
describe("private billing queue snapshot", () => {
  it("returns only the derived snapshot with both versions and private headers", async () => {
    const response = await GET(req());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      centralVersion: 12,
      financeVersion: 8,
      generatedAt: expect.any(String),
      items: [],
      summary: {
        cycles: 0,
        delivered: 0,
        awaitingMeasurement: 0,
        advances: 0,
        needsReview: 0,
        measuredBalanceCents: 0,
      },
    });
    expect(Number.isNaN(Date.parse(data.generatedAt))).toBe(false);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it.each([
    { role: "ADMIN", tenantId: "client" },
    { role: "CLIENT_ADMIN", tenantId: null },
    { role: "USER", tenantId: null },
  ])("rejects a nonfinancial profile before reading either book: %s", async (profile) => {
    mock.auth.mockResolvedValue(profile);
    const response = await GET(req());
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.central).not.toHaveBeenCalled();
    expect(mock.finance).not.toHaveBeenCalled();
  });
  it("preserves authentication errors without reading books", async () => {
    mock.auth.mockRejectedValue(new AuthError("Sessão expirada", 401));
    const response = await GET(req());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sessão expirada" });
    expect(mock.central).not.toHaveBeenCalled();
    expect(mock.finance).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "expectedVersion=",
    "expectedVersion=-1",
    "expectedVersion=1.2",
    "expectedVersion=01",
    "expectedVersion=1e1",
    "expectedVersion=9007199254740992",
  ])("requires an exact safe Central version: %s", async (query) => {
    const response = await GET(req(query));
    expect(response.status).toBe(400);
    expect(mock.central).not.toHaveBeenCalled();
    expect(mock.finance).not.toHaveBeenCalled();
  });
  it("accepts version zero for an empty Central", async () => {
    mock.central.mockResolvedValue({ version: 0, records: [], audit: [] });
    expect((await GET(req("expectedVersion=0"))).status).toBe(200);
  });
  it("rejects a stale workspace version before reading the financial book", async () => {
    const response = await GET(req("expectedVersion=11"));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A Central mudou. Atualize a Central e consulte a fila novamente.",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.finance).not.toHaveBeenCalled();
  });
  it.each(["central", "finance"] as const)(
    "reports a %s read failure as an error, never an empty queue or raw diagnostic",
    async (source) => {
      mock[source].mockRejectedValue(new Error("Internal credential or document information"));
      const response = await GET(req());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Não foi possível concluir. Atualize para conferir antes de tentar novamente.",
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  );
});
