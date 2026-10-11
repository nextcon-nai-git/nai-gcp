// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMPORT_TEST_COMPANY, makeImportAnalysis } from "../../tests/fixtures/nai-import";
import type { AuthContext } from "@/lib/auth/auth-context";
import type { PgrAnalysisOutput } from "@/lib/pgr-schema";

const memory = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Write = { path: string; data: Data; merge: boolean; create: boolean };
  type Snapshot = {
    id: string;
    exists: boolean;
    data: () => Data | undefined;
    ref: Reference;
  };
  type Reference = {
    path: string;
    id: string;
    collection: (name: string) => Collection;
    get: () => Promise<Snapshot>;
    set: (data: Data, options?: { merge?: boolean }) => Promise<void>;
  };
  type Collection = {
    doc: (id?: string) => Reference;
    select: (...fields: string[]) => Collection;
    limit: (count: number) => Collection;
    orderBy: (field: string, direction: string) => Collection;
    get: () => Promise<{ docs: Snapshot[]; size: number; empty: boolean }>;
  };
  const records = new Map<string, Data>();
  const reads: string[] = [];
  const uploadPaths: string[] = [];
  let nextId = 0;
  let tail = Promise.resolve();
  const upload = vi.fn();
  const analyze = vi.fn();
  function snapshot(path: string): Snapshot {
    const value = records.get(path);
    return {
      id: path.split("/").at(-1)!,
      exists: value !== undefined,
      data: () => (value === undefined ? undefined : structuredClone(value)),
      ref: document(path),
    };
  }
  function document(path: string): Reference {
    return {
      path,
      id: path.split("/").at(-1)!,
      collection: (name: string) => collection(`${path}/${name}`),
      get: async () => {
        reads.push(path);
        return snapshot(path);
      },
      set: async (data: Data, options?: { merge?: boolean }) => {
        apply(records, { path, data, merge: !!options?.merge, create: false });
      },
    };
  }
  function collection(path: string, limit = Infinity): Collection {
    return {
      doc: (id = `auto_${++nextId}`) => document(`${path}/${id}`),
      select: () => collection(path, limit),
      limit: (count: number) => collection(path, count),
      orderBy: () => collection(path, limit),
      get: async () => {
        reads.push(path);
        const docs = [...records.keys()]
          .filter(
            (key) =>
              key.startsWith(`${path}/`) && key.split("/").length === path.split("/").length + 1
          )
          .slice(0, limit)
          .map(snapshot);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  function apply(target: Map<string, Data>, write: Write) {
    if (write.create && target.has(write.path)) throw new Error("Document already exists");
    const old = target.get(write.path) || {};
    const next = write.merge ? structuredClone(old) : {};
    for (const [key, value] of Object.entries(write.data)) {
      if (value && typeof value === "object" && "__arrayUnion" in value) {
        next[key] = [
          ...new Set([
            ...(Array.isArray(old[key]) ? old[key] : []),
            ...(value as { __arrayUnion: unknown[] }).__arrayUnion,
          ]),
        ];
      } else next[key] = structuredClone(value);
    }
    target.set(write.path, next);
  }
  function transaction<T>(
    callback: (tx: {
      get: (reference: ReturnType<typeof document>) => Promise<ReturnType<typeof snapshot>>;
      create: (reference: ReturnType<typeof document>, data: Data) => void;
      update: (reference: ReturnType<typeof document>, data: Data) => void;
      set: (
        reference: ReturnType<typeof document>,
        data: Data,
        options?: { merge?: boolean }
      ) => void;
    }) => Promise<T>
  ) {
    // Serialize transactions and apply writes atomically. Concurrent callers still
    // share the pre-upload window, exercising the transaction's duplicate check.
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    return (async () => {
      await previous;
      try {
        const writes: Write[] = [];
        const result = await callback({
          get: (reference) => reference.get(),
          create: (reference, data) =>
            writes.push({ path: reference.path, data, create: true, merge: false }),
          update: (reference, data) =>
            writes.push({ path: reference.path, data, create: false, merge: true }),
          set: (reference, data, options) =>
            writes.push({ path: reference.path, data, create: false, merge: !!options?.merge }),
        });
        const after = new Map(records);
        writes.forEach((write) => apply(after, write));
        records.clear();
        after.forEach((data, path) => records.set(path, data));
        return result;
      } finally {
        release();
      }
    })();
  }
  return {
    records,
    reads,
    uploadPaths,
    upload,
    analyze,
    db: { collection, runTransaction: transaction },
    reset: () => {
      records.clear();
      reads.length = 0;
      uploadPaths.length = 0;
      nextId = 0;
      tail = Promise.resolve();
    },
  };
});

vi.mock("@/lib/firebase-admin", () => ({ adminDb: memory.db }));
vi.mock("@/firebase/config", () => ({ firebaseConfig: { storageBucket: "synthetic.test" } }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "server-timestamp",
    arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
  },
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        save: async (...args: unknown[]) => {
          memory.uploadPaths.push(path);
          return memory.upload(...args);
        },
      }),
    }),
  }),
}));
vi.mock("./pgr-document-analysis", () => ({ analyzePgrDocument: memory.analyze }));

