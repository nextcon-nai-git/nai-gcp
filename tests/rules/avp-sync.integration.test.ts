import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { AVP_SOURCE_HEADERS } from "@/lib/avp-source-config";

const source = vi.hoisted(() => ({ values: [] as unknown[][], fail: false, reads: 0 }));
vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: class {} },
    sheets: () => ({
      spreadsheets: {
        get: async () => ({
          data: {
            sheets: [
              {
                properties: {
                  sheetId: 1413127031,
                  title: "Fila de Agendamentos",
                  gridProperties: { rowCount: 1046, columnCount: 22 },
                },
              },
            ],
          },
        }),
        values: {
          get: async () => {
            source.reads++;
            if (source.fail) throw { code: 403 };
            return { data: { values: source.values } };
          },
        },
      },
    }),
  },
}));
import { adminDb } from "@/lib/firebase-admin";
import { syncAvpSource, getAvpSnapshot, patchAvpQueue } from "@/services/avp-sheet-sync";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  source.fail = false;
  source.reads = 0;
  const record: Record<string, string> = {
    Nº: "1",
    COLABORADOR: "Pessoa sintética",
    CIDADE: "Imperatriz/MA",
    STATUS: "AGENDADO",
    "VALOR ASO": "45",
  };
  source.values = [
    [...AVP_SOURCE_HEADERS],
    AVP_SOURCE_HEADERS.map((header) => record[header] || ""),
  ];
});
afterAll(async () => {
  await env?.cleanup();
  await adminDb.terminate();
});
const meta = () => adminDb.collection("integrations").doc("grupo-avp");
const setCost = (value: string) => {
  source.values[1][AVP_SOURCE_HEADERS.indexOf("VALOR ASO")] = value;
};

describe("Sincronização AVP com persistência real no emulador", () => {
  it("publica a fila depois da gravação e deduplica execução concorrente", async () => {
    const results = await Promise.all([syncAvpSource(true, "a"), syncAvpSource(true, "b")]);
    expect(results.filter((r) => r.started)).toHaveLength(1);
    expect(source.reads).toBe(1);
    const data = await getAvpSnapshot();
    expect(data.items).toHaveLength(1);
    expect(data.status).toBe("CONNECTED");
    expect((await meta().collection("audit").get()).size).toBe(1);
  });
  it("preserva a última fonte válida quando o Google nega leitura", async () => {
    await syncAvpSource(true);
    const before = await getAvpSnapshot();
    await meta().set({ lastAttemptMs: 0 }, { merge: true });
    source.fail = true;
    await syncAvpSource(true);
    const after = await getAvpSnapshot();
    expect(after.items).toEqual(before.items);
    expect(after.revision).toBe(before.revision);
    expect(after.status).toBe("ERROR");
    expect(after.error).toContain("permissão");
  });
  it("não troca a versão publicada quando um lote falha", async () => {
    await syncAvpSource(true);
    const before = await getAvpSnapshot();
    await meta().set({ lastAttemptMs: 0 }, { merge: true });
    setCost("55");
    const spy = vi
      .spyOn(Object.getPrototypeOf(adminDb.batch()), "commit")
      .mockRejectedValueOnce(new Error("Synthetic write failure"));
    try {
      const result = await syncAvpSource(true);
      expect(result).toHaveProperty("error");
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    const after = await getAvpSnapshot();
    expect(after.revision).toBe(before.revision);
    expect(after.items[0].valorAso).toBe("45");
  });
  it("grava edição compartilhada e recusa versão desatualizada", async () => {
    await syncAvpSource(true);
    const before = await getAvpSnapshot();
    const changes = [{ id: before.items[0].id, fields: { valorAso: "35" } }];
    await patchAvpQueue(before.revision, changes, "operator");
    expect((await getAvpSnapshot()).items[0].valorAso).toBe("35");
    await expect(patchAvpQueue(before.revision, changes, "other")).rejects.toThrow("CONFLICT");
    const audit = await meta().collection("audit").where("action", "==", "QUEUE_EDIT").get();
    expect(audit.docs[0].data().changes).toEqual([
      { id: before.items[0].id, fields: ["valorAso"] },
    ]);
  });
  it("sinaliza conflito quando a fonte e a edição mudam o mesmo campo", async () => {
    await syncAvpSource(true);
    const before = await getAvpSnapshot();
    await patchAvpQueue(
      before.revision,
      [{ id: before.items[0].id, fields: { valorAso: "35" } }],
      "operator"
    );
    await meta().set({ lastAttemptMs: 0 }, { merge: true });
    setCost("42");
    await syncAvpSource(true);
    const after = await getAvpSnapshot();
    expect(after.items[0].valorAso).toBe("42");
    expect(after.conflicts).toEqual([{ id: before.items[0].id, field: "valorAso" }]);
  });
  it("rejeita alteração de identidade, status vazio ou inválido e IDs duplicados", async () => {
    await syncAvpSource(true);
    const before = await getAvpSnapshot();
    const id = before.items[0].id;
    for (const changes of [
      [{ id, fields: { colaborador: "Outra pessoa" } }],
      [{ id, fields: { status: "INVENTADO" } }],
      [{ id, fields: { status: "" } }],
      [
        { id, fields: { valorAso: "35" } },
        { id, fields: { valorAso: "34" } },
      ],
    ])
      await expect(patchAvpQueue(before.revision, changes, "operator")).rejects.toThrow();
    expect((await getAvpSnapshot()).revision).toBe(before.revision);
  });
});
