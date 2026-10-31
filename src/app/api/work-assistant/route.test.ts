// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  collection: vi.fn(),
  company: vi.fn(),
  proposal: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  ask: vi.fn(),
  configured: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
vi.mock("@/services/work-assistant-openai", () => ({
  askWorkAssistant: m.ask,
  workAssistantConfigured: m.configured,
}));
import { GET, POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const action = {
  title: "Conferir plano",
  instructions: "Conferir evidências",
  responsibleName: "SST",
  dueDate: "2026-11-14",
  deadlineBasis: "plan",
  source: "PGR",
};
function request(body: unknown) {
  return new NextRequest("https://nai.test/api/work-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ uid: "u1", role: "SUPER_ADMIN", tenantId: null, servedCompanies: [] });
  m.configured.mockReturnValue(true);
  m.company.mockResolvedValue({ exists: true, data: () => ({ name: "Cliente" }) });
  m.proposal.mockResolvedValue({
    data: () => ({ uid: "u1", companyId: "ONE", expiresAt: Date.now() + 60000, actions: [action] }),
  });
  m.collection.mockImplementation((name) => ({
    doc: (docId: string) =>
      name === "companies"
        ? { get: m.company, collection: () => ({ doc: () => ({ id: "task" }) }) }
        : { id: docId, set: m.set },
  }));
  m.transaction.mockImplementation((fn) =>
    fn({ get: m.proposal, create: m.create, update: m.update, set: m.set })
  );
});
describe("work assistant authorization and confirmation", () => {
  it("probes the server configuration without sending company records or secrets", async () => {
    m.ask.mockResolvedValue({ answer: "Conexão verificada", actions: [] });
    const r = await POST(request({ action: "probe", companyId: "ONE" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ verified: true });
    expect(m.ask).toHaveBeenCalledWith(expect.any(Array), { diagnostic: true });
    expect(JSON.stringify(m.ask.mock.calls)).not.toContain("Cliente");
    expect(m.create).not.toHaveBeenCalled();
    expect(m.set).toHaveBeenLastCalledWith({ lastVerifiedAt: expect.any(String) }, { merge: true });
  });
  it("requires authentication before data access", async () => {
    m.auth.mockRejectedValue(new AuthError("Login", 401));
    expect((await GET(new NextRequest("https://nai.test"))).status).toBe(401);
    expect(m.collection).not.toHaveBeenCalled();
  });
  it.each(["ENGINEER", "CLIENT_ADMIN", "DOCTOR", "OPERATIONS"])(
    "does not grant new assistant access to %s",
    async (role) => {
      m.auth.mockResolvedValue({ role, tenantId: "ONE", servedCompanies: [] });
      expect(
        (
          await POST(
            request({
              action: "chat",
              companyId: "ONE",
              messages: [{ role: "user", content: "teste" }],
            })
          )
        ).status
      ).toBe(403);
      expect(m.collection).not.toHaveBeenCalled();
    }
  );
  it("cannot apply another user's or company's proposal", async () => {
    m.proposal.mockResolvedValue({
      data: () => ({
        uid: "OTHER",
        companyId: "ONE",
        expiresAt: Date.now() + 60000,
        actions: [action],
      }),
    });
    expect(
      (await POST(request({ action: "apply", companyId: "ONE", proposalId: id }))).status
    ).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects expired proposals", async () => {
    m.proposal.mockResolvedValue({
      data: () => ({ uid: "u1", companyId: "ONE", expiresAt: 0, actions: [action] }),
    });
    expect(
      (await POST(request({ action: "apply", companyId: "ONE", proposalId: id }))).status
    ).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("uses only the stored proposal and creates linked tasks transactionally", async () => {
    const r = await POST(
      request({ action: "apply", companyId: "ONE", proposalId: id, actions: [{ title: "forged" }] })
    );
    expect(r.status).toBe(200);
    expect(m.create.mock.calls[0][1]).toMatchObject({
      title: "Conferir plano",
      companyId: "ONE",
      status: "todo",
      createdBy: "u1",
      dueDate: "2026-11-14",
    });
    expect(m.update).toHaveBeenCalledOnce();
  });
  it("returns success on replay without duplicate tasks", async () => {
    m.proposal.mockResolvedValue({
      data: () => ({ uid: "u1", companyId: "ONE", appliedAt: "2026-10-30", actions: [action] }),
    });
    const r = await POST(request({ action: "apply", companyId: "ONE", proposalId: id }));
    expect(await r.json()).toEqual({ count: 1, alreadyApplied: true });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("reports unavailable configuration without a provider request", async () => {
    m.configured.mockReturnValue(false);
    const r = await POST(
      request({ action: "chat", companyId: "ONE", messages: [{ role: "user", content: "resumo" }] })
    );
    expect(r.status).toBe(503);
    expect(m.ask).not.toHaveBeenCalled();
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
});
