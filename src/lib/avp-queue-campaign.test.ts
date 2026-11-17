import { describe, expect, it } from "vitest";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
import { countAdditionalCampaignExams } from "./avp-queue-campaign";

const cpfA = "52998224725";
const cpfB = "11144477735";
const person = (name: string, cpf: string, city = "Recife") => ["id", city, "PE", name, cpf];
const exam = (name: string, id = "q1") => ({
  ...AVP_TEST_ASOS[0],
  id,
  colaborador: name,
  tipoExame: "Periódico",
  cidade: "Recife",
  uf: "PE",
  dataPedidoIso: "2026-11-01",
});

describe("periódicos adicionais da campanha", () => {
  it("conta um exame por CPF, inclusive em dois vínculos ou municípios, e concilia o periódico da fila", () => {
    expect(
      countAdditionalCampaignExams(
        [exam("Helena Sá"), { ...exam("Pessoa B", "q2"), tipoExame: "Admissional" }],
        [
          person("HELENA SA", cpfA),
          person("Helena Sá", cpfA, "Carpina"),
          person("Pessoa B", cpfB),
          person("Pessoa B", cpfB),
        ]
      )
    ).toEqual({ additional: 1, pending: 0 });
  });
  it("preserva pedidos de outro ciclo ou município", () => {
    expect(
      countAdditionalCampaignExams(
        [{ ...exam("Pessoa A"), dataPedidoIso: "2025-10-01" }, exam("Pessoa B", "q2")],
        [person("Pessoa A", cpfA), person("Pessoa B", cpfB, "Carpina")]
      )
    ).toEqual({ additional: 2, pending: 0 });
  });
  it("separa homônimos, CPF inválido e pedidos ambíguos para conciliação", () => {
    expect(
      countAdditionalCampaignExams(
        [exam("Pessoa A")],
        [person("Pessoa A", cpfA), person("Pessoa A", cpfB), person("Pessoa C", "")]
      )
    ).toEqual({ additional: 0, pending: 3 });
    for (const queue of [
      [{ ...exam("Pessoa A"), dataPedidoIso: "" }],
      [exam("Pessoa A"), exam("Pessoa A", "q2")],
      [{ ...exam("Pessoa A"), uf: "BR" }],
    ]) {
      expect(countAdditionalCampaignExams(queue, [person("Pessoa A", cpfA)])).toEqual({
        additional: 0,
        pending: 1,
      });
    }
  });
});
