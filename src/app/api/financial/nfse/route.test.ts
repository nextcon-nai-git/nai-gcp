import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/fiscal-invoices", () => ({ listFiscalInvoices: m.list }));
import { POST } from "./route";
const request = (body = "{}") =>
  new NextRequest("https://example.test/api/financial/nfse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ role: "SUPER_ADMIN", tenantId: null });
});
it("requires corporate financial access before reading the body or provider", async () => {
  m.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
  expect((await POST(request("invalid"))).status).toBe(403);
  expect(m.list).not.toHaveBeenCalled();
});
it("limits request size and keeps fiscal responses private", async () => {
  expect((await POST(request(" ".repeat(65537)))).status).toBe(413);
  expect(m.list).not.toHaveBeenCalled();
  m.list.mockResolvedValue({ invoices: [] });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("does not expose provider exceptions or credentials", async () => {
  m.list.mockRejectedValue(new Error("app_secret=synthetic"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("synthetic");
});
