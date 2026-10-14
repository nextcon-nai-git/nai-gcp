import { beforeEach, expect, it, vi } from "vitest";
import { processProviderMediaMessage } from "./whatsapp-agent-flow";
import { sendSimulatedProviderMediaMessage } from "@/actions/whatsapp-bot-actions";
const mock = vi.hoisted(() => ({ generate: vi.fn(), auth: vi.fn() }));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));
vi.mock("@/lib/auth/ai-action", () => ({
  requireAiAction: mock.auth,
  FINANCIAL_AI_ROLES: ["FINANCIAL"],
  CLINICAL_AI_ROLES: ["DOCTOR"],
}));
beforeEach(() => {
  mock.generate.mockReset();
  mock.auth.mockReset().mockResolvedValue({});
});

it("falha na leitura não inventa ASO, empresa, trabalhador ou conclusão de aptidão", async () => {
  mock.generate.mockRejectedValue(new Error("private provider details"));
  await expect(
    processProviderMediaMessage({
      mediaType: "image",
      imageBase64: "data:image/png;base64,aGVsbG8=",
    })
  ).rejects.toThrow("nenhum ASO foi homologado");
});

it("retorno válido não pode confirmar eSocial, pagamento ou protocolo sem gravação", async () => {
  mock.generate.mockResolvedValue({
    output: {
      company: "EMPRESA SINTÉTICA",
      employee: "PESSOA SINTÉTICA",
      examType: "Admissional",
      replyMessage: "ASO HOMOLOGADO; eSocial enviado; fatura liberada",
    },
  });
  const result = await processProviderMediaMessage({
    mediaType: "audio",
    textOrTranscript: "Documento recebido para conferência.",
  });
  expect(result.extractedData.fitnessStatus).toBe("NAO_INFORMADO");
  expect(result.extractedData.protocolNumber).toBe("");
  expect(result.extractedData.doctorCrm).toBeUndefined();
  expect(result.replyText).toContain("revisão profissional permanece pendente");
  expect(result.replyText).not.toContain("ASO HOMOLOGADO;");
});

it("mídia clínica é protegida por perfil clínico antes de chamar o leitor", async () => {
  mock.auth.mockRejectedValue(new Error("acesso negado"));
  await expect(sendSimulatedProviderMediaMessage({ mediaType: "image" }, "token")).rejects.toThrow(
    "acesso negado"
  );
  expect(mock.auth.mock.calls[0][1]).toEqual(["DOCTOR"]);
  expect(mock.generate).not.toHaveBeenCalled();
});
