import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/auth/ai-action", () => ({
  requireAiAction: mock.auth,
  CLINICAL_AI_ROLES: ["DOCTOR"],
}));
vi.mock("@/ai/genkit", () => ({ ai: { generate: mock.generate } }));
import { generateNtepContestation } from "./ntep-contestation-generator";
const input = {
  companyName: "Empresa sintética",
  cnae: "0000",
  employeeName: "Pessoa de teste",
  jobRole: "Assistente",
  cid: "Z00",
  workEnvironment: "Evidências pendentes de revisão",
};
beforeEach(() => {
  mock.auth.mockReset().mockResolvedValue({});
  mock.generate.mockReset();
});
describe("NTEP evidence boundary", () => {
  it("authenticates before generation", async () => {
    mock.auth.mockRejectedValue(new Error("denied"));
    await expect(generateNtepContestation(input)).rejects.toThrow("denied");
    expect(mock.generate).not.toHaveBeenCalled();
  });
  it("does not fabricate a petition or expose provider details on failure", async () => {
    mock.generate.mockRejectedValue(new Error("private clinical details"));
    await expect(generateNtepContestation(input)).rejects.toThrow("Nenhuma minuta foi gerada");
  });
  it("does not infer financial savings, success probability or missing clinical facts", async () => {
    mock.generate.mockResolvedValue({
      output: {
        caseTitle: "Minuta",
        successProbability: "ALTA",
        estimatedTaxSavings: 38400,
        primaryDefenseStrategy: "Revisar",
        legalGrounds: [],
        technicalArguments: [],
        fullPetitionText: "Minuta para revisão",
      },
    });
    const result = await generateNtepContestation(input);
    expect(result).toMatchObject({ successProbability: "NAO_AVALIADA", estimatedTaxSavings: null });
    expect(mock.generate.mock.calls[0][0].prompt).toContain(
      "Não informado; não presumir normalidade"
    );
    expect(mock.generate.mock.calls[0][0].prompt).not.toContain("91/982");
  });
  it("requires case data and rejects malformed provider results", async () => {
    await expect(generateNtepContestation({ ...input, employeeName: "" })).rejects.toThrow(
      "Informe"
    );
    expect(mock.generate).not.toHaveBeenCalled();
    mock.generate.mockResolvedValue({ output: { fullPetitionText: "Incomplete" } });
    await expect(generateNtepContestation(input)).rejects.toThrow("Nenhuma minuta");
  });
});
