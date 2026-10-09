import { beforeEach, expect, it, vi } from "vitest";
import type { ApiKeyRecord } from "@/types/developer";
import { replayWebhookDelivery, executeWebhookDelivery } from "./webhook-dispatcher";
const state = vi.hoisted(() => ({
  delivery: {} as Record<string, unknown>,
  webhook: {} as Record<string, unknown>,
  update: vi.fn(),
  post: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => (name === "webhooks" ? state.webhook : state.delivery),
        }),
        update: state.update,
      }),
    }),
  },
}));
vi.mock("./post-webhook", () => ({ postWebhook: state.post }));
vi.mock("@/lib/webhook-security-guard", () => ({ validateWebhookTargetUrl: state.validate }));
const key = { id: "k", clientId: "a", scopes: ["webhooks:manage"] } as ApiKeyRecord;
beforeEach(() => {
  vi.clearAllMocks();
  state.delivery = {
    clientId: "a",
    webhookId: "w",
    targetUrl: "https://example.test",
    payload: {},
    attempt: 0,
    maxAttempts: 5,
  };
  state.webhook = { clientId: "a", active: true, secret: "secret", url: "https://example.test" };
  state.update.mockResolvedValue(undefined);
  state.post.mockResolvedValue({ status: 200, ok: true });
  state.validate.mockResolvedValue({
    valid: true,
    normalizedUrl: "https://example.test/",
    resolvedIps: ["8.8.8.8"],
  });
});
it("denies replay from another tenant before mutation or delivery", async () => {
  await expect(replayWebhookDelivery("delivery", { ...key, clientId: "b" })).rejects.toThrow(
    "Isolamento"
  );
  expect(state.update).not.toHaveBeenCalled();
  expect(state.post).not.toHaveBeenCalled();
});
it.each([{ active: false }, { clientId: "b" }, { url: "https://changed.test" }, { secret: "" }])(
  "rejects invalid replay destination %j",
  async (change) => {
    Object.assign(state.webhook, change);
    await expect(replayWebhookDelivery("delivery", key)).rejects.toThrow();
    expect(state.update).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
  }
);
it("replays only the authorized active webhook", async () => {
  await expect(replayWebhookDelivery("delivery", key)).resolves.toMatchObject({ success: true });
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ status: "PENDING" }));
});
it("uses validated IPs and records redirect failure as retryable", async () => {
  state.post.mockResolvedValue({ status: 302, ok: false });
  await expect(executeWebhookDelivery("delivery", "secret", state.delivery)).resolves.toMatchObject(
    { status: "RETRYING", success: false }
  );
  expect(state.post).toHaveBeenCalledWith(
    "https://example.test/",
    ["8.8.8.8"],
    expect.any(Object),
    "{}",
    10000
  );
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "RETRYING", httpStatus: 302 })
  );
});
