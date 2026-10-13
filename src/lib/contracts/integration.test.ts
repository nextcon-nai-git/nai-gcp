import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runTransaction: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
  runTransaction: mocks.runTransaction,
  serverTimestamp: () => "server-time",
}));

import { hashContractFile, integrateAnalyzedContract } from "./integration";
import type { ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";

const result: ContractAnalysisOutput = {
  summary: "Resumo sintético",
  clientInfo: {
    name: "Cliente de teste",
    cnpj: "12.345.678/0001-90",
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
      checklist: [],
    },
  ],
};
const sourceHash = "a".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("contract integration persistence", () => {
  it("derives the same source identity from the same file contents", async () => {
    const first = new File(["synthetic contract"], "first.pdf");
    const retry = new File(["synthetic contract"], "retry.pdf");
    const changed = new File(["different synthetic contract"], "first.pdf");

    expect(await hashContractFile(first)).toBe(await hashContractFile(retry));
    expect(await hashContractFile(first)).not.toBe(await hashContractFile(changed));
  });

  it("writes company, contract, and task atomically with stable IDs", async () => {
    const writes: { path: string; data: Record<string, unknown> }[] = [];
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => false }),
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          writes.push({ path: ref.path, data });
        },
      })
    );

    await expect(integrateAnalyzedContract({} as never, result, sourceHash)).resolves.toEqual({
      companyId: "12345678000190",
      created: true,
    });
    expect(writes.map(({ path }) => path)).toEqual([
      "companies/12345678000190",
      `companies/12345678000190/contracts/source_${sourceHash}`,
      `companies/12345678000190/tasks/source_${sourceHash}_task_0`,
    ]);
    expect(writes[2].data.contractId).toBe(`source_${sourceHash}`);
  });

  it("persists an extracted contract with no tasks without creating placeholder cards", async () => {
    const writes: { path: string }[] = [];
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => false }),
        set: (ref: { path: string }) => {
          writes.push({ path: ref.path });
        },
      })
    );

    await integrateAnalyzedContract({} as never, { ...result, operationalTasks: [] }, sourceHash);
    expect(writes.map(({ path }) => path)).toEqual([
      "companies/12345678000190",
      `companies/12345678000190/contracts/source_${sourceHash}`,
    ]);
  });

  it("does not recreate a contract or its tasks when the source was already integrated", async () => {
    const set = vi.fn();
    mocks.runTransaction.mockImplementation(async (_db, callback) =>
      callback({
        get: async () => ({ exists: () => true }),
        set,
      })
    );

    await expect(integrateAnalyzedContract({} as never, result, sourceHash)).resolves.toEqual({
      companyId: "12345678000190",
      created: false,
    });
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects invalid source identity and CNPJ before persistence", async () => {
    await expect(integrateAnalyzedContract({} as never, result, "invalid")).rejects.toThrow(
      /identificar/
    );
    await expect(
      integrateAnalyzedContract(
        {} as never,
        { ...result, clientInfo: { ...result.clientInfo, cnpj: "123" } },
        sourceHash
      )
    ).rejects.toThrow(/CNPJ/);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("propagates persistence failures so the caller cannot show success", async () => {
    mocks.runTransaction.mockRejectedValue(new Error("transaction failed"));

    await expect(integrateAnalyzedContract({} as never, result, sourceHash)).rejects.toThrow(
      "transaction failed"
    );
  });
});
