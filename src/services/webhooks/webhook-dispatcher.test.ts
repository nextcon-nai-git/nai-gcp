import { beforeEach, expect, it, vi } from "vitest";
import type { DeveloperPrincipal } from "@/types/developer";
import {
  emitWebhookEvent, executeWebhookDelivery, processWebhookQueue, replayWebhookDelivery,
} from "./webhook-dispatcher";

const state = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  post: vi.fn(), validate: vi.fn(), tail: Promise.resolve(), sequence: 0,
}));
vi.mock("@/lib/firebase-admin", () => {
  const doc = (path: string) => ({
    path,
    get: async () => {
      const row = state.rows.get(path);
      return { exists: !!row, data: () => row ? { ...row } : undefined };
    },
  });
  const query = (name: string, filters: Array<[string, string, unknown]> = [], order = "", count = 100) => ({
    doc: (id: string) => doc(name + "/" + id),
    where: (field: string, op: string, value: unknown) =>
      query(name, [...filters, [field, op, value]], order, count),
    orderBy: (field: string) => query(name, filters, field, count),
    limit: (limit: number) => query(name, filters, order, limit),
    add: async (row: Record<string, unknown>) => {
      const id = String(++state.sequence);
      state.rows.set(name + "/" + id, row);
      return { id };
    },
    get: async () => {
      const docs = [...state.rows.entries()]
        .filter(([path, row]) => path.startsWith(name + "/") && filters.every(
          ([field, op, value]) => op === "==" ? row[field] === value :
            typeof row[field] === "string" && String(row[field]) <= String(value)
        ))
        .sort((a, b) => String(a[1][order]).localeCompare(String(b[1][order])))
        .slice(0, count)
        .map(([path, row]) => ({ id: path.split("/")[1], data: () => ({ ...row }) }));
      return { docs, empty: docs.length === 0 };
    },
  });
  return {
    adminDb: {
      collection: (name: string) => query(name),
      runTransaction: (callback: (tx: unknown) => Promise<unknown>) => {
        // Serialize transactions to model atomic claims/rechecks.
        const result = state.tail.then(() => callback({
          get: (ref: ReturnType<typeof doc>) => ref.get(),
          update: (ref: ReturnType<typeof doc>, patch: Record<string, unknown>) =>
            state.rows.set(ref.path, { ...state.rows.get(ref.path), ...patch }),
        }));
        state.tail = result.then(() => undefined, () => undefined);
        return result;
      },
    },
  };
});
vi.mock("./post-webhook", () => ({ postWebhook: state.post }));
vi.mock("@/lib/webhook-security-guard", () => ({ validateWebhookTargetUrl: state.validate }));
const principal: DeveloperPrincipal = { id: "k", clientId: "a", scopes: ["webhooks:manage"] };
const row = () => state.rows.get("webhook_deliveries/d")!;
const webhook = () => state.rows.get("webhooks/w")!;
beforeEach(() => {
  vi.clearAllMocks();
  state.tail = Promise.resolve();
  state.rows.clear();
  state.sequence = 0;
  state.rows.set("webhook_deliveries/d", {
    clientId: "a", webhookId: "w", targetUrl: "https://example.test/",
    eventId: "evt", eventType: "aso.expired", payload: {}, signature: "",
    attempt: 0, maxAttempts: 5, status: "PENDING",
    createdAt: "2026-01-01T00:00:00.000Z", nextRetryAt: null,
  });
  state.rows.set("webhooks/w", {
    clientId: "a", active: true, secret: "secret", url: "https://example.test/",
    events: ["aso.expired"],
  });
  state.post.mockResolvedValue({ status: 200, ok: true });
  state.validate.mockResolvedValue({
    valid: true, normalizedUrl: "https://example.test/", resolvedIps: ["8.8.8.8"],
  });
});
it("persists events without starting untracked HTTP work", async () => {
  const result = await emitWebhookEvent("aso.expired", "a", { employeeId: "e" });
  expect(result.deliveriesCount).toBe(1);
  expect(state.rows.get("webhook_deliveries/1")).toMatchObject({ status: "PENDING", attempt: 0 });
  expect(state.post).not.toHaveBeenCalled();
});
it("claims concurrent invocations only once and awaits delivery", async () => {
  let release!: () => void;
  state.post.mockImplementation(() => new Promise((resolve) => {
    release = () => resolve({ status: 200, ok: true });
  }));
  const first = executeWebhookDelivery("d");
  await vi.waitFor(() => expect(state.post).toHaveBeenCalledTimes(1));
  await executeWebhookDelivery("d");
  expect(row().status).toBe("RETRYING");
  release();
  await first;
  expect(row()).toMatchObject({ status: "DELIVERED", attempt: 1, leaseToken: null });
});
it("retries only when due and preserves validated IP pinning", async () => {
  state.post.mockResolvedValueOnce({ status: 503, ok: false });
  await executeWebhookDelivery("d");
  expect(row()).toMatchObject({ status: "RETRYING", attempt: 1, httpStatus: 503 });
  expect(Date.parse(String(row().nextRetryAt))).toBeGreaterThan(Date.now() + 59000);
  await processWebhookQueue();
  expect(state.post).toHaveBeenCalledTimes(1);
  row().nextRetryAt = "2026-01-01T00:00:00.000Z";
  await processWebhookQueue();
  expect(row()).toMatchObject({ status: "DELIVERED", attempt: 2 });
  expect(state.post).toHaveBeenCalledWith(
    "https://example.test/", ["8.8.8.8"], expect.any(Object), "{}", 10000
  );
});
it("recovers expired leases and stops after the retry budget", async () => {
  Object.assign(row(), {
    status: "RETRYING", attempt: 4, leaseToken: "crashed",
    leaseUntil: "2026-01-01T00:00:00.000Z", nextRetryAt: "2026-01-01T00:00:00.000Z",
  });
  state.post.mockRejectedValue(new Error("timeout"));
  await processWebhookQueue();
  expect(row()).toMatchObject({ status: "DEAD_LETTER", attempt: 5, nextRetryAt: null });
  await executeWebhookDelivery("d");
  expect(state.post).toHaveBeenCalledTimes(1);
});
it("does not overwrite a newer lease after a slow send", async () => {
  state.post.mockImplementation(async () => {
    Object.assign(row(), { leaseToken: "new-worker", attempt: 2 });
    return { status: 200, ok: true };
  });
  await executeWebhookDelivery("d");
  expect(row()).toMatchObject({ leaseToken: "new-worker", status: "RETRYING" });
});
it.each([{ active: false }, { clientId: "b" }, { url: "https://changed.test/" }, { secret: "" }])(
  "blocks revoked or changed destinations on automatic retry: %j", async (change) => {
    Object.assign(webhook(), change);
    await executeWebhookDelivery("d");
    expect(row().status).toBe("DEAD_LETTER");
    expect(state.post).not.toHaveBeenCalled();
  }
);
it("captures DNS validation exceptions as retryable failures", async () => {
  state.validate.mockRejectedValueOnce(new Error("DNS unavailable"));
  await executeWebhookDelivery("d");
  expect(row()).toMatchObject({ status: "RETRYING", lastError: "DNS unavailable", leaseToken: null });
});
it("rejects cross-tenant replay before mutation", async () => {
  row().status = "DEAD_LETTER";
  await expect(replayWebhookDelivery("d", { ...principal, clientId: "b" })).rejects.toThrow("Isolamento");
  expect(row().status).toBe("DEAD_LETTER");
});
it.each(["PENDING", "RETRYING", "DELIVERED"])("rejects replay of %s deliveries", async (status) => {
  row().status = status;
  await expect(replayWebhookDelivery("d", principal)).rejects.toThrow("falha definitiva");
});
it("requeues a dead letter once and restores the retry budget", async () => {
  Object.assign(row(), { status: "DEAD_LETTER", attempt: 5 });
  await replayWebhookDelivery("d", principal);
  expect(row()).toMatchObject({ status: "PENDING", attempt: 0, leaseToken: null });
  expect(state.post).not.toHaveBeenCalled();
  await expect(replayWebhookDelivery("d", principal)).rejects.toThrow();
  await processWebhookQueue();
  expect(row()).toMatchObject({ status: "DELIVERED", attempt: 1 });
});
