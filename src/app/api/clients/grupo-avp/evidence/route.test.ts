// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import { AvpPaymentSchema } from "@/lib/avp-evidence";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  collection: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/firebase/config", () => ({ firebaseConfig: { storageBucket: "test" } }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ save: m.save }) }) }),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
import { GET, POST } from "./route";
const url = "https://test/api/clients/grupo-avp/evidence";
const record = AvpPaymentSchema.parse({
  kind: "payment",
  id: "a".repeat(64),
  source: "Synthetic receipt",
  sourceHash: "b".repeat(64),
  notes: "",
  clinic: "Test clinic",
  date: "2026-10-16",
  amountCents: 12000,
  unitCents: 6000,
  quantity: 2,
  city: "",
  uf: "",
  employees: "",
  transactionId: "",
  confirmation: "Comprovante",
  scope: "AVP",
});
const request = () =>
  new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records: [record] }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({
    uid: "admin",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
  m.collection.mockReturnValue({
    doc: () => ({ collection: () => ({ doc: () => ({ get: m.get, update: m.update }) }) }),
  });
  m.getAll.mockResolvedValue([{ exists: false }]);
  m.transaction.mockImplementation((fn) => fn({ getAll: m.getAll, create: m.create }));
});
describe("private AVP evidence", () => {
  it("denies anonymous and unrelated/internal-unassigned/client accounts before storage", async () => {
    m.auth.mockRejectedValueOnce(new AuthError("Login", 401));
    expect((await GET(new NextRequest(url))).status).toBe(401);
    for (const user of [
      { role: "OPERATIONS", tenantId: null, servedCompanies: [] },
      { role: "ADMIN", tenantId: "OTHER", servedCompanies: [] },
      { role: "ADMIN", tenantId: "GRUPO_AVP", servedCompanies: [] },
    ]) {
      m.auth.mockResolvedValue(user);
      expect((await POST(request())).status).toBe(403);
    }
    expect(m.collection).not.toHaveBeenCalled();
  });
  it("creates immutable indexed evidence and repeats idempotently", async () => {
    const r = await POST(request());
    expect(r.status).toBe(200);
    expect(r.headers.get("vary")).toBe("Authorization");
    expect(m.collection).toHaveBeenCalledWith("webhook_deliveries");
    expect(m.create).toHaveBeenCalledOnce();
    m.getAll.mockResolvedValue([
      {
        exists: true,
        data: () => ({
          contentHash: createHash("sha256").update(JSON.stringify(record)).digest("hex"),
        }),
      },
    ]);
    expect(await (await POST(request())).json()).toMatchObject({ added: 0, unchanged: 1 });
    expect(m.create).toHaveBeenCalledOnce();
  });
  it("rejects differing versions without overwriting", async () => {
    m.getAll.mockResolvedValue([{ exists: true, data: () => ({ contentHash: "other" }) }]);
    expect((await POST(request())).status).toBe(409);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects PDF content mismatching the indexed hash before writing", async () => {
    m.get.mockResolvedValue({ data: () => ({ kind: "aso", fileHash: "c".repeat(64) }) });
    const form = new FormData();
    form.set("id", "a".repeat(64));
    form.set("file", new File(["%PDF-1.7 fake"], "aso.pdf"));
    expect((await POST(new NextRequest(url, { method: "POST", body: form }))).status).toBe(400);
    expect(m.save).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
});
