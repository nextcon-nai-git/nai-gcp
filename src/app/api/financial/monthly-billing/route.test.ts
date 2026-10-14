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
  it.each([undefined, "1"])(
    "stops an oversized stream before reading the remainder (content-length: %s)",
    async (declaredLength) => {
      const cancel = vi.fn();
      let reads = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            reads++;
            if (reads === 1) controller.enqueue(new Uint8Array(65536));
            else if (reads === 2) controller.enqueue(new Uint8Array(1));
            else controller.error(new Error("The oversized remainder must not be read"));
          },
          cancel,
        },
        { highWaterMark: 0 }
      );
      const init = {
        method: "POST",
        body,
        ...(declaredLength ? { headers: { "Content-Length": declaredLength } } : {}),
        duplex: "half" as const,
      };
      const req = new NextRequest("https://test/api/financial/monthly-billing", init);
      const result = await POST(req);
      expect(result.status).toBe(413);
      expect(reads).toBe(2);
      expect(cancel).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
      expect(mocks.save).not.toHaveBeenCalled();
      expect(result.headers.get("cache-control")).toBe("private, no-store");
    }
  );
  it.each(["", "\uFEFF"])("accepts valid JSON at the exact byte limit (BOM: %s)", async (bom) => {
    const json = bom + JSON.stringify(input);
    mocks.save.mockResolvedValue({ saved: true });
    const req = new NextRequest("https://test/api/financial/monthly-billing", {
      method: "POST",
      body: json + " ".repeat(65536 - Buffer.byteLength(json)),
    });
    expect((await POST(req)).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith({ uid: "admin", role: "SUPER_ADMIN" }, input);
  });
  it("rejects unauthorized callers before consuming the request body", async () => {
    mocks.auth.mockResolvedValue({ uid: "client", role: "CLIENT_ADMIN" });
    const req = request(input);
    expect((await POST(req)).status).toBe(403);
    expect(req.bodyUsed).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
