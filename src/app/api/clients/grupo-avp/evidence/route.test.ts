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
  download: vi.fn(),
  collection: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/firebase/config", () => ({ firebaseConfig: { storageBucket: "test" } }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({ file: () => ({ save: m.save, download: m.download }) }),
  }),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, runTransaction: m.transaction },
}));
import { GET, POST, PATCH } from "./route";
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
  it("returns only the PDF matching its immutable indexed digest with private headers", async () => {
    const bytes = Buffer.from("%PDF-1.7 synthetic AVP evidence");
    m.get.mockResolvedValue({
      data: () => ({
        kind: "aso",
        uploaded: true,
        fileHash: createHash("sha256").update(bytes).digest("hex"),
      }),
    });
    m.download.mockResolvedValue([bytes]);
    const response = await GET(new NextRequest(url + "?document=" + "a".repeat(64)));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(m.auth).toHaveBeenCalledTimes(2);
  });
  it.each(["suspended", "scope", "external"])(
    "does not release a PDF after %s access changes during Storage download",
    async (scenario) => {
      const bytes = Buffer.from("%PDF-1.7 private synthetic contents");
      m.get.mockResolvedValue({
        data: () => ({
          kind: "aso",
          uploaded: true,
          fileHash: createHash("sha256").update(bytes).digest("hex"),
        }),
      });
      m.download.mockImplementation(async () => {
        if (scenario === "suspended")
          m.auth.mockRejectedValue(new AuthError("Acesso suspenso.", 403));
        else
          m.auth.mockResolvedValue({
            uid: "admin",
            role: scenario === "scope" ? "OPERATIONS" : "ADMIN",
            tenantId: scenario === "external" ? "GRUPO_AVP" : null,
            servedCompanies: [],
          });
        return [bytes];
      });
      const response = await GET(new NextRequest(url + "?document=" + "a".repeat(64)));
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("private synthetic contents");
      expect(m.download).toHaveBeenCalledOnce();
      expect(m.auth).toHaveBeenCalledTimes(2);
    }
  );
  it("refuses mismatching stored PDF bytes and malformed indexed hashes", async () => {
    m.get.mockResolvedValue({
      data: () => ({ kind: "aso", uploaded: true, fileHash: "c".repeat(64) }),
    });
    m.download.mockResolvedValue([Buffer.from("%PDF-1.7 private synthetic replacement")]);
    const response = await GET(new NextRequest(url + "?document=" + "a".repeat(64)));
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("private synthetic replacement");
    m.download.mockClear();
    m.get.mockResolvedValue({
      data: () => ({ kind: "aso", uploaded: true, fileHash: "../other-document" }),
    });
    expect((await GET(new NextRequest(url + "?document=" + "a".repeat(64)))).status).toBe(409);
    expect(m.download).not.toHaveBeenCalled();
  });
});

it("paginates a collection beyond 3,000 records using stable IDs", async () => {
  const ids = Array.from({ length: 3501 }, (_, n) => n.toString(16).padStart(64, "0"));
  let start = 0;
  const query = {
    orderBy: vi.fn().mockReturnThis(),
    startAfter: vi.fn((cursor: string) => {
      start = ids.indexOf(cursor) + 1;
      return query;
    }),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(async () => {
      const page = ids.slice(start, start + 501);
      return {
        size: page.length,
        docs: page.map((id) => ({ id, data: () => ({ clinic: "Teste" }) })),
      };
    }),
  };
  m.collection.mockReturnValue({ doc: () => ({ collection: () => query }) });
  let cursor: string | null = null;
  const loaded: string[] = [];
  do {
    const response = await GET(new NextRequest(url + (cursor ? "?cursor=" + cursor : "")));
    expect(response.status).toBe(200);
    const data = await response.json();
    loaded.push(...data.records.map((r: { id: string }) => r.id));
    cursor = data.nextCursor;
  } while (cursor);
  expect(loaded).toEqual(ids);
  expect(query.get).toHaveBeenCalledTimes(8);
});
it("rejects an invalid pagination cursor before reading records", async () => {
  expect((await GET(new NextRequest(url + "?cursor=../invalid"))).status).toBe(400);
  expect(m.collection).not.toHaveBeenCalled();
});
it("bounds the streamed JSON body without relying on Content-Length", async () => {
  const response = await POST(
    new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: " ".repeat(500001),
    })
  );
  expect(response.status).toBe(413);
  expect(m.transaction).not.toHaveBeenCalled();
});

