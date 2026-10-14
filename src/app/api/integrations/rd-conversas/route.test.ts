// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({
  user: { uid: "staff", role: "OPERATIONS", tenantId: null as string | null },
  draft: null as Record<string, unknown> | null,
  send: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn(async () => state.user) }));
vi.mock("@/lib/firebase-admin", () => {
  const ref = {
    collection: () => ref,
    doc: () => ref,
    id: "draft-id",
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
      runTransaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          get: async () => ({ data: () => state.draft }),
          update: (_r: unknown, d: Record<string, unknown>) => Object.assign(state.draft!, d),
        }),
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
  it("blocks tenant scoped staff before provider access", async () => {
    state.user.tenantId = "client";
    const response = await GET(
      new NextRequest("https://nai.local/api/integrations/rd-conversas?resource=contacts")
    );
    expect(response.status).toBe(403);
    expect(state.send).not.toHaveBeenCalled();
  });
});
