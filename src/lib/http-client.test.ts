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
