import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  getDoc: vi.fn(),
  getMetadata: vi.fn(),
  getBytes: vi.fn(),
  uploadBytes: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
  getDoc: mocks.getDoc,
  runTransaction: mocks.runTransaction,
  serverTimestamp: () => "server-time",
}));
vi.mock("firebase/storage", () => ({
  getBytes: mocks.getBytes,
  getMetadata: mocks.getMetadata,
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  uploadBytes: mocks.uploadBytes,
}));

import {
  ContractImportConfirmationPending,
  hashContractFile,
  integrateAnalyzedContract,
  preserveContractSource,
  type ContractSource,
} from "./integration";
import type { ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";

const result: ContractAnalysisOutput = {
  summary: "Resumo sintético",
  clientInfo: {
    name: "Cliente de teste",
    cnpj: "11.222.333/0001-81",
    segment: "Teste",
    riskDegree: 2,
    address: "Endereço sintético",
  },
  clauses: { rights: [], duties: [] },
  operationalTasks: [
    {
      title: "Tarefa sintética",
      description: "Descrição sintética",
      category: "pgr",
      frequency: "anual",
      checklist: ["Conferir evidência contratual"],
    },
  ],
};
const sourceHash = "5aea7a7a5e33d66d021fd52802ceb64ac5b8f377b2be55fddca8607f093ce3ce";
const source: ContractSource = {
  sha256: sourceHash,
  storagePath: `internos_nextcon/contract-sources/${sourceHash}`,
  generation: "4",
  sizeBytes: 18,
};
const company = {
  id: "legacy-company-id",
  name: "Nome cadastrado conferido",
  cnpj: "11.222.333/0001-81",
  active: true,
  isDeleted: false,
};
const pdf = new File(["%PDF-1.7\nsynthetic"], "contract.pdf", { type: "application/pdf" });
const persistedContract = {
  companyId: company.id,
  sourceHash,
  sourceStoragePath: source.storagePath,
  sourceGeneration: source.generation,
  sourceSizeBytes: source.sizeBytes,
  sourceConfirmed: true,
  sourceConfirmedBy: "reviewer",
  sourceConfirmedAt: "server-time",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMetadata.mockResolvedValue({
    contentType: "application/pdf",
    customMetadata: { sourceSha256: sourceHash },
    generation: source.generation,
    size: source.sizeBytes,
  });
  mocks.getBytes.mockResolvedValue(new TextEncoder().encode("%PDF-1.7\nsynthetic"));
  mocks.getDoc.mockImplementation(async (ref: { path: string }) => ({
    exists: () => true,
    data: () =>
      ref.path.startsWith("contract_import_sources/")
        ? { ...persistedContract, contractId: `source_${sourceHash}` }
        : persistedContract,
  }));
  mocks.runTransaction.mockImplementation(async (_db, callback) =>
    callback({
      get: async (ref: { path: string }) => {
        if (ref.path === `companies/${company.id}`) return { data: () => company };
        return { exists: () => false, data: () => undefined };
      },
      set: vi.fn(),
    })
  );
});

const integrate = (
  options: {
    companyId?: string;
    result?: ContractAnalysisOutput;
    sourceConfirmed?: boolean;
  } = {}
) =>
  integrateAnalyzedContract(
    {} as never,
    {} as never,
    options.result || result,
    options.companyId || company.id,
    source,
    "reviewer",
    options.sourceConfirmed ?? true
  );

