import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: m.get }) }) }) }),
    runTransaction: m.transaction,
  },
}));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "time" } }));
import { GET, POST } from "./route";
const dossier = {
  version: 1,
  sourceName: "fixture.zip",
  sha256: "a".repeat(64),
  controlName: "",
  controlSha256: "",
  cases: [
    {
      key: "12345678909",
      name: "Pessoa de teste",
      sourceCnpj: "76492701001129",
      reportedCnpjs: [],
      sourcePath: "fixture",
      hasRegistration: false,
      registration: "",
      jobTitles: [],
      department: "",
      admission: null,
      termination: null,
      benefits: "",
      dib: "",
      ddb: "",
      cost: null,
      alerts: "",
      rhNotes: "",
      leaves: [],
    },
  ],
};
const req = (body: unknown = {}) =>
  new NextRequest("https://nai.test/api/admin/britania-fap", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ uid: "a", role: "SUPER_ADMIN", tenantId: null });
});
describe("restricted group FAP dossier", () => {
  it("writes dossier and audit atomically without altering companies or user access", async () => {
    m.transaction.mockImplementation(async (fn) =>
      fn({ get: async () => ({ exists: false }), create: m.create })
    );
    const response = await POST(req(dossier));
    expect(response.status).toBe(200);
    expect(m.create).toHaveBeenCalledTimes(2);
    expect(m.create.mock.calls[0][1]).toMatchObject({ companyId: "BRITANIA_JOINVILLE", dossier });
    expect(m.create.mock.calls[1][1]).not.toHaveProperty("dossier");
  });
  it("rejects a different existing dossier without partial writes", async () => {
    m.transaction.mockImplementation(async (fn) =>
      fn({
        get: async () => ({ exists: true, data: () => ({ contentHash: "other" }) }),
        create: m.create,
      })
    );
    expect((await POST(req(dossier))).status).toBe(409);
    expect(m.create).not.toHaveBeenCalled();
  });
  it.each([
    { role: "SCOPED_PROVIDER" },
    { role: "DOCTOR" },
    { role: "OPERATIONS" },
    { role: "ADMIN", tenantId: "customer" },
    { role: "SUPER_ADMIN", tenantId: "customer" },
  ])("denies group health access outside internal admin: %o", async (u) => {
    m.auth.mockResolvedValue(u);
    expect((await GET(req())).status).toBe(403);
    const request = req();
    expect((await POST(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(m.get).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("returns no-store and explicit empty dossier", async () => {
    m.get.mockResolvedValue({ exists: false });
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ dossier: null });
  });
  it("rejects malformed data without writing", async () => {
    expect((await POST(req({ version: 1, cases: [], permissions: ["admin"] }))).status).toBe(400);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("rejects oversized data without writing", async () => {
    expect((await POST(req({ text: "a".repeat(860000) }))).status).toBe(413);
    expect(m.transaction).not.toHaveBeenCalled();
  });
});
