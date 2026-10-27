import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const state = vi.hoisted(() => ({
  verify: vi.fn(),
  process: vi.fn(),
}));
vi.mock("googleapis/build/src/apis/oauth2", () => ({
  auth: {
    OAuth2: class {
      verifyIdToken = state.verify;
    },
  },
}));
vi.mock("@/services/webhooks/webhook-dispatcher", () => ({
  processWebhookQueue: state.process,
}));
const request = (token = "Bearer token") =>
  new NextRequest("https://example.test/api/internal/webhook-deliveries", {
    method: "POST",
    headers: token ? { authorization: token } : {},
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("WEBHOOK_INVOKER_EMAIL", "worker@example.test");
  vi.stubEnv("WEBHOOK_WORKER_AUDIENCE", "https://example.test/api/internal/webhook-deliveries");
  state.verify.mockResolvedValue({
    getPayload: () => ({ email: "worker@example.test", email_verified: true }),
  });
  state.process.mockResolvedValue({ examined: 2 });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects unauthenticated invocations before touching the queue", async () => {
  expect((await POST(request(""))).status).toBe(401);
  expect(state.process).not.toHaveBeenCalled();
});
it("fails closed when worker configuration is absent", async () => {
  vi.stubEnv("WEBHOOK_INVOKER_EMAIL", "");
  expect((await POST(request())).status).toBe(503);
  expect(state.process).not.toHaveBeenCalled();
});
it("verifies the configured audience and awaits processing", async () => {
  const response = await POST(request());
  expect(state.verify).toHaveBeenCalledWith({
    idToken: "token",
    audience: "https://example.test/api/internal/webhook-deliveries",
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ examined: 2 });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it.each([
  { email: "other@example.test", email_verified: true },
  { email: "worker@example.test", email_verified: false },
])("rejects the wrong or unverified identity: %j", async (claims) => {
  state.verify.mockResolvedValue({ getPayload: () => claims });
  expect((await POST(request())).status).toBe(403);
  expect(state.process).not.toHaveBeenCalled();
});
it("rejects invalid or expired identity tokens", async () => {
  state.verify.mockRejectedValue(new Error("expired"));
  expect((await POST(request())).status).toBe(401);
  expect(state.process).not.toHaveBeenCalled();
});
it("returns a retryable error without leaking internal failures", async () => {
  state.process.mockRejectedValue(new Error("private infrastructure error"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private infrastructure");
});

it.each(["Basic token", "Bearer", "Bearer token extra", "Bearer token,other"])(
  "rejects malformed authorization: %s",
  async (header) => {
    if (header === "Bearer token,other") state.verify.mockRejectedValue(new Error("invalid token"));
    expect((await POST(request(header))).status).toBe(401);
    expect(state.process).not.toHaveBeenCalled();
  }
);
it("accepts case-insensitive bearer scheme", async () => {
  expect((await POST(request("bearer token"))).status).toBe(200);
});
it("fails closed when audience is absent", async () => {
  vi.stubEnv("WEBHOOK_WORKER_AUDIENCE", "");
  expect((await POST(request())).status).toBe(503);
  expect(state.verify).not.toHaveBeenCalled();
  expect(state.process).not.toHaveBeenCalled();
});
it("rejects missing identity claims", async () => {
  state.verify.mockResolvedValue({ getPayload: () => undefined });
  expect((await POST(request())).status).toBe(403);
  expect(state.process).not.toHaveBeenCalled();
});
