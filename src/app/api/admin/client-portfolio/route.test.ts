import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { APPROVED_PORTFOLIO, SANTANDER_RECORD } from "@/lib/client-portfolio";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      name,
      doc: (id: string) => ({ name, id, get: () => Promise.resolve({ exists: false }) }),
      get: mocks.get,
    }),
    runTransaction: mocks.transaction,
  },
}));
import { GET, POST } from "./route";
const request = (body?: unknown) =>
  new NextRequest(
    "https://nai.example/api/admin/client-portfolio",
    body ? { method: "POST", body: JSON.stringify(body) } : {}
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN" });
  const ids = [
    ...APPROVED_PORTFOLIO.flatMap((g) => [...g.records]).filter((id) => id !== "GRUPO_AVP"),
    SANTANDER_RECORD,
    "old-customer",
  ];
  const snapshot = {
    size: ids.length,
    docs: ids.map((id) => ({
      id,
      ref: { id },
      updateTime: { toMillis: () => 100 },
      data: () => ({ active: true }),
    })),
  };
  mocks.get.mockResolvedValue(snapshot);
  mocks.transaction.mockImplementation((fn) =>
    fn({
      get: async (ref: { name: string }) =>
        ref.name === "admin_migrations" ? { exists: false } : snapshot,
      update: mocks.update,
      create: mocks.create,
    })
  );
});
describe("Portfolio administrative operation", () => {
  it("rejects non-administrators before any database changes", async () => {
    mocks.auth.mockResolvedValue({ role: "CLIENT_ADMIN" });
    expect((await POST(request({ revision: "x" }))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects a stale review without writes", async () => {
    expect((await POST(request({ revision: "stale" }))).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("applies reviewed records, excludes Santander, and creates AVP plus audit", async () => {
    const review = await (await GET(request())).json();
    expect((await POST(request({ revision: review.revision }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      { id: SANTANDER_RECORD },
      expect.objectContaining({ active: false, isDeleted: true, entityType: "bank" })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      { id: "old-customer" },
      expect.objectContaining({ active: false })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      { id: "CETESB_080680" },
      expect.objectContaining({ active: true, portfolioClientId: "cetesb" })
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "companies", id: "GRUPO_AVP" }),
      expect.objectContaining({ active: true, portfolioClientId: "avp" })
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "admin_migrations",
        id: "client-portfolio-approved-2026-10-07",
      }),
      expect.objectContaining({ actorUid: "admin", previous: expect.any(Array) })
    );
  });
});
