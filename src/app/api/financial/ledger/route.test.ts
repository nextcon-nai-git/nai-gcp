import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/financial-ledger", () => ({ listLedgers: mocks.list, saveLedger: mocks.save }));
import { GET, POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
});
describe("ledger API boundary", () => {
  it("requires authentication and marks responses private", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Sessão necessária", 401));
    const response = await GET(new NextRequest("https://test/api/financial/ledger"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects unauthorized imports before reading multipart data", async () => {
    mocks.auth.mockResolvedValue({ role: "OPERATIONS" });
    const response = await POST(
      new NextRequest("https://test/api/financial/ledger", { method: "POST", body: "not a form" })
    );
    expect(response.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not return internal storage errors", async () => {
    mocks.auth.mockResolvedValue({ role: "SUPER_ADMIN" });
    mocks.list.mockRejectedValue(new Error("internal-storage-secret"));
    const response = await GET(new NextRequest("https://test/api/financial/ledger"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("internal-storage-secret");
  });
});
