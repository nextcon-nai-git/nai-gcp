// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  auth: vi.fn(),
  get: vi.fn(),
  download: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: m.verify },
  adminDb: {
    collection: () => ({ doc: () => ({ get: m.get, collection: () => ({ add: m.audit }) }) }),
  },
}));
vi.mock("@/lib/auth/require-auth", () => ({
  extractBearerToken: (req: NextRequest) => req.headers.get("authorization"),
  requireAuth: m.auth,
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ download: m.download, save: m.save }) }) }),
}));
import { GET, POST } from "./route";
const id = "a".repeat(48);
const actor = { uid: "doctor", email: "doctor@example.test", email_verified: true };
const record = {
  ownerUid: "owner",
  state: "awaiting_signature",
  grants: [
    { email: "doctor@example.test", role: "doctor" },
    { email: "reception@example.test", role: "reception" },
  ],
  expiresAt: "2030-01-01T00:00:00Z",
  revoked: false,
  signedDocument: {
    path: "private/file.pdf",
    sha256: createHash("sha256").update("%PDF-synthetic").digest("hex"),
  },
};
function req(method: string, auth = true, body?: FormData) {
  return new NextRequest(`https://nai.test/api/clinic-portal/document?id=${id}`, {
    method,
    headers: {
      ...(auth ? { authorization: "token" } : {}),
      ...(body ? { "content-length": "1000" } : {}),
    },
    body,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CLINIC_PORTAL_ENABLED", "true");
  m.verify.mockResolvedValue(actor);
  m.get.mockResolvedValue({ data: () => record });
  m.auth.mockResolvedValue({ uid: "owner", role: "OPERATIONS" });
  m.download.mockResolvedValue([Buffer.from("%PDF-synthetic")]);
});
describe("signed ASO isolation", () => {
  it("blocks downloads without login and when disabled", async () => {
    expect((await GET(req("GET", false))).status).toBe(401);
    vi.stubEnv("CLINIC_PORTAL_ENABLED", "false");
    expect((await GET(req("GET"))).status).toBe(503);
    expect((await POST(req("POST"))).status).toBe(503);
    expect(m.download).not.toHaveBeenCalled();
  });
  it("allows invited doctor and records a private download without public URLs", async () => {
    const response = await GET(req("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "signed_pdf_read", uid: "doctor" })
    );
  });
  it("blocks altered PDF bytes and never records a successful download", async () => {
    m.download.mockResolvedValue([Buffer.from("%PDF-altered")]);
    const response = await GET(req("GET"));
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("%PDF-altered");
    expect(m.audit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ action: "signed_pdf_integrity_failed", uid: "doctor" })
    );
  });
  it.each([undefined, "", "not-a-sha256", "a".repeat(64)])(
    "blocks missing or divergent document hash (%s)",
    async (sha256) => {
      m.get.mockResolvedValue({
        data: () => ({ ...record, signedDocument: { ...record.signedDocument, sha256 } }),
      });
      expect((await GET(req("GET"))).status).toBe(409);
      expect(m.audit).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "signed_pdf_read" })
      );
    }
  );
  it("does not report a successful read when storage fails", async () => {
    m.download.mockRejectedValue(new Error("storage unavailable"));
    expect((await GET(req("GET"))).status).toBe(500);
    expect(m.audit).not.toHaveBeenCalled();
  });
  it("allows owner operational access to ASO only", async () => {
    m.verify.mockResolvedValue({ uid: "owner", email: "owner@example.test", email_verified: true });
    expect((await GET(req("GET"))).status).toBe(200);
  });
  it("denies reception, other owners and revoked invited doctor", async () => {
    m.verify.mockResolvedValue({
      uid: "reception",
      email: "reception@example.test",
      email_verified: true,
    });
    m.auth.mockResolvedValue({ uid: "reception", role: "PROVIDER" });
    expect((await GET(req("GET"))).status).toBe(403);
    m.verify.mockResolvedValue(actor);
    m.get.mockResolvedValue({ data: () => ({ ...record, revoked: true }) });
    m.auth.mockResolvedValue({ uid: "doctor", role: "DOCTOR" });
    expect((await GET(req("GET"))).status).toBe(403);
    expect(m.download).not.toHaveBeenCalled();
  });
  it("rejects oversized files before parsing the multipart body", async () => {
    const r = new NextRequest("https://nai.test/api/clinic-portal/document", {
      method: "POST",
      headers: { authorization: "token", "content-length": "9999999" },
      body: "invalid",
    });
    expect((await POST(r)).status).toBe(400);
    expect(m.save).not.toHaveBeenCalled();
  });
  it("rejects PDFs without the doctor review attestation", async () => {
    const data = new FormData();
    data.set("id", id);
    data.set("file", new File(["%PDF-".padEnd(150)], "aso.pdf", { type: "application/pdf" }));
    expect((await POST(req("POST", true, data))).status).toBe(400);
    expect(m.save).not.toHaveBeenCalled();
  });
});
