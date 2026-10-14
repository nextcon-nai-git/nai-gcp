import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), preserve: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/services/production-central", () => ({
  preserveProductionSource: mock.preserve,
  readProductionSource: mock.read,
}));
import { PUT } from "./route";
const req = (body = "%PDF-1.7", contentType = "application/pdf") =>
  new NextRequest("https://nai.test/api/production/source", {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ role: "SUPER_ADMIN", tenantId: null });
  mock.preserve.mockResolvedValue({ sha256: "verified" });
});
describe("source upload route", () => {
  it("authenticates and returns only a verified private source", async () => {
    const response = await PUT(req());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ source: { sha256: "verified" } });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.preserve.mock.calls[0][1]).toEqual(Buffer.from("%PDF-1.7"));
  });
  it("denies unauthorized access before reading request bytes", async () => {
    mock.auth.mockResolvedValue({ role: "ADMIN", tenantId: "customer" });
    const request = req();
    expect((await PUT(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(mock.preserve).not.toHaveBeenCalled();
  });
  it("rejects a misleading content type", async () => {
    expect((await PUT(req("%PDF-", "text/plain"))).status).toBe(400);
    expect(mock.preserve).not.toHaveBeenCalled();
  });
  it("enforces the streamed byte limit even without content-length", async () => {
    expect((await PUT(req("x".repeat(10 * 1024 * 1024)))).status).toBe(413);
    expect(mock.preserve).not.toHaveBeenCalled();
  });
});
