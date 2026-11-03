// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth/errors";
import type { AuthContext } from "@/lib/auth/auth-context";
import { IMPORT_TEST_COMPANY, makeImportAnalysis } from "../../../../../tests/fixtures/nai-import";

const memory = vi.hoisted(() => {
  type Data = Record<string, unknown>;
  type Reference = {
    path: string;
    collection: (name: string) => { doc: (id?: string) => Reference };
    get: () => Promise<{ exists: boolean; data: () => Data | undefined }>;
    set: (value: Data, options?: { merge?: boolean }) => Promise<void>;
  };
  const documents = new Map<string, Data>();
  const auth = vi.fn();
  const generate = vi.fn();
  const afterRead = vi.fn();
  const batchSet = vi.fn();
  const batchCreate = vi.fn();
  const commit = vi.fn();
  const ref = (path: string): Reference => ({
    path,
    collection: (name) => ({ doc: (id = "history") => ref(`${path}/${name}/${id}`) }),
    get: async () => {
      const value = documents.get(path);
      const snapshot = value && structuredClone(value);
      afterRead(path);
      return { exists: snapshot !== undefined, data: () => snapshot };
    },
    set: async (value, options) => {
      documents.set(path, { ...(options?.merge ? documents.get(path) : {}), ...value });
    },
  });
  return {
    documents,
    auth,
    generate,
    afterRead,
    batchSet,
    batchCreate,
    commit,
    db: {
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      runTransaction: async (
        callback: (tx: {
          get: (reference: Reference) => ReturnType<Reference["get"]>;
          set: (reference: Reference, value: Data, options?: { merge?: boolean }) => Promise<void>;
        }) => Promise<unknown>
      ) =>
        callback({
          get: (reference) => reference.get(),
          set: (reference, ...args) => reference.set(...args),
        }),
      batch: () => ({ set: batchSet, create: batchCreate, commit }),
    },
  };
});
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: memory.auth }));
vi.mock("@/lib/auth/require-pgr-app-check", () => ({ requirePgrAppCheck: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: memory.db }));
vi.mock("@/services/pgr-ai-provider", () => ({ getPgrAi: () => ({ generate: memory.generate }) }));
import { GET, POST } from "./route";

const hash = "a".repeat(64);
const companyPath = `companies/${IMPORT_TEST_COMPANY.id}`;
const publicPath = `${companyPath}/pgr_cards/${hash}`;
const clinicalPath = `${companyPath}/clinical_records/import_${hash}`;
const reviewPath = `${clinicalPath}/agent_reviews/medico_trabalho`;
const input = {
  companyId: IMPORT_TEST_COMPANY.id,
  cardId: hash,
  role: "medico_trabalho",
};
const user: AuthContext = {
  uid: "synthetic-doctor",
  email: "doctor@example.test",
  role: "DOCTOR",
  tenantId: null,
  servedCompanies: [IMPORT_TEST_COMPANY.id],
  permissions: [],
};
const review = {
  resumo: "Revisão clínica sintética reservada",
  achados: [],
  checklist: ["Conferir o documento original"],
  encaminhamentos: [],
  limites: "Requer validação profissional",
};
const request = (method: "GET" | "POST") =>
  new NextRequest(
    "https://nai.test/api/pgr/agent-review" +
      (method === "GET" ? "?" + new URLSearchParams(input) : ""),
    {
      method,
      ...(method === "POST"
        ? { body: JSON.stringify(input), headers: { "Content-Type": "application/json" } }
        : {}),
    }
  );

beforeEach(() => {
  vi.resetAllMocks();
  memory.documents.clear();
  memory.auth.mockResolvedValue({ ...user });
  memory.generate.mockResolvedValue({ output: review });
  memory.documents.set(companyPath, IMPORT_TEST_COMPANY);
  memory.documents.set(publicPath, {
    companyId: IMPORT_TEST_COMPANY.id,
    sourceHash: hash,
    restricted: true,
  });
  memory.documents.set(clinicalPath, {
    companyId: IMPORT_TEST_COMPANY.id,
    sourceHash: hash,
    analysis: makeImportAnalysis("ASO"),
  });
  memory.documents.set(reviewPath, { review });
});

describe("revisões de documentos com autorização atual", () => {
  it.each(["carteira", "perfil clínico", "sessão"])(
    "não libera a revisão se perder %s durante a consulta",
    async (change) => {
      memory.afterRead.mockImplementation((path: string) => {
        if (path !== reviewPath) return;
        if (change === "sessão")
          memory.auth.mockRejectedValue(new AuthError("Sessão encerrada", 401));
        else
          memory.auth.mockResolvedValue(
            change === "carteira" ? { ...user, servedCompanies: [] } : { ...user, role: "ENGINEER" }
          );
      });
      const response = await GET(request("GET"));
      expect(response.status).toBe(change === "sessão" ? 401 : 403);
      expect(await response.text()).not.toContain(review.resumo);
    }
  );

  it.each(["carteira", "perfil clínico", "sessão"])(
    "não grava nem devolve a geração se perder %s enquanto a IA processa",
    async (change) => {
      memory.generate.mockImplementation(async () => {
        if (change === "sessão")
          memory.auth.mockRejectedValue(new AuthError("Sessão encerrada", 401));
        else
          memory.auth.mockResolvedValue(
            change === "carteira" ? { ...user, servedCompanies: [] } : { ...user, role: "ENGINEER" }
          );
        return { output: review };
      });
      const response = await POST(request("POST"));
      expect(response.status).toBe(change === "sessão" ? 401 : 403);
      expect(await response.text()).not.toContain(review.resumo);
      expect(memory.batchSet).not.toHaveBeenCalled();
      expect(memory.batchCreate).not.toHaveBeenCalled();
      expect(memory.commit).not.toHaveBeenCalled();
      expect(memory.documents.get(reviewPath)?.busyUntil).toBe(0);
    }
  );

  it("recusa uma origem que deixou de pertencer à empresa durante a geração", async () => {
    memory.generate.mockImplementation(async () => {
      memory.documents.set(clinicalPath, {
        ...memory.documents.get(clinicalPath),
        companyId: "other-synthetic-company",
      });
      return { output: review };
    });
    const response = await POST(request("POST"));
    expect(response.status).toBe(400);
    expect(memory.commit).not.toHaveBeenCalled();
  });

  it("confere novamente a identidade da empresa antes de salvar a revisão", async () => {
    memory.generate.mockImplementation(async () => {
      memory.documents.set(companyPath, {
        ...IMPORT_TEST_COMPANY,
        cnpj: "12.345.678/0001-95",
      });
      return { output: review };
    });
    const response = await POST(request("POST"));
    expect(response.status).toBe(409);
    expect(memory.commit).not.toHaveBeenCalled();
  });

  it("mantém leitura e histórico de rascunho quando o acesso continua válido", async () => {
    const read = await GET(request("GET"));
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ review, status: "draft" });
    const saved = await POST(request("POST"));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ review, status: "draft" });
    expect(memory.batchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: reviewPath }),
      expect.objectContaining({ review, status: "draft", createdBy: user.uid })
    );
    expect(memory.batchCreate).toHaveBeenCalledWith(
      expect.objectContaining({ path: `${clinicalPath}/agent_review_history/history` }),
      expect.objectContaining({ review, status: "draft", createdBy: user.uid })
    );
    expect(memory.commit).toHaveBeenCalledOnce();
  });
});
