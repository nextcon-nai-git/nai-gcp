// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
type Reference = {
  path: string;
  collection: (name: string) => { doc: (id?: string) => Reference };
};
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  verify: vi.fn(),
  tx: { get: vi.fn(), update: vi.fn(), create: vi.fn() },
  record: {} as Record<string, unknown>,
  profileData: undefined as Record<string, unknown> | undefined,
}));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: mocks.auth,
  extractBearerToken: () => "token",
}));
vi.mock("@/lib/firebase-admin", () => {
  const ref = (path: string): Reference => ({
    path,
    collection: (name) => ({ doc: (id = "synthetic-event") => ref(`${path}/${name}/${id}`) }),
  });
  return {
    adminAuth: { verifyIdToken: mocks.verify },
    adminDb: {
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      doc: ref,
      runTransaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx),
    },
  };
});
import { POST } from "./route";
const id = "a".repeat(48);
const clinical = {
  attendanceDate: "2026-01-01",
  history: "secret history",
  occupationalHistory: "",
  medications: "",
  complaints: "",
  vitalSigns: "",
  physicalExam: "normal",
  results: "normal",
  conduct: "",
  conclusion: "apto",
  observations: "",
};
const request = (body: unknown) =>
  new NextRequest("https://nai.test/api/clinic-portal", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLINIC_PORTAL_ENABLED", "true");
  mocks.profileData = undefined;
  mocks.record = {
    ownerUid: "owner",
    sourcePath: "users/owner/asoRequests/request",
    grants: [
      { email: "doctor@example.test", role: "doctor" },
      { email: "reception@example.test", role: "reception" },
    ],
    expiresAt: "2030-01-01T00:00:00Z",
    revoked: false,
    version: 0,
    state: "invited",
    identity: { employeeName: "Worker" },
    clinical,
    exams: [],
    risks: [],
  };
  mocks.verify.mockResolvedValue({
    uid: "doctor",
    email: "doctor@example.test",
    email_verified: true,
  });
  mocks.auth.mockResolvedValue({ uid: "owner", role: "OPERATIONS" });
  mocks.tx.get.mockImplementation(async (reference: Reference) => {
    const data = /^users\/[^/]+$/.test(reference.path)
      ? mocks.profileData
      : reference.path === `clinic_portal_private/${id}`
        ? mocks.record
        : undefined;
    return { exists: data !== undefined, data: () => data };
  });
});
describe("portal server authorization and persistence", () => {
  it.each([undefined, "1"])(
    "bounds the actual request stream when Content-Length is %s",
    async (contentLength) => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1500000));
          controller.enqueue(new Uint8Array(1500000));
        },
        cancel,
      });
      const response = await POST(
        new NextRequest("https://nai.test/api/clinic-portal", {
          method: "POST",
          headers: contentLength ? { "content-length": contentLength } : {},
          body,
          duplex: "half",
        } as ConstructorParameters<typeof NextRequest>[1])
      );
      expect(response.status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(mocks.verify).not.toHaveBeenCalled();
      expect(mocks.tx.get).not.toHaveBeenCalled();
      expect(mocks.tx.update).not.toHaveBeenCalled();
    }
  );
  it.each(["read", "confirm", "save", "submit"])(
    "blocks %s for a deleted profile even if accessEnabled remains true",
    async (action) => {
      mocks.profileData = { role: "DOCTOR", accessEnabled: true, isDeleted: true };
      const response = await POST(
        request({ action, id, version: 0, payload: clinical, reviewed: true })
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("secret history");
      expect(mocks.tx.get).toHaveBeenCalledTimes(1);
      expect(mocks.tx.update).not.toHaveBeenCalled();
      expect(mocks.tx.create).not.toHaveBeenCalled();
    }
  );
  it.each(["read", "confirm", "save", "submit"])(
    "blocks %s for a suspended profile before reading the clinical record",
    async (action) => {
      mocks.profileData = { role: "DOCTOR", accessEnabled: false };
      const response = await POST(
        request({ action, id, version: 0, payload: clinical, reviewed: true })
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("secret history");
      expect(mocks.tx.get).toHaveBeenCalledTimes(1);
      expect(mocks.tx.get).toHaveBeenCalledWith(expect.objectContaining({ path: "users/doctor" }));
      expect(mocks.tx.update).not.toHaveBeenCalled();
      expect(mocks.tx.create).not.toHaveBeenCalled();
    }
  );
  it("keeps access for a valid external invitee who has no internal profile", async () => {
    const response = await POST(request({ action: "read", id }));
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("clinical", clinical);
  });
  it("blocks a cards-only expert even if a prior invitation matches the email", async () => {
    mocks.profileData = { role: "SCOPED_PROVIDER", accessEnabled: true };
    expect((await POST(request({ action: "read", id }))).status).toBe(403);
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.create).not.toHaveBeenCalled();
  });
  it("fails closed until security rules have been deployed and activation is explicit", async () => {
    vi.stubEnv("CLINIC_PORTAL_ENABLED", "false");
    expect((await POST(request({ action: "read", id }))).status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("requires server-side clinical-review attestation", async () => {
    for (const reviewed of [undefined, false]) {
      expect(
        (await POST(request({ action: "submit", id, version: 0, payload: clinical, reviewed })))
          .status
      ).toBe(400);
    }
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
  it("makes repeated confirmation version-neutral even from an old window", async () => {
    mocks.record.state = "draft";
    mocks.record.version = 8;
    mocks.verify.mockResolvedValue({
      uid: "reception",
      email: "reception@example.test",
      email_verified: true,
    });
    const response = await POST(request({ action: "confirm", id, version: 0 }));
    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe(8);
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.create).not.toHaveBeenCalled();
  });
  it("accepts all permitted text fields including maximum JSON escaping", async () => {
    const payload = { ...clinical };
    for (const key of [
      "history",
      "occupationalHistory",
      "medications",
      "complaints",
      "vitalSigns",
      "physicalExam",
      "results",
      "conduct",
      "observations",
    ] as const)
      payload[key] = "\u0001".repeat(12000);
    const response = await POST(request({ action: "save", id, version: 0, payload }));
    expect(response.status).toBe(200);
  });
  it("blocks forwarded links and unverified accounts without writes", async () => {
    mocks.verify.mockResolvedValue({
      uid: "stranger",
      email: "other@example.test",
      email_verified: true,
    });
    expect((await POST(request({ action: "read", id }))).status).toBe(403);
    mocks.verify.mockResolvedValue({
      uid: "doctor",
      email: "doctor@example.test",
      email_verified: false,
    });
    expect((await POST(request({ action: "read", id }))).status).toBe(403);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
  it("denies clinical writes by reception and hides clinical fields on read", async () => {
    mocks.verify.mockResolvedValue({
      uid: "reception",
      email: "reception@example.test",
      email_verified: true,
    });
    const read = await POST(request({ action: "read", id }));
    expect(read.status).toBe(200);
    expect(await read.json()).not.toHaveProperty("clinical");
    mocks.tx.update.mockClear();
    expect(
      (await POST(request({ action: "save", id, version: 0, payload: clinical }))).status
    ).toBe(403);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
  it("prevents lost updates and locks submitted records", async () => {
    expect(
      (await POST(request({ action: "save", id, version: 9, payload: clinical }))).status
    ).toBe(409);
    mocks.record.state = "awaiting_signature";
    expect(
      (await POST(request({ action: "save", id, version: 0, payload: clinical }))).status
    ).toBe(400);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
  it("saves clinical content only privately and audits the actor", async () => {
    const response = await POST(
      request({ action: "submit", reviewed: true, id, version: 0, payload: clinical })
    );
    expect(response.status).toBe(200);
    expect(mocks.tx.update.mock.calls[0][1]).toMatchObject({
      clinical,
      state: "awaiting_signature",
      version: 1,
    });
    expect(mocks.tx.update.mock.calls[1][1]).toMatchObject({
      clinicPortalStatus: "awaiting_signature",
    });
    expect(JSON.stringify(mocks.tx.update.mock.calls[1])).not.toContain("secret history");
    expect(mocks.tx.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ uid: "doctor", action: "submit" })
    );
  });
  it("blocks cross-owner revocation and expired access", async () => {
    mocks.auth.mockResolvedValue({ uid: "other-owner", role: "OPERATIONS" });
    expect((await POST(request({ action: "revoke", id }))).status).toBe(403);
    mocks.record.expiresAt = "2020-01-01T00:00:00Z";
    expect((await POST(request({ action: "read", id }))).status).toBe(403);
  });
  it("does not accept missing examination or conclusion at submission", async () => {
    expect(
      (
        await POST(
          request({
            action: "submit",
            reviewed: true,
            id,
            version: 0,
            payload: { ...clinical, conclusion: "pendente" },
          })
        )
      ).status
    ).toBe(400);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
});

describe("access denial diagnostics", () => {
  it("explains an unverified session without granting access", async () => {
    mocks.verify.mockResolvedValue({
      uid: "doctor",
      email: "doctor@example.test",
      email_verified: false,
    });
    const response = await POST(request({ action: "read", id }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("confirmação do seu e-mail");
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });
  it("does not reveal the invited address to another account", async () => {
    mocks.verify.mockResolvedValue({
      uid: "other",
      email: "other@example.test",
      email_verified: true,
    });
    const response = await POST(request({ action: "read", id }));
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.error).not.toContain("doctor@example.test");
    expect(body.error).toContain("não tem acesso");
  });
  it("distinguishes a recreated account from the bound account", async () => {
    mocks.record.grants = [{ email: "doctor@example.test", role: "doctor", uid: "old-user" }];
    const response = await POST(request({ action: "read", id }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("outro cadastro");
  });
});
