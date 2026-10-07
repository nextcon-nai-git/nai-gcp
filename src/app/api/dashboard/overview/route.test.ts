import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({ auth: vi.fn(), dashboard: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/services/executive-dashboard", () => ({ getExecutiveDashboard: mock.dashboard }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ uid: "test", role: "SUPER_ADMIN" });
});
describe("Executive dashboard endpoint", () => {
  it("does not read sources without verified authentication", async () => {
    mock.auth.mockRejectedValueOnce(new AuthError("Unauthorized", 401));
    expect((await GET(new NextRequest("https://nai.test/api/dashboard/overview"))).status).toBe(
      401
    );
    expect(mock.dashboard).not.toHaveBeenCalled();
  });
  it("uses scoped server data with private no-store caching", async () => {
    mock.dashboard.mockResolvedValueOnce({ clients: [], avp: null });
    const response = await GET(
      new NextRequest("https://nai.test/api/dashboard/overview?company=a")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.dashboard).toHaveBeenCalledWith({ uid: "test", role: "SUPER_ADMIN" }, "a");
  });
  it("reports source failures instead of returning invented zero metrics", async () => {
    mock.dashboard.mockRejectedValueOnce(new Error("source offline"));
    const response = await GET(new NextRequest("https://nai.test/api/dashboard/overview"));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("clients");
  });
});
