import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const m = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/supplier-qualification", () => ({ getSuppliers: m.get, saveSupplier: m.save }));
import { GET, POST } from "./route";
const request = (body?: string) =>
  new NextRequest("https://example.test/api/suppliers/qualification", {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ uid: "provider", role: "PROVIDER", tenantId: null });
});
describe("supplier API", () => {
  it.each([GET, POST])("denies unauthorized sessions before reading dossiers", async (handler) => {
    m.auth.mockRejectedValue(new AuthError("Sessão expirada", 401));
    const r = await handler(request(handler === POST ? "{}" : undefined));
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(m.get).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it.each([GET, POST])("denies client admin before parsing data", async (handler) => {
    m.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await handler(request(handler === POST ? "bad" : undefined))).status).toBe(403);
    expect(m.get).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });
  it("bounds request bytes and redacts internals", async () => {
    expect((await POST(request("x".repeat(65537)))).status).toBe(413);
    expect((await POST(request("{"))).status).toBe(400);
    m.get.mockRejectedValue(new Error("private bucket secret"));
    const r = await GET(request());
    expect(await r.text()).not.toContain("secret");
    expect(r.status).toBe(503);
  });
});
