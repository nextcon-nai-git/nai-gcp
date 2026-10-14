import { describe, expect, it } from "vitest";
import {
  CLINICAL_LINE_CODES,
  clinicalEngine,
  type ClinicalLineCode,
  type DadosPaciente,
} from "./engine";

const clinicalDecision =
  /metformina|farmacoterapia|iniciar|prescrever|proceder com cirurgia|rastreio negativo|remissão clínica|peso adequado|desenvolvimento adequado|sem indicação de rastreio|baixo risco|elegível|monoterapia/i;

const completeInputs: Array<{ code: ClinicalLineCode; data: DadosPaciente }> = [
  { code: "saude_mental", data: { phq9: Array(9).fill(3), gad7: Array(7).fill(3) } },
  { code: "diabetes", data: { glicemia_jejum: 135, hba1c: 7.1 } },
  { code: "hipertensao", data: { pas: 145, pad: 90 } },
  { code: "climaterio", data: { mrs_escore: 20 } },
  { code: "cirurgia", data: { asa_score: 2 } },
  { code: "prep_pep", data: { exposicao_72h: true, risco_continuo: true } },
  { code: "obesidade", data: { peso: 85, altura: 1.55 } },
  { code: "neoplasias", data: { idade: 60, sexo: "F" } },
  { code: "idoso", data: { katz_score: 2 } },
  { code: "gestacao_risco", data: { fatores_risco_gestacional: ["fator declarado"] } },
  { code: "gestacao", data: { idade_gestacional_semanas: 8 } },
  { code: "puerperio", data: { epds_score: 15 } },
  { code: "puericultura", data: { percentil_peso: 2 } },
  { code: "reumatologia", data: { das28_score: 6 } },
];

