import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), prompt: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/ai/genkit", () => ({
  ai: {
    definePrompt: () => mocks.prompt,
    defineFlow: (_: unknown, fn: unknown) => fn,
    generate: mocks.generate,
  },
}));
import { requireAiAction, DOCUMENT_AI_ROLES, CLINICAL_AI_ROLES } from "./ai-action";
import { AuthError } from "./errors";
import { analyzeContract } from "@/ai/flows/contract-analysis-flow";
import { analyzeProviderContract } from "@/ai/flows/provider-contract-analysis-flow";
import { processDigitalAsoIngestion } from "@/ai/flows/aso-full-ingestion-flow";
import { classifyDocument } from "@/ai/flows/document-classifier-flow";
import { extractDocumentAutofillData } from "@/ai/flows/document-ocr-autofill-flow";
import { extractEmployeesFromText } from "@/ai/flows/employee-extraction-flow";
import { extractPpeSheetData } from "@/ai/flows/ppe-sheet-ocr-flow";
import { runComplianceAudit } from "@/ai/flows/compliance-auditor-flow";
import { processDataIntelligence } from "@/ai/flows/data-intelligence-agent-flow";
import { runEsocialCrossAudit } from "@/ai/flows/esocial-cross-audit-flow";
import { analyzeFieldInspectionPhoto } from "@/ai/flows/field-inspection-flow";
import { generateNtepContestation } from "@/ai/flows/ntep-contestation-generator";
import { processFiscalDocument } from "@/ai/flows/real-time-fiscal-flow";
import { analyzeSafetyReport } from "@/ai/flows/report-analysis-flow";

import { runKnowledgeAssistant } from "@/ai/flows/knowledge-assistant-flow";
import { generateNaiQuote } from "@/ai/flows/nai-quote-flow";
import { gerarOrcamentoComNai } from "@/actions/nai-quote";
import {
  sendSimulatedWhatsappMessage,
  sendSimulatedProviderMediaMessage,
} from "@/actions/whatsapp-bot-actions";
import { processarRelatorioSST } from "@/actions/sst-report-processor";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ uid: "admin", role: "ADMIN" });
});
describe("Autorização das ações de IA", () => {
  const actions = [
    runKnowledgeAssistant,
    generateNaiQuote,
    gerarOrcamentoComNai,
    sendSimulatedWhatsappMessage,
    sendSimulatedProviderMediaMessage,
    processarRelatorioSST,
    analyzeContract,
    analyzeProviderContract,
    processDigitalAsoIngestion,
    classifyDocument,
    extractDocumentAutofillData,
    extractEmployeesFromText,
    extractPpeSheetData,
    runComplianceAudit,
    processDataIntelligence,
    runEsocialCrossAudit,
    analyzeFieldInspectionPhoto,
    generateNtepContestation,
    processFiscalDocument,
    analyzeSafetyReport,
  ];
  it.each(actions.map((action) => [action.name, action] as const))(
    "%s rejeita sessão ausente antes de processar entrada ou chamar IA",
    async (_, action) => {
      mocks.auth.mockRejectedValue(new AuthError("Sessão ausente", 401));
      // Malformed payload deliberately verifies authorization precedes input processing.
      await expect((action as (input: unknown) => Promise<unknown>)(null)).rejects.toMatchObject({
        status: 401,
      });
      expect(mocks.prompt).not.toHaveBeenCalled();
      expect(mocks.generate).not.toHaveBeenCalled();
    }
  );
  it.each(["GUEST", "UNKNOWN", "PROVIDER"])("nega perfil %s", async (role) => {
    mocks.auth.mockResolvedValue({ role });
    await expect(requireAiAction("token", DOCUMENT_AI_ROLES, {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("impede RH de executar análise clínica", async () => {
    mocks.auth.mockResolvedValue({ role: "HR" });
    await expect(requireAiAction("token", CLINICAL_AI_ROLES, {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("limita a entrada mesmo quando autenticado", async () => {
    await expect(
      requireAiAction("token", DOCUMENT_AI_ROLES, "a".repeat(14_000_001))
    ).rejects.toMatchObject({ status: 400 });
  });
  it("envia a credencial apenas à autenticação, sem incluí-la no prompt", async () => {
    mocks.prompt.mockResolvedValue({ output: { summary: "Análise" } });
    await analyzeContract({ pdfDataUri: "data:application/pdf;base64,JVBERi0=" }, "private-token");
    expect(mocks.auth.mock.calls[0][0].headers.get("authorization")).toBe("Bearer private-token");
    expect(mocks.prompt).toHaveBeenCalledWith({
      pdfDataUri: "data:application/pdf;base64,JVBERi0=",
    });
  });
});
