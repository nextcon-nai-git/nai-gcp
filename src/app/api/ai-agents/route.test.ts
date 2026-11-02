// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const m = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn(), allowed: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/ai/flows/sesmt-agents-flow", () => ({ processSesmtAgentRequest: m.generate }));
vi.mock("@/lib/agent-access-control", () => ({ getAllowedAgentsForUser: m.allowed }));
import { POST } from "./route";
const input = { agentRole: "medico_trabalho", userPrompt: "Pergunta sintética para teste." };
const request = (body: unknown) =>
  new NextRequest("https://nai.test/api/ai-agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ uid: "doctor", role: "DOCTOR" });
  m.allowed.mockReturnValue({ allowedRoles: ["medico_trabalho"] });
  m.generate.mockResolvedValue({ analysis: "Resposta sintética" });
});
afterEach(() => vi.restoreAllMocks());
it("passes only valid bounded question/context to an allowed agent", async () => {
  const response = await POST(
    request({ ...input, companyContext: { companyName: "Empresa sintética", employeeCount: 3 } })
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(m.generate).toHaveBeenCalledExactlyOnceWith({
    ...input,
    companyContext: { companyName: "Empresa sintética", employeeCount: 3 },
  });
});
it.each([
  null,
  { ...input, userPrompt: {} },
  { ...input, userPrompt: " " },
  { ...input, userPrompt: "a".repeat(20001) },
  { ...input, companyContext: { employeeCount: -1 } },
])("rejects malformed input before generating an analysis", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(m.generate).not.toHaveBeenCalled();
});
it.each([undefined, "1"])("limits real streamed bytes with Content-Length %s", async (length) => {
  const cancel = vi.fn();
  const response = await POST(
    new NextRequest("https://nai.test/api/ai-agents", {
      method: "POST",
      headers: length ? { "content-length": length } : {},
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(256 * 1024));
          controller.enqueue(new Uint8Array(1));
        },
        cancel,
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1])
  );
  expect(response.status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(m.generate).not.toHaveBeenCalled();
});
it("denies an unauthorized agent without invoking the provider", async () => {
  m.allowed.mockReturnValue({ allowedRoles: ["enfermeiro_trabalho"] });
  expect((await POST(request(input))).status).toBe(403);
  expect(m.generate).not.toHaveBeenCalled();
});
it.each(["junta_sesmt", "constructor", "unknown"])(
  "rejects unsupported agent %s even when the permission helper includes it",
  async (agentRole) => {
    m.allowed.mockReturnValue({ allowedRoles: [agentRole] });
    expect((await POST(request({ ...input, agentRole }))).status).toBe(400);
    expect(m.generate).not.toHaveBeenCalled();
  }
);
it("authenticates before reading the question", async () => {
  m.auth.mockRejectedValue(new AuthError("Sessão expirada.", 401));
  const req = request(input);
  expect((await POST(req)).status).toBe(401);
  expect(req.bodyUsed).toBe(false);
  expect(m.generate).not.toHaveBeenCalled();
});
it("does not disclose provider details or question content in responses or logs", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  m.generate.mockRejectedValue(
    new Error("credential=synthetic-secret; private diagnostic content")
  );
  const response = await POST(request(input));
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const visible = await response.text();
  expect(visible).not.toContain("synthetic-secret");
  expect(visible).not.toContain("private diagnostic");
  expect(log).toHaveBeenCalledExactlyOnceWith("[API AI Agents Error]", "AUTHORIZATION");
});
