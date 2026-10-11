import { describe, it, expect } from "vitest";
import { parsePgrDocumentPages, evidenceIsInPages } from "./pgr-document-parser";
import { suggestedPgrCompany, isValidPgrCnpj } from "./pgr-schema";
import { assertPgrClientBinding, buildPgrSavePlan } from "./pgr-save-plan";
import { parsePgrWithHeuristics } from "@/ai/flows/pgr-heuristic-parser";
import { getDocumentedRiskScore } from "./risk-assessment";
const pages = [
  {
    numero: 1,
    texto:
      "RAZÃO SOCIAL: COMPANHIA AMBIENTAL DO ESTADO DE SÃO PAULO - CETESB\nEndereço: Avenida de teste, 345\nC.N.P.J.: 43.776.491/0001-70",
  },
  {
    numero: 2,
    texto: "CONCEITOS DE RISCOS AMBIENTAIS\nExemplos: ruído, calor, agentes químicos e bactérias.",
  },
  {
    numero: 3,
    texto:
      "RECONHECIMENTO DE RISCOS AMBIENTAIS\nMANUTENÇÃO\nGrupo Homogêneo: manutenção\nExposição a ruído contínuo de furadeiras e motores.",
  },
  {
    numero: 4,
    texto:
      "CRONOGRAMA DE METAS PGR\nRESPONSÁVEIS ATIVIDADE PRAZO\nEquipe técnica: realizar avaliação quantitativa de agentes químicos. Segundo semestre de 2026.",
  },
];
describe("PGR: identidade e evidências", () => {
  it("identifica CETESB sem aproveitar bytes ou contexto AVP", () => {
    const a = parsePgrDocumentPages(pages);
    expect(a.pgrCardDetalhado.razaoSocial).toContain("CETESB");
    expect(a.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
    expect(a.identidade.status).toBe("identificada");
    expect(a.pgrCardDetalhado.grauDeRisco).toBeNull();
    expect(a.pgrCardDetalhado.cnae).toBe("");
    expect(a.pgrCardDetalhado.dataValidade).toBe("");
    expect(a.pgrCardDetalhado.coordenadasGps).toBe("");
  });
  it("não extrai cliente de filename ou data URI", () => {
    const a = parsePgrWithHeuristics("data:application/pdf;base64,AVPAAAA", "PGR_CETESB.pdf");
    expect(a.pgrCardDetalhado.razaoSocial).toBe("");
    expect(a.pgrCardDetalhado.cnpj).toBe("");
    expect(a.riscosIdentificados).toHaveLength(0);
    expect(a.leitura.modo).toBe("inconclusiva");
  });
  it("ignora glossário e vincula os riscos à página ocupacional", () => {
    const a = parsePgrDocumentPages(pages);
    expect(a.riscosIdentificados).toHaveLength(1);
    expect(a.riscosIdentificados[0].agente).toBe("Ruído");
    expect(a.riscosIdentificados[0].evidencia.pagina).toBe(3);
    expect(evidenceIsInPages(a.riscosIdentificados[0].evidencia, pages)).toBe(true);
  });
  it("sugere cinco especialistas com checklist e sem marcar execução", () => {
    const a = parsePgrDocumentPages(pages);
    expect(new Set(a.acoesCategorizadas.map((x) => x.agenteSugerido)).size).toBe(5);
    expect(
      a.acoesCategorizadas.every((x) => x.colunaKanban === "todo" && x.checklist.length > 0)
    ).toBe(true);
    expect(
      a.acoesCategorizadas.some((x) => x.fundamento === "documento" && x.evidencia?.pagina === 4)
    ).toBe(true);
  });
  it("bloqueia duas empresas rotuladas e não escolhe a primeira", () => {
    const a = parsePgrDocumentPages([
      {
        numero: 1,
        texto:
          "EMPRESA: EMPRESA ALFA\nCNPJ: 43.776.491/0001-70\nCLIENTE: EMPRESA BETA\nCNPJ: 44.337.647/0001-89",
      },
    ]);
    expect(a.identidade.status).toBe("ambigua");
    expect(a.pgrCardDetalhado.razaoSocial).toBe("");
  });
  it("não captura CNPJ da prestadora quando o cliente não informa CNPJ", () => {
    const result = parsePgrDocumentPages([
      {
        numero: 1,
        texto: "PGR\nCLIENTE: CETESB\nPRESTADORA: Clínica Exemplo\nCNPJ: 44.337.647/0001-89",
      },
    ]);
    expect(result.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(result.pgrCardDetalhado.cnpj).toBe("");
  });
  it("separa a razão social do elaborador da empresa avaliada", () => {
    const result = parsePgrDocumentPages([
      {
        numero: 1,
        texto:
          "PGR\nCLIENTE: CETESB\nCNPJ: 43.776.491/0001-70\n" +
          "PRESTADORA:\nRAZÃO SOCIAL: Clínica Exemplo\nCNPJ: 44.337.647/0001-89",
      },
    ]);
    expect(result.identidade.status).toBe("identificada");
    expect(result.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(result.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
  });
  it("reconhece empregador em ASO sem usar o CNPJ do emissor", () => {
    const result = parsePgrDocumentPages([
      {
        numero: 1,
        texto:
          "ASO\nPRESTADORA: Clínica Exemplo\nCNPJ: 44.337.647/0001-89\n" +
          "EMPREGADOR: CETESB\nCNPJ: 43.776.491/0001-70\nMédico examinador: Dr. Exemplo\nCRM-SP: 123456",
      },
    ]);
    expect(result.identidade.status).toBe("identificada");
    expect(result.pgrCardDetalhado.razaoSocial).toBe("CETESB");
    expect(result.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
  });
  it.each(["EMPREGADO", "TRABALHADOR", "PACIENTE", "Nome do colaborador", "FUNCIONÁRIA"])(
    "não transforma endereço de %s em endereço da empresa",
    (label) => {
      const result = parsePgrDocumentPages([
        {
          numero: 1,
          texto: `ASO\nEMPRESA: CETESB\nCNPJ: 43.776.491/0001-70\n${label}: Pessoa Sintética\nEndereço: ENDERECO_PESSOAL_CANARIO`,
        },
      ]);
      expect(result.pgrCardDetalhado.razaoSocial).toBe("CETESB");
      expect(result.pgrCardDetalhado.cnpj).toBe("43.776.491/0001-70");
      expect(result.pgrCardDetalhado.enderecoCompleto).toBe("");
      expect(JSON.stringify(result.pgrCardDetalhado)).not.toContain("ENDERECO_PESSOAL_CANARIO");
    }
  );
  it("preserva endereço empresarial anterior ao bloco do trabalhador", () => {
    const result = parsePgrDocumentPages([
      {
        numero: 1,
        texto:
          "ASO\nEMPRESA: CETESB\nCNPJ: 43.776.491/0001-70\nEndereço: Avenida Empresarial, 100\nTRABALHADOR: Pessoa Sintética\nEndereço: ENDERECO_PESSOAL_CANARIO",
      },
    ]);
    expect(result.pgrCardDetalhado.enderecoCompleto).toBe("Avenida Empresarial, 100");
  });
  it("associa pelo CNPJ exato, preservando o ID cadastral", () => {
    const a = parsePgrDocumentPages(pages);
    expect(
      suggestedPgrCompany(a, [
        { id: "cetesb-original", name: "CETESB", cnpj: "43776491000170" },
        { id: "avp", name: "AVP", cnpj: "44337647000189" },
      ])
    ).toBe("cetesb-original");
  });
  it("não escolhe cadastro duplicado ou filial diferente", () => {
    const a = parsePgrDocumentPages(pages);
    expect(
      suggestedPgrCompany(a, [
        { id: "a", name: "A", cnpj: "43776491000170" },
        { id: "b", name: "B", cnpj: "43776491000170" },
      ])
    ).toBeNull();
    expect(
      suggestedPgrCompany(a, [{ id: "filial", name: "CETESB Limeira", cnpj: "43776491004248" }])
    ).toBeNull();
  });
  it("rejeita CNPJ inventado e impede gravar CETESB em AVP", () => {
    expect(isValidPgrCnpj("12.345.678/0001-90")).toBe(false);
    expect(isValidPgrCnpj("43.776.491/0001-70")).toBe(true);
    expect(() =>
      assertPgrClientBinding(parsePgrDocumentPages(pages), {
        id: "avp",
        name: "AVP",
        cnpj: "44.337.647/0001-89",
      })
    ).toThrow("outra empresa");
  });
  it("gera IDs idempotentes, checklist pendente e avaliação desconhecida", () => {
    const a = parsePgrDocumentPages(pages);
    const company = { id: "cliente-real", name: "CETESB", cnpj: "43776491000170" };
    const first = buildPgrSavePlan(a, company, "a".repeat(64), "operador", "");
    const second = buildPgrSavePlan(a, company, "a".repeat(64), "operador", "");
    expect(first.tasks.map((x) => x.id)).toEqual(second.tasks.map((x) => x.id));
    expect(
      first.tasks.every(
        (x) =>
          x.companyId === "cliente-real" &&
          x.companyName === "CETESB" &&
          x.agentEnabled === false &&
          x.checklist.every((c) => !c.checked)
      )
    ).toBe(true);
    expect(first.risks[0].probability).toBeNull();
    expect(first.risks[0].severity).toBeNull();
    expect(first.tasks.flatMap((task) => task.riskIds)).toContain(first.risks[0].id);
    expect(getDocumentedRiskScore(first.risks[0])).toBeNull();
  });
  it("não interpreta índice e conceitos como cronograma executável", () => {
    const a = parsePgrDocumentPages([
      { numero: 1, texto: "ÍNDICE\nPlano de Ação................ 100\nPrazo.... 101" },
      { numero: 2, texto: "CONCEITOS DE RISCOS AMBIENTAIS\nPlano de ação, atividade e prazo." },
    ]);
    expect(a.acoesCategorizadas.filter((x) => x.fundamento === "documento")).toHaveLength(0);
  });
});
