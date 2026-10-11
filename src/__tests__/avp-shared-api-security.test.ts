import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  sync: vi.fn(),
  snapshot: vi.fn(),
  patch: vi.fn(),
  oidc: vi.fn(),
  history: vi.fn(),
  audit: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/services/avp-sheet-sync", () => ({
  syncAvpSource: mock.sync,
  getAvpSnapshot: mock.snapshot,
  patchAvpQueue: mock.patch,
}));
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        verifyIdToken = mock.oidc;
      },
    },
  },
}));
vi.mock("@/services/medical-history", () => ({ getAuthorizedMedicalHistory: mock.history }));
vi.mock("@/services/audit/medical-audit-service", () => ({
  medicalAuditService: { record: mock.audit },
}));
vi.mock("@/ai/genkit", () => ({ ai: { generateStream: mock.generate } }));
import { GET, PATCH } from "@/app/api/clients/grupo-avp/queue/route";
import { POST as scheduled } from "@/app/api/internal/avp-sheet-sync/route";
import { POST as medical } from "@/app/api/medical-assistant/route";
const request = (method: string, path: string, body?: unknown, token = true) =>
  new NextRequest(`https://nai.test${path}`, {
    method,
    headers: token ? { Authorization: "Bearer synthetic-test-token" } : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({
    uid: "operator",
    role: "HR",
    tenantId: "GRUPO_AVP",
    servedCompanies: [],
  });
  mock.sync.mockResolvedValue({ started: true, rowCount: 1 });
  mock.snapshot.mockResolvedValue({ items: [], revision: "synthetic" });
  mock.patch.mockResolvedValue("new-revision");
  mock.audit.mockResolvedValue(undefined);
  vi.stubEnv("AVP_SYNC_INVOKER_EMAIL", "runtime@example.test");
  vi.stubEnv("AVP_SYNC_AUDIENCE", "https://nai.test/api/internal/avp-sheet-sync");
  mock.oidc.mockResolvedValue({
    getPayload: () => ({ email: "runtime@example.test", email_verified: true }),
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Fila compartilhada por empresa", () => {
  it("nega sessão ausente e empresa sem vínculo antes de acessar dados", async () => {
    mock.auth.mockRejectedValueOnce(new AuthError("Sessão ausente", 401));
    expect((await GET(request("GET", "/api/clients/grupo-avp/queue"))).status).toBe(401);
    mock.auth.mockResolvedValueOnce({
      uid: "foreign",
      role: "HR",
      tenantId: "foreign",
      servedCompanies: [],
    });
    expect((await GET(request("GET", "/api/clients/grupo-avp/queue"))).status).toBe(403);
    expect(mock.sync).not.toHaveBeenCalled();
    expect(mock.snapshot).not.toHaveBeenCalled();
  });
  it("encaminha leitura autorizada sem cache público", async () => {
    const response = await GET(request("GET", "/api/clients/grupo-avp/queue?force=1"));
    expect(response.status).toBe(200);
    expect(mock.sync).toHaveBeenCalledWith(true, "operator");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("nega edição ao perfil de consulta e devolve conflito ao editor", async () => {
    mock.auth.mockResolvedValueOnce({
      uid: "doctor",
      role: "DOCTOR",
      tenantId: "GRUPO_AVP",
      servedCompanies: [],
    });
    expect((await PATCH(request("PATCH", "/queue", { revision: "x", changes: [] }))).status).toBe(
      403
    );
    expect(mock.patch).not.toHaveBeenCalled();
    mock.patch.mockRejectedValueOnce(new Error("CONFLICT"));
    expect((await PATCH(request("PATCH", "/queue", { revision: "x", changes: [] }))).status).toBe(
      409
    );
  });
  it("limita o corpo e recusa JSON quebrado sem gravar", async () => {
    expect((await PATCH(request("PATCH", "/queue", { large: "x".repeat(500001) }))).status).toBe(
      413
    );
    expect(
      (await PATCH(new NextRequest("https://nai.test/queue", { method: "PATCH", body: "{" })))
        .status
    ).toBe(422);
    expect(mock.patch).not.toHaveBeenCalled();
  });
});
describe("Agendador com identidade Google", () => {
  it("exige token verificado para a identidade exata", async () => {
    expect((await scheduled(request("POST", "/sync", undefined, false))).status).toBe(401);
    mock.oidc.mockResolvedValueOnce({
      getPayload: () => ({ email: "foreign@example.test", email_verified: true }),
    });
    expect((await scheduled(request("POST", "/sync"))).status).toBe(403);
    mock.oidc.mockRejectedValueOnce(new Error("wrong audience"));
    expect((await scheduled(request("POST", "/sync"))).status).toBe(401);
    expect(mock.sync).not.toHaveBeenCalled();
  });
  it("valida audiência e executa; falha da fonte é recuperável", async () => {
    expect((await scheduled(request("POST", "/sync"))).status).toBe(200);
    expect(mock.oidc).toHaveBeenCalledWith({
      idToken: "synthetic-test-token",
      audience: "https://nai.test/api/internal/avp-sheet-sync",
    });
    mock.sync.mockResolvedValueOnce({ started: true, error: "source unavailable" });
    expect((await scheduled(request("POST", "/sync"))).status).toBe(503);
  });
});
describe("Assistente médico protegido", () => {
  const body = {
    mensagemMedico: "Exemplo sintético",
    pacienteId: "synthetic-patient",
    companyId: "company-a",
  };
  it("nega sessão ausente antes da consulta e da IA", async () => {
    mock.auth.mockRejectedValueOnce(new AuthError("Sessão ausente", 401));
    expect((await medical(request("POST", "/medical", body))).status).toBe(401);
    expect(mock.history).not.toHaveBeenCalled();
    expect(mock.audit).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("nega acesso clínico sem gerar respostas nem expor CORS público", async () => {
    mock.history.mockRejectedValueOnce(new AuthError("Perfil não clínico", 403));
    const response = await medical(request("POST", "/medical", body));
    expect(response.status).toBe(403);
    expect(mock.audit).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

it.each(["{", "null", "[]"])(
  "recusa corpo clínico inválido %s sem acessar prontuário",
  async (body) => {
    const response = await medical(
      new NextRequest("https://nai.test/api/medical-assistant", { method: "POST", body })
    );
    expect(response.status).toBe(400);
    expect(mock.history).not.toHaveBeenCalled();
    expect(mock.generate).not.toHaveBeenCalled();
  }
);

it("resposta clínica autorizada não permite cache nem consulta de CID simulada", async () => {
  mock.history.mockResolvedValue({ records: [] });
  mock.generate.mockReturnValue({
    stream: (async function* () {
      yield { text: "Revisão médica necessária." };
    })(),
  });
  const response = await medical(
    request("POST", "/medical", { mensagemMedico: "Resumo", pacienteId: "p1", companyId: "c1" })
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).toBe("Revisão médica necessária.");
  expect(mock.generate.mock.calls[0][0]).not.toHaveProperty("tools");
});
it("encerra streaming com erro genérico, sem expor erro do provedor", async () => {
  mock.history.mockResolvedValue({ records: [] });
  mock.generate.mockReturnValue({
    stream: (async function* () {
      yield { text: "Início" };
      throw new Error("segredo-do-provedor");
    })(),
  });
  const response = await medical(
    request("POST", "/medical", { mensagemMedico: "Resumo", pacienteId: "p1", companyId: "c1" })
  );
  await expect(response.text()).rejects.toThrow("A resposta foi interrompida.");
});
