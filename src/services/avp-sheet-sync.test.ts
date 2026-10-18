import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVP_SOURCE, AVP_SOURCE_HEADERS } from "@/lib/avp-source-config";
import { parseAvpSourceValues } from "@/lib/avp-source-parser";

type TestSnapshot = {
  id: string | undefined;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};
type TestRef = {
  path: string;
  collection: (name: string) => TestRef;
  doc: (name: string) => TestRef;
  get: () => Promise<TestSnapshot | { docs: TestSnapshot[] }>;
  set: (data: Record<string, unknown>, options?: { merge?: boolean }) => Promise<unknown>;
};
type TestTransaction = {
  get: (item: TestRef) => Promise<TestSnapshot>;
  getAll: (...items: TestRef[]) => Promise<TestSnapshot[]>;
  set: (item: TestRef, data: Record<string, unknown>, options?: { merge?: boolean }) => unknown;
};

const mock = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>();
  const snapshot = (path: string) => ({
    id: path.split("/").at(-1),
    exists: docs.has(path),
    data: () => docs.get(path),
  });
  const save = (path: string, data: Record<string, unknown>, options?: { merge?: boolean }) =>
    docs.set(path, options?.merge ? { ...docs.get(path), ...data } : { ...data });
  const ref = (path: string): TestRef => ({
    path,
    collection: (name: string) => ref(`${path}/${name}`),
    doc: (name: string) => ref(`${path}/${name}`),
    get: async () =>
      path.split("/").length % 2 === 0
        ? snapshot(path)
        : {
            docs: [...docs.keys()]
              .filter(
                (key) =>
                  key.startsWith(path + "/") && key.split("/").length === path.split("/").length + 1
              )
              .map(snapshot),
          },
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) =>
      save(path, data, options),
  });
  const transaction = vi.fn(async (action: (tx: TestTransaction) => Promise<unknown>) => {
    const pending: Array<() => void> = [];
    const result = await action({
      get: async (item: TestRef) => snapshot(item.path),
      getAll: async (...items: TestRef[]) => items.map((item) => snapshot(item.path)),
      set: (item: TestRef, data: Record<string, unknown>, options?: { merge?: boolean }) =>
        pending.push(() => save(item.path, data, options)),
    });
    pending.forEach((write) => write());
    return result;
  });
  const commit = vi.fn();
  const batch = vi.fn(() => {
    const pending: Array<() => void> = [];
    return {
      set: (item: TestRef, data: Record<string, unknown>) =>
        pending.push(() => save(item.path, data)),
      commit: async () => {
        await commit();
        pending.forEach((write) => write());
      },
    };
  });
  return {
    docs,
    ref,
    transaction,
    batch,
    commit,
    metadata: vi.fn(),
    values: vi.fn(),
    googleAuth: vi.fn(),
  };
});
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: mock.ref, runTransaction: mock.transaction, batch: mock.batch },
}));
vi.mock("googleapis/build/src/apis/sheets", () => ({
  auth: {
    GoogleAuth: class {
      constructor(options: unknown) {
        mock.googleAuth(options);
      }
    },
  },
  sheets: () => ({ spreadsheets: { get: mock.metadata, values: { get: mock.values } } }),
}));

import {
  applyAvpOverrides,
  getAvpSnapshot,
  patchAvpQueue,
  readPrivateAvpSheet,
  syncAvpSource,
} from "./avp-sheet-sync";

const meta = "integrations/grupo-avp";
const values = (count = 1) => [
  [...AVP_SOURCE_HEADERS],
  ...Array.from({ length: count }, (_, index) =>
    AVP_SOURCE_HEADERS.map(
      (field) =>
        (
          ({
            Nº: String(index + 1),
            COLABORADOR: `Pessoa sintética ${index + 1}`,
            CIDADE: "Curitiba / PR",
            STATUS: "NÃO INICIADO",
            URGÊNCIA: "NORMAL",
          }) as Record<string, string>
        )[field] ?? ""
    )
  ),
];
const row = () => parseAvpSourceValues(values()).rows[0];
const seed = () => {
  const item = row();
  mock.docs.set(meta, {
    sourceVersion: "version-one",
    manualRevision: "0",
    status: "CONNECTED",
    checkedAt: "2026-10-18T00:00:00.000Z",
  });
  mock.docs.set(
    `${meta}/versions/version-one/rows/${item.id}`,
    item as unknown as Record<string, unknown>
  );
  return item;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  mock.docs.clear();
  mock.commit.mockReset().mockResolvedValue(undefined);
  mock.metadata.mockReset().mockResolvedValue({
    data: {
      sheets: [
        {
          properties: {
            sheetId: AVP_SOURCE.sheetId,
            title: AVP_SOURCE.sheetTitle,
            gridProperties: { rowCount: 1000, columnCount: 22 },
          },
        },
      ],
    },
  });
  mock.values.mockReset().mockResolvedValue({ data: { values: values() } });
});
afterEach(() => vi.useRealTimers());

