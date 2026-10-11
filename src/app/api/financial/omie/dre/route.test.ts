import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/omie-financial", () => ({ listOmieDre: mocks.list }));
import { GET } from "./route";
const request = () =>
  new NextRequest(
    "https://nai.example/api/financial/omie/dre?start=2026-01-01&end=2026-09-30&dateBasis=emission"
  );

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.list.mockReset();
});
describe("DRE HTTP boundary", () => {
  it("does not call the financial service before successful authentication", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Entre no NAI", 401));
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("forwards only the requested query and makes the authenticated response uncacheable", async () => {
    const user = { uid: "synthetic" };
    mocks.auth.mockResolvedValue(user);
    mocks.list.mockResolvedValue({ rows: [] });
    const response = await GET(request());
    expect(mocks.list).toHaveBeenCalledWith(user, {
      start: "2026-01-01",
      end: "2026-09-30",
      dateBasis: "emission",
    });
    expect(response.headers.get("Vary")).toBe("Authorization");
    expect(await response.json()).toEqual({ rows: [] });
  });
  it("preserves permission errors while hiding arbitrary provider/internal errors", async () => {
    mocks.auth.mockResolvedValue({ uid: "synthetic" });
    mocks.list.mockRejectedValueOnce(new AuthError("Acesso restrito", 403));
    expect((await GET(request())).status).toBe(403);
    mocks.list.mockRejectedValueOnce(new Error("private-storage-key"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private-storage-key");
  });
});
