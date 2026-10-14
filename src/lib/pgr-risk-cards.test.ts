import { expect, it } from "vitest";
import { withPgrRiskCards } from "./pgr-risk-cards";
import { parsePgrDocumentPages } from "./pgr-document-parser";
it("lê todas as fichas da mesma página preservando GHE, controles e classificação de cada ficha", () => {
  const pages = [
    {
      numero: 1,
      texto:
        "GHE: 01 - Produção\nPerigo/Fator de Risco Ruído Grupo Físico\nDescrição Exposição aos motores\nPrevenção e controle Protetor auditivo\nAvaliação de risco\nNível de Risco Moderado\nAções necessárias Conferir\nPerigo/Fator de Risco Calor Grupo Físico\nDescrição Trabalho junto ao forno\nPrevenção e controle Ventilação\nAvaliação de risco\nNível de Risco Alto\nAções necessárias Revisar\nGHE: 02 - Transporte\nPerigo/Fator de Risco Colisão Grupo Acidentes\nDescrição Condução de veículos\nAvaliação de risco\nNível de Risco Alto",
    },
  ];
  const result = parsePgrDocumentPages(pages);
  expect(
    result.riscosIdentificados.map((risk) => [
      risk.agente,
      risk.setorGhe,
      risk.classificacaoOriginal,
      risk.controlesDocumentados,
    ])
  ).toEqual([
    ["Ruído", "GHE: 01 - Produção", "Moderado", ["Protetor auditivo"]],
    ["Calor", "GHE: 01 - Produção", "Alto", ["Ventilação"]],
    ["Colisão", "GHE: 02 - Transporte", "Alto", []],
  ]);
});

it("uma ficha incompleta não torna a extração parcial autoritativa para a página inteira", () => {
  const pages = withPgrRiskCards([
    {
      numero: 1,
      texto:
        "GHE: 01 - Produção\nPerigo/Fator de Risco Ruído Grupo Físico\nDescrição Operação dos motores\nAvaliação de risco\nNível de Risco Moderado\nPerigo/Fator de Risco Calor\nDescrição Operação junto ao forno",
    },
  ]);
  expect(pages[0].riscosTabela).toBeUndefined();
});
it("preserva perigo, grupo herdado, classificação e controles da ficha vertical", () => {
  const pages = withPgrRiskCards([
    { numero: 1, texto: "GES 02 - HIDROMETRIA\nDescrição do ambiente" },
    {
      numero: 2,
      texto:
        "Perigo/Fator de Risco Afogamento Grupo Acidente\nDescrição Atividades em rios\nPrevenção e controle\nEPI Colete salva vidas\nExposição\nAvaliação de risco\nSeveridade Crítica\nNível de\nRisco\nRisco Alto(PR2)\nAções necessárias Manter o colete",
    },
    {
      numero: 3,
      texto:
        "Perigo/Fator de Risco Grupo Ergonômico\nPostura em pé\nDescrição Trabalho em pé\nAvaliação de risco\nNível de Risco Moderado(PR3)\nAções necessárias Pausas",
    },
  ]);
  expect(pages[1].riscosTabela?.[0]).toMatchObject({
    agente: "Afogamento",
    categoria: "acidente",
    setorGhe: "GES 02 - HIDROMETRIA",
    classificacaoOriginal: "Risco Alto(PR2)",
    controlesDocumentados: ["EPI Colete salva vidas"],
  });
  expect(pages[2].riscosTabela?.[0].agente).toBe("Postura em pé");
  const result = parsePgrDocumentPages(pages);
  expect(result.riscosIdentificados).toHaveLength(2);
  expect(result.pgrCardDetalhado.ghesIdentificados).toContain("GES 02 - HIDROMETRIA");
});
it("não transforma instruções genéricas ou formulário vazio em risco", () => {
  expect(
    withPgrRiskCards([
      { numero: 1, texto: "Perigo/Fator de Risco\nGrupo\nDescrição\nAvaliação de risco" },
    ])[0].riscosTabela
  ).toBeUndefined();
});

it("não cria risco de benzeno a partir de instrução genérica de monitoramento", () => {
  const result = parsePgrDocumentPages([
    {
      numero: 26,
      texto:
        "4.4 CRITÉRIOS PARA MONITORAMENTO DA EXPOSIÇÃO\nPara Benzeno (se houver), seguir periodicidade.\nSe houver exposição a riscos críticos, revisar o inventário.",
    },
  ]);
  expect(result.riscosIdentificados).toEqual([]);
});
