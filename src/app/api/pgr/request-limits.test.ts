// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  appCheck: vi.fn(),
  collection: vi.fn(),
  transaction: vi.fn(),
  load: vi.fn(),
  ai: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/auth/require-pgr-app-check", () => ({ requirePgrAppCheck: m.appCheck }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
vi.mock("@/services/nai-import-review", () => ({ loadNaiImportForReview: m.load }));
vi.mock("@/services/pgr-ai-provider", () => ({ getPgrAi: m.ai }));
import { PATCH } from "./tasks/route";
import { POST } from "./agent-review/route";

const routes = [
  { name: "tasks", method: "PATCH", limit: 30000, handle: PATCH },
  { name: "agent-review", method: "POST", limit: 2000, handle: POST },
];

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ uid: "admin", role: "SUPER_ADMIN", servedCompanies: [] });
  m.appCheck.mockResolvedValue(undefined);
});

it.each(routes)("bounds $name before parsing, persistence or AI calls", async (route) => {
  for (const length of [undefined, "1"]) {
    const cancel = vi.fn();
    const request = new NextRequest(`https://nai.test/api/pgr/${route.name}`, {
      method: route.method,
      headers: length ? { "content-length": length } : {},
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(route.limit));
          controller.enqueue(new Uint8Array(1));
        },
        cancel,
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    expect((await route.handle(request)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
  }
  expect(m.collection).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.load).not.toHaveBeenCalled();
  expect(m.ai).not.toHaveBeenCalled();
});

it.each(routes)("authenticates $name before consuming input", async (route) => {
  m.auth.mockRejectedValue(new AuthError("Sessão expirada.", 401));
  const request = new NextRequest(`https://nai.test/api/pgr/${route.name}`, {
    method: route.method,
    body: "untrusted",
  });
  expect((await route.handle(request)).status).toBe(401);
  expect(request.bodyUsed).toBe(false);
  expect(m.appCheck).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.ai).not.toHaveBeenCalled();
});

it.each(routes)("retains App Check before reading $name input", async (route) => {
  m.appCheck.mockRejectedValue(new AuthError("App Check obrigatório.", 403));
  const request = new NextRequest(`https://nai.test/api/pgr/${route.name}`, {
    method: route.method,
    body: "untrusted",
  });
  expect((await route.handle(request)).status).toBe(403);
  expect(request.bodyUsed).toBe(false);
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.ai).not.toHaveBeenCalled();
});

it.each(routes)("keeps the safe invalid-request response for $name", async (route) => {
  const request = new NextRequest(`https://nai.test/api/pgr/${route.name}`, {
    method: route.method,
    body: "synthetic-private-input",
  });
  const response = await route.handle(request);
  expect(response.status).toBe(422);
  expect(await response.text()).not.toContain("synthetic-private-input");
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.ai).not.toHaveBeenCalled();
});
