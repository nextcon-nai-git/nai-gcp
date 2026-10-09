import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/monthly-billing", () => ({
  listMonthlyBilling: mocks.list,
  saveMonthlyBilling: mocks.save,
}));
import { GET, POST } from "./route";
const input = {
  groupCompanyId: "example",
  sourceName: "example.xlsx",
  revision: "a".repeat(64),
  confirmed: true,
  rows: [{ cnpj: "11222333000181", name: "Exemplo", valueCents: 12345 }],
};
function request(body: unknown) {
  return new NextRequest("https://test/api/financial/monthly-billing", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN" });
});
describe("monthly billing authorization and validation", () => {
  it("blocks unauthenticated reads and unauthorized writes before accessing data", async () => {
    mocks.auth.mockRejectedValueOnce(new AuthError("Sessão inválida", 401));
    expect((await GET(new NextRequest("https://test/api/financial/monthly-billing"))).status).toBe(
      401
    );
    mocks.auth.mockResolvedValue({ uid: "client", role: "CLIENT_ADMIN" });
    const result = await POST(request(input));
    expect(result.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects duplicate CNPJs and unreviewed submissions", async () => {
    expect((await POST(request({ ...input, rows: [...input.rows, ...input.rows] }))).status).toBe(
      400
    );
    expect((await POST(request({ ...input, confirmed: false }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("passes validated cents and the authenticated actor to the transactional service", async () => {
    mocks.save.mockResolvedValue({ saved: true });
    expect((await POST(request(input))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({ uid: "admin", role: "SUPER_ADMIN" }, input);
  });
  it("returns conflict errors but hides internal server details", async () => {
    mocks.save.mockRejectedValueOnce(new AuthError("A carteira mudou.", 409));
    expect((await POST(request(input))).status).toBe(409);
    mocks.save.mockRejectedValueOnce(new Error("internal secret"));
    const result = await POST(request(input));
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("internal secret");
  });
});
