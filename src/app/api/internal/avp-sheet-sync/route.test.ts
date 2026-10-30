// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ verify: vi.fn(), queue: vi.fn(), periodic: vi.fn() }));
vi.mock("googleapis/build/src/apis/oauth2", () => ({
  auth: {
    OAuth2: class {
      verifyIdToken = m.verify;
    },
  },
}));
vi.mock("@/services/avp-sheet-sync", () => ({ syncAvpSource: m.queue }));
vi.mock("@/services/avp-periodic-sync", () => ({ syncAvpPeriodicControl: m.periodic }));
import { POST } from "./route";
const request = (token = "signed-token") =>
  new NextRequest("https://example.test/api/internal/avp-sheet-sync", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AVP_SYNC_INVOKER_EMAIL", "scheduler@example.test");
  vi.stubEnv("AVP_SYNC_AUDIENCE", "https://example.test/api/internal/avp-sheet-sync");
  m.verify.mockResolvedValue({
    getPayload: () => ({ email: "scheduler@example.test", email_verified: true }),
  });
  m.queue.mockResolvedValue({ started: true, rowCount: 1 });
  m.periodic.mockResolvedValue({ started: false });
});
afterEach(() => vi.unstubAllEnvs());
it("exige token, audiência e identidade antes de ler as fontes", async () => {
  expect((await POST(request(""))).status).toBe(401);
  m.verify.mockResolvedValue({
    getPayload: () => ({ email: "other@example.test", email_verified: true }),
  });
  expect((await POST(request())).status).toBe(403);
  expect(m.queue).not.toHaveBeenCalled();
  expect(m.periodic).not.toHaveBeenCalled();
  expect(m.verify).toHaveBeenCalledWith({
    idToken: "signed-token",
    audience: "https://example.test/api/internal/avp-sheet-sync",
  });
});
it("mantém a fila a cada chamada e delega o intervalo horário dos periódicos", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.queue).toHaveBeenCalledWith(true, "scheduler@example.test");
  expect(m.periodic).toHaveBeenCalledWith({ scheduled: true });
});
it("falhas das fontes são independentes e retornam erro para repetição do agendador", async () => {
  m.queue.mockRejectedValue(new Error("private queue error"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(m.periodic).toHaveBeenCalledOnce();
  expect(JSON.stringify(await response.json())).not.toContain("private queue");
});
