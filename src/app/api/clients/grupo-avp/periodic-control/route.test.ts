// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { emptyWorkflow } from "@/lib/avp-workflow";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), cases: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/services/avp-periodic-sync", () => ({ readAvpPeriodicSnapshot: mocks.read }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ collection: () => ({ limit: () => ({ get: mocks.cases }) }) }),
    }),
  },
}));
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
  mocks.read.mockResolvedValue({ summary: { uniquePeople: 1 }, people: [] });
  mocks.cases.mockResolvedValue({ size: 0, docs: [] });
});
describe("autorização do controle de periódicos AVP", () => {
  it("exige sessão antes de ler qualquer fonte", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.cases).not.toHaveBeenCalled();
  });
  it.each([
    { role: "ADMIN", tenantId: "GRUPO_AVP", servedCompanies: [] },
    { role: "OPERATIONS", tenantId: null, servedCompanies: ["OUTRO"] },
    { role: "GUEST", tenantId: "GRUPO_AVP", servedCompanies: [] },
  ])("não expõe RH e valores a outro escopo: %s", async (profile) => {
    mocks.auth.mockResolvedValue({ uid: "a", ...profile });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.cases).not.toHaveBeenCalled();
  });
  it("retorna a mesma projeção operacional para lista e mapa sem expor dados do caso", async () => {
    const person = {
      id: "person-1",
      name: "Pessoa teste",
      unit: "Unidade teste",
      admission: "2025-01-01",
      city: "Marabá",
      uf: "PA",
      cityKey: "MARABA|PA",
      status: "Não iniciado",
      progress: "pending",
      classification: "listed",
      duplicateRows: 0,
      sourceRows: [5],
      phone: "",
      email: "",
      review: "OK",
    };
    mocks.read.mockResolvedValue({ summary: { uniquePeople: 1 }, people: [person] });
    const record = {
      ...emptyWorkflow(person),
      stage: "scheduled",
      identityChecked: true,
      socCheck: "existing-order",
      socReference: "consulta",
      socOrder: "123",
      clinic: "Clínica teste",
      clinicEmail: "private-clinic@example.test",
      owner: "operator",
      scheduledDate: "2026-11-03",
      version: 1,
      updatedAt: "2026-11-01T12:00:00Z",
      updatedBy: "operator",
    };
    mocks.cases.mockResolvedValue({ size: 1, docs: [{ id: "case-1", data: () => record }] });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.people[0]).toMatchObject({
      status: "Agendado",
      progress: "scheduled",
      sourceStatus: "Não iniciado",
      progressSource: "workflow",
    });
    expect(JSON.stringify(data)).not.toContain("private-clinic@example.test");
    expect(response.headers.get("vary")).toBe("Authorization");
  });
  it("não apresenta projeção parcial quando a leitura dos casos falha ou excede o limite", async () => {
    mocks.cases.mockRejectedValueOnce(new Error("private-query"));
    expect((await GET(request())).status).toBe(503);
    mocks.cases.mockResolvedValueOnce({ size: 10001, docs: [] });
    expect((await GET(request())).status).toBe(503);
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
