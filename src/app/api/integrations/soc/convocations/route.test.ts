// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Papa from "papaparse";
import { AuthError } from "@/lib/auth/errors";
import { convocationFields, CONVOCATION_MAX_BYTES } from "@/lib/integrations/soc-convocations";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  chunks: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: m.auth }));
vi.mock("@/lib/firebase-admin", () => {
  function collection(path: string) {
    return {
      doc: (id: string) => ({
        path: path + "/" + id,
        get: m.get,
        collection: (name: string) => collection(path + "/" + id + "/" + name),
      }),
      orderBy: () => ({ get: m.chunks }),
    };
  }
  return {
    adminDb: {
      collection,
      runTransaction: m.transaction,
    },
  };
});
import { GET, POST } from "./route";
const row = {
  ...Object.fromEntries(convocationFields.map((f) => [f, ""])),
  "Código Funcionario": "001",
  "CNPJ DA UNIDADE": "11.918.109/0008-03",
  Nome: "Exemplo",
  UNIDADE: "AESA",
  Exame: "Clínico",
};
const request = (body = Papa.unparse([row])) =>
  new NextRequest("https://nai.test/api/integrations/soc/convocations", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body,
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ uid: "admin", role: "ADMIN", tenantId: null });
  m.get.mockResolvedValue({ exists: false, data: () => undefined });
  m.transaction.mockImplementation((callback) => callback({ get: m.get, set: m.set }));
});
describe("convocation import access and persistence", () => {
  it("rejects unauthenticated access and client tenants before storage", async () => {
    m.auth.mockRejectedValue(new AuthError("Entre novamente", 401));
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    m.auth.mockResolvedValue({ role: "ADMIN", tenantId: "client" });
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(m.get).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("allows internal operations to read but not import", async () => {
    m.auth.mockResolvedValue({ role: "OPERATIONS", tenantId: null });
    expect((await GET(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(403);
  });
  it("rejects invalid or oversized CSV without mutation", async () => {
    expect((await POST(request("wrong\nlayout"))).status).toBe(400);
    expect((await POST(request("x".repeat(CONVOCATION_MAX_BYTES + 1)))).status).toBe(413);
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("publica todas as linhas e o histórico junto com a base ativa", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({ ...row, Nome: "Pessoa " + index }));
    const response = await POST(request(Papa.unparse(rows)));
    expect(response.status).toBe(200);
    expect(m.transaction).toHaveBeenCalledOnce();
    const writes = m.set.mock.calls;
    const metadata = writes.at(-1)![1];
    const active = "webhook_deliveries/soc-convocations-avp";
    const history = active + "/imports/" + metadata.importId;
    expect(writes.map(([ref]) => ref.path)).toEqual([
      history + "/chunks/0000",
      history + "/chunks/0001",
      history,
      active,
    ]);
    expect(writes[0][1]).toEqual({ index: 0, rows: rows.slice(0, 100) });
    expect(writes[1][1]).toEqual({ index: 1, rows: rows.slice(100) });
    expect(writes[2][1]).toEqual(metadata);
    expect(metadata).toMatchObject({
      group: "GRUPO_AVP",
      importedBy: "admin",
      summary: { rows: 101 },
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("informa falha se a transação não for confirmada", async () => {
    m.transaction.mockRejectedValue(Error("unavailable"));
    expect((await POST(request())).status).toBe(500);
    expect(m.set).not.toHaveBeenCalled();
  });

  it("recusa concorrência antes de gravar blocos ou histórico", async () => {
    m.get
      .mockResolvedValueOnce({ data: () => ({ hash: "old" }) })
      .mockResolvedValueOnce({ data: () => ({ importId: "newer" }) });
    expect((await POST(request())).status).toBe(409);
    expect(m.set).not.toHaveBeenCalled();
  });
  it("preserva uma versão de auditoria para cada importação confirmada", async () => {
    expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
    const history = m.set.mock.calls.filter(([ref]) => /\/imports\/[^/]+$/.test(ref.path));
    expect(history).toHaveLength(2);
    expect(history[0][1].hash).toBe(history[1][1].hash);
    expect(history[0][1].importId).not.toBe(history[1][1].importId);
  });

  it.each(["importId", "hash"])(
    "carrega um histórico completo identificado por %s",
    async (field) => {
      const metadata = { [field]: "active", summary: { rows: 2 } };
      m.get.mockResolvedValue({ exists: true, data: () => metadata });
      m.chunks.mockResolvedValue({ docs: [{ data: () => ({ index: 0, rows: [row, row] }) }] });
      const response = await GET(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ snapshot: { ...metadata, rows: [row, row] } });
    }
  );

  it.each([
    { chunks: [] },
    { chunks: [{ index: 1, rows: [row, row] }] },
    { chunks: [{ index: 0, rows: [row] }] },
    { chunks: [{ index: 0, rows: null }] },
  ])("sinaliza base incompleta sem apresentar resultados parciais", async ({ chunks }) => {
    m.get.mockResolvedValue({
      exists: true,
      data: () => ({ importId: "active", summary: { rows: 2 } }),
    });
    m.chunks.mockResolvedValue({ docs: chunks.map((chunk) => ({ data: () => chunk })) });
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: expect.stringContaining("incompleta") });
  });
});
