// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  profile: vi.fn(),
  sync: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
}));
vi.mock("googleapis/build/src/apis/oauth2", () => ({
  auth: {
    OAuth2: class {
      verifyIdToken(input: unknown) {
        return mocks.verify(input);
      }
    },
  },
}));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mocks.collection } }));
vi.mock("@/services/aso-flow-mail", () => ({ syncAsoFlowMail: mocks.sync }));
// requireAsoFlowAccess and parseClaims are real: tests exercise the actual role/tenant boundary.
import { POST } from "./route";

const invoker = "scheduler@example.test",
  operator = "configured-operator";
const audience = "https://nai.example.test/api/internal/aso-mail-sync";
const request = (authorization: string | null = "Bearer synthetic-oidc-token") =>
  new NextRequest(audience, { method: "POST", headers: authorization ? { authorization } : {} });
function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ASO_MAIL_SYNC_INVOKER_EMAIL", invoker);
  vi.stubEnv("ASO_MAIL_SYNC_AUDIENCE", audience);
  vi.stubEnv("ASO_MAIL_OPERATOR_UID", operator);
  mocks.verify.mockResolvedValue({ getPayload: () => ({ email: invoker, email_verified: true }) });
  mocks.collection.mockImplementation(() => ({ doc: mocks.doc }));
  mocks.doc.mockImplementation(() => ({ get: mocks.profile }));
  mocks.profile.mockResolvedValue({
    data: () => ({
      role: "OPERATIONS",
      email: "operator@example.test",
      accessEnabled: true,
      servedCompanies: ["company-a"],
      permissions: ["existing-permission"],
    }),
  });
  mocks.sync.mockResolvedValue({ saved: 2, skipped: 1, examined: 3, hasMore: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("monitor interno de ASOs por e-mail", () => {
  it.each([null, "", "Basic fake", "Bearer", "Bearer bad token"])(
    "nega cabeçalho inválido %s antes de acessar perfis",
    async (authorization) => {
      const result = await POST(request(authorization));
      privateResponse(result, 401);
      expect(mocks.verify).not.toHaveBeenCalled();
      expect(mocks.profile).not.toHaveBeenCalled();
      expect(mocks.sync).not.toHaveBeenCalled();
    }
  );
  it.each(["ASO_MAIL_SYNC_INVOKER_EMAIL", "ASO_MAIL_SYNC_AUDIENCE", "ASO_MAIL_OPERATOR_UID"])(
    "não funciona sem configuração %s",
    async (variable) => {
      vi.stubEnv(variable, "");
      privateResponse(await POST(request()), 503);
      expect(mocks.verify).not.toHaveBeenCalled();
      expect(mocks.profile).not.toHaveBeenCalled();
      expect(mocks.sync).not.toHaveBeenCalled();
    }
  );
  it.each(["../operator", "a".repeat(129)])(
    "rejeita operador inválido antes de consultar o banco",
    async (uid) => {
      vi.stubEnv("ASO_MAIL_OPERATOR_UID", uid);
      privateResponse(await POST(request()), 503);
      expect(mocks.profile).not.toHaveBeenCalled();
      expect(mocks.sync).not.toHaveBeenCalled();
    }
  );
  it("confere a audiência esperada e não expõe erros ou tokens do provedor", async () => {
    mocks.verify.mockRejectedValue(new Error("private JWT synthetic-oidc-token issuer rejected"));
    const response = await POST(request());
    privateResponse(response, 401);
    expect(mocks.verify).toHaveBeenCalledWith({ idToken: "synthetic-oidc-token", audience });
    expect(await response.text()).not.toContain("synthetic-oidc-token");
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it.each([
    { email: "different@example.test", email_verified: true },
    { email: invoker, email_verified: false },
    { email: invoker, email_verified: "true" },
    undefined,
  ])("nega emissor diferente ou e-mail não verificado: %j", async (claims) => {
    mocks.verify.mockResolvedValue({ getPayload: () => claims });
    privateResponse(await POST(request()), 401);
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it.each([undefined, { role: "ADMIN", accessEnabled: false }])(
    "não usa perfil ausente ou suspenso: %j",
    async (profile) => {
      mocks.profile.mockResolvedValue({ data: () => profile });
      privateResponse(await POST(request()), 403);
      expect(mocks.collection).toHaveBeenCalledWith("users");
      expect(mocks.doc).toHaveBeenCalledWith(operator);
      expect(mocks.sync).not.toHaveBeenCalled();
    }
  );
  it.each([
    { role: "SCOPED_PROVIDER", accessEnabled: true, servedCompanies: ["company-a"] },
    { role: "PROVIDER", accessEnabled: true },
    { role: "GUEST", accessEnabled: true },
    { role: "ADMIN", tenantId: "company-a", accessEnabled: true },
    { role: "SUPER_ADMIN", companyId: "company-a", accessEnabled: true },
  ])("aplica o limite interno atual ao operador %j", async (profile) => {
    mocks.profile.mockResolvedValue({ data: () => profile });
    privateResponse(await POST(request()), 403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("usa somente a carteira e as permissões atuais do operador configurado", async () => {
    const response = await POST(request());
    privateResponse(response, 200);
    expect(await response.json()).toEqual({ saved: 2, skipped: 1, examined: 3, hasMore: false });
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith({
      uid: operator,
      email: "operator@example.test",
      role: "OPERATIONS",
      tenantId: null,
      servedCompanies: ["company-a"],
      permissions: ["existing-permission"],
    });
  });
  it("reconsulta o perfil a cada chamada e respeita revogação entre execuções", async () => {
    privateResponse(await POST(request()), 200);
    mocks.profile.mockResolvedValueOnce({
      data: () => ({ role: "OPERATIONS", accessEnabled: false }),
    });
    privateResponse(await POST(request()), 403);
    expect(mocks.profile).toHaveBeenCalledTimes(2);
    expect(mocks.sync).toHaveBeenCalledTimes(1);
  });
  it("mantém erros de sincronização privados e não transforma falha em sucesso", async () => {
    mocks.sync.mockRejectedValueOnce(new AuthError("Caixa em consulta", 409));
    privateResponse(await POST(request()), 409);
    mocks.sync.mockRejectedValueOnce(new Error("private-mailbox access_token=synthetic-secret"));
    const response = await POST(request());
    privateResponse(response, 503);
    expect(await response.text()).not.toContain("synthetic-secret");
  });
});