describe("recebimento individual e conferência do vínculo", () => {
  const bytes = Buffer.from("%PDF-1.7 fixture ASO assinado");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const formFields = {
    employee: "Pessoa de Teste",
    company: "Empresa de Teste",
    companyCnpj: "11.222.333/0001-81",
    socEmployeeCode: "42",
    examType: "Admissional",
    examDate: "2026-11-18",
    receivedDate: "2026-11-19",
    review: "Conferir vínculo",
    source: "Remessa de teste",
    notes: "",
    onlySignedAso: true,
  };
  const records = new Map<string, Record<string, unknown>>();
  const doc = (id: string) => ({ id, get: async () => ({ data: () => records.get(id) }) });
  const query = { limit: () => ({ lookup: true }) };
  beforeEach(() => {
    records.clear();
    m.collection.mockReturnValue({
      doc: () => ({ collection: () => ({ doc, where: () => query }) }),
    });
    m.transaction.mockImplementation((fn) =>
      fn({
        getAll: async (...refs: { id: string }[]) =>
          refs.map(({ id }) => ({ exists: records.has(id), data: () => records.get(id) })),
        get: async (r: { id?: string; lookup?: boolean }) =>
          r.lookup
            ? { empty: ![...records.values()].some((i) => i.fileHash === hash) }
            : { exists: records.has(r.id!), data: () => records.get(r.id!) },
        create: (r: { id: string }, value: Record<string, unknown>) => records.set(r.id, value),
        update: (r: { id: string }, patch: Record<string, unknown>) =>
          records.set(r.id, { ...records.get(r.id), ...patch }),
      })
    );
  });
  function receive(fields = formFields, fileName = "aso.pdf") {
    const form = new FormData();
    form.set("receipt", JSON.stringify(fields));
    form.set("file", new File([bytes], fileName, { type: "application/pdf" }));
    return POST(new NextRequest(url, { method: "POST", body: form }));
  }
  const confirm = (overrides = {}) =>
    PATCH(
      new NextRequest(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: hash,
          companyCnpj: formFields.companyCnpj,
          reference: "Pedido SOC de teste",
          ...overrides,
        }),
      })
    );
  it("registra um PDF, preserva divergência, confirma uma única vez e mantém a referência", async () => {
    expect((await receive()).status).toBe(200);
    expect((await receive()).status).toBe(200);
    expect(m.save).toHaveBeenCalledOnce();
    expect(records.get(hash)).toMatchObject({
      uploaded: true,
      companyCnpj: "11222333000181",
      review: "Conferir vínculo",
    });
    expect((await receive({ ...formFields, employee: "Homônimo em outro vínculo" })).status).toBe(
      409
    );
    expect((await confirm({ companyCnpj: "12.ABC.345/01DE-35" })).status).toBe(409);
    expect((await confirm()).status).toBe(200);
    const confirmed = records.get(hash);
    expect(confirmed).toMatchObject({
      review: "Recebido",
      linkConfirmation: {
        uid: "admin",
        reference: "Pedido SOC de teste",
        previousReview: "Conferir vínculo",
      },
    });
    expect((await confirm()).status).toBe(200);
    expect(records.get(hash)).toBe(confirmed);
    expect(records.size).toBe(1);
  });
  it("preserva indexação histórica de arquivo idêntico, inclusive renomeado", async () => {
    records.set("9".repeat(64), { ...formFields, kind: "aso", fileHash: hash, uploaded: false });
    expect((await receive(formFields, "via-2.pdf")).status).toBe(409);
    expect(records.size).toBe(1);
    expect(m.save).not.toHaveBeenCalled();
  });
  it("protege também a importação em lote após recebimento individual", async () => {
    await receive();
    const entry = {
      ...formFields,
      kind: "aso",
      id: "a".repeat(64),
      sourceHash: hash,
      fileHash: hash,
      fileName: "outra-via.pdf",
      city: "",
      uf: "",
    };
    const { onlySignedAso, ...index } = entry;
    expect(onlySignedAso).toBe(true);
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ records: [index] }),
      })
    );
    expect(response.status).toBe(409);
    expect(records.size).toBe(1);
  });
  it("retoma o PDF após falha no armazenamento sem concluir o vínculo ou criar outro ASO", async () => {
    m.save.mockRejectedValueOnce(new Error("offline"));
    expect((await receive()).status).toBe(503);
    expect(records.get(hash)).toMatchObject({ uploaded: false });
    expect((await confirm()).status).toBe(400);
    expect((await receive()).status).toBe(200);
    expect(records.size).toBe(1);
    expect(records.get(hash)).toMatchObject({ uploaded: true });
  });
  it("exige somente o ASO assinado, datas coerentes e um CNPJ válido e preserva retificação pendente", async () => {
    for (const fields of [
      { onlySignedAso: false },
      { companyCnpj: "invalido" },
      { examDate: "2026-11-20" },
    ])
      expect((await receive({ ...formFields, ...fields })).status).toBe(400);
    expect(records.size).toBe(0);
    expect((await receive({ ...formFields, review: "Conferir retificação" })).status).toBe(200);
    expect((await confirm()).status).toBe(409);
  });
});
