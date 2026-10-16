// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { SocError } from "@/lib/integrations/soc";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), getRuns: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/integrations/soc-monitor", () => ({
  monitoredSocRead: mocks.read,
  socRuns: () => ({ orderBy: () => ({ limit: () => ({ get: mocks.getRuns }) }) }),
}));
import { GET } from "./route";
const req = (query = "") => new NextRequest(`https://nai.test/api/integrations/soc${query}`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ role: "OPERATIONS", tenantId: null });
});
describe("SOC API authorization boundary", () => {
  it("denies unauthenticated requests before reading data", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Entre novamente.", 401));
    expect((await GET(req("?resource=employees"))).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("denies client tenant access to monitoring as well as records", async () => {
    mocks.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await GET(req("?resource=runs"))).status).toBe(403);
    expect(mocks.getRuns).not.toHaveBeenCalled();
  });
  it("status does not make a provider request or claim connected", async () => {
    const result = await GET(req());
    expect((await result.json()).connected).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects unknown resources", async () =>
    expect((await GET(req("?resource=write"))).status).toBe(400));
  it("preserves an actionable safe provider error", async () => {
    mocks.read.mockRejectedValue(new SocError(424, "ACCESS_DENIED", "Confira a chave."));
    const result = await GET(req("?resource=employees&companyId=101"));
    expect(result.status).toBe(424);
    expect(await result.json()).toEqual({ error: "Confira a chave.", code: "ACCESS_DENIED" });
  });
  it("does not expose unexpected exception details", async () => {
    mocks.read.mockRejectedValue(new Error("private-secret-and-cpf"));
    const result = await GET(req("?resource=companies"));
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain("private-secret");
  });
});
