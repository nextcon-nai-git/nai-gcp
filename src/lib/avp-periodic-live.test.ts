import { describe, expect, it } from "vitest";
import {
  adaptLiveCampaign,
  adaptLiveAccreditation,
  spreadsheetIdFromUrl,
} from "./avp-periodic-live";
import { CAMPAIGN_HEADERS } from "./avp-periodic-control";
import { periodicProgress } from "./avp-periodic-status";

describe("fontes vivas dos periódicos", () => {
  it("identifica colunas por cabeçalho, tolera colunas extras e conserva a linha original", () => {
    const headers = ["QUEM AGENDOU", ...CAMPAIGN_HEADERS.slice(0, -1).toReversed(), "Confirmação "];
    const row = headers.map((h) => (h === "Nome" ? "Pessoa sintética" : h === "ID" ? "42" : ""));
    const result = adaptLiveCampaign([["Título"], ["Orientações"], [], headers, row]);
    expect(result[1][0]).toBe("42");
    expect(result[1][3]).toBe("Pessoa sintética");
    expect(result[1][30]).toBe("5");
  });
  it("rejeita campanha vazia e cabeçalhos duplicados ou incompletos", () => {
    expect(() => adaptLiveCampaign([[], [], [], CAMPAIGN_HEADERS])).toThrow();
    expect(() => adaptLiveCampaign([[], [], [], [...CAMPAIGN_HEADERS, "Nome"], ["1"]])).toThrow();
    expect(() => adaptLiveCampaign([[], [], [], ["ID"], ["1"]])).toThrow();
  });
  it("não publica IDs duplicados que fariam registros diferentes compartilharem o mesmo card", () => {
    expect(() =>
      adaptLiveCampaign([[], [], [], CAMPAIGN_HEADERS.slice(0, -1), ["1"], ["1"]])
    ).toThrow("ID único");
  });
  const headers = [
    "#",
    "Cidade",
    "UF",
    "STATUS",
    "NOME DA CLÍNICA QUE TRABALHAMOS",
    "CONTATO",
    "VALOR ATUAL",
    "VALOR NEGOCIADO",
    "PRAZO DE PAGAMENTO",
    "AUTORIZADO PARA AGENDAMENTO E SINALIZADO A EQUIPE?",
    "OBSREVAÇÃO",
    "CNPJ SOC",
  ];
  it("prefere o negociado, conserva a referência atual e não inventa contrato", () => {
    const r = adaptLiveAccreditation(
      [
        ["Título"],
        headers,
        [
          "1",
          "Curitiba",
          "PR",
          "Pendente de contrato",
          "Clínica sintética",
          "",
          "80",
          "70",
          "30 dias",
          "Sim",
          "",
          "00000000000001",
        ],
      ],
      "2026-10-30T12:00:00Z"
    );
    expect(r.clinics[0].cents).toBe(7000);
    expect(r.clinics[0].notes).toContain("Valor atual: 80");
    expect(r.clinics[0].source).toContain("linha 3");
    expect(r.providers[1][10]).toBe("");
    expect(r.prices[1][4]).toBe("Credenciamento atual");
  });
  it("não substitui preço negociado ambíguo por outro preço nem atribui preço à clínica indefinida", () => {
    const r = adaptLiveAccreditation(
      [
        [],
        headers,
        ["1", "Curitiba", "PR", "", "Clínica", "", "40", "50 / 60"],
        ["2", "Recife", "PE", "", "", "", "70"],
      ],
      "2026-10-30T00:00:00Z"
    );
    expect(r.clinics.map((c) => c.cents)).toEqual([null, null]);
    expect(r.clinics[1].nome).toBe("Clínica a definir");
    expect(r.providers).toHaveLength(2);
  });
  it("rejeita municípios sem UF e identificadores duplicados", () => {
    expect(() => adaptLiveAccreditation([[], headers, ["1", "Curitiba", ""]], "")).toThrow();
    expect(() =>
      adaptLiveAccreditation([[], headers, ["1", "Curitiba", "PR"], ["1", "Recife", "PE"]], "")
    ).toThrow();
  });
  it.each([
    "http://docs.google.com/spreadsheets/d/aaaaaaaaaaaaaaaaaaaa/edit",
    "https://example.test/spreadsheets/d/aaaaaaaaaaaaaaaaaaaa/edit",
    "https://docs.google.com@evil.test/spreadsheets/d/aaaaaaaaaaaaaaaaaaaa/edit",
    "https://docs.google.com/document/d/aaaaaaaaaaaaaaaaaaaa/edit",
  ])("bloqueia URL fora do formato Google Sheets: %s", (url) =>
    expect(() => spreadsheetIdFromUrl(url)).toThrow()
  );
  it("extrai apenas o identificador sem parâmetros de compartilhamento", () =>
    expect(
      spreadsheetIdFromUrl(
        "https://docs.google.com/spreadsheets/d/aaaaaaaaaaaaaaaaaaaa/edit?usp=drivesdk"
      )
    ).toBe("aaaaaaaaaaaaaaaaaaaa"));
});
describe("quatro cores dos periódicos", () => {
  it.each([
    ["Não iniciado", "pending"],
    ["Não agendado", "pending"],
    ["Não realizado", "unknown"],
    ["Não recebido ASO", "unknown"],
    ["ASO não recebido", "unknown"],
    ["Sem ASO recebido", "unknown"],
    ["Em contato", "pending"],
    ["Agendado", "scheduled"],
    ["ASO recebido", "received"],
    ["Cancelado / N/A", "cancelled"],
    ["Faltou", "cancelled"],
    ["Faltas", "cancelled"],
    ["Não compareceu", "cancelled"],
    ["Aguardando ASO", "scheduled"],
    ["Situação nova", "unknown"],
  ])("classifica %s sem alterar o status original", (status, expected) =>
    expect(periodicProgress(status)).toBe(expected)
  );
  it("considera data de recebimento e sinaliza contradição com cancelamento", () => {
    expect(periodicProgress("Agendado", "30/10/2026")).toBe("received");
    expect(periodicProgress("Cancelado", "30/10/2026")).toBe("unknown");
    expect(periodicProgress("Agendado", "Não recebido")).toBe("scheduled");
  });
});
