// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";

const m = vi.hoisted(() => ({ auth: vi.fn(), patch: vi.fn(), snapshot: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/services/avp-sheet-sync", () => ({
  patchAvpQueue: m.patch,
  getAvpSnapshot: m.snapshot,
  syncAvpSource: m.sync,
}));
import { GET, PATCH } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({
    uid: "operator",
    role: "OPERATIONS",
    tenantId: null,
    servedCompanies: ["GRUPO_AVP"],
  });
  m.patch.mockResolvedValue("next-revision");
});

it.each(["suspended", "scope"])(
  "does not release the queue after access changes during synchronization: %s",
  async (change) => {
    m.sync.mockImplementationOnce(async () => {
      if (change === "suspended") m.auth.mockRejectedValue(new AuthError("Perfil suspenso.", 403));
      else
        m.auth.mockResolvedValue({
          uid: "operator",
          role: "OPERATIONS",
          tenantId: null,
          servedCompanies: [],
        });
      return { started: true };
    });
    m.snapshot.mockResolvedValue({ items: [{ colaborador: "synthetic-private-person" }] });
    const response = await GET(
      new NextRequest("https://nai.test/api/clients/grupo-avp/queue?force=1")
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("synthetic-private-person");
    expect(m.auth).toHaveBeenCalledTimes(2);
    expect(m.sync).toHaveBeenCalledExactlyOnceWith(true, "operator");
    expect(m.snapshot).toHaveBeenCalledOnce();
  }
);

it("returns the synchronized queue while the current profile retains AVP access", async () => {
  const snapshot = { items: [{ colaborador: "synthetic-person" }], revision: "current" };
  m.sync.mockResolvedValue({ started: true });
  m.snapshot.mockResolvedValue(snapshot);
  const response = await GET(new NextRequest("https://nai.test/api/clients/grupo-avp/queue"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(snapshot);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(m.auth).toHaveBeenCalledTimes(2);
  expect(m.sync).toHaveBeenCalledExactlyOnceWith(false, "operator");
});

it.each([undefined, "1"])(
  "cancels an oversized queue stream without trusting Content-Length %s",
  async (length) => {
    const cancel = vi.fn();
    const request = new NextRequest("https://nai.test/api/clients/grupo-avp/queue", {
      method: "PATCH",
      headers: length ? { "content-length": length } : {},
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(250000));
          controller.enqueue(new Uint8Array(250001));
        },
        cancel,
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    const response = await PATCH(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Alterações excedem o limite." });
    expect(cancel).toHaveBeenCalledOnce();
    expect(m.patch).not.toHaveBeenCalled();
    expect(m.sync).not.toHaveBeenCalled();
  }
);

it("preserves legacy JSON without a content-type and the authenticated actor", async () => {
  const changes = [{ id: "synthetic", status: "pending" }];
  const request = new NextRequest("https://nai.test/api/clients/grupo-avp/queue", {
    method: "PATCH",
    body: "\uFEFF" + JSON.stringify({ revision: "reviewed", changes }),
  });
  const response = await PATCH(request);
  expect(response.status).toBe(200);
  expect(m.patch).toHaveBeenCalledExactlyOnceWith("reviewed", changes, "operator");
  expect(await response.json()).toEqual({ success: true, revision: "next-revision" });
});

it("rejects revoked access before reading the request body", async () => {
  m.auth.mockRejectedValue(new AuthError("Entre novamente.", 401));
  const request = new NextRequest("https://nai.test/api/clients/grupo-avp/queue", {
    method: "PATCH",
    body: "private-synthetic-input",
  });
  expect((await PATCH(request)).status).toBe(401);
  expect(request.bodyUsed).toBe(false);
  expect(m.patch).not.toHaveBeenCalled();
});

it("retains safe validation and revision conflict responses", async () => {
  const request = (body?: string) =>
    new NextRequest("https://nai.test/api/clients/grupo-avp/queue", { method: "PATCH", body });
  expect((await PATCH(request())).status).toBe(422);
  const invalid = await PATCH(request("private-synthetic-input"));
  expect(invalid.status).toBe(422);
  expect(await invalid.text()).not.toContain("private-synthetic-input");
  m.patch.mockRejectedValueOnce(new Error("CONFLICT"));
  expect((await PATCH(request('{"revision":"old","changes":[]}'))).status).toBe(409);
});
