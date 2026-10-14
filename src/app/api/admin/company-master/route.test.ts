import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  set: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: state.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => ({ doc: (id = "audit") => ({ path: `${name}/${id}` }) }),
    runTransaction: state.transaction,
  },
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "server-time" },
}));
import { POST } from "./route";
const data = {
  id: "legacy",
  name: "Cliente real",
  cnpj: "11.222.333/0001-81",
  segment: "GENERAL",
  risk_degree: 1,
  city: "Curitiba",
  state: "PR",
  active: true,
  esocial_enabled: false,
};
const req = (input: unknown = data) =>
  new NextRequest("https://nai.test/api/admin/company-master", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.mockResolvedValue({ uid: "internal-admin", role: "SUPER_ADMIN", tenantId: null });
  state.get.mockResolvedValue({
    exists: true,
    data: () => ({ cnpj: "previous", createdAt: "original-time" }),
  });
  state.transaction.mockImplementation(async (fn) =>
    fn({ get: state.get, set: state.set, create: state.create })
  );
});
describe("audited company master writes", () => {
  it.each(["SUPER_ADMIN", "ADMIN"])(
    "allows global %s and preserves existing creation metadata",
    async (role) => {
      state.auth.mockResolvedValue({ uid: "internal-admin", role, tenantId: null });
      const response = await POST(req());
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const saved = state.set.mock.calls[0][1];
      expect(saved).not.toHaveProperty("createdAt");
      expect(saved.cnpj).toBe("11222333000181");
      expect(state.create.mock.calls[0][1]).toMatchObject({
        actorUid: "internal-admin",
        previous: { cnpj: "previous" },
        next: { cnpj: "11222333000181" },
      });
    }
  );
  it.each([false, true])(
    "stamps absent creation metadata, including local-only inserts (%s)",
    async (exists) => {
      state.get.mockResolvedValue({ exists, data: () => (exists ? {} : undefined) });
      expect((await POST(req())).status).toBe(200);
      expect(state.set.mock.calls[0][1].createdAt).toBe("server-time");
    }
  );
  it.each([
    { role: "ADMIN", tenantId: "customer" },
    { role: "SUPER_ADMIN", tenantId: "customer" },
    { role: "CLIENT_ADMIN", tenantId: "customer" },
    { role: "OPERATIONS", tenantId: null },
    { role: "DOCTOR", tenantId: null },
  ])("denies scoped and non-admin profiles before reading data: %o", async (user) => {
    state.auth.mockResolvedValue(user);
    const request = req();
    expect((await POST(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it.each([
    { ...data, cnpj: "123" },
    { ...data, permissions: ["admin"] },
    { ...data, id: "a/b" },
  ])("rejects malformed or security fields", async (input) => {
    expect((await POST(req(input))).status).toBe(400);
    expect(state.transaction).not.toHaveBeenCalled();
  });
  it("does not report success when the atomic write fails", async () => {
    state.transaction.mockRejectedValue(new Error("write unavailable"));
    expect((await POST(req())).status).toBe(503);
  });
});
