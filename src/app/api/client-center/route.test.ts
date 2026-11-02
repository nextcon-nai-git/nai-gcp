// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/client-center", () => ({
  createClientRequest: m.create,
  getClientCenter: m.read,
}));
import { POST } from "./route";

const actor = { uid: "hr", role: "HR", tenantId: "company-a" };
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue(actor);
  m.create.mockResolvedValue({ id: "request", status: "todo" });
});

it.each([undefined, "1"])(
  "cancels a large request stream before parsing or creating a card with Content-Length %s",
  async (length) => {
    const cancel = vi.fn();
    const request = new NextRequest("https://nai.test/api/client-center", {
      method: "POST",
      headers: length ? { "content-length": length } : {},
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(25000));
          controller.enqueue(new Uint8Array(25000));
        },
        cancel,
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(cancel).toHaveBeenCalledOnce();
    expect(m.create).not.toHaveBeenCalled();
  }
);

it("retains the character limit for bounded requests, including multi-byte text", async () => {
  const body = { description: "á".repeat(7000) };
  const request = new NextRequest("https://nai.test/api/client-center", {
    method: "POST",
    body: JSON.stringify(body),
  });
  expect((await POST(request)).status).toBe(201);
  expect(m.create).toHaveBeenCalledExactlyOnceWith(actor, body);
  m.create.mockClear();
  const oversized = new NextRequest("https://nai.test/api/client-center", {
    method: "POST",
    body: JSON.stringify({ description: "a".repeat(12001) }),
  });
  expect((await POST(oversized)).status).toBe(413);
  expect(m.create).not.toHaveBeenCalled();
});

it("rejects unauthenticated requests without consuming their body", async () => {
  m.auth.mockRejectedValue(new AuthError("Entre novamente.", 401));
  const request = new NextRequest("https://nai.test/api/client-center", {
    method: "POST",
    body: "untrusted-input",
  });
  expect((await POST(request)).status).toBe(401);
  expect(request.bodyUsed).toBe(false);
  expect(m.create).not.toHaveBeenCalled();
});

it("returns a safe validation error for malformed JSON", async () => {
  const response = await POST(
    new NextRequest("https://nai.test/api/client-center", {
      method: "POST",
      body: "private-synthetic-value",
    })
  );
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("private-synthetic-value");
  expect(m.create).not.toHaveBeenCalled();
});