describe("contract integration persistence", () => {
  it.each([
    { razaoSocial: "Razão social legada", expected: "Razão social legada" },
    { razaoSocial: "", expected: company.id },
  ])("preserves the legacy customer label $expected", async ({ razaoSocial, expected }) => {
    const writes: Record<string, unknown>[] = [];
    mocks.runTransaction.mockImplementationOnce(async (_db, callback) =>
      callback({
        get: async (ref: { path: string }) =>
          ref.path === `companies/${company.id}`
            ? { data: () => ({ ...company, name: undefined, razaoSocial }) }
            : { exists: () => false, data: () => undefined },
        set: (_ref: unknown, data: Record<string, unknown>) => writes.push(data),
      })
    );
    await integrate();
    expect(writes[1].companyName).toBe(expected);
    expect(writes[2].companyName).toBe(expected);
  });

  it("stops a source upload after session cancellation during the metadata lookup", async () => {
    let rejectRead!: (error: unknown) => void;
    mocks.getMetadata.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        })
    );
    const controller = new AbortController();
    const pending = preserveContractSource({} as never, pdf, sourceHash, controller.signal);
    await vi.waitFor(() => expect(rejectRead).toBeDefined());
    controller.abort();
    rejectRead({ code: "storage/object-not-found" });
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
  });
  it("does not start a transaction after session cancellation during source validation", async () => {
    let finish!: (bytes: Uint8Array) => void;
    mocks.getBytes.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const controller = new AbortController();
    const pending = integrateAnalyzedContract(
      {} as never,
      {} as never,
      result,
      company.id,
      source,
      "reviewer",
      true,
      controller.signal
    );
    controller.abort();
    finish(new TextEncoder().encode("%PDF-1.7\nsynthetic"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
  it("does not stage transaction writes or recovery reads after cancellation", async () => {
    const controller = new AbortController(),
      set = vi.fn();
    mocks.runTransaction.mockImplementationOnce(async (_db, callback) =>
      callback({
        get: async (ref: { path: string }) => {
          controller.abort();
          return ref.path === `companies/${company.id}`
            ? { data: () => company }
            : { exists: () => false };
        },
        set,
      })
    );
    await expect(
      integrateAnalyzedContract(
        {} as never,
        {} as never,
        result,
        company.id,
        source,
        "reviewer",
        true,
        controller.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(set).not.toHaveBeenCalled();
    expect(mocks.getDoc).not.toHaveBeenCalled();
  });
  it("derives a stable source hash from actual PDF contents", async () => {
    const retry = new File(["%PDF-1.7\nsynthetic"], "retry.pdf", { type: "application/pdf" });
    const changed = new File(["%PDF-1.7\ndifferent"], "contract.pdf", { type: "application/pdf" });

    expect(await hashContractFile(pdf)).toBe(await hashContractFile(retry));
    expect(await hashContractFile(pdf)).not.toBe(await hashContractFile(changed));
    await expect(hashContractFile(new File(["not a PDF"], "invalid.pdf"))).rejects.toThrow(
      /PDF válido/
    );
  });

  it("stores and verifies a private immutable source with its generation", async () => {
    mocks.getMetadata.mockRejectedValueOnce({ code: "storage/object-not-found" });
    mocks.uploadBytes.mockResolvedValue({});
    const digest = await hashContractFile(pdf);
    mocks.getMetadata.mockResolvedValue({
      contentType: "application/pdf",
      customMetadata: { sourceSha256: digest },
      generation: "9",
      size: pdf.size,
    });
    mocks.getBytes.mockResolvedValue(new Uint8Array(await pdf.arrayBuffer()));

    await expect(preserveContractSource({} as never, pdf, digest)).resolves.toMatchObject({
      sha256: digest,
      storagePath: `internos_nextcon/contract-sources/${digest}`,
      generation: "9",
      sizeBytes: pdf.size,
    });
    expect(mocks.uploadBytes).toHaveBeenCalledOnce();
    expect(mocks.uploadBytes.mock.calls[0][2]).toMatchObject({
      contentType: "application/pdf",
      customMetadata: { sourceSha256: digest },
    });
  });

  it("writes only under the explicitly selected legacy company ID and omits invented task fields", async () => {
    const writes: { path: string; data: Record<string, unknown> }[] = [];
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async (ref: { path: string }) =>
          ref.path === `companies/${company.id}`
            ? { data: () => company }
            : { exists: () => false, data: () => undefined },
        set: (ref: { path: string }, data: Record<string, unknown>) =>
          writes.push({ path: ref.path, data }),
      })
    );

    await expect(integrate()).resolves.toMatchObject({
      companyId: company.id,
      contractId: `source_${sourceHash}`,
      created: true,
    });
    expect(writes.map(({ path }) => path)).toEqual([
      `contract_import_sources/${sourceHash}`,
      `companies/${company.id}/contracts/source_${sourceHash}`,
      `companies/${company.id}/tasks/source_${sourceHash}_task_0`,
    ]);
    expect(writes[0].data.companyId).toBe(company.id);
    expect(writes[1].data.companyName).toBe(company.name);
    expect(writes[1].data).toMatchObject({
      sourceConfirmed: true,
      sourceConfirmedBy: "reviewer",
      sourceStoragePath: source.storagePath,
      sourceGeneration: source.generation,
    });
    expect(writes[2].data).toMatchObject({
      dueDate: "",
      frequency: "anual",
      checklist: [{ id: "contract-0", text: "Conferir evidência contratual", checked: false }],
    });
    expect(writes[2].data).not.toHaveProperty("priority");
  });

  it("does not overwrite or reactivate a mismatched or archived company", async () => {
    for (const invalidCompany of [
      { ...company, cnpj: "11.222.333/0001-82" },
      { ...company, active: false },
      { ...company, isDeleted: true },
      { ...company, deletedAt: "2026-10-01T12:00:00Z" },
      { ...company, status: "archived" },
    ]) {
      const set = vi.fn();
      mocks.runTransaction.mockImplementationOnce(async (_db, callback) =>
        callback({
          get: async (ref: { path: string }) =>
            ref.path === `companies/${company.id}`
              ? { data: () => invalidCompany }
              : { exists: () => false },
          set,
        })
      );
      await expect(integrate()).rejects.toThrow();
      expect(set).not.toHaveBeenCalled();
    }
  });

  it("accepts alphanumeric CNPJ and rejects bad checksums or forged company IDs", async () => {
    mocks.runTransaction.mockClear();
    const alphanumeric = {
      ...result,
      clientInfo: { ...result.clientInfo, cnpj: "12.ABC.345/01DE-35" },
    };
    const alphaCompany = { ...company, cnpj: "12ABC34501DE35" };
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async (ref: { path: string }) =>
          ref.path === "companies/selected-company"
            ? { data: () => alphaCompany }
            : { exists: () => false },
        set: vi.fn(),
      })
    );
    mocks.getDoc.mockImplementation(async (ref: { path: string }) => ({
      exists: () => true,
      data: () =>
        ref.path.startsWith("contract_import_sources/")
          ? {
              ...persistedContract,
              companyId: "selected-company",
              contractId: `source_${sourceHash}`,
            }
          : { ...persistedContract, companyId: "selected-company" },
    }));
    await expect(
      integrateAnalyzedContract(
        {} as never,
        {} as never,
        alphanumeric,
        "selected-company",
        source,
        "reviewer",
        true
      )
    ).resolves.toMatchObject({ companyId: "selected-company" });
    await expect(
      integrateAnalyzedContract(
        {} as never,
        {} as never,
        { ...result, clientInfo: { ...result.clientInfo, cnpj: "00000000000000" } },
        company.id,
        source,
        "reviewer",
        true
      )
    ).rejects.toThrow(/validar/);
  });

  it("does not write again for an identical registry replay", async () => {
    const set = vi.fn();
    const registry = {
      ...persistedContract,
      contractId: `source_${sourceHash}`,
    };
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async (ref: { path: string }) => {
          if (ref.path === `companies/${company.id}`) return { data: () => company };
          return {
            exists: () => true,
            data: () => (ref.path.startsWith("contract_import_sources/") ? registry : registry),
          };
        },
        set,
      })
    );

    await expect(integrate()).resolves.toMatchObject({ created: false });
    expect(set).not.toHaveBeenCalled();
  });

  it("reports a read-after-write failure as pending confirmation", async () => {
    mocks.getDoc.mockRejectedValue(new Error("read failed"));
    await expect(integrate()).rejects.toBeInstanceOf(ContractImportConfirmationPending);
  });

  it("confirms a transaction timeout by rereading its committed source and contract", async () => {
    const registry = { ...persistedContract, contractId: `source_${sourceHash}` };
    mocks.runTransaction.mockRejectedValue(new Error("connection lost after commit"));
    mocks.getDoc.mockImplementation(async (ref: { path: string }) => ({
      exists: () => true,
      data: () => (ref.path.startsWith("contract_import_sources/") ? registry : persistedContract),
    }));

    await expect(integrate()).resolves.toMatchObject({ created: false });
  });

  it("requires explicit review confirmation before starting persistence", async () => {
    await expect(integrate({ sourceConfirmed: false })).rejects.toThrow(/confirme/);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
});
