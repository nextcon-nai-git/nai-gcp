// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { AuthError } from "@/lib/auth/errors";
const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  company: vi.fn(),
  document: vi.fn(),
  save: vi.fn(),
  readStream: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
  collection: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mock.auth }));
vi.mock("@/firebase/config", () => ({ firebaseConfig: { storageBucket: "test" } }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({ file: () => ({ save: mock.save, createReadStream: mock.readStream }) }),
  }),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mock.collection, runTransaction: mock.transaction },
}));
import { GET, POST } from "./route";
const context = { params: Promise.resolve({ id: "CETESB" }) };
const url = "https://test/api/clients/CETESB/documents";
const pdfBytes = Buffer.from("%PDF-1.7 test");
const pdfHash = createHash("sha256").update(pdfBytes).digest("hex");
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
  mock.readStream.mockImplementation(() => Readable.from([pdfBytes]));
  mock.collection.mockReturnValue({
    doc: () => ({ get: mock.company, collection: () => ({ doc: () => ({ get: mock.document }) }) }),
  });
  mock.transaction.mockImplementation((fn) => fn({ get: mock.document, create: mock.create }));
});
describe("private client documents and action import", () => {
  it.each(["company", "session"])(
    "does not return the PDF after losing %s access during its download",
    async (change) => {
      mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId: "CETESB" }) });
      mock.readStream.mockImplementation(() => {
        if (change === "session")
          mock.auth.mockRejectedValue(new AuthError("Access suspended", 403));
        else
          mock.auth.mockResolvedValue({
            role: "CLIENT_ADMIN",
            tenantId: "OTHER",
            servedCompanies: [],
          });
        return Readable.from([pdfBytes]);
      });
      const response = await GET(new NextRequest(`${url}?pdf=${pdfHash}`), context);
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.text()).not.toContain("%PDF-");
    }
  );
  it("rechecks consolidated archive privileges after reading the original", async () => {
    mock.document.mockResolvedValue({
      exists: true,
      data: () => ({ companyId: "BRITANIA_JOINVILLE" }),
    });
    mock.readStream.mockImplementation(() => {
      mock.auth.mockResolvedValue({
        role: "ADMIN",
        tenantId: "BRITANIA_JOINVILLE",
        servedCompanies: [],
      });
      return Readable.from([pdfBytes]);
    });
    const response = await GET(
      new NextRequest(`https://test/api/clients/BRITANIA_JOINVILLE/documents?pdf=${pdfHash}`),
      { params: Promise.resolve({ id: "BRITANIA_JOINVILLE" }) }
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("%PDF-");
  });
  it("does not release the index if its company access changes during the query", async () => {
    mock.collection.mockReturnValue({
      doc: () => ({
        collection: () => ({
          orderBy: () => ({
            limit: () => ({
              get: async () => {
                mock.auth.mockResolvedValue({
                  role: "CLIENT_ADMIN",
                  tenantId: "OTHER",
                  servedCompanies: [],
                });
                return {
                  docs: [{ id: pdfHash, data: () => ({ name: "Private synthetic source" }) }],
                };
              },
            }),
          }),
        }),
      }),
    });
    const response = await GET(new NextRequest(url), context);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("Private synthetic source");
  });
  it("does not create cards if administration is revoked while uploading the original", async () => {
    mock.save.mockImplementation(async () => {
      mock.auth.mockResolvedValue({ role: "ENGINEER", tenantId: "CETESB", servedCompanies: [] });
    });
    const response = await POST(upload(), context);
    expect(response.status).toBe(403);
    expect(mock.transaction).not.toHaveBeenCalled();
    expect(mock.create).not.toHaveBeenCalled();
  });
  it.each(["DOCTOR", "PROVIDER", "CLIENT_ADMIN", "ENGINEER", "OPERATIONS"])(
    "denies consolidated Britânia PDFs to a site-scoped %s",
    async (role) => {
      mock.auth.mockResolvedValue({
        role,
        tenantId: "BRITANIA_JOINVILLE",
        servedCompanies: ["BRITANIA_JOINVILLE"],
      });
      const ctx = { params: Promise.resolve({ id: "BRITANIA_JOINVILLE" }) };
      expect(
        (
          await GET(
            new NextRequest(
              "https://test/api/clients/BRITANIA_JOINVILLE/documents?pdf=" + "a".repeat(64)
            ),
            ctx
          )
        ).status
      ).toBe(403);
      expect(mock.readStream).not.toHaveBeenCalled();
      expect(mock.collection).not.toHaveBeenCalled();
    }
  );
  it("allows an internal legacy Nextcon admin to retrieve the consolidated original", async () => {
    mock.auth.mockResolvedValue({ role: "ADMIN", tenantId: "nextcon", servedCompanies: [] });
    mock.document.mockResolvedValue({
      exists: true,
      data: () => ({ companyId: "BRITANIA_JOINVILLE" }),
    });
    expect(
      (
        await GET(
          new NextRequest("https://test/api/clients/BRITANIA_JOINVILLE/documents?pdf=" + pdfHash),
          { params: Promise.resolve({ id: "BRITANIA_JOINVILLE" }) }
        )
      ).status
    ).toBe(200);
  });
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
    mock.document.mockResolvedValue({
      exists: true,
      data: () => ({ taskCount: 4, companyId: "CETESB" }),
    });
    mock.save.mockRejectedValue({ code: 412 });
    const r = await POST(upload(), context);
    expect(await r.json()).toEqual({ alreadySaved: true, taskCount: 4 });
    expect(mock.readStream).toHaveBeenCalledOnce();
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("never persists cards if original upload fails", async () => {
    mock.save.mockRejectedValue(new Error("private bucket details"));
    const r = await POST(upload(), context);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private bucket details");
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("returns only a verified original with private download headers", async () => {
    mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId: "CETESB" }) });
    const r = await GET(new NextRequest(`${url}?pdf=${pdfHash}`), context);
    expect(r.status).toBe(200);
    expect(Buffer.from(await r.arrayBuffer())).toEqual(pdfBytes);
    expect(mock.readStream).toHaveBeenCalledWith({
      start: 0,
      end: 15 * 1024 * 1024,
      validation: false,
      decompress: false,
    });
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("vary")).toBe("Authorization");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it.each(["changed PDF", "non-PDF", "oversized PDF"])(
    "refuses to serve a stored %s under a different content address",
    async (condition) => {
      mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId: "CETESB" }) });
      const bytes =
        condition === "oversized PDF"
          ? Buffer.concat([pdfBytes, Buffer.alloc(15 * 1024 * 1024)])
          : Buffer.from(condition === "non-PDF" ? "private non-PDF data" : "%PDF-1.7 changed");
      mock.readStream.mockImplementation(() => Readable.from([bytes]));
      const r = await GET(new NextRequest(`${url}?pdf=${pdfHash}`), context);
      expect(r.status).toBe(409);
      expect(await r.text()).not.toContain("private non-PDF data");
    }
  );
  it.each(["OTHER", undefined])(
    "blocks download and reimport when the index company is %s",
    async (companyId) => {
      mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId }) });
      expect((await GET(new NextRequest(`${url}?pdf=${pdfHash}`), context)).status).toBe(409);
      expect((await POST(upload(), context)).status).toBe(409);
      expect(mock.readStream).not.toHaveBeenCalled();
      expect(mock.save).not.toHaveBeenCalled();
      expect(mock.create).not.toHaveBeenCalled();
    }
  );
  it("refuses a conflicting stored original before creating the index or cards", async () => {
    mock.save.mockRejectedValue({ code: 412 });
    mock.readStream.mockImplementation(() => Readable.from([Buffer.from("%PDF-1.7 different")]));
    expect((await POST(upload(), context)).status).toBe(409);
    expect(mock.transaction).not.toHaveBeenCalled();
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("restores a missing original on identical reimport without changing cards", async () => {
    mock.document.mockResolvedValue({
      exists: true,
      data: () => ({ companyId: "CETESB", taskCount: 4 }),
    });
    const r = await POST(upload(), context);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ alreadySaved: true, taskCount: 4 });
    expect(mock.save).toHaveBeenCalledWith(
      pdfBytes,
      expect.objectContaining({ preconditionOpts: { ifGenerationMatch: 0 } })
    );
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("recovers an uploaded original after its Firestore transaction failed", async () => {
    mock.transaction.mockRejectedValueOnce(new Error("Firestore unavailable"));
    expect((await POST(upload(), context)).status).toBe(503);
    expect(mock.save).toHaveBeenCalledOnce();
    expect(mock.create).not.toHaveBeenCalled();
    mock.save.mockRejectedValueOnce({ code: 412 });
    const retry = await POST(upload(), context);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ alreadySaved: false, taskCount: 1 });
    expect(mock.readStream).toHaveBeenCalledOnce();
    expect(mock.create).toHaveBeenCalledTimes(2);
  });
  it("rechecks the index company inside the card transaction", async () => {
    mock.document
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, data: () => ({ companyId: "OTHER" }) });
    expect((await POST(upload(), context)).status).toBe(409);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("stops a storage stream that ignores Range before accumulating the full object", async () => {
    mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId: "CETESB" }) });
    let consumed = 0;
    let released = false;
    const stream = Readable.from(
      (async function* () {
        try {
          for (let index = 0; index < 100; index++) {
            consumed++;
            yield Buffer.alloc(1024 * 1024);
          }
        } finally {
          released = true;
        }
      })(),
      { highWaterMark: 1 }
    );
    mock.readStream.mockReturnValue(stream);
    const r = await GET(new NextRequest(`${url}?pdf=${pdfHash}`), context);
    expect(r.status).toBe(409);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(stream.destroyed).toBe(true);
    expect(released).toBe(true);
    expect(consumed).toBeLessThan(20);
  });
  it("destroys a failed stream and hides storage details", async () => {
    mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId: "CETESB" }) });
    const stream = Readable.from(
      (async function* () {
        yield pdfBytes;
        throw new Error("private bucket and credential details");
      })()
    );
    mock.readStream.mockReturnValue(stream);
    const r = await GET(new NextRequest(`${url}?pdf=${pdfHash}`), context);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private bucket and credential details");
    expect(stream.destroyed).toBe(true);
  });
  it("interrupts the storage stream when the request is aborted", async () => {
    mock.document.mockResolvedValue({ exists: true, data: () => ({ companyId: "CETESB" }) });
    const controller = new AbortController();
    const stream = new Readable({
      read() {
        controller.abort();
      },
    });
    mock.readStream.mockReturnValue(stream);
    const r = await GET(
      new NextRequest(`${url}?pdf=${pdfHash}`, { signal: controller.signal }),
      context
    );
    expect(r.status).toBe(503);
    expect(stream.destroyed).toBe(true);
  });
});
