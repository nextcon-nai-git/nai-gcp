// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postWebhook } from "./post-webhook";
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", async (original) => {
  const actual = await original<typeof import("node:https")>();
  return { ...actual, request: mock.request, default: { ...actual, request: mock.request } };
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
function setup(status = 200) {
  const req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
  const response = { statusCode: status, destroy: vi.fn() };
  req.end.mockImplementation(() => req.emit("response", response));
  mock.request.mockReturnValue(req);
  return { req, response };
}
describe("outbound webhook transport", () => {
  it("pins the public IP and preserves the HTTPS hostname for TLS validation", async () => {
    const { response } = setup();
    await expect(
      postWebhook("https://hooks.example.test/events", ["8.8.8.8"], {}, "{}", 1000)
    ).resolves.toEqual({ status: 200, ok: true });
    const [url, options] = mock.request.mock.calls[0];
    expect(url.hostname).toBe("hooks.example.test");
    expect(options.agent).toBe(false);
    const callback = vi.fn();
    options.lookup("hooks.example.test", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    options.lookup("hooks.example.test", { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: "8.8.8.8", family: 4 }]);
    expect(response.destroy).toHaveBeenCalledOnce();
  });
  it("returns redirects as failures without a second request", async () => {
    setup(302);
    await expect(postWebhook("https://example.test", ["8.8.8.8"], {}, "{}", 1000)).resolves.toEqual(
      { status: 302, ok: false }
    );
    expect(mock.request).toHaveBeenCalledOnce();
  });
  it.each(["127.0.0.1", "169.254.169.254", "10.0.0.1", "::1"])(
    "rejects restricted destination %s before connecting",
    async (address) => {
      await expect(postWebhook("https://example.test", [address], {}, "{}", 1000)).rejects.toThrow(
        "validado"
      );
      expect(mock.request).not.toHaveBeenCalled();
    }
  );
  it("enforces a wall-clock timeout even before response headers", async () => {
    vi.useFakeTimers();
    const { req } = setup();
    req.end.mockReset();
    req.destroy.mockImplementation((error) => req.emit("error", error));
    const pending = postWebhook("https://example.test", ["8.8.8.8"], {}, "{}", 10);
    const rejected = expect(pending).rejects.toThrow("Timeout");
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    expect(req.destroy).toHaveBeenCalledOnce();
  });
});
