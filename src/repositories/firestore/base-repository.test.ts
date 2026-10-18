import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  apps: vi.fn(() => [] as unknown[]),
  app: vi.fn(() => ({ name: "existing" })),
  initApp: vi.fn(() => ({ name: "new" })),
  initDb: vi.fn(() => ({ id: "db" })),
  db: vi.fn(() => ({ id: "fallback-db" })),
  get: vi.fn(),
  list: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  txGet: vi.fn(),
  txSet: vi.fn(),
  transaction: vi.fn(),
  where: vi.fn((field, operator, value) => ({ field, operator, value })),
}));
vi.mock("firebase/app", () => ({
  initializeApp: mock.initApp,
  getApps: mock.apps,
  getApp: mock.app,
}));
vi.mock("firebase/firestore", () => ({
  initializeFirestore: mock.initDb,
  getFirestore: mock.db,
  collection: (_db: unknown, name: string) => ({ path: name }),
  doc: (...args: unknown[]) => {
    const id = args.length === 3 ? args[2] : args[1] || "generated-id";
    return {
      id,
      path: `${args.length === 3 ? args[1] : (args[0] as { path: string }).path}/${id}`,
    };
  },
  query: (...args: unknown[]) => ({ args }),
  where: mock.where,
  getDoc: mock.get,
  getDocs: mock.list,
  setDoc: mock.set,
  updateDoc: mock.update,
  deleteDoc: mock.remove,
  serverTimestamp: () => "server-timestamp",
  runTransaction: mock.transaction,
}));
import { BaseFirestoreRepository } from "./base-repository";
import { EmployeeRepository } from "../employees/employee-repository";
import { IncidentRepository } from "../incidents/incident-repository";

type TestRecord = { id: string; name: string; companyId: string };
class TestRepository extends BaseFirestoreRepository<TestRecord> {
  constructor() {
    super("records");
  }
}
const snapshot = (id: string, data: Record<string, unknown>) => ({
  id,
  exists: () => true,
  data: () => data,
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.apps.mockReturnValue([]);
  mock.initDb.mockImplementation(() => ({ id: "db" }));
  mock.get.mockReset().mockResolvedValue({ exists: () => false });
  mock.list.mockReset().mockResolvedValue({ docs: [] });
  mock.set.mockReset().mockResolvedValue(undefined);
  mock.update.mockReset().mockResolvedValue(undefined);
  mock.remove.mockReset().mockResolvedValue(undefined);
  mock.txGet.mockReset().mockResolvedValue({ exists: () => false });
  mock.txSet.mockReset();
  mock.transaction
    .mockReset()
    .mockImplementation(async (_db, action) => action({ get: mock.txGet, set: mock.txSet }));
});

