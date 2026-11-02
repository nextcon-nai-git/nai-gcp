// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), replay: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: {} }));
vi.mock("@/lib/developer-api-guard", async (original) => ({
  ...(await original<typeof import("@/lib/developer-api-guard")>()),
  requireApiKey: m.auth,
}));
vi.mock("@/services/webhooks/webhook-dispatcher", () => ({ replayWebhookDelivery: m.replay }));
import { POST } from "./route";
const key = { id: "key", clientId: "company-a", scopes: ["webhooks:manage"] };
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue(key);
  m.replay.mockResolvedValue({ queued: true });
});
it("keeps the authenticated principal attached to a bounded replay request", async () => {
  const response = await POST(
    new NextRequest("https://nai.test/api/deliveries", {
      method: "POST",
      body: JSON.stringify({ deliveryId: "delivery-a" }),
    })
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(m.replay).toHaveBeenCalledExactlyOnceWith("delivery-a", key);
});
it.each([undefined, "1"])(
  "cancels an oversized replay request with Content-Length %s",
  async (length) => {
    const cancel = vi.fn();
    const response = await POST(
      new NextRequest("https://nai.test/api/deliveries", {
        method: "POST",
        headers: length ? { "content-length": length } : {},
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(4096));
            controller.enqueue(new Uint8Array(1));
          },
          cancel,
        }),
        duplex: "half",
      } as ConstructorParameters<typeof NextRequest>[1])
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(cancel).toHaveBeenCalledOnce();
    expect(m.replay).not.toHaveBeenCalled();
  }
);
it("requires webhook scope before reading the body", async () => {
  m.auth.mockResolvedValue({ ...key, scopes: ["employees:read"] });
  const request = new NextRequest("https://nai.test/api/deliveries", {
    method: "POST",
    body: "untrusted",
  });
  expect((await POST(request)).status).toBe(403);
  expect(request.bodyUsed).toBe(false);
  expect(m.replay).not.toHaveBeenCalled();
});
it("keeps malformed JSON away from replay and its public error", async () => {
  const response = await POST(
    new NextRequest("https://nai.test/api/deliveries", {
      method: "POST",
      body: "synthetic-private-input",
    })
  );
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("synthetic-private-input");
  expect(m.replay).not.toHaveBeenCalled();
});
