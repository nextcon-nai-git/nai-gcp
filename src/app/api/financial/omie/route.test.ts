// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  list: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/omie-financial", () => ({
  connectOmie: m.connect,
  disconnectOmie: m.disconnect,
  listOmie: m.list,
  omieStatus: m.status,
}));
import { POST } from "./route";

const credentials = { appKey: "synthetic-key", appSecret: "synthetic-secret" };
const request = (body: string | ReadableStream<Uint8Array>, type = "application/json") =>
  new NextRequest("https://example.test/api/financial/omie", {
    method: "POST",
    headers: { "Content-Type": type },
    body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ uid: "admin", role: "ADMIN", tenantId: null });
  m.connect.mockResolvedValue({ connected: true, company: "NEXTCON TESTE" });
});

describe("Omie credential API input boundary", () => {
  it.each([
    { role: "OPERATIONS", tenantId: null },
    { role: "ADMIN", tenantId: "client" },
    { role: "CLIENT_ADMIN", tenantId: "client" },
  ])("denies $role/$tenantId before reading or saving credentials", async (user) => {
    m.auth.mockResolvedValue({ uid: "not-authorized", ...user });
    const req = request(JSON.stringify(credentials));
    const reader = vi.spyOn(req.body!, "getReader");
    const result = await POST(req);
    expect(result.status).toBe(403);
    expect(reader).not.toHaveBeenCalled();
    expect(m.connect).not.toHaveBeenCalled();
    await req.body!.cancel();
  });

  it("stops a chunked body at the byte limit even without Content-Length", async () => {
    const cancel = vi.fn();
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (++chunks <= 10) controller.enqueue(new Uint8Array(1024));
        else controller.close();
      },
      cancel,
    });
    const result = await POST(request(body));
    expect(result.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toBeLessThan(10);
    expect(m.connect).not.toHaveBeenCalled();
  });

  it("measures UTF-8 bytes rather than accepting a large multibyte body", async () => {
    const result = await POST(request(JSON.stringify({ appKey: "á".repeat(1100) })));
    expect(result.status).toBe(413);
    expect(m.connect).not.toHaveBeenCalled();
  });

  it("requires valid JSON before calling the credential service", async () => {
    expect((await POST(request(JSON.stringify(credentials), "text/plain"))).status).toBe(400);
    expect((await POST(request("{invalid"))).status).toBe(400);
    expect(m.connect).not.toHaveBeenCalled();
  });

  it("accepts a bounded JSON request and keeps credentials out of the response", async () => {
    const result = await POST(request(JSON.stringify(credentials)));
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(result.headers.get("Vary")).toBe("Authorization");
    expect(m.connect).toHaveBeenCalledWith(
      { uid: "admin", role: "ADMIN", tenantId: null },
      credentials
    );
    expect(await result.json()).toEqual({ connected: true, company: "NEXTCON TESTE" });
  });
});
