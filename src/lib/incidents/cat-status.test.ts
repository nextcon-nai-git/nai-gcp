import { describe, expect, it } from "vitest";
import { getCatInfo } from "./cat-status";

describe("situação de CAT sem fatos inventados", () => {
  it("não infere morte, afastamento ou CAT de palavras no relato", () => {
    expect(
      getCatInfo({
        description: "Não houve fratura, morte ou afastamento.",
        type: "Quase acidente",
      })
    ).toMatchObject({
      severity: null,
      hasLeave: null,
      daysOfLeave: null,
      requiresCat: null,
      isCritical: false,
    });
  });
  it("não inventa 15 dias de afastamento nem prazo a partir da criação", () => {
    expect(
      getCatInfo({
        severity: "GRAVE",
        hasLeave: true,
        requiresCatS2210: true,
        createdAt: "2020-01-01",
      })
    ).toMatchObject({
      daysOfLeave: null,
      isExpired: false,
      label: "Prazo da CAT a confirmar",
    });
  });
  it("não aplica tolerância de quatro horas a óbito", () => {
    expect(getCatInfo({ severity: "FATAL", requiresCatS2210: true })).not.toHaveProperty(
      "deadlineTs"
    );
  });
  it("preserva valores registrados e diferencia recibo informado de emissão validada", () => {
    expect(getCatInfo({ catStatus: "EMITIDA", hasLeave: true, daysOfLeave: 4 })).toMatchObject({
      label: "Emissão informada — conferir recibo",
      daysOfLeave: 4,
    });
  });
  it("aceita apenas prazo registrado válido", () => {
    expect(
      getCatInfo({ requiresCatS2210: true, catDeadlineTimestamp: NaN }).deadlineTs
    ).toBeUndefined();
    expect(getCatInfo({ requiresCatS2210: true, catDeadlineTimestamp: 1000 }, 2000)).toMatchObject({
      isExpired: true,
      deadlineTs: 1000,
    });
  });
});
