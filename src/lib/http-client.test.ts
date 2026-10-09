import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("deduplicates concurrent cached GET requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      arrayBuffer: async () => new TextEncoder().encode('{"available":true}').buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      fetchJson("https://example.test/opportunities", { cacheTtlMs: 1_000 }),
      fetchJson("https://example.test/opportunities", { cacheTtlMs: 1_000 }),
    ]);

    expect(first).toEqual({ available: true });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retries a transient server response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        arrayBuffer: async () => new TextEncoder().encode('{"retried":true}').buffer,
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchJson("https://example.test/retry", { retries: 1, retryDelayMs: 1 })
    ).resolves.toEqual({ retried: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

it("does not reuse a cached response with a different size limit", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => new Response('{"value":"large"}'))
  );
  await expect(
    fetchJson("https://example.test/limits", { cacheTtlMs: 1000, maxResponseBytes: 100 })
  ).resolves.toEqual({ value: "large" });
  await expect(
    fetchJson("https://example.test/limits", { cacheTtlMs: 1000, maxResponseBytes: 5, retries: 0 })
  ).rejects.toThrow("size limit");
});

it.each(["authorization", "cookie", "x-api-key", "x-nai-api-key"])(
  "never caches credentials in %s",
  async (header) => {
    const mocked = vi.fn().mockImplementation(async () => new Response("{}"));
    vi.stubGlobal("fetch", mocked);
    const options = { cacheTtlMs: 1000, headers: { [header]: "private" } };
    await fetchJson(`https://example.test/private/${header}`, options);
    await fetchJson(`https://example.test/private/${header}`, options);
    expect(mocked).toHaveBeenCalledTimes(2);
  }
);

it("cancels an oversized streamed response without Content-Length", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(20));
    },
    cancel,
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
  await expect(
    fetchJson("https://example.test/stream", { maxResponseBytes: 10, retries: 0 })
  ).rejects.toThrow("size limit");
  expect(cancel).toHaveBeenCalledOnce();
});
