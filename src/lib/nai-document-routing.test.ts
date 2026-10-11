import { describe, expect, it } from "vitest";
import {
  classifyNaiDocument,
  extractNaiProviders,
  withNaiDocumentWorkflow,
} from "./nai-document-routing";
import { parsePgrDocumentPages } from "./pgr-document-parser";
import { getNaiDocument, PgrAnalysisOutputSchema } from "./pgr-schema";

describe("NAI importa: classificação pelo conteúdo", () => {
  it.each([
    ["Programa de Gerenciamento de Riscos", "PGR", "engenheiro_seguranca", "sst"],
    ["Laudo Técnico das Condições Ambientais do Trabalho", "LTCAT", "engenheiro_seguranca", "sst"],
    [
      "Programa de Controle Médico de Saúde Ocupacional",
      "PCMSO",
      "medico_trabalho",
      "clinico_restrito",
    ],
    ["Atestado de Saúde Ocupacional", "ASO", "medico_trabalho", "clinico_restrito"],
    ["Laudo de Perícia Médica", "PERICIA_MEDICA", "medico_trabalho", "clinico_restrito"],
    ["Laudo médico-pericial", "PERICIA_MEDICA", "medico_trabalho", "clinico_restrito"],
    ["Avaliação Ergonômica Preliminar", "AEP", "ergonomista", "sst"],
    ["Análise Ergonômica do Trabalho", "AET", "ergonomista", "sst"],
    ["Levantamento ergonômico", "DADOS_ERGONOMICOS", "ergonomista", "sst"],
    ["ASO - admissional", "ASO", "medico_trabalho", "clinico_restrito"],
    ["PCMSO 2026", "PCMSO", "medico_trabalho", "clinico_restrito"],
  ])("encaminha %s ao especialista responsável", (title, tipo, agenteResponsavel, acesso) => {
    expect(classifyNaiDocument([{ numero: 1, texto: title }])).toMatchObject({
      tipo,
      agenteResponsavel,
      acesso,
      statusClassificacao: "identificado",
    });
  });

  it("não troca PGR por documentos citados em referências ou no índice", () => {
    const document = classifyNaiDocument([
      {
        numero: 1,
        texto: "PGR\nPrograma de Gerenciamento de Riscos\nConsultar PCMSO e ASO quando necessário.",
      },
      {
        numero: 2,
        texto: "SUMÁRIO\nPCMSO........................5\nAET........................12",
      },
      { numero: 3, texto: "Referências: ASO e Programa de Controle Médico de Saúde Ocupacional." },
    ]);
    expect(document).toMatchObject({
      tipo: "PGR",
      acesso: "sst",
      statusClassificacao: "identificado",
    });
  });

  it("sinaliza tipos concorrentes e mantém dados clínicos restritos", () => {
    expect(
      classifyNaiDocument([
        {
          numero: 1,
          texto:
            "Programa de Gerenciamento de Riscos\nPrograma de Controle Médico de Saúde Ocupacional",
        },
      ])
    ).toMatchObject({
      tipo: "OUTRO",
      agenteResponsavel: null,
      statusClassificacao: "ambiguo",
      acesso: "clinico_restrito",
    });
  });

  it("detecta anexo clínico apesar do título técnico principal", () => {
    expect(
      classifyNaiDocument([
        { numero: 1, texto: "PGR\nPrograma de Gerenciamento de Riscos" },
        { numero: 20, texto: "ANEXO CLÍNICO\nPaciente: Exemplo\nAnamnese: história individual." },
      ])
    ).toMatchObject({ tipo: "PGR", acesso: "clinico_restrito" });
  });
  it("preserva o PGR não clínico com quadro de documentos e orientações de sigilo", () => {
    const document = classifyNaiDocument([
      {
        numero: 1,
        texto:
          "Programa de Gerenciamento de Riscos\nA equipe deve consultar prontuário e anamnese apenas no ambiente clínico autorizado.",
      },
      {
        numero: 2,
        texto: "QUADRO DE DOCUMENTOS\nPGR\nPCMSO\nASO\nAET\nVerificar os documentos disponíveis.",
      },
    ]);
    expect(document).toMatchObject({
      tipo: "PGR",
      acesso: "sst",
      statusClassificacao: "identificado",
    });
  });
  it("não deixa lista de documentos vinculados apagar o título principal da mesma página", () => {
    expect(
      classifyNaiDocument([
        {
          numero: 1,
          texto:
            "PGR\nPrograma de Gerenciamento de Riscos\nDocumentos vinculados:\nPCMSO\nASO\nAET",
        },
      ])
    ).toMatchObject({ tipo: "PGR", acesso: "sst", statusClassificacao: "identificado" });
  });
  it("não confunde diagnóstico ergonômico com informação clínica individual", () => {
    const document = classifyNaiDocument([
      {
        numero: 1,
        texto:
          "AET\nAnálise Ergonômica do Trabalho\nDiagnóstico: organização do trabalho e altura inadequada da bancada.\nConsultar prontuário apenas por médico quando necessário.",
      },
    ]);
    expect(document).toMatchObject({
      tipo: "AET",
      acesso: "sst",
      agenteResponsavel: "ergonomista",
    });
  });

  it("não inventa tipo nem especialista para conteúdo vazio ou alheio à SST", () => {
    for (const texto of ["", "Pedido de compra de equipamentos de informática"]) {
      expect(classifyNaiDocument([{ numero: 1, texto }])).toMatchObject({
        tipo: "OUTRO",
        agenteResponsavel: null,
        statusClassificacao: "nao_identificado",
      });
    }
  });

  it("mantém análises legadas legíveis sem alterar sua versão", () => {
    const legacy = parsePgrDocumentPages([{ numero: 1, texto: "PGR" }]);
    expect(legacy.documento).toBeUndefined();
    expect(PgrAnalysisOutputSchema.parse(legacy).leitura.versao).toBe("pgr-evidence-v1");
    expect(getNaiDocument(legacy).tipo).toBe("PGR");
  });
});

