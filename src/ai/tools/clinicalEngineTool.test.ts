import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

const mocks = vi.hoisted(() => ({
  defineTool: vi.fn((_config: unknown, handler: unknown) => handler),
  warn: vi.fn(),
}));
vi.mock("@/ai/genkit", () => ({ ai: { defineTool: mocks.defineTool } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn } }));

import { clinicalEngine } from "@/services/clinical-rules/engine";
import {
  ClinicalSummaryOutputSchema,
  PatientDataSchema,
  evaluateClinicalLinesTool,
} from "./clinicalEngineTool";

type ToolOutput = z.infer<typeof ClinicalSummaryOutputSchema>;
const callTool = evaluateClinicalLinesTool as unknown as (input: unknown) => Promise<ToolOutput>;

beforeEach(() => mocks.warn.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("clinical summary tool boundary", () => {
  it("does not fabricate identity or measurements when fields are missing", async () => {
    const result = await callTool({ glicemia_jejum: 135, linhas_ativadas: ["diabetes"] });
    expect(result.status).toBe("PRELIMINARY");
    if (result.status !== "PRELIMINARY") throw new Error("Expected a preliminary result");
    expect(result.paciente).toEqual({});
    expect(result.resultados_avaliacao[0]).toMatchObject({
      inputValidity: "INCOMPLETE_OR_INVALID",
      escore: "Não avaliado",
      reportedData: { glicemia_jejum: 135 },
      clinicallyValidated: false,
      reviewRequired: true,
    });
    expect(result.resultados_avaliacao[0].reportedData).not.toHaveProperty("hba1c");
    expect(ClinicalSummaryOutputSchema.safeParse(result).success).toBe(true);
  });

  it("retains the original narrative and never turns ASA into permission to operate", async () => {
    const relato = "Nega hipertensão; ASA foi informado sem avaliação nesta ferramenta.";
    const result = await callTool({ relato, asa_score: 2, linhas_ativadas: ["cirurgia"] });
    expect(result).toMatchObject({
      status: "PRELIMINARY",
      clinicallyValidated: false,
      reviewRequired: true,
      relato,
    });
    if (result.status !== "PRELIMINARY") throw new Error("Expected a preliminary result");
    expect(result.resultados_avaliacao[0].reportedData).toEqual({ relato, asa_score: 2 });
    expect(result.resultados_avaliacao[0].escore).toBe("ASA informado: 2");
    expect(result.resultados_avaliacao[0].conduta).not.toMatch(/proceder|liberado|cirurgia/i);
  });

  it("does not describe the summary as an official guideline or mandate repetition", () => {
    const config = mocks.defineTool.mock.calls[0][0] as {
      description: string;
      outputSchema: unknown;
    };
    expect(config.description).not.toMatch(/diretriz|oficia|exat|sempre use/i);
    expect(config.description).toContain("revisão profissional");
    expect(config.outputSchema).toBe(ClinicalSummaryOutputSchema);
  });

  it.each([
    { hba1c: null, linhas_ativadas: ["diabetes"] },
    { peso: Infinity, altura: 1.7, linhas_ativadas: ["obesidade"] },
    { linhas_ativadas: ["constructor"] },
  ])(
    "rejects invalid structured input without generating a substitute clinical opinion %#",
    async (input) => {
      expect(PatientDataSchema.safeParse(input).success).toBe(false);
      const result = await callTool(input);
      expect(result).toMatchObject({
        status: "UNAVAILABLE",
        clinicallyValidated: false,
        reviewRequired: true,
      });
      expect(result).not.toHaveProperty("resultados_avaliacao");
    }
  );

  it("returns a controlled failure and logs only a fixed code after an engine error", async () => {
    vi.spyOn(clinicalEngine, "avaliarPaciente").mockImplementationOnce(() => {
      throw new Error("Pessoa sintética confidencial, documento TEST-SECRET");
    });
    const result = await callTool({
      nome: "Pessoa sintética confidencial",
      linhas_ativadas: ["cirurgia"],
    });
    expect(result.status).toBe("UNAVAILABLE");
    expect(JSON.stringify(result)).not.toMatch(/confidencial|TEST-SECRET/);
    expect(mocks.warn).toHaveBeenCalledExactlyOnceWith("Resumo clínico indisponível", {
      code: "CLINICAL_SUMMARY_UNAVAILABLE",
    });
    expect(ClinicalSummaryOutputSchema.safeParse(result).success).toBe(true);
  });

  it("requires review flags and rejects added decision fields in the output contract", async () => {
    const result = await callTool({ asa_score: 2, linhas_ativadas: ["cirurgia"] });
    expect(
      ClinicalSummaryOutputSchema.safeParse({ ...result, clinicallyValidated: true }).success
    ).toBe(false);
    expect(
      ClinicalSummaryOutputSchema.safeParse({ ...result, reviewRequired: false }).success
    ).toBe(false);
    expect(ClinicalSummaryOutputSchema.safeParse({ ...result, aptidao: "APTO" }).success).toBe(
      false
    );
  });
});
