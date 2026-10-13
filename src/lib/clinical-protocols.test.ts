import { describe, expect, it } from "vitest";
import {
  evaluateAllCareLines,
  evaluateDiabetes,
  evaluateHipertensao,
  evaluatePrePosOperatorio,
  evaluateSaudeMental,
  evaluatePrEP_PEP,
  type ClinicalData,
} from "./clinical-protocols";

describe("legacy care-line adapter", () => {
  it("retains missing inputs as incomplete summaries instead of a negative screen", () => {
    const results = evaluateAllCareLines({});
    expect(results).toHaveLength(14);
    for (const result of results) {
      expect(result).toMatchObject({
        escore: "Não avaliado",
        inputValidity: "INCOMPLETE_OR_INVALID",
        clinicallyValidated: false,
        reviewRequired: true,
        reportedData: {},
      });
    }
  });

  it("never fills glucose, HbA1c or blood pressure values", () => {
    const data = [
      evaluateDiabetes({ glicemia_jejum: 135 }),
      evaluateDiabetes({ hba1c: 7.1 }),
      evaluateHipertensao({ pas: 145 }),
      evaluateHipertensao({ pad: 90 }),
      evaluateDiabetes({ glicemia_jejum: 135, hba1c: null } as unknown as ClinicalData),
    ];
    expect(data.map((result) => result.reportedData)).toEqual([
      { glicemia_jejum: 135 },
      { hba1c: 7.1 },
      { pas: 145 },
      { pad: 90 },
      { glicemia_jejum: 135, hba1c: null },
    ]);
    expect(data.every((result) => result.escore === "Não avaliado")).toBe(true);
  });

  it("preserves a partial questionnaire without manufacturing a second score", () => {
    const phq9 = Array(9).fill(0);
    const result = evaluateSaudeMental({ phq9 });
    expect(result.escore).toBe("Não avaliado");
    expect(result.reportedData).toEqual({ phq9 });
    expect(result.inputValidity).toBe("INCOMPLETE_OR_INVALID");
  });

  it("preserves identifiers and review flags for the former surgical-release output", () => {
    expect(evaluatePrePosOperatorio({ asa_score: 2 })).toMatchObject({
      id: "risco-cirurgico",
      iconType: "ClipboardList",
      escore: "ASA informado: 2",
      inputValidity: "VALID",
      clinicallyValidated: false,
      reviewRequired: true,
      reportedData: { asa_score: 2 },
    });
    expect(evaluatePrePosOperatorio({ asa_score: 2 }).conduta).not.toContain("Proceder");
  });

  it("preserves false and literal narrative without converting them into low risk", () => {
    const data = {
      exposicao_72h: false,
      risco_continuo: false,
      relato: "Exposição negada; contexto ainda sem avaliação.",
    };
    const result = evaluatePrEP_PEP(data);
    expect(result.reportedData).toEqual(data);
    expect(result.escore).not.toContain("Baixo Risco");
    expect(result.clinicallyValidated).toBe(false);
  });
});
