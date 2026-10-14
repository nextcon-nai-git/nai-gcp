import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/financial-operations", () => ({
  getFinanceBook: mocks.get,
  saveFinanceCommand: mocks.save,
}));
import { GET, POST } from "./route";
const request = (method: "GET" | "POST", body = "{}") =>
  new NextRequest("https://example.test/api/financial/operations", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ uid: "internal", role: "SUPER_ADMIN", tenantId: null });
});
describe("financial operations API", () => {
  it.each([GET, POST])("rejects unauthenticated access", async (method) => {
    mocks.auth.mockRejectedValue(new AuthError("Sessão necessária", 401));
    const r = await method(request(method === GET ? "GET" : "POST"));
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("vary")).toBe("Authorization");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([GET, POST])("rejects client admins before payload/storage", async (method) => {
    mocks.auth.mockResolvedValue({ uid: "client", role: "ADMIN", tenantId: "client-a" });
    expect((await method(request(method === GET ? "GET" : "POST", "invalid"))).status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("bounds actual streamed bytes and rejects malformed data", async () => {
    expect((await POST(request("POST", " ".repeat(524289)))).status).toBe(413);
    expect((await POST(request("POST", "{"))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("preserves concurrency conflicts and redacts unexpected provider errors", async () => {
    mocks.save.mockRejectedValue(new AuthError("Atualize", 409));
    expect((await POST(request("POST"))).status).toBe(409);
    mocks.get.mockRejectedValue(new Error("secret provider token"));
    const r = await GET(request("GET"));
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secret");
  });
});
