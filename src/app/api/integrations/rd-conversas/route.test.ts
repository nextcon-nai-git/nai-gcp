// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const state = vi.hoisted(() => ({
  user: { uid: "staff", role: "OPERATIONS", tenantId: null as string | null },
  draft: null as Record<string, unknown> | null,
  send: vi.fn(),
  auth: vi.fn(),
  afterReservation: vi.fn(),
  links: vi.fn(),
  queries: [] as string[],
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: state.auth }));
vi.mock("@/lib/firebase-admin", () => {
  const ref = {
    collection: (name: string) => {
      state.queries.push(name);
      return ref;
    },
    doc: () => ref,
    id: "draft-id",
    orderBy: () => ref,
    limit: (limit: number) => {
      state.queries.push(`limit:${limit}`);
      return ref;
    },
    get: async () => ({ docs: [] }),
    create: vi.fn(async (d: Record<string, unknown>) => {
      state.draft = d;
    }),
    update: vi.fn(async (d: Record<string, unknown>) => {
      Object.assign(state.draft!, d);
    }),
  };
  return {
    adminDb: {
      collection: () => ref,
      getAll: (...args: unknown[]) => state.links(...args),
      runTransaction: async (fn: (tx: unknown) => unknown) => {
        const result = await fn({
          get: async () => ({ data: () => state.draft }),
          update: (_r: unknown, d: Record<string, unknown>) => Object.assign(state.draft!, d),
        });
        state.afterReservation();
        return result;
      },
    },
  };
});
vi.mock("@/lib/integrations/tallos-api", async (original) => ({
  ...(await original<object>()),
  tallosRequest: (...args: unknown[]) => state.send(...args),
}));
import { POST, GET } from "./route";
const request = (body: unknown) =>
  new NextRequest("https://nai.local/api/integrations/rd-conversas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  state.user = { uid: "staff", role: "OPERATIONS", tenantId: null };
  state.draft = null;
  state.queries = [];
  state.auth.mockReset().mockImplementation(async () => ({ ...state.user }));
  state.afterReservation.mockReset();
  state.links.mockReset().mockResolvedValue([]);
  vi.unstubAllEnvs();
  state.send.mockReset().mockResolvedValue({ data: {}, total: null, pages: null });
});
describe("Reviewed Tallos messages", () => {
  it("creating a draft never sends a message", async () => {
    const response = await POST(
      request({
        action: "draft",
        contactId: "contact",
        operatorId: "operator",
        message: "Texto sintético",
      })
    );
    expect(response.status).toBe(200);
    expect(state.send).not.toHaveBeenCalled();
    expect(state.draft?.status).toBe("REVIEW_REQUIRED");
  });
  it("stops oversized streamed input before storing a draft or calling Tallos", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(12000));
        controller.enqueue(new Uint8Array(12000));
      },
      cancel,
    });
    const response = await POST(
      new NextRequest("https://nai.local/api/integrations/rd-conversas", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "1" },
        body: stream,
      })
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(state.draft).toBeNull();
    expect(state.send).not.toHaveBeenCalled();
  });

  it("checks the body limit in UTF-8 bytes instead of characters", async () => {
    const response = await POST(request({ action: "draft", message: "á".repeat(11000) }));
    expect(response.status).toBe(413);
    expect(state.draft).toBeNull();
    expect(state.send).not.toHaveBeenCalled();
  });

  it.each([
    ["application/json", "{", 400],
    ["text/plain", "{}", 415],
  ])("rejects invalid input without writing: %s", async (contentType, body, status) => {
    const response = await POST(
      new NextRequest("https://nai.local/api/integrations/rd-conversas", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      })
    );
    expect(response.status).toBe(status);
    expect(state.draft).toBeNull();
    expect(state.send).not.toHaveBeenCalled();
  });

  it("requires exact confirmation, ownership and an unused draft", async () => {
    state.draft = { createdBy: "other", status: "REVIEW_REQUIRED", expiresAt: Date.now() + 60000 };
    expect(
      (await POST(request({ action: "send", draftId: "draft-id", confirmation: "sim" }))).status
    ).toBe(400);
    expect(
      (
        await POST(
          request({ action: "send", draftId: "draft-id", confirmation: "AUTORIZAR ENVIO" })
        )
      ).status
    ).toBe(404);
    state.draft.createdBy = "staff";
    state.draft.status = "ACCEPTED";
    expect(
      (
        await POST(
          request({ action: "send", draftId: "draft-id", confirmation: "AUTORIZAR ENVIO" })
        )
      ).status
    ).toBe(409);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("marks an ambiguous send unconfirmed and refuses automatic replay", async () => {
    state.draft = {
      contactId: "contact",
      operatorId: "operator",
      message: "Sintético",
      createdBy: "staff",
      status: "REVIEW_REQUIRED",
      expiresAt: Date.now() + 60000,
    };
    state.send.mockRejectedValue(new Error("timeout"));
    const body = { action: "send", draftId: "draft-id", confirmation: "AUTORIZAR ENVIO" };
    expect((await POST(request(body))).status).toBe(502);
    expect(state.draft.status).toBe("UNCONFIRMED");
    expect((await POST(request(body))).status).toBe(409);
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it.each(["suspended", "scope"])(
    "preserves the reservation without sending after access changes: %s",
    async (change) => {
      state.draft = {
        contactId: "contact",
        operatorId: "operator",
        message: "Sintético",
        createdBy: "staff",
        status: "REVIEW_REQUIRED",
        expiresAt: Date.now() + 60000,
      };
      state.afterReservation.mockImplementationOnce(() => {
        if (change === "suspended")
          state.auth.mockRejectedValue(new AuthError("Perfil suspenso.", 403));
        else state.user.tenantId = "client";
      });
      const body = { action: "send", draftId: "draft-id", confirmation: "AUTORIZAR ENVIO" };
      expect((await POST(request(body))).status).toBe(403);
      expect(state.send).not.toHaveBeenCalled();
      expect(state.draft).toMatchObject({ status: "SENDING", authorizedBy: "staff" });
      expect(state.auth).toHaveBeenCalledTimes(2);
      state.auth.mockResolvedValue({ ...state.user, tenantId: null });
      expect((await POST(request(body))).status).toBe(409);
      expect(state.send).not.toHaveBeenCalled();
    }
  );
  it("persists an authorized provider acceptance after revocation during dispatch", async () => {
    state.draft = {
      contactId: "contact",
      operatorId: "operator",
      message: "Sintético",
      createdBy: "staff",
      status: "REVIEW_REQUIRED",
      expiresAt: Date.now() + 60000,
    };
    state.send.mockImplementationOnce(async () => {
      state.auth.mockRejectedValue(new AuthError("Perfil suspenso.", 403));
      return { data: {}, total: null, pages: null };
    });
    const body = { action: "send", draftId: "draft-id", confirmation: "AUTORIZAR ENVIO" };
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, status: "ACCEPTED" });
    expect(state.draft).toMatchObject({ status: "ACCEPTED", authorizedBy: "staff" });
    expect(state.draft.completedAt).toEqual(expect.any(String));
    expect(state.send).toHaveBeenCalledTimes(1);
    expect((await POST(request(body))).status).toBe(403);
    expect(state.draft.status).toBe("ACCEPTED");
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it("blocks tenant scoped staff before provider access", async () => {
    state.user.tenantId = "client";
    const response = await GET(
      new NextRequest("https://nai.local/api/integrations/rd-conversas?resource=contacts")
    );
    expect(response.status).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
  });
});

describe("Tallos read-only operation without remote history", () => {
  it.each(["suspended", "scope"])(
    "does not release contacts after access changes during the provider read: %s",
    async (change) => {
      state.send.mockImplementationOnce(async () => {
        if (change === "suspended")
          state.auth.mockRejectedValue(new AuthError("Perfil suspenso.", 403));
        else state.user.tenantId = "client";
        return { data: [{ _id: "contact", full_name: "synthetic-private-person" }] };
      });
      const response = await GET(
        new NextRequest("https://nai.local/api/integrations/rd-conversas?resource=contacts")
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("synthetic-private-person");
      expect(state.auth).toHaveBeenCalledTimes(2);
      expect(state.send).toHaveBeenCalledOnce();
      expect(state.links).toHaveBeenCalledOnce();
    }
  );
  it("returns contacts when the current profile retains internal access", async () => {
    state.send.mockResolvedValue({
      data: [{ _id: "contact", full_name: "synthetic-person" }],
      total: 1,
      pages: 1,
    });
    const response = await GET(
      new NextRequest("https://nai.local/api/integrations/rd-conversas?resource=contacts")
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [{ id: "contact", name: "synthetic-person" }],
      total: 1,
    });
    expect(state.auth).toHaveBeenCalledTimes(2);
    expect(state.send).toHaveBeenCalledOnce();
  });
  it("reads the AVP queue without any Tallos credentials or provider calls", async () => {
    vi.stubEnv("TALLOS_API_TOKEN", "");
    vi.stubEnv("TALLOS_HISTORY_PRIVATE_KEY", "");
    const response = await GET(
      new NextRequest("https://nai.local/api/integrations/rd-conversas?resource=operation")
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      messages: [],
      requests: [],
      webhookDiagnostics: [],
      limit: 100,
    });
    expect(state.queries).toContain("messages");
    expect(state.queries).toContain("asoRequests");
    expect(state.queries.filter((q) => q === "limit:100")).toHaveLength(2);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("blocks tenant access before reading the shared AVP queue", async () => {
    state.user.tenantId = "client";
    const response = await GET(
      new NextRequest("https://nai.local/api/integrations/rd-conversas?resource=operation")
    );
    expect(response.status).toBe(403);
    expect(state.queries).toEqual([]);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("does not query encrypted history without a private key", async () => {
    vi.stubEnv("TALLOS_HISTORY_PRIVATE_KEY", "");
    const response = await GET(
      new NextRequest(
        "https://nai.local/api/integrations/rd-conversas?resource=history&contactId=synthetic"
      )
    );
    expect(response.status).toBe(424);
    expect(state.send).not.toHaveBeenCalled();
  });
});
