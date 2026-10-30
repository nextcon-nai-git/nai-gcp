// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/avp-periodic-sync", () => ({ readAvpPeriodicSnapshot: mocks.read }));
import { GET } from "./route";
const request = () =>
  new NextRequest("https://example.test/api/clients/grupo-avp/periodic-control");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    uid: "a",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
  mocks.read.mockResolvedValue({ summary: { uniquePeople: 1 } });
});
describe("autorização do controle de periódicos AVP", () => {
  it("exige sessão antes de ler qualquer fonte", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([
    { role: "ADMIN", tenantId: "GRUPO_AVP", servedCompanies: [] },
    { role: "OPERATIONS", tenantId: null, servedCompanies: ["OUTRO"] },
    { role: "GUEST", tenantId: "GRUPO_AVP", servedCompanies: [] },
  ])("não expõe RH e valores a outro escopo: %s", async (profile) => {
    mocks.auth.mockResolvedValue({ uid: "a", ...profile });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("permite à operação interna da carteira e impede cache público", async () => {
    mocks.auth.mockResolvedValue({
      uid: "a",
      role: "OPERATIONS",
      tenantId: null,
      servedCompanies: ["GRUPO_AVP"],
    });
    const r = await GET(request());
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.read).toHaveBeenCalledOnce();
  });
  it("não retorna credenciais nem dados parciais quando a fonte falha", async () => {
    mocks.read.mockRejectedValue(new Error("private-service-account-content"));
    const r = await GET(request());
    expect(r.status).toBe(503);
    expect(JSON.stringify(await r.json())).not.toContain("private-service-account-content");
  });
});