describe("clinical summaries remain unvalidated", () => {
  it.each(completeInputs)(
    "does not turn supplied values into a decision in $code",
    ({ code, data }) => {
      const [result] = clinicalEngine.avaliarPaciente({ ...data, linhas_ativadas: [code] });
      expect(result).toMatchObject({
        codigo: code,
        inputValidity: "VALID",
        clinicallyValidated: false,
        reviewRequired: true,
        reportedData: data,
      });
      expect(`${result.escore} ${result.conduta}`).not.toMatch(clinicalDecision);
    }
  );

  it("keeps the former medication and surgical-release examples as reported measurements", () => {
    const results = clinicalEngine.avaliarPaciente({
      glicemia_jejum: 135,
      hba1c: 7.1,
      asa_score: 2,
      linhas_ativadas: ["diabetes", "cirurgia"],
    });
    expect(results.map((result) => result.escore)).toEqual([
      "Glicemia informada: 135 mg/dL | HbA1c informada: 7.1%",
      "ASA informado: 2",
    ]);
    expect(results.every((result) => result.reviewRequired && !result.clinicallyValidated)).toBe(
      true
    );
  });

  it.each([
    { code: "saude_mental", data: { phq9: Array(9).fill(0), gad7: Array(7).fill(0) } },
    { code: "diabetes", data: { glicemia_jejum: 90, hba1c: 5 } },
    { code: "hipertensao", data: { pas: 120, pad: 80 } },
    { code: "obesidade", data: { peso: 60, altura: 1.7 } },
    { code: "neoplasias", data: { idade: 20, sexo: "M" } },
    { code: "gestacao_risco", data: { fatores_risco_gestacional: [] } },
    { code: "prep_pep", data: { exposicao_72h: false, risco_continuo: false } },
    { code: "puericultura", data: { percentil_peso: 50 } },
    { code: "reumatologia", data: { das28_score: 1 } },
  ])("does not infer absence of disease or risk in $code", ({ code, data }) => {
    const result = clinicalEngine.linhas_disponiveis[code].avaliar(data);
    expect(result.inputValidity).toBe("VALID");
    expect(result.reportedData).toEqual(data);
    expect(`${result.escore} ${result.conduta}`).not.toMatch(clinicalDecision);
    expect(result.clinicallyValidated).toBe(false);
  });

  it("keeps missing, null and partial inputs distinct without normal defaults", () => {
    const missing = clinicalEngine.linhas_disponiveis.diabetes.avaliar({});
    const partial = clinicalEngine.linhas_disponiveis.diabetes.avaliar({ glicemia_jejum: 135 });
    const explicitNull = clinicalEngine.linhas_disponiveis.diabetes.avaliar({
      glicemia_jejum: 135,
      hba1c: null,
    });
    expect(missing.reportedData).toEqual({});
    expect(partial.reportedData).toEqual({ glicemia_jejum: 135 });
    expect(explicitNull.reportedData).toEqual({ glicemia_jejum: 135, hba1c: null });
    for (const result of [missing, partial, explicitNull]) {
      expect(result).toMatchObject({
        escore: "Não avaliado",
        inputValidity: "INCOMPLETE_OR_INVALID",
        clinicallyValidated: false,
        reviewRequired: true,
      });
    }
  });

  it("preserves literal narrative, negation, zero scores, empty lists and explicit false", () => {
    const relato = "Nega hipertensão; HAS apenas em familiar. Ainda sem avaliação médica.";
    const results = clinicalEngine.avaliarPaciente({
      relato,
      epds_score: 0,
      fatores_risco_gestacional: [],
      exposicao_72h: false,
      risco_continuo: false,
      linhas_ativadas: ["puerperio", "gestacao_risco", "prep_pep"],
    });
    expect(results.map((result) => result.reportedData)).toEqual([
      { relato, epds_score: 0 },
      { relato, fatores_risco_gestacional: [] },
      { relato, exposicao_72h: false, risco_continuo: false },
    ]);
    expect(results[0].escore).toBe("EPDS: 0");
    expect(results[1].escore).toContain("lista vazia");
    expect(results[2].escore).toContain("informada: não");
  });

  it("retains the supplied PHQ-9 when GAD-7 was not supplied", () => {
    const phq9 = Array(9).fill(1);
    const result = clinicalEngine.linhas_disponiveis.saude_mental.avaliar({ phq9 });
    expect(result.escore).toBe("Não avaliado");
    expect(result.reportedData).toEqual({ phq9 });
    expect(result.reportedData).not.toHaveProperty("gad7");
  });

  it("calculates sums and BMI without a clinical classification", () => {
    expect(
      clinicalEngine.linhas_disponiveis.saude_mental.avaliar({
        phq9: Array(9).fill(2),
        gad7: Array(7).fill(1),
      }).escore
    ).toBe("PHQ-9: 18 | GAD-7: 7");
    expect(
      clinicalEngine.linhas_disponiveis.obesidade.avaliar({ peso: 85, altura: 1.55 }).escore
    ).toBe("IMC 35.4 (calculado com peso e altura informados)");
  });

  it.each([
    { phq9: [], gad7: Array(7).fill(0) },
    { phq9: Array(9), gad7: Array(7) },
    { phq9: Array(9).fill(0), gad7: Array(7) },
    { phq9: Array(9).fill(Infinity), gad7: Array(7).fill(0) },
    { phq9: Array(9).fill(NaN), gad7: Array(7).fill(0) },
    { phq9: Array(9).fill(0.5), gad7: Array(7).fill(0) },
    { phq9: Array(9).fill("0"), gad7: Array(7).fill(0) },
  ])("rejects non-finite, invalid or sparse questionnaire entries %#", (data) => {
    const result = clinicalEngine.linhas_disponiveis.saude_mental.avaliar(data);
    expect(result.inputValidity).toBe("INCOMPLETE_OR_INVALID");
    expect(result.escore).toBe("Não avaliado");
    expect(result.reportedData).toEqual(data);
  });

  it.each([
    { peso: NaN, altura: 1.7 },
    { peso: Infinity, altura: 1.7 },
    { peso: 75, altura: 0 },
    { peso: 75, altura: 1e-200 },
    { peso: 75, altura: 1e200 },
    { peso: 1e308, altura: 1e-100 },
    { peso: 1e308, altura: 1 },
    { peso: Number.MIN_VALUE, altura: 2 },
    { peso: 1e-100, altura: 1 },
  ])("rejects invalid BMI arithmetic including underflow and rounding overflow %#", (data) => {
    const result = clinicalEngine.linhas_disponiveis.obesidade.avaliar(data);
    expect(result.inputValidity).toBe("INCOMPLETE_OR_INVALID");
    expect(result.escore).toBe("Não avaliado");
    expect(result.reportedData).toEqual(data);
  });

  it.each([null, [], "dados", 42].map((value) => ({ value })))(
    "rejects a non-object root %#",
    ({ value }) => {
      expect(() => clinicalEngine.avaliarPaciente(value as unknown as DadosPaciente)).toThrow(
        "objeto JSON"
      );
    }
  );

  it.each(
    [undefined, null, "diabetes", ["constructor"], ["__proto__"], [null], Array(1)].map(
      (value) => ({ value })
    )
  )("rejects unknown, inherited or invalid line selections %#", ({ value }) =>
    expect(() => clinicalEngine.avaliarPaciente({ linhas_ativadas: value })).toThrow(
      "linhas_ativadas"
    )
  );

  it("keeps every unavailable line explicitly pending", () => {
    const results = clinicalEngine.avaliarPaciente({ linhas_ativadas: [...CLINICAL_LINE_CODES] });
    expect(results).toHaveLength(CLINICAL_LINE_CODES.length);
    expect(
      results.every(
        (result) =>
          result.escore === "Não avaliado" && result.reviewRequired && !result.clinicallyValidated
      )
    ).toBe(true);
  });
});
