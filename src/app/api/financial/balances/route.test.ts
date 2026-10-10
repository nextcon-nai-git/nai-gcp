import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/financial-balance", () => ({
  listBalances: mocks.list,
  saveBalance: mocks.save,
}));
import { GET, POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("balance API boundary", () => {
  it("requires authentication and sends private cache headers", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Sessão necessária", 401));
    const result = await GET(new NextRequest("https://test/api/financial/balances"));
    expect(result.status).toBe(401);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("denies unauthorized imports before parsing the multipart body", async () => {
    mocks.auth.mockResolvedValue({ role: "OPERATIONS" });
    const result = await POST(
      new NextRequest("https://test/api/financial/balances", { method: "POST", body: "not a form" })
    );
    expect(result.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects oversized requests before parsing and hides internal errors", async () => {
    mocks.auth.mockResolvedValue({ role: "SUPER_ADMIN" });
    const result = await POST(
      new NextRequest("https://test/api/financial/balances", {
        method: "POST",
        headers: { "content-length": String(12 * 1024 * 1024) },
      })
    );
    expect(result.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    mocks.list.mockRejectedValue(new Error("internal-secret"));
    const failed = await GET(new NextRequest("https://test/api/financial/balances"));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("internal-secret");
  });
});
