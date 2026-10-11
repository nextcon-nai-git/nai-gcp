import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/ai-action", () => ({
  requireAiAction: mock.auth,
  CLINICAL_AI_ROLES: ["DOCTOR"],
  DOCUMENT_AI_ROLES: ["ENGINEER"],
}));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));
import { analyzeFieldInspectionPhoto } from "./field-inspection-flow";
import { runEsocialCrossAudit } from "./esocial-cross-audit-flow";
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({});
  mock.generate.mockRejectedValue(new Error("private provider details"));
});
it("does not fabricate inspection findings when generation fails", async () => {
  await expect(analyzeFieldInspectionPhoto({ notes: "Synthetic inspection" })).rejects.toThrow(
    "Nenhum achado"
  );
});
it("does not manufacture representative employees without source data", async () => {
  await expect(runEsocialCrossAudit({ companyName: "Synthetic company" })).rejects.toThrow(
    "Forneça dados"
  );
  expect(mock.generate).not.toHaveBeenCalled();
});
it("does not fabricate fines when the provider fails", async () => {
  await expect(
    runEsocialCrossAudit({
      companyName: "Synthetic company",
      employeesData: [
        { name: "Synthetic", cpf: "", role: "Test", sector: "Test", hazards: [], examsDone: [] },
      ],
    })
  ).rejects.toThrow("Nenhum resultado");
});
