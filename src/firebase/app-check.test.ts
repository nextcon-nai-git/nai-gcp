import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ initialize: vi.fn(), getToken: vi.fn() }));
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: mock.initialize,
  ReCaptchaEnterpriseProvider: class {
    constructor(public key: string) {}
  },
  getToken: mock.getToken,
}));
import { initializeNaiAppCheck, getNaiAppCheckToken } from "./app-check";
import type { FirebaseApp } from "firebase/app";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("App Check no navegador", () => {
  it("não inventa uma chave de registro nem ativa um provedor de debug", () => {
    expect(initializeNaiAppCheck({} as FirebaseApp)).toBeNull();
    expect(mock.initialize).not.toHaveBeenCalled();
  });
  it("inicializa uma vez por app, antes dos serviços, e renova tokens", async () => {
    vi.stubEnv("NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY", "registered-site-key");
    const app = {} as FirebaseApp;
    const instance = {};
    mock.initialize.mockReturnValue(instance);
    mock.getToken.mockResolvedValue({ token: "app-token" });
    expect(initializeNaiAppCheck(app)).toBe(instance);
    expect(initializeNaiAppCheck(app)).toBe(instance);
    expect(mock.initialize).toHaveBeenCalledTimes(1);
    expect(mock.initialize.mock.calls[0][1].isTokenAutoRefreshEnabled).toBe(true);
    expect(await getNaiAppCheckToken(app)).toBe("app-token");
  });
});