describe("leitura privada e publicação da fila AVP", () => {
  it("usa somente permissão de leitura e a aba configurada", async () => {
    const result = await readPrivateAvpSheet();
    expect(result.rows).toHaveLength(1);
    expect(mock.googleAuth).toHaveBeenCalledWith({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    expect(mock.values).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: AVP_SOURCE.spreadsheetId,
        range: "'Fila de Agendamentos'!A1:V1000",
        valueRenderOption: "FORMATTED_VALUE",
      }),
      { timeout: 20000 }
    );
  });

  it.each([
    { sheetId: 0, title: AVP_SOURCE.sheetTitle },
    { sheetId: AVP_SOURCE.sheetId, title: "Outra aba" },
    {
      sheetId: AVP_SOURCE.sheetId,
      title: AVP_SOURCE.sheetTitle,
      gridProperties: { rowCount: 10002, columnCount: 22 },
    },
    {
      sheetId: AVP_SOURCE.sheetId,
      title: AVP_SOURCE.sheetTitle,
      gridProperties: { rowCount: 100, columnCount: 21 },
    },
  ])("rejeita fonte divergente sem consultar seus valores", async (properties) => {
    mock.metadata.mockResolvedValue({ data: { sheets: [{ properties }] } });
    await expect(readPrivateAvpSheet()).rejects.toThrow();
    expect(mock.values).not.toHaveBeenCalled();
  });

  it("não inicia enquanto houver lease ou intervalo mínimo vigente", async () => {
    mock.docs.set(meta, { leaseUntil: Date.now() + 1000 });
    expect(await syncAvpSource(true)).toEqual({ started: false });
    mock.docs.set(meta, { lastAttemptMs: Date.now() - 29000 });
    expect(await syncAvpSource(true)).toEqual({ started: false });
    mock.docs.set(meta, { lastAttemptMs: Date.now() - 60000 });
    expect(await syncAvpSource()).toEqual({ started: false });
    expect(mock.values).not.toHaveBeenCalled();
  });

  it("publica todos os lotes antes de ativar a versão e registra a autoria", async () => {
    mock.values.mockResolvedValue({ data: { values: values(401) } });
    mock.commit.mockImplementation(async () => {
      expect(mock.docs.get(meta)?.sourceVersion).toBeUndefined();
    });
    expect(await syncAvpSource(false, "operator-1")).toEqual({ started: true, rowCount: 401 });
    expect(mock.batch).toHaveBeenCalledTimes(2);
    expect(mock.docs.get(meta)).toMatchObject({
      rowCount: 401,
      status: "CONNECTED",
      lease: null,
      leaseUntil: 0,
    });
    expect([...mock.docs.entries()].filter(([key]) => key.includes("/audit/"))[0][1]).toMatchObject(
      { actor: "operator-1", action: "SOURCE_SYNC", rowCount: 401 }
    );
    const current = await getAvpSnapshot();
    expect(current.items).toHaveLength(401);
    expect(current.items[0].sourceRow).toBe(2);
    expect(current.items.at(-1)?.sourceRow).toBe(402);
  });

  it("não regrava conteúdo idêntico, mas mantém eventos de consulta", async () => {
    await syncAvpSource();
    const firstVersion = mock.docs.get(meta)?.sourceVersion;
    mock.batch.mockClear();
    vi.advanceTimersByTime(601000);
    expect(await syncAvpSource()).toEqual({ started: true, rowCount: 1 });
    expect(mock.batch).not.toHaveBeenCalled();
    expect(mock.docs.get(meta)?.sourceVersion).toBe(firstVersion);
    expect([...mock.docs.keys()].filter((key) => key.includes("/audit/"))).toHaveLength(2);
  });

  it.each([403, 404, 500])("preserva a última fila na falha Google %i", async (code) => {
    seed();
    mock.values.mockRejectedValue({ code, message: "private-token-diagnostic" });
    const result = await syncAvpSource();
    expect(result).toMatchObject({ started: true, error: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain("private-token-diagnostic");
    expect(mock.docs.get(meta)).toMatchObject({
      sourceVersion: "version-one",
      status: "ERROR",
      lease: null,
    });
    expect((await getAvpSnapshot()).items).toHaveLength(1);
  });

  it("preserva o ponteiro anterior se um lote falhar", async () => {
    seed();
    mock.commit.mockRejectedValue(new Error("write unavailable"));
    expect(await syncAvpSource()).toHaveProperty("error");
    expect(mock.docs.get(meta)?.sourceVersion).toBe("version-one");
  });

  it("uma execução que perdeu o lease não substitui nem desbloqueia a nova execução", async () => {
    seed();
    mock.values.mockImplementation(async () => {
      mock.docs.set(meta, {
        ...mock.docs.get(meta),
        lease: "new-owner",
        leaseUntil: Date.now() + 120000,
      });
      return { data: { values: values() } };
    });
    expect(await syncAvpSource()).toHaveProperty("error");
    expect(mock.docs.get(meta)).toMatchObject({
      sourceVersion: "version-one",
      lease: "new-owner",
      status: "CONNECTED",
    });
  });

  it("expõe ausência de configuração sem inventar registros", async () => {
    expect(await getAvpSnapshot()).toMatchObject({
      items: [],
      revision: "",
      status: "CONFIGURATION_REQUIRED",
      checkedAt: null,
    });
  });
});

describe("edição manual e conflitos com a planilha", () => {
  it("aplica edição apenas quando a fonte base continua compatível", () => {
    const original = row();
    const changed = { ...original, status: "EXAME FEITO" as const };
    const override = {
      fields: { status: "AGENDADO", responsavel: "Operador", colaborador: "Não permitido" },
      baseFields: { status: original.status, responsavel: original.responsavel },
      updatedBy: "operator",
      updatedAt: "2026-10-18",
    };
    const result = applyAvpOverrides([changed], new Map([[original.id, override]]));
    expect(result.items[0]).toMatchObject({
      status: "EXAME FEITO",
      responsavel: "Operador",
      colaborador: original.colaborador,
    });
    expect(result.conflicts).toEqual([{ id: original.id, field: "status" }]);
    expect(
      applyAvpOverrides([{ ...original, status: "AGENDADO" }], new Map([[original.id, override]]))
        .conflicts
    ).toEqual([]);
    expect(original.responsavel).toBe("");
  });

  it("salva campos permitidos, atualiza a revisão e registra somente nomes de campos na auditoria", async () => {
    const item = seed();
    const revision = await patchAvpQueue(
      "version-one:0",
      [{ id: item.id, fields: { status: "AGENDADO", responsavel: "Operador sintético" } }],
      "operator-1"
    );
    expect(revision).not.toBe("version-one:0");
    const snapshot = await getAvpSnapshot();
    expect(snapshot.revision).toBe(revision);
    expect(snapshot.items[0]).toMatchObject({
      status: "AGENDADO",
      responsavel: "Operador sintético",
    });
    expect(snapshot.conflicts).toEqual([]);
    const audit = [...mock.docs.entries()].find(([key]) => key.includes("/audit/"))![1];
    expect(audit).toMatchObject({
      actor: "operator-1",
      changes: [{ id: item.id, fields: ["status", "responsavel"] }],
    });
    expect(JSON.stringify(audit)).not.toContain("Operador sintético");
  });

  it("rejeita revisão desatualizada sem escrever alterações", async () => {
    const item = seed();
    await expect(
      patchAvpQueue("old:0", [{ id: item.id, fields: { status: "AGENDADO" } }], "operator")
    ).rejects.toThrow("CONFLICT");
    expect([...mock.docs.keys()].some((path) => path.includes("/overrides/"))).toBe(false);
  });

  it("rejeita registro ausente e mantém toda a atualização atômica", async () => {
    const item = seed();
    await expect(
      patchAvpQueue(
        "version-one:0",
        [
          { id: item.id, fields: { status: "AGENDADO" } },
          { id: "avp_" + "f".repeat(32), fields: { status: "AGENDADO" } },
        ],
        "operator"
      )
    ).rejects.toThrow("Solicitação não encontrada");
    expect([...mock.docs.keys()].some((path) => path.includes("/overrides/"))).toBe(false);
    expect(mock.docs.get(meta)?.manualRevision).toBe("0");
  });

  it.each<Record<string, string>>([
    {},
    { colaborador: "Outra pessoa" },
    { status: "inventado" },
    { urgencia: "inventada" },
    { observacoes: "x".repeat(5001) },
  ])("rejeita campos vazios, proibidos ou inválidos", async (fields) => {
    const item = seed();
    await expect(
      patchAvpQueue("version-one:0", [{ id: item.id, fields }], "operator")
    ).rejects.toThrow();
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("rejeita lote vazio, IDs duplicados e caminho inválido", async () => {
    const item = seed();
    await expect(patchAvpQueue("version-one:0", [], "operator")).rejects.toThrow();
    const change = { id: item.id, fields: { status: "AGENDADO" } };
    await expect(patchAvpQueue("version-one:0", [change, change], "operator")).rejects.toThrow(
      "única vez"
    );
    await expect(
      patchAvpQueue("version-one:0", [{ ...change, id: "../other" }], "operator")
    ).rejects.toThrow("inválida");
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});
