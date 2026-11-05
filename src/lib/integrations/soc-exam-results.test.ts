import { describe, expect, it } from "vitest";
import { parseSocExamResults, summarizeSocExamResults } from "./soc-exam-results";

const row = {
  EMPRESA: "2306171",
  NOMEEMPRESA: "ASSOBES ENSINO SUPERIOR LTDA",
  DATAFICHA: "29/10/2026",
  DATARESULTADO: "29/10/2026",
  TIPOEXAME: "per",
  DATAEXAME: "29/10/2026",
  CODEXAME: "250",
  NOMEEXAME: "FALTA/ AUSÊNCIA",
  EXAMEALTERADO: "0",
  CPFMEDICOEXAMINADOR: "",
  NOMEMEDICOEXAMINADOR: "",
  CODIGOPRESTADOR: "404",
  NOMEPRESTADOR: "CLINICA HSE INTEGRATED - Mossoró/RN",
  UF: "RN",
  CIDADEPRESTADOR: "Mossoró",
};

describe("SOC exam result import", () => {
  it("deduplicates identical rows and classifies absences without linking a worker", () => {
    const parsed = parseSocExamResults([row, row]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.rows[0].derivedStatus).toBe("FALTA_AUSENCIA");
    expect(
      summarizeSocExamResults(parsed.rows, parsed.sourceRows, parsed.duplicates)
    ).toMatchObject({
      sourceRows: 2,
      uniqueRows: 1,
      duplicates: 1,
      absences: 1,
      realized: 0,
      reconciliationRequired: true,
    });
  });

  it("preserves a performed exam and altered flag", () => {
    const parsed = parseSocExamResults([
      {
        ...row,
        CODEXAME: "CLINICO 24",
        NOMEEXAME: "Avaliação Clínica Ocupacional",
        EXAMEALTERADO: "1",
      },
    ]);
    expect(parsed.rows[0].derivedStatus).toBe("REALIZADO");
    expect(summarizeSocExamResults(parsed.rows, 1, 0).altered).toBe(1);
  });
});
