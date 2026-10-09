import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, POST } from "./route";
const state = vi.hoisted(() => ({
  auth: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  add: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: state.get, update: state.update }), add: state.add }),
  },
}));
vi.mock("@/lib/developer-api-guard", async (original) => ({
  ...(await original<typeof import("@/lib/developer-api-guard")>()),
  requireApiKey: state.auth,
}));
vi.mock("@/lib/webhook-security-guard", () => ({ validateWebhookTargetUrl: state.validate }));
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.mockResolvedValue({ id: "key", clientId: "a", scopes: ["webhooks:manage"] });
  state.get.mockResolvedValue({ exists: true, data: () => ({ clientId: "a" }) });
  state.update.mockResolvedValue(undefined);
  state.add.mockResolvedValue({ id: "new" });
  state.validate.mockResolvedValue({ valid: true, normalizedUrl: "https://example.test/" });
});
const req = (method: string, body?: unknown, query = "?id=w") =>
  new NextRequest(`https://example.test/api/webhooks${query}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
it("denies deactivation of another tenant webhook without mutation", async () => {
  state.get.mockResolvedValue({ exists: true, data: () => ({ clientId: "b" }) });
  expect((await DELETE(req("DELETE"))).status).toBe(403);
  expect(state.update).not.toHaveBeenCalled();
});
it("deactivates an authorized webhook with audit identity", async () => {
  const response = await DELETE(req("DELETE"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({ active: false, revokedByKeyId: "key" })
  );
});
it("rejects malformed IDs and unknown events before persisting", async () => {
  expect((await DELETE(req("DELETE", undefined, "?id=a/b"))).status).toBe(400);
  expect(
    (await POST(req("POST", { url: "https://example.test", events: ["unapproved"] }))).status
  ).toBe(400);
  expect(state.add).not.toHaveBeenCalled();
});
it("stores only a validated normalized URL", async () => {
  expect(
    (await POST(req("POST", { url: "https://example.test", events: ["aso.expired"] }))).status
  ).toBe(201);
  expect(state.add).toHaveBeenCalledWith(
    expect.objectContaining({
      clientId: "a",
      url: "https://example.test/",
      events: ["aso.expired"],
    })
  );
});
