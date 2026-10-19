import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  book: vi.fn(),
  companies: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/production-central", () => ({
  getProductionBook: mocks.book,
  productionCompanies: mocks.companies,
  saveProductionCommand: mocks.save,
}));
import { GET, POST } from "./route";
const url = "https://nai.test/api/production";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN", tenantId: null });
  mocks.book.mockResolvedValue({ version: 1, records: [], audit: [] });
  mocks.companies.mockResolvedValue([]);
  mocks.save.mockResolvedValue({ version: 2, records: [], audit: [] });
});
describe("production API boundary", () => {
  it("returns private non-cacheable data only after authentication", async () => {
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(await response.json()).toMatchObject({ book: { version: 1 }, companies: [] });
  });
  it.each(["CLIENT_ADMIN", "OPERATIONS", "DOCTOR", "PROVIDER", "ADMIN"])(
    "denies %s without reading data or mutation body",
    async (role) => {
      mocks.auth.mockResolvedValue({ uid: "limited", role, tenantId: "client" });
      expect((await GET(new NextRequest(url))).status).toBe(403);
      expect(
        (
          await POST(
            new NextRequest(url, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: "not json",
            })
          )
        ).status
      ).toBe(403);
      expect(mocks.book).not.toHaveBeenCalled();
      expect(mocks.companies).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
    }
  );
  it("preserves 401 and does not convert a failed read to a successful empty central", async () => {
    mocks.auth.mockRejectedValueOnce(new AuthError("Sessão expirada", 401));
    expect((await GET(new NextRequest(url))).status).toBe(401);
    mocks.book.mockRejectedValueOnce(new Error("private storage internal details"));
    const response = await GET(new NextRequest(url));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("internal details");
  });
  it.each([
    ["text/plain", "{}", 400],
    ["application/json", "{broken", 400],
    ["application/json", "x".repeat(256 * 1024 + 1), 413],
  ] as const)(
    "rejects unsupported or oversized command input (%s, %i)",
    async (contentType, body, status) => {
      const response = await POST(
        new NextRequest(url, { method: "POST", headers: { "Content-Type": contentType }, body })
      );
      expect(response.status).toBe(status);
      expect(mocks.save).not.toHaveBeenCalled();
    }
  );
});
