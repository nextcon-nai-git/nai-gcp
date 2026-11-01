// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({ verify: vi.fn(), sync: vi.fn(), monitor: vi.fn() }));
vi.mock("@/services/operational-runs", () => ({ monitorOperation: m.monitor }));
vi.mock("googleapis/build/src/apis/oauth2", () => ({
  auth: {
    OAuth2: class {
      verifyIdToken = m.verify;
    },
  },
}));
vi.mock("@/services/esocial/messaging", () => ({ syncEsocialMessages: m.sync }));
import { POST } from "./route";
const invoker = "synthetic-scheduler@example.test";
const audience = "https://nai.example.test/api/internal/esocial-sync";
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
  m.monitor.mockImplementation((_operation: string, execute: () => Promise<unknown>) => execute());
  vi.stubEnv("ESOCIAL_SYNC_INVOKER_EMAIL", invoker);
  vi.stubEnv("ESOCIAL_SYNC_AUDIENCE", audience);
  vi.stubEnv("ESOCIAL_SYNC_ENABLED", "true");
  m.verify.mockResolvedValue({ getPayload: () => ({ email: invoker, email_verified: true }) });
  m.sync.mockResolvedValue({ checked: 1, waiting: 0, unavailable: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("consulta interna eSocial por OIDC", () => {
  it.each([null, "", "Basic token", "Bearer", "Bearer a b"])(
    "nega credencial inválida %s antes do worker",
    async (header) => {
      privateResponse(await POST(request(header)), 401);
      expect(m.verify).not.toHaveBeenCalled();
      expect(m.monitor).not.toHaveBeenCalled();
      expect(m.sync).not.toHaveBeenCalled();
    }
  );
  it.each(["ESOCIAL_SYNC_INVOKER_EMAIL", "ESOCIAL_SYNC_AUDIENCE", "ESOCIAL_SYNC_ENABLED"])(
    "exige configuração %s",
    async (name) => {
      vi.stubEnv(name, "");
      privateResponse(await POST(request()), 503);
      expect(m.verify).not.toHaveBeenCalled();
      expect(m.monitor).not.toHaveBeenCalled();
      expect(m.sync).not.toHaveBeenCalled();
    }
  );
  it("valida a audiência fixa e não divulga tokens ou diagnóstico do provedor", async () => {
    m.verify.mockRejectedValue(new Error("private-provider-error synthetic-oidc-token"));
    const response = await POST(request());
    privateResponse(response, 401);
    expect(m.verify).toHaveBeenCalledWith({ idToken: "synthetic-oidc-token", audience });
    expect(await response.text()).not.toContain("synthetic-oidc-token");
    expect(m.sync).not.toHaveBeenCalled();
  });
  it.each([
    { email: "other@example.test", email_verified: true },
    { email: invoker, email_verified: false },
    { email: invoker, email_verified: "true" },
    undefined,
  ])("nega identidade não verificada ou diferente: %j", async (claims) => {
    m.verify.mockResolvedValue({ getPayload: () => claims });
    privateResponse(await POST(request()), 401);
    expect(m.sync).not.toHaveBeenCalled();
  });
  it("executa apenas consulta após validar invocador, sem aceitar ações no corpo", async () => {
    const response = await POST(
      new NextRequest(audience, {
        method: "POST",
        headers: {
          authorization: "Bearer synthetic-oidc-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "transmit", companyId: "injected-client" }),
      })
    );
    privateResponse(response, 200);
    expect(m.sync).toHaveBeenCalledExactlyOnceWith();
    expect(await response.json()).toEqual({ checked: 1, waiting: 0, unavailable: 0 });
  });
  it("preserva conflito e mantém falhas internas privadas", async () => {
    m.sync.mockRejectedValueOnce(new AuthError("Consulta já em andamento.", 409));
    privateResponse(await POST(request()), 409);
    m.sync.mockRejectedValueOnce(new Error("private-firebase-record"));
    const response = await POST(request());
    privateResponse(response, 503);
    expect(await response.text()).not.toContain("private-firebase-record");
  });
});


it("records only an authenticated worker invocation", async () => {
  await POST(request());
  expect(m.monitor).toHaveBeenCalledWith("esocial-query", expect.any(Function));
});
