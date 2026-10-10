import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  generate: vi.fn(),
  add: vi.fn(),
  get: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mocks.generate } }));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mocks.collection } }));
import { processarRelatorioSST } from "./sst-report-processor";
import { salvarLeadNai } from "./save-nai-lead";
import { AuthError } from "@/lib/auth/errors";
const report = {
  companyId: "client-a",
  title: "Visita técnica",
  content: "Observações verificadas durante a visita à unidade.",
};
const lead = {
  skillTitle: "Documentos",
  userText: "Preciso de uma proposta",
  aiResponse: "Solicite atendimento comercial.",
};
const analysis = {
  nivel_risco_geral: "Médio",
  resumo_executivo: "Revisão necessária.",
  acoes_imediatas_recomendadas: ["Conferir evidências."],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    uid: "engineer-1",
    role: "ENGINEER",
    tenantId: "client-a",
    servedCompanies: [],
  });
  mocks.collection.mockReturnValue({ doc: mocks.doc, add: mocks.add });
  mocks.doc.mockReturnValue({ get: mocks.get, collection: mocks.collection });
  mocks.get.mockResolvedValue({ exists: true });
  mocks.add.mockResolvedValue({ id: "saved-id" });
  mocks.generate.mockResolvedValue({ output: analysis });
});
describe("Persistência de relatórios SST", () => {
  it("nega cliente de outro tenant antes de ler dados ou chamar IA", async () => {
    await expect(
      processarRelatorioSST({ ...report, companyId: "client-b" }, "token")
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.collection).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejeita campos forjados de autoria", async () => {
    const result = await processarRelatorioSST(
      { ...report, authorId: "other" } as typeof report,
      "token"
    );
    expect(result.sucesso).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejeita cliente inexistente antes de gerar análise", async () => {
    mocks.get.mockResolvedValue({ exists: false });
    expect((await processarRelatorioSST(report, "token")).sucesso).toBe(false);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("salva autoria autenticada e revisão pendente na coleção do cliente", async () => {
    expect(await processarRelatorioSST(report, "private-token")).toMatchObject({
      sucesso: true,
      relatorioId: "saved-id",
      analise: analysis,
    });
    expect(mocks.doc).toHaveBeenCalledWith("client-a");
    expect(mocks.collection).toHaveBeenCalledWith("reports");
    expect(mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "engineer-1",
        companyId: "client-a",
        reviewStatus: "pending",
        content: report.content,
      })
    );
    expect(JSON.stringify(mocks.generate.mock.calls)).not.toContain("private-token");
  });
  it("não confirma sucesso nem expõe erro interno se a gravação falha", async () => {
    mocks.add.mockRejectedValue(new Error("database secret"));
    const result = await processarRelatorioSST(report, "token");
    expect(result.sucesso).toBe(false);
    expect(JSON.stringify(result)).not.toContain("database secret");
  });
  it("rejeita resposta inválida da IA sem gravar", async () => {
    mocks.generate.mockResolvedValue({ output: null });
    expect((await processarRelatorioSST(report, "token")).sucesso).toBe(false);
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
describe("Persistência de contatos comerciais", () => {
  it("exige autenticação antes de validar dados", async () => {
    mocks.auth.mockRejectedValue(new AuthError("Sem sessão", 401));
    await expect(salvarLeadNai(null as unknown as typeof lead)).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("rejeita tenant ou autor fornecido pelo cliente", async () => {
    expect(
      (await salvarLeadNai({ ...lead, ownerUid: "other" } as typeof lead, "token")).sucesso
    ).toBe(false);
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("associa contato ao usuário e tenant da sessão", async () => {
    expect(await salvarLeadNai(lead, "token")).toEqual({ sucesso: true });
    expect(mocks.add).toHaveBeenCalledWith(
      expect.objectContaining({ ...lead, ownerUid: "engineer-1", companyId: "client-a" })
    );
  });
  it("limita tamanho das mensagens antes da gravação", async () => {
    expect((await salvarLeadNai({ ...lead, userText: "a".repeat(4001) }, "token")).sucesso).toBe(
      false
    );
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("retorna falha se a persistência falha", async () => {
    mocks.add.mockRejectedValue(new Error("secret"));
    expect(await salvarLeadNai(lead, "token")).toEqual({
      sucesso: false,
      erro: "Não foi possível salvar a conversa.",
    });
  });
});