describe("NAI importa: prestadores e plano por documento", () => {
  it("separa contratante, elaborador e médico examinador sem transformar trabalhador em prestador", () => {
    const providers = extractNaiProviders([
      {
        numero: 1,
        texto:
          "ASO\nCLIENTE: CETESB\nCNPJ: 43.776.491/0001-70\n" +
          "EMPREGADO: PESSOA DO EXEMPLO\n" +
          "PRESTADORA: Clínica Ocupacional Exemplo\nCNPJ: 44.337.647/0001-89\nCidade/UF: São Paulo/SP\n" +
          "Médico examinador: Dra. Especialista Exemplo\nCRM-SP: 123456\n",
      },
    ]);
    expect(providers.map((provider) => provider.nome)).toEqual([
      "Clínica Ocupacional Exemplo",
      "Dra. Especialista Exemplo",
    ]);
    expect(providers[0]).toMatchObject({ cnpj: "44.337.647/0001-89", cidadeUf: "São Paulo/SP" });
    expect(providers[1].registroProfissional).toContain("123456");
    expect(providers[1].cnpj).toBe("");
    expect(
      providers.every((provider) => !provider.evidencias[0].trecho.includes("PESSOA DO EXEMPLO"))
    ).toBe(true);
  });

  it("não usa o CNPJ do cliente seguinte como credencial de prestador", () => {
    const providers = extractNaiProviders([
      {
        numero: 1,
        texto:
          "Responsável técnico: Engenheiro Exemplo\nCREA-SP: 123456\n" +
          "CLIENTE: CETESB\nCNPJ: 43.776.491/0001-70",
      },
    ]);
    expect(providers).toHaveLength(1);
    expect(providers[0].cnpj).toBe("");
    expect(providers[0].evidencias[0].trecho).not.toContain("CETESB");
  });

  it.each([
    ["AEP", "ergonomista"],
    ["AET", "ergonomista"],
    ["PCMSO", "medico_trabalho"],
    ["ASO", "medico_trabalho"],
  ])("gera checklist de %s sem pacote genérico dos cinco agentes", (title, role) => {
    const pages = [{ numero: 1, texto: title }];
    const result = withNaiDocumentWorkflow(
      parsePgrDocumentPages(pages),
      pages,
      classifyNaiDocument(pages)
    );
    expect(result.acoesCategorizadas).toHaveLength(["AEP", "AET"].includes(title) ? 2 : 1);
    expect(result.acoesCategorizadas[0].agenteSugerido).toBe(role);
    expect(result.acoesCategorizadas[0].checklist.length).toBeGreaterThan(2);
    expect(result.acoesCategorizadas[0].colunaKanban).toBe("todo");
    expect(result.analiseAgente?.status).toBe("pendente");
  });
  it("também substitui o pacote genérico do PGR por revisão coordenada e devolutiva pendente", () => {
    const pages = [{ numero: 1, texto: "PGR\nPrograma de Gerenciamento de Riscos" }];
    const result = withNaiDocumentWorkflow(
      parsePgrDocumentPages(pages),
      pages,
      classifyNaiDocument(pages)
    );
    expect(result.acoesCategorizadas).toHaveLength(2);
    expect(
      result.acoesCategorizadas.every((action) => action.agenteSugerido === "engenheiro_seguranca")
    ).toBe(true);
    expect(result.acoesCategorizadas.some((action) => action.titulo.includes("devolutiva"))).toBe(
      true
    );
    expect(result.acoesCategorizadas.every((action) => action.colunaKanban === "todo")).toBe(true);
  });
});
