// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePgrDocumentPages } from "@/lib/pgr-document-parser";
import type { AuthContext } from "@/lib/auth/auth-context";
import type { PgrAnalysisOutput } from "@/lib/pgr-schema";

const state = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
}));
vi.mock("@/lib/firebase-admin", () => {
  const record = (path: string): unknown => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => record(path + "/" + name + "/" + id) }),
    get: async () => {
      state.reads.push(path);
      return { exists: state.documents.has(path), data: () => state.documents.get(path) };
    },
  });
  return {
    adminDb: { collection: (name: string) => ({ doc: (id: string) => record(name + "/" + id) }) },
  };
});
import { loadNaiImportForReview } from "./nai-import-review";

const hash = "a".repeat(64);
const publicPath = `companies/company-a/pgr_cards/${hash}`;
const clinicalPath = `companies/company-a/clinical_records/import_${hash}`;
const input = { companyId: "company-a", cardId: hash, role: "medico_trabalho" as const };
const user: AuthContext = {
  uid: "synthetic-doctor",
  email: "doctor@example.test",
  role: "DOCTOR",
  tenantId: "company-a",
  permissions: [],
  servedCompanies: [],
};
const analysis: PgrAnalysisOutput = {
  ...parsePgrDocumentPages([{ numero: 1, texto: "Documento sintético" }]),
  documento: {
    tipo: "ASO",
    agenteResponsavel: "medico_trabalho",
    statusClassificacao: "identificado",
    evidencias: [],
    justificativa: "Atestado sintético",
    acesso: "clinico_restrito",
  },
};
beforeEach(() => {
  state.documents.clear();
  state.reads.length = 0;
  state.documents.set(publicPath, {
    companyId: "company-a",
    sourceHash: hash,
    restricted: true,
    analysis: null,
  });
  state.documents.set(clinicalPath, { companyId: "company-a", sourceHash: hash, analysis });
});

describe("NAI importa: revisão do responsável", () => {
  it("nega equipe operacional antes de carregar a análise clínica", async () => {
    await expect(
      loadNaiImportForReview({ ...user, role: "OPERATIONS" }, input)
    ).rejects.toMatchObject({ status: 403 });
    expect(state.reads).toEqual([publicPath]);
  });

  it("mantém as novas revisões dentro da coleção clínica protegida", async () => {
    const source = await loadNaiImportForReview(user, input);
    expect(source.ref.path).toBe(clinicalPath);
    expect(source.analysis.documento?.tipo).toBe("ASO");
  });

  it("recusa encaminhar documento médico a outro agente", async () => {
    await expect(
      loadNaiImportForReview(user, { ...input, role: "engenheiro_seguranca" })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("não reduz a proteção quando o envelope médico perder o marcador de acesso", async () => {
    state.documents.set(publicPath, {
      companyId: "company-a",
      sourceHash: hash,
      documentType: "ASO",
      analysis: null,
    });
    await expect(
      loadNaiImportForReview({ ...user, role: "OPERATIONS" }, input)
    ).rejects.toMatchObject({ status: 403 });
    expect(state.reads).toEqual([publicPath]);
  });

  it("recusa outra empresa antes de consultar qualquer documento", async () => {
    await expect(
      loadNaiImportForReview({ ...user, tenantId: "company-b" }, input)
    ).rejects.toMatchObject({ status: 403 });
    expect(state.reads).toEqual([]);
  });

  it("não aceita um vínculo de documento adulterado", async () => {
    state.documents.set(publicPath, { companyId: "company-b", sourceHash: hash, restricted: true });
    await expect(loadNaiImportForReview(user, input)).rejects.toMatchObject({ status: 400 });
    expect(state.reads).toEqual([publicPath]);
  });
});
