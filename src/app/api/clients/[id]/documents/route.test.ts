// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  company: vi.fn(),
  document: vi.fn(),
  save: vi.fn(),
  download: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/firebase/config", () => ({ firebaseConfig: { storageBucket: "test" } }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({ file: () => ({ save: mock.save, download: mock.download }) }),
  }),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mock.collection, runTransaction: mock.transaction },
}));
import { GET, POST } from "./route";
const context = { params: Promise.resolve({ id: "CETESB" }) };
const url = "https://test/api/clients/CETESB/documents";
function upload(
  pdf = "%PDF-1.7 test",
  actions = '[{"title":"Revisar PGR","instructions":"Item 4.1; início contratual + 60 dias"}]'
) {
  const form = new FormData();
  form.set("source", new File([pdf], "edital.pdf", { type: "application/pdf" }));
  form.set("actions", actions);
  return new NextRequest(url, { method: "POST", body: form });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({
    uid: "admin",
    role: "SUPER_ADMIN",
    tenantId: null,
    servedCompanies: [],
  });
  mock.company.mockResolvedValue({ exists: true, data: () => ({ name: "CETESB" }) });
  mock.document.mockResolvedValue({ exists: false });
  mock.collection.mockReturnValue({
    doc: () => ({ get: mock.company, collection: () => ({ doc: () => ({ get: mock.document }) }) }),
  });
  mock.transaction.mockImplementation((fn) => fn({ get: mock.document, create: mock.create }));
});
describe("private client documents and action import", () => {
  it("rejects anonymous users and keeps responses private", async () => {
    mock.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
    const r = await GET(new NextRequest(url), context);
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.collection).not.toHaveBeenCalled();
  });
  it("denies cross-tenant reads and non-admin imports", async () => {
    mock.auth.mockResolvedValue({ role: "CLIENT_ADMIN", tenantId: "OTHER", servedCompanies: [] });
    expect((await GET(new NextRequest(url), context)).status).toBe(403);
    mock.auth.mockResolvedValue({ role: "CLIENT_ADMIN", tenantId: "CETESB", servedCompanies: [] });
    expect((await POST(upload(), context)).status).toBe(403);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("rejects invalid PDFs and action lists before persisting", async () => {
    expect((await POST(upload("not a pdf"), context)).status).toBe(400);
    expect((await POST(upload("%PDF-1.7", '[{"title":"x"}]'), context)).status).toBe(400);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("creates document and linked cards atomically without invented deadlines", async () => {
    const r = await POST(upload(), context);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ taskCount: 1, alreadySaved: false });
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.create).toHaveBeenCalledTimes(2);
    expect(mock.create.mock.calls[1][1]).toMatchObject({
      companyId: "CETESB",
      companyName: "CETESB",
      status: "todo",
      dueDate: "",
      title: "Revisar PGR",
    });
  });
  it("does not duplicate imports or reset existing progress", async () => {
    mock.document.mockResolvedValue({ exists: true, data: () => ({ taskCount: 4 }) });
    const r = await POST(upload(), context);
    expect(await r.json()).toEqual({ alreadySaved: true, taskCount: 4 });
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("never persists cards if original upload fails", async () => {
    mock.save.mockRejectedValue(new Error("private bucket details"));
    const r = await POST(upload(), context);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private bucket details");
    expect(mock.create).not.toHaveBeenCalled();
  });
});