describe("repositório Firestore: identidade e persistência", () => {
  it("inicializa a instância apenas quando não existe um aplicativo", () => {
    new TestRepository();
    expect(mock.initApp).toHaveBeenCalledOnce();
    mock.apps.mockReturnValue([{}]);
    new TestRepository();
    expect(mock.initApp).toHaveBeenCalledOnce();
    expect(mock.app).toHaveBeenCalledOnce();
  });
  it("reutiliza Firestore já inicializado", () => {
    mock.initDb.mockImplementation(() => {
      throw new Error("already initialized");
    });
    new TestRepository();
    expect(mock.db).toHaveBeenCalledOnce();
  });
  it("retorna null só quando o documento não existe e preserva erros de leitura", async () => {
    const repo = new TestRepository();
    expect(await repo.get("missing")).toBeNull();
    mock.get.mockRejectedValue(new Error("permission denied"));
    await expect(repo.get("missing")).rejects.toThrow("permission denied");
  });
  it("prioriza o ID do snapshot no get e na listagem, mesmo com ID divergente armazenado", async () => {
    const repo = new TestRepository();
    const document = snapshot("real-id", {
      id: "other-client-document",
      name: "Name",
      companyId: "company-one",
    });
    mock.get.mockResolvedValue(document);
    mock.list.mockResolvedValue({ docs: [document] });
    expect(await repo.get("real-id")).toMatchObject({ id: "real-id" });
    expect(await repo.list()).toEqual([{ id: "real-id", name: "Name", companyId: "company-one" }]);
  });
  it("mantém filtros falsy válidos e ignora somente null/undefined", async () => {
    await new TestRepository().list({
      active: false,
      count: 0,
      text: "",
      missing: undefined,
      absent: null,
    });
    expect(mock.where.mock.calls).toEqual([
      ["active", "==", false],
      ["count", "==", 0],
      ["text", "==", ""],
    ]);
  });
  it("cria com ID novo e só devolve sucesso após a persistência", async () => {
    const repo = new TestRepository();
    expect(await repo.create({ name: "Synthetic", companyId: "company-one" })).toBe("generated-id");
    expect(mock.set).toHaveBeenCalledWith(
      { id: "generated-id", path: "records/generated-id" },
      expect.objectContaining({
        name: "Synthetic",
        companyId: "company-one",
        createdAt: expect.any(String),
        serverTimestamp: "server-timestamp",
      })
    );
    expect(mock.transaction).not.toHaveBeenCalled();
    mock.set.mockRejectedValue(new Error("write failed"));
    await expect(repo.create({ name: "Synthetic", companyId: "company-one" })).rejects.toThrow(
      "write failed"
    );
  });
  it("não sobrescreve um ID informado que já existe", async () => {
    mock.txGet.mockResolvedValue({ exists: () => true });
    await expect(
      new TestRepository().create({ name: "Replacement", companyId: "company-two" }, "existing")
    ).rejects.toThrow("Já existe");
    expect(mock.txSet).not.toHaveBeenCalled();
    expect(mock.set).not.toHaveBeenCalled();
  });
  it("confere a ausência e grava um ID informado na mesma transação", async () => {
    expect(
      await new TestRepository().create(
        { name: "Synthetic", companyId: "company-one" },
        "custom-id"
      )
    ).toBe("custom-id");
    expect(mock.txGet).toHaveBeenCalledWith({ id: "custom-id", path: "records/custom-id" });
    expect(mock.txSet).toHaveBeenCalledWith(
      { id: "custom-id", path: "records/custom-id" },
      expect.objectContaining({ companyId: "company-one" })
    );
    expect(mock.set).not.toHaveBeenCalled();
  });
  it("atualiza somente o documento solicitado com marca temporal e propaga falhas", async () => {
    const repo = new TestRepository();
    await repo.update("known-id", { name: "Reviewed" });
    expect(mock.update).toHaveBeenCalledWith(
      { id: "known-id", path: "records/known-id" },
      expect.objectContaining({
        name: "Reviewed",
        updatedAt: expect.any(String),
        serverTimestamp: "server-timestamp",
      })
    );
    mock.update.mockRejectedValue(new Error("conflict"));
    await expect(repo.update("known-id", {})).rejects.toThrow("conflict");
  });
  it("propaga a falha de remoção em vez de indicar sucesso", async () => {
    const repo = new TestRepository();
    await repo.delete("known-id");
    expect(mock.remove).toHaveBeenCalledWith({ id: "known-id", path: "records/known-id" });
    mock.remove.mockRejectedValue(new Error("denied"));
    await expect(repo.delete("known-id")).rejects.toThrow("denied");
  });
});

describe("consultas por empresa", () => {
  it.each(["", " ", "company/other", "company\\other", "x".repeat(129), undefined, null])(
    "não converte empresa inválida %s em consulta global",
    async (companyId) => {
      const employees = new EmployeeRepository();
      const incidents = new IncidentRepository();
      await expect(employees.listByCompany(companyId as string)).rejects.toThrow("empresa válida");
      await expect(incidents.listByCompany(companyId as string)).rejects.toThrow("empresa válida");
      await expect(employees.findByCpf(companyId as string, "synthetic-cpf")).rejects.toThrow(
        "empresa válida"
      );
      expect(mock.list).not.toHaveBeenCalled();
    }
  );
  it("mantém o filtro de empresa ao consultar funcionários e incidentes", async () => {
    await new EmployeeRepository().listByCompany("company-a");
    await new IncidentRepository().listByCompany("company-b");
    expect(mock.where.mock.calls).toEqual([
      ["companyId", "==", "company-a"],
      ["companyId", "==", "company-b"],
    ]);
  });
  it("exige CPF, retorna ausência e recusa selecionar entre cadastros duplicados", async () => {
    const repo = new EmployeeRepository();
    await expect(repo.findByCpf("company", "")).rejects.toThrow("Informe o CPF");
    expect(mock.list).not.toHaveBeenCalled();
    expect(await repo.findByCpf("company", "synthetic-cpf")).toBeNull();
    mock.list.mockResolvedValue({ docs: [snapshot("one", {}), snapshot("two", {})] });
    await expect(repo.findByCpf("company", "synthetic-cpf")).rejects.toThrow(
      "mais de um colaborador"
    );
    mock.list.mockResolvedValue({ docs: [snapshot("one", { name: "Synthetic" })] });
    expect(await repo.findByCpf("company", "synthetic-cpf")).toMatchObject({ id: "one" });
    expect(mock.where).toHaveBeenCalledWith("companyId", "==", "company");
    expect(mock.where).toHaveBeenCalledWith("cpf", "==", "synthetic-cpf");
  });
});
