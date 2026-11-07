import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const db = vi.hoisted(() => ({
  readActive: vi.fn(),
  readInTransaction: vi.fn(),
  write: vi.fn(),
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: async () => ({ uid: "test-admin", role: "ADMIN" }),
}));
vi.mock("@/lib/integrations/soc", () => ({ requireSocAccess: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => {
  function reference(path: string) {
    return {
      path,
      get: db.readActive,
      collection: (name: string) => collection(path + "/" + name),
    };
  }
  function collection(path: string) {
    return { doc: (id: string) => reference(path + "/" + id) };
  }
  return {
    adminDb: {
      collection,
      runTransaction: (run: (tx: unknown) => Promise<void>) =>
        run({ get: db.readInTransaction, set: db.write }),
    },
  };
});

const rootPath = "webhook_deliveries/soc-exam-results";

function request(
  rows: Record<string, string>[] = [{ EMPRESA: "1", NOMEEMPRESA: "Empresa teste" }]
) {
  return new NextRequest("https://example.test/api/integrations/soc/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });
}

describe("publicação dos resultados SOC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const empty = { data: () => undefined };
    db.readActive.mockResolvedValue(empty);
    db.readInTransaction.mockResolvedValue(empty);
  });

  it("publica os blocos e os dois registros de metadados na mesma transação", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      EMPRESA: "1",
      NOMEEMPRESA: "Empresa teste",
      CODEXAME: String(i),
    }));
    const response = await POST(request(rows));
    expect(response.status).toBe(200);
    expect(db.write).toHaveBeenCalledTimes(4);
    const writes = db.write.mock.calls;
    const metadata = writes[3][1];
    const importPath = rootPath + "/imports/" + metadata.importId;
    expect(writes.map(([ref]) => ref.path)).toEqual([
      importPath + "/chunks/0000",
      importPath + "/chunks/0001",
      importPath,
      rootPath,
    ]);
    expect(writes[0][1].rows).toHaveLength(100);
    expect(writes[1][1].rows).toHaveLength(1);
    expect(writes[2][1]).toEqual(metadata);
  });

  it("identifica a linha inválida antes de consultar ou gravar o lote", async () => {
    const row = { EMPRESA: "1", NOMEEMPRESA: "Empresa teste" };
    const response = await POST(request([row, { ...row, DATAEXAME: "31/02/2026" }]));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Registro 2: Data SOC inválida em DATAEXAME." });
    expect(db.readActive).not.toHaveBeenCalled();
    expect(db.write).not.toHaveBeenCalled();
  });

  it("devolve o resumo publicado sem repetir a transação ao reenviar o mesmo lote", async () => {
    const row = { EMPRESA: "1", NOMEEMPRESA: "Empresa teste", CODEXAME: "250" };
    const rows = [
      { ...row, NOMEEXAME: "Avaliação Clínica Ocupacional" },
      { ...row, NOMEEXAME: "FALTA / AUSÊNCIA" },
    ];
    const first = await POST(request(rows));
    expect(first.status).toBe(200);
    const result = await first.json();
    expect(result.summary).toMatchObject({ uniqueRows: 2, realized: 1, absences: 1 });
    const metadata = db.write.mock.calls.at(-1)![1];
    db.readActive.mockResolvedValue({ data: () => metadata });
    db.readInTransaction.mockClear();
    db.write.mockClear();

    const retry = await POST(request(rows));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({
      imported: false,
      duplicate: true,
      summary: result.summary,
      importedAt: result.importedAt,
    });
    expect(db.readInTransaction).not.toHaveBeenCalled();
    expect(db.write).not.toHaveBeenCalled();
  });

  it("responde 409 antes de gravar quando outro lote já foi publicado", async () => {
    db.readInTransaction.mockResolvedValue({ data: () => ({ importId: "outro" }) });
    expect((await POST(request())).status).toBe(409);
    expect(db.write).not.toHaveBeenCalled();
  });
});
