import { describe, expect, it } from "vitest";
import { parsePgrDocumentPages } from "./pgr-document-parser";
import { mergeNaiIdentity } from "./nai-import-evidence";

describe("NAI importa: tabelas de identificação e dados com evidência", () => {
  it("lê campos sem dois-pontos, rodapé antes do corpo e não confunde clientes citados com empregador", () => {
    const pages = [
      {
        numero: 3,
        texto:
          "Responsável Técnico: Profissional Exemplo\nRegistro profissional: 123\n1. Caracterização da Organização e Unidade\nCampo   Informação detalhada\nRazão Social   EMPRESA TESTE LTDA\nCNPJ   44.337.647/0001-89\nGrau de Risco   Grau 01\nCNAE Principal   71.19-7-04\nEndereço (Sede)\nRua Exemplo, 100\n",
      },
      {
        numero: 11,
        texto:
          "Descrição de cargos\ncliente Organização Externa -\nAtuação na unidade de apoio.\nGHE 01 - Administrativo\nGHE 02 - Operação\n",
      },
      { numero: 12, texto: "GHE: 01 - Administrativo\nGHE: 02 - Operação\n" },
    ];
    const result = parsePgrDocumentPages(pages);
    expect(result.identidade.status).toBe("identificada");
    expect(result.pgrCardDetalhado).toMatchObject({
      razaoSocial: "EMPRESA TESTE LTDA",
      cnpj: "44.337.647/0001-89",
      cnae: "71.19-7-04",
      grauDeRisco: 1,
      enderecoCompleto: "Rua Exemplo, 100",
      ghesIdentificados: ["GHE: 01 - Administrativo", "GHE: 02 - Operação"],
    });
  });

  it("conserva ambiguidade quando há duas empresas identificadas em tabelas", () => {
    const result = parsePgrDocumentPages([
      {
        numero: 1,
        texto:
          "Razão Social   PRIMEIRA EMPRESA\nCNPJ   44.337.647/0001-89\nRazão Social   SEGUNDA EMPRESA\nCNPJ   43.776.491/0001-70",
      },
    ]);
    expect(result.identidade.status).toBe("ambigua");
  });

  it("aproveita identidade descoberta pela IA somente com nome e CNPJ na mesma evidência", () => {
    const pages = [
      {
        numero: 15,
        texto:
          "Identificação da unidade • Contratante | EMPRESA TESTE LTDA | CNPJ 44.337.647/0001-89\nCidade Curitiba/PR",
      },
    ];
    const base = parsePgrDocumentPages(pages);
    const model = structuredClone(base);
    model.pgrCardDetalhado.razaoSocial = "EMPRESA TESTE LTDA";
    model.pgrCardDetalhado.cnpj = "44.337.647/0001-89";
    model.identidade = {
      status: "identificada",
      evidencias: [{ pagina: 15, trecho: pages[0].texto.split("\n")[0] }],
      aviso: "Conferir",
    };
    expect(mergeNaiIdentity(base, model, pages, false).detail.razaoSocial).toBe(
      "EMPRESA TESTE LTDA"
    );
    model.pgrCardDetalhado.razaoSocial = "EMPRESA INVENTADA";
    expect(mergeNaiIdentity(base, model, pages, false).identity.status).toBe("nao_identificada");
  });

  it("preserva o empregador e recusa metadados de outro CNPJ", () => {
    const pages = [
      {
        numero: 1,
        texto:
          "PGR\nRazão Social: EMPRESA TESTE LTDA\nCNPJ: 44.337.647/0001-89\nCuritiba/PR\nSão Paulo/SP",
      },
    ];
    const base = parsePgrDocumentPages(pages);
    const model = structuredClone(base);
    model.pgrCardDetalhado.cidadeUf = "Curitiba/PR";
    expect(mergeNaiIdentity(base, model, pages, false).detail.cidadeUf).toBe("Curitiba/PR");
    model.pgrCardDetalhado.cnpj = "43.776.491/0001-70";
    model.pgrCardDetalhado.cidadeUf = "São Paulo/SP";
    expect(mergeNaiIdentity(base, model, pages, false).detail.cidadeUf).toBe("");
  });
});
