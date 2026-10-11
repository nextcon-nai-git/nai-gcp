import { describe, expect, it } from "vitest";
import { readPgrRiskTable, type PgrTextItem } from "./pgr-risk-table";
import { parsePgrDocumentPages, isPgrExposureEvidence } from "./pgr-document-parser";

function table(scale = 1, offset = 0) {
  const item = (str: string, x: number, y: number, width = 10): PgrTextItem => ({
    str,
    transform: [1, 0, 0, 1, x * scale + offset, y * scale],
    width: width * scale,
  });
  const labels = [
    "Tipo do",
    "Descrição do Perigo",
    "Relacionada ao Risco",
    "Circunstância",
    "Frequência e",
    "Prevenção Existentes",
    "Propagação",
    "Possíveis Agravos",
    "S",
    "P",
    "Nível",
    "Avaliação /",
    "Medidas de Prevenção Sugeridas",
  ];
  const left = [30, 80, 154, 227, 301, 360, 432, 475, 554, 575, 606, 631, 688];
  const out = [
    item("GHE: 01 - Escritório", 30, 540),
    ...labels.map((label, i) => item(label, left[i], 480)),
  ];
  function row(y: number, hazard: string, score: string[]) {
    const cells = [
      "Ergonômico",
      hazard,
      "Trabalho com computador",
      "Posição sentada",
      "Diariamente",
      "Cadeira ajustável",
      "Contato",
      "Desconforto",
      ...score,
      "Qualitativa",
      "Orientar pausas",
    ];
    cells.forEach((value, i) => out.push(item(value, left[i], y - (i % 2) * 5)));
  }
  row(430, "Postura sentada prolongada", ["2", "3", "6"]);
  row(360, "Exigência cognitiva (fator psicossocial)", ["–", "–", "A confirmar"]);
  out.push(item("Ausência de Riscos Químicos, Físicos e Biológicos", 30, 300));
  return out;
}

describe("inventário tabular por coordenadas", () => {
  it.each([
    [1, 0],
    [0.7, 20],
    [1.5, 50],
  ])("preserva linhas e S/P/nível em escala %s", (scale, offset) => {
    const rows = readPgrRiskTable(table(scale, offset));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      agente: "Postura sentada prolongada",
      setorGhe: "GHE: 01 - Escritório",
      classificacaoOriginal: "S=2; P=3; Nível=6",
      controlesDocumentados: ["Cadeira ajustável"],
    });
    expect(rows[1]).toMatchObject({
      categoria: "psicossocial",
      classificacaoOriginal: "A confirmar",
    });
  });
  it("não inventa colunas se o cabeçalho não for reconhecido", () => {
    expect(readPgrRiskTable(table().filter((x) => x.str !== "P"))).toEqual([]);
    expect(readPgrRiskTable(table().filter((x) => !x.str.startsWith("GHE:")))).toEqual([]);
  });
  it("usa evidência literal e mantém linhas distintas da mesma página", () => {
    const items = table();
    const pages = [
      {
        numero: 1,
        texto: items.map((x) => x.str).join("\n"),
        riscosTabela: readPgrRiskTable(items),
      },
    ];
    const out = parsePgrDocumentPages(pages);
    expect(out.riscosIdentificados).toHaveLength(2);
    expect(out.riscosIdentificados.every((r) => isPgrExposureEvidence(r.evidencia, pages))).toBe(
      true
    );
    expect(out.riscosIdentificados[0].classificacaoOriginal).toBe("S=2; P=3; Nível=6");
  });
  it.each([
    "5. Inventário de EPI's\nProteção contra ruído",
    "10. Avaliações Pontuais\nConforme o Inventário de Riscos, avaliar ruído, calor e agentes químicos",
  ])("não usa referência genérica como exposição", (texto) => {
    const pages = [{ numero: 1, texto }];
    expect(parsePgrDocumentPages(pages).riscosIdentificados).toEqual([]);
    expect(isPgrExposureEvidence({ pagina: 1, trecho: "ruído" }, pages)).toBe(false);
  });
  it("captura endereço multilinha e separa revisão de validade", () => {
    const result = parsePgrDocumentPages([
      {
        numero: 1,
        texto:
          "PGR\nEmissão: 01/09/2026\nREVISÃO:\n01/09/2028\nRazão Social CLIENTE SINTÉTICO\nCNPJ 43.776.491/0001-70\nEndereço (Sede)\nRua Exemplo, 100 - Centro - Curitiba/PR -\nCEP: 80000-000\nQuantidade Total de Funcionários\n20",
      },
    ]);
    expect(result.pgrCardDetalhado).toMatchObject({
      enderecoCompleto: "Rua Exemplo, 100 - Centro - Curitiba/PR - CEP: 80000-000",
      cidadeUf: "Curitiba/PR",
      dataEmissao: "01/09/2026",
      dataRevisao: "01/09/2028",
      dataValidade: "",
    });
  });
});

it("não associa riscos de dois GHEs da mesma página ao primeiro grupo", () => {
  const result = parsePgrDocumentPages([
    {
      numero: 1,
      texto:
        "Inventário de Riscos\nGHE: 01 - Escritório\nPostura sentada prolongada\nGHE: 02 - Campo\nExposição a ruído",
    },
  ]);
  expect(result.riscosIdentificados.map((r) => r.setorGhe)).toEqual([
    "GHE: 01 - Escritório",
    "GHE: 02 - Campo",
  ]);
});
