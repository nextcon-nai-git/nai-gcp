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

function request(count = 1) {
  const rows = Array.from({ length: count }, (_, i) => ({
    EMPRESA: "1",
    NOMEEMPRESA: "Empresa teste",
    CODEXAME: String(i),
  }));
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
    const response = await POST(request(101));
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

  it("responde 409 antes de gravar quando outro lote já foi publicado", async () => {
    db.readInTransaction.mockResolvedValue({ data: () => ({ importId: "outro" }) });
    expect((await POST(request())).status).toBe(409);
    expect(db.write).not.toHaveBeenCalled();
  });
});