import { getPgrRecords, preparePgrDraft, savePgrDraft } from "./pgr-workspace";

const user: AuthContext = {
  uid: "synthetic-admin",
  email: "synthetic@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const bytes = Buffer.from("%PDF-1.7\nSynthetic import document\n%%EOF");
const hash = createHash("sha256").update(bytes).digest("hex");
const draftId = "d".repeat(64);
const companyPath = `companies/${IMPORT_TEST_COMPANY.id}`;
const params = {
  draftId,
  companyId: IMPORT_TEST_COMPANY.id,
  createCompany: false,
  confirmed: true,
  dueDate: "2026-11-10",
};
function seed(analysis = makeImportAnalysis(), ownerUid = user.uid) {
  memory.records.set(`nai_importa_drafts/${draftId}`, {
    ownerUid,
    analysis,
    sourceHash: hash,
    mime: "application/pdf",
    fileName: "synthetic.pdf",
    expiresAtMs: Date.now() + 60000,
  });
}
function entries(prefix: string) {
  return [...memory.records.entries()].filter(([path]) => path.startsWith(`${prefix}/`));
}
beforeEach(() => {
  memory.reset();
  memory.upload.mockReset().mockResolvedValue(undefined);
  memory.analyze.mockReset();
  memory.records.set(companyPath, { ...IMPORT_TEST_COMPANY, reviewed: true });
  seed();
});

describe("NAI importa: gravação e reimportação", () => {
  it("persiste o draft só no servidor e informa autorização de cadastro de prestadores", async () => {
    memory.analyze.mockResolvedValue(makeImportAnalysis());
    const draft = await preparePgrDraft(user, bytes, "application/pdf", "synthetic.pdf");
    expect(draft.canRegisterProviders).toBe(true);
    expect(memory.records.get(`nai_importa_drafts/${draft.draftId}`)?.ownerUid).toBe(user.uid);
    expect(memory.analyze).toHaveBeenCalledWith(expect.objectContaining({ allowClinical: true }));
    expect(entries("users")).toHaveLength(0);
  });

  it("dois saves concorrentes geram uma importação; nova tentativa preserva revisão humana", async () => {
    const outcomes = await Promise.all([
      savePgrDraft(user, params, bytes),
      savePgrDraft(user, params, bytes),
    ]);
    expect(outcomes.map((item) => item.alreadySaved).sort()).toEqual([false, true]);
    expect(entries(`${companyPath}/pgr_cards`)).toHaveLength(1);
    expect(entries(`${companyPath}/audit_logs`)).toHaveLength(1);
    expect(entries("providers")).toHaveLength(1);
    expect(memory.reads.some((path) => path.includes("/clinical_records/"))).toBe(false);
    const [taskPath, task] = entries(`${companyPath}/tasks`)[0];
    memory.records.set(taskPath, {
      ...task,
      status: "doing",
      checklist: [{ text: "Revisão humana", checked: true }],
    });
    const uploaded = memory.upload.mock.calls.length;
    const repeat = await savePgrDraft(user, params, bytes);
    expect(repeat).toMatchObject({
      alreadySaved: true,
      checklistCount: 2,
      providerCount: 1,
      providerIds: ["12345678000195"],
    });
    expect(memory.records.get(taskPath)?.status).toBe("doing");
    expect(memory.records.get(taskPath)?.checklist).toEqual([
      { text: "Revisão humana", checked: true },
    ]);
    expect(memory.upload).toHaveBeenCalledTimes(uploaded);
  });

  it("reutiliza ID legado, preserva dados revisados e acrescenta apenas o vínculo e auditoria", async () => {
    const provider = {
      name: "Nome cadastral revisado",
      cnpj: "12.345.678/0001-95",
      specialty: "Especialidade revisada",
      active: false,
      servedCompanies: ["another-company"],
    };
    memory.records.set("providers/legacy-provider", provider);
    const saved = await savePgrDraft(user, params, bytes);
    expect(saved.providerIds).toEqual(["legacy-provider"]);
    expect(memory.records.get("providers/legacy-provider")).toEqual({
      ...provider,
      servedCompanies: ["another-company", IMPORT_TEST_COMPANY.id],
      updatedAt: "server-timestamp",
      modifiedBy: user.uid,
    });
    expect(entries("providers")).toHaveLength(1);
    expect(memory.records.get(`${companyPath}/provider_links/legacy-provider`)).toMatchObject({
      companyId: IMPORT_TEST_COMPANY.id,
      providerId: "legacy-provider",
    });
    expect(entries("users")).toHaveLength(0);
  });

  it("não cria prestadores quando a opção está desligada ou o usuário não é admin global", async () => {
    expect(
      (await savePgrDraft(user, { ...params, includeProviders: false }, bytes)).providerCount
    ).toBe(0);
    expect(entries("providers")).toHaveLength(0);
    memory.records.delete(`${companyPath}/pgr_cards/${hash}`);
    for (const [path] of entries(`${companyPath}/tasks`)) memory.records.delete(path);
    for (const [path] of entries(`${companyPath}/risks`)) memory.records.delete(path);
    const engineer: AuthContext = { ...user, role: "ENGINEER", tenantId: IMPORT_TEST_COMPANY.id };
    expect((await savePgrDraft(engineer, params, bytes)).providerCount).toBe(0);
    expect(entries("providers")).toHaveLength(0);
  });

  it("recusa duplicidade cadastral e falha de upload antes de confirmar novos dados", async () => {
    const identity = { cnpj: "12.345.678/0001-95", name: "Duplicado sintético" };
    memory.records.set("providers/duplicate-a", identity);
    memory.records.set("providers/duplicate-b", identity);
    await expect(savePgrDraft(user, params, bytes)).rejects.toMatchObject({ status: 409 });
    expect(memory.upload).not.toHaveBeenCalled();
    memory.records.delete("providers/duplicate-a");
    memory.records.delete("providers/duplicate-b");
    memory.upload.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(savePgrDraft(user, params, bytes)).rejects.toThrow("storage unavailable");
    expect(entries("providers")).toHaveLength(0);
    expect(entries(`${companyPath}/tasks`)).toHaveLength(0);
    expect(entries(`${companyPath}/pgr_cards`)).toHaveLength(0);
    expect((await savePgrDraft(user, params, bytes)).alreadySaved).toBe(false);
  });

  it("não cria duplicata se um prestador com ID legado surgir entre a prévia e a transação", async () => {
    memory.upload.mockImplementationOnce(async () => {
      memory.records.set("providers/concurrent-legacy", {
        name: "Prestador cadastrado simultaneamente",
        cnpj: "12.345.678/0001-95",
        servedCompanies: ["previous-company"],
      });
    });
    await expect(savePgrDraft(user, params, bytes)).rejects.toMatchObject({ status: 409 });
    expect(entries(`${companyPath}/pgr_cards`)).toHaveLength(0);
    expect(entries("providers")).toHaveLength(1);
    expect(memory.records.has("providers/12345678000195")).toBe(false);
    const saved = await savePgrDraft(user, params, bytes);
    expect(saved.providerIds).toEqual(["concurrent-legacy"]);
    expect(memory.records.get("providers/concurrent-legacy")?.servedCompanies).toEqual([
      "previous-company",
      IMPORT_TEST_COMPANY.id,
    ]);
  });

  it("bloqueia agente inconclusivo, classificação ambígua, outro tenant e arquivo trocado", async () => {
    const analysis = makeImportAnalysis();
    analysis.analiseAgente!.status = "indisponivel";
    seed(analysis);
    await expect(savePgrDraft(user, params, bytes)).rejects.toMatchObject({ status: 422 });
    analysis.analiseAgente!.status = "concluida";
    analysis.documento!.statusClassificacao = "ambiguo";
    seed(analysis);
    await expect(savePgrDraft(user, params, bytes)).rejects.toMatchObject({ status: 422 });
    seed();
    await expect(
      savePgrDraft({ ...user, role: "ENGINEER", tenantId: "other-company" }, params, bytes)
    ).rejects.toMatchObject({ status: 403 });
    await expect(savePgrDraft(user, params, Buffer.from("different bytes"))).rejects.toMatchObject({
      status: 400,
    });
    expect(memory.upload).not.toHaveBeenCalled();
    expect(entries(`${companyPath}/tasks`)).toHaveLength(0);
  });

  it("não cria cliente duplicado com CNPJ já cadastrado sob ID histórico", async () => {
    await expect(
      savePgrDraft(user, { ...params, createCompany: true }, bytes)
    ).rejects.toMatchObject({ status: 409 });
    expect(memory.upload).not.toHaveBeenCalled();
    expect(memory.records.get("companies/11222333000181")).toBeUndefined();
  });
});

describe("NAI importa: privacidade clínica", () => {
  function clinicalAnalysis(): PgrAnalysisOutput {
    const analysis = makeImportAnalysis("ASO");
    analysis.parecerTecnicoIA = "CLINICAL_CANARY";
    analysis.acoesCategorizadas[0].titulo = "CLINICAL_CANARY";
    analysis.acoesCategorizadas[0].checklist = ["CLINICAL_CANARY"];
    analysis.riscosIdentificados[0].evidencia.trecho = "CLINICAL_CANARY";
    return analysis;
  }

  it("não grava nomes, trechos ou resultados clínicos em cards, auditoria ou metadados gerais", async () => {
    const analysis = clinicalAnalysis();
    seed(analysis);
    memory.records.get(`nai_importa_drafts/${draftId}`)!.fileName = "CLINICAL_FILENAME.pdf";
    const result = await savePgrDraft(user, params, bytes);
    expect(result).toMatchObject({
      restricted: true,
      documentType: "ASO",
      taskCount: 1,
      checklistCount: 4,
      riskCount: 0,
    });
    const general = [...memory.records.entries()].filter(
      ([path]) =>
        !path.startsWith("nai_importa_drafts/") &&
        !path.startsWith(`${companyPath}/clinical_records/`)
    );
    expect(JSON.stringify(general)).not.toContain("CLINICAL_CANARY");
    expect(JSON.stringify(general)).not.toContain("CLINICAL_FILENAME");
    expect(memory.records.get(`${companyPath}/pgr_cards/${hash}`)?.analysis).toBeNull();
    expect(memory.records.get(`${companyPath}/clinical_records/import_${hash}`)?.analysis).toEqual(
      analysis
    );
    expect(memory.uploadPaths).toEqual([
      `clientes/${IMPORT_TEST_COMPANY.id}/prontuarios/importacoes/${hash}.pdf`,
    ]);
  });

  it("reidrata a análise só para clínicos e não consulta o detalhe ao listar para engenheiro", async () => {
    seed(clinicalAnalysis());
    await savePgrDraft(user, params, bytes);
    const engineer: AuthContext = { ...user, role: "ENGINEER", tenantId: IMPORT_TEST_COMPANY.id };
    memory.reads.length = 0;
    const publicHistory = await getPgrRecords(engineer, IMPORT_TEST_COMPANY.id);
    expect(publicHistory[0]).toMatchObject({ restricted: true, analysis: null });
    expect(memory.reads.some((path) => path.includes("/clinical_records/"))).toBe(false);
    expect(JSON.stringify(publicHistory)).not.toContain("CLINICAL_CANARY");
    const doctor: AuthContext = { ...engineer, role: "DOCTOR" };
    const privateHistory = await getPgrRecords(doctor, IMPORT_TEST_COMPANY.id);
    expect(privateHistory[0].analysis?.parecerTecnicoIA).toBe("CLINICAL_CANARY");
    expect((await savePgrDraft(user, params, bytes)).alreadySaved).toBe(true);
  });

  it("cadastro de cliente originado de ASO recebe só a identidade empresarial comprovada", async () => {
    const analysis = clinicalAnalysis();
    analysis.pgrCardDetalhado.enderecoCompleto = "CLINICAL_CANARY";
    memory.records.delete(companyPath);
    seed(analysis);
    const saved = await savePgrDraft(user, { ...params, createCompany: true }, bytes);
    const company = memory.records.get(`companies/${saved.companyId}`);
    expect(company).toMatchObject({
      name: IMPORT_TEST_COMPANY.name,
      cnpj: IMPORT_TEST_COMPANY.cnpj,
    });
    expect(company).not.toHaveProperty("address");
    expect(JSON.stringify(company)).not.toContain("CLINICAL_CANARY");
  });

  it("nega save clínico e leitura fora do tenant antes de consultar o detalhe", async () => {
    seed(clinicalAnalysis());
    const engineer: AuthContext = { ...user, role: "ENGINEER", tenantId: IMPORT_TEST_COMPANY.id };
    await expect(savePgrDraft(engineer, params, bytes)).rejects.toMatchObject({ status: 403 });
    expect(memory.upload).not.toHaveBeenCalled();
    await expect(
      getPgrRecords(
        { ...engineer, role: "DOCTOR", tenantId: "other-company" },
        IMPORT_TEST_COMPANY.id
      )
    ).rejects.toMatchObject({ status: 403 });
  });
});
