import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  auth: vi.fn(),
  analyze: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  commit: vi.fn(),
  records: new Map<string, Record<string, unknown>>(),
  companyExists: true,
}));
vi.mock("@/lib/firebase-admin", () => {
  const collection = (name: string) => ({
    doc: (id = "new-synthetic-id") => ({ id, path: `${name}/${id}` }),
  });
  return {
    adminDb: {
      collection,
      runTransaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          get: async (ref: { path: string }) =>
            ref.path.startsWith("companies/")
              ? { exists: state.companyExists, data: () => ({ name: "Empresa sintética" }) }
              : { exists: state.records.has(ref.path), data: () => state.records.get(ref.path) },
          create: (ref: { path: string }, data: Record<string, unknown>) => {
            state.create(ref, data);
            state.records.set(ref.path, data);
          },
        }),
      batch: () => ({ update: state.update, create: state.create, commit: state.commit }),
    },
  };
});
vi.mock("@/lib/developer-api-guard", async (original) => ({
  ...(await original<typeof import("@/lib/developer-api-guard")>()),
  requireDeveloperPrincipal: state.auth,
}));
vi.mock("@/services/ai/incident-investigation-engine", () => ({
  analyzeIncidentWithNormativeGrounding: state.analyze,
}));
import { POST } from "./route";
const body = {
  type: "Quase acidente",
  description: "Objeto caiu no piso; sem lesão relatada.",
  companyId: "company-a",
};
const request = (data: unknown = body, key?: string) =>
  new NextRequest("https://nai.test/api/v1/incidents", {
    method: "POST",
    body: JSON.stringify(data),
    headers: key ? { "Idempotency-Key": key } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.records.clear();
  state.companyExists = true;
  state.auth.mockResolvedValue({ id: "key-a", clientId: "company-a", scopes: ["incidents:write"] });
  state.analyze.mockResolvedValue({
    companyId: "company-a",
    severity: "GRAVE",
    extractedFacts: { hasLeave: true, estimatedDaysOfLeave: 15 },
    esocialImpact: { requiresCatS2210: true },
    immutableDigest: "synthetic-digest",
    findings: [],
  });
  state.commit.mockResolvedValue(undefined);
});
describe("recebimento auditável de incidentes M2M", () => {
  it("salva o relato e mantém conclusões de IA pendentes de revisão", async () => {
    const response = await POST(request({ ...body, reporterId: "external-person" }));
    expect(response.status).toBe(201);
    expect((await response.json()).reviewRequired).toBe(true);
    expect(state.create.mock.calls[0][1]).toMatchObject({
      companyId: "company-a",
      reporterId: "key-a",
      reportedBy: "external-person",
      status: "PROTOCOLADO",
    });
    const update = state.update.mock.calls[0][1];
    expect(update).toHaveProperty("technicalOpinion");
    for (const key of ["hasLeave", "daysOfLeave", "severity", "catDeadlineIso", "requiresCatS2210"])
      expect(update).not.toHaveProperty(key);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("confirma recebimento quando IA falha, sem incentivar duplicação", async () => {
    state.analyze.mockRejectedValue(new Error("private-provider-error"));
    const response = await POST(request());
    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data).toMatchObject({ success: true, status: "PROTOCOLADO", analysisAvailable: false });
    expect(state.records.size).toBe(1);
    expect(JSON.stringify(data)).not.toContain("private-provider-error");
  });
  it("retentativa idempotente não cria outro incidente nem gera outra análise", async () => {
    const first = await POST(request(body, "synthetic-request-123"));
    const second = await POST(request(body, "synthetic-request-123"));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).replayed).toBe(true);
    expect(state.records.size).toBe(1);
    expect(state.analyze).toHaveBeenCalledTimes(1);
  });
  it("preserva o ID idempotente existente ao receber apenas o principal", async () => {
    await POST(request(body, "synthetic-request-123"));
    expect(state.create.mock.calls[0][0]).toMatchObject({
      path: "incidents/d5a364d1cc3635c36e5a180fcc40d63e504f889939e6f0fbdba94852e6dc59da",
    });
  });
  it("a mesma solicitação de outra identidade mantém autoria e registro separados", async () => {
    await POST(request(body, "synthetic-request-123"));
    state.auth.mockResolvedValue({
      id: "key-b",
      clientId: "company-a",
      scopes: ["incidents:write"],
    });
    expect((await POST(request(body, "synthetic-request-123"))).status).toBe(201);
    expect(state.records.size).toBe(2);
    expect([...state.records.values()].map((entry) => entry.recordedByApiKey).sort()).toEqual([
      "key-a",
      "key-b",
    ]);
  });
  it("recusa reutilizar chave idempotente com outro conteúdo", async () => {
    await POST(request(body, "synthetic-request-123"));
    const result = await POST(
      request({ ...body, description: "Outro relato sintético." }, "synthetic-request-123")
    );
    expect(result.status).toBe(409);
    expect(state.records.size).toBe(1);
  });
  it("nega outra empresa antes de gravar e chamar IA", async () => {
    expect((await POST(request({ ...body, companyId: "company-b" }))).status).toBe(403);
    expect(state.create).not.toHaveBeenCalled();
    expect(state.analyze).not.toHaveBeenCalled();
  });
  it("não cria incidente órfão em empresa inexistente", async () => {
    state.companyExists = false;
    expect((await POST(request())).status).toBe(404);
    expect(state.create).not.toHaveBeenCalled();
  });
  it("exige empresa explícita para chave global", async () => {
    state.auth.mockResolvedValue({ id: "global", clientId: "GLOBAL", scopes: ["incidents:write"] });
    expect((await POST(request({ type: body.type, description: body.description }))).status).toBe(
      400
    );
    expect(state.create).not.toHaveBeenCalled();
  });
  it.each([
    null,
    [],
    {},
    { ...body, description: 123 },
    { ...body, photoUrl: "not-a-url" },
    { ...body, photoUrl: "javascript:alert(1)" },
    { ...body, companyId: "a/b" },
  ])("recusa payload inválido %j", async (data) => {
    expect((await POST(request(data))).status).toBe(400);
    expect(state.create).not.toHaveBeenCalled();
    expect(state.analyze).not.toHaveBeenCalled();
  });
  it("não atribui falha de análise à recepção quando commit do parecer falha", async () => {
    state.commit.mockRejectedValue(new Error("network failed"));
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(state.records.size).toBe(1);
  });
});
