// @vitest-environment node
import { describe, expect, it } from "vitest";
import { IMPORT_TEST_COMPANY, makeImportAnalysis } from "../../tests/fixtures/nai-import";
import {
  assertPgrAnalysisReady,
  buildPgrProviderPlan,
  buildPgrSavePlan,
  getPgrImportMetadata,
} from "./pgr-save-plan";
import type { NaiDocumentType } from "./pgr-schema";

const plan = (analysis = makeImportAnalysis()) =>
  buildPgrSavePlan(analysis, IMPORT_TEST_COMPANY, "a".repeat(64), "synthetic-user", "");

describe("NAI importa: plano de persistência", () => {
  it.each([
    ["PGR", "engenheiro_seguranca"],
    ["LTCAT", "engenheiro_seguranca"],
    ["PCMSO", "medico_trabalho"],
    ["ASO", "medico_trabalho"],
    ["PERICIA_MEDICA", "medico_trabalho"],
    ["AEP", "ergonomista"],
    ["AET", "ergonomista"],
    ["DADOS_ERGONOMICOS", "ergonomista"],
  ] as const)("mantém %s sob coordenação de %s", (type, role) => {
    const analysis = makeImportAnalysis(type);
    expect(getPgrImportMetadata(analysis).responsibleAgent).toBe(role);
    expect(plan(analysis).tasks[0].sourceLabel).toBe("NAI importa");
    expect(plan(analysis).tasks[0].documentType).toBe(type);
  });

  it("preserva o especialista da ação além do coordenador principal do PGR", () => {
    const analysis = makeImportAnalysis();
    analysis.acoesCategorizadas[0].agenteSugerido = "ergonomista";
    expect(plan(analysis).tasks[0]).toMatchObject({
      agentRole: "ergonomista",
      responsibleAgent: "engenheiro_seguranca",
    });
  });

  it.each(["PCMSO", "ASO", "PERICIA_MEDICA", "AET"] as NaiDocumentType[])(
    "%s restrito gera apenas checklist administrativo sem texto clínico",
    (type) => {
      const analysis = makeImportAnalysis(type);
      analysis.documento!.acesso = "clinico_restrito";
      analysis.pgrCardDetalhado.cnae = "CLINICAL_CANARY";
      analysis.pgrCardDetalhado.enderecoCompleto = "CLINICAL_CANARY";
      analysis.parecerTecnicoIA = "CLINICAL_CANARY";
      analysis.acoesCategorizadas[0].titulo = "CLINICAL_CANARY";
      analysis.acoesCategorizadas[0].descricaoDetalhada = "CLINICAL_CANARY";
      analysis.acoesCategorizadas[0].checklist = ["CLINICAL_CANARY"];
      analysis.riscosIdentificados[0].evidencia.trecho = "CLINICAL_CANARY";
      const saved = plan(analysis);
      expect(saved.tasks).toHaveLength(1);
      expect(saved.tasks[0].agentRole).toBe("medico_trabalho");
      expect(saved.tasks[0].checklist).toHaveLength(4);
      expect(saved.risks).toHaveLength(0);
      expect(JSON.stringify(saved)).not.toContain("CLINICAL_CANARY");
    }
  );

  it("o tipo clínico não pode ser rebaixado pelo campo acesso", () => {
    const analysis = makeImportAnalysis("ASO");
    analysis.documento!.acesso = "sst";
    expect(plan(analysis).tasks[0].restricted).toBe(true);
    expect(plan(analysis).risks).toHaveLength(0);
  });

  it("não libera gravação enquanto a análise do agente estiver pendente", () => {
    const analysis = makeImportAnalysis();
    analysis.analiseAgente!.status = "pendente";
    expect(() => assertPgrAnalysisReady(analysis)).toThrow(
      "análise do agente ainda não foi concluída"
    );
    analysis.analiseAgente!.status = "concluida";
    analysis.documento!.statusClassificacao = "ambiguo";
    expect(() => assertPgrAnalysisReady(analysis)).toThrow("tipo do documento");
  });

  it("mantém PGRs legados e cria revisão útil quando não houver ações detalhadas", () => {
    const analysis = makeImportAnalysis();
    delete analysis.documento;
    delete analysis.analiseAgente;
    analysis.acoesCategorizadas = [];
    expect(plan(analysis).tasks[0].checklist.length).toBeGreaterThan(0);
    expect(plan(analysis).tasks[0].status).toBe("todo");
    expect(plan(analysis).tasks[0].id).toBe(plan(analysis).tasks[0].id);
  });
});

describe("NAI importa: identidade de prestadores", () => {
  it("cria candidato por CNPJ comprovado e nunca usa o ID sugerido pela IA", () => {
    const providers = buildPgrProviderPlan(makeImportAnalysis(), IMPORT_TEST_COMPANY);
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ id: "12345678000195", cnpj: "12345678000195" });
    expect(providers[0]).not.toHaveProperty("evidencias");
  });

  it.each(["invalid_cnpj", "council_only", "missing_evidence", "employee", "client"])(
    "não cadastra identidade %s",
    (reason) => {
      const analysis = makeImportAnalysis();
      const provider = analysis.prestadoresIdentificados![0];
      if (reason === "invalid_cnpj") provider.cnpj = "12.345.678/0001-90";
      if (reason === "council_only") {
        provider.cnpj = "";
        provider.registroProfissional = "Conselho sintético 999/UF";
      }
      if (reason === "missing_evidence") provider.evidencias = [];
      if (reason === "employee") provider.papelNoDocumento = "Empregado examinado";
      if (reason === "client") provider.cnpj = IMPORT_TEST_COMPANY.cnpj;
      expect(buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY)).toHaveLength(0);
    }
  );

  it("aceita rótulo literal elaborado por e não resolve duas identidades conflitantes", () => {
    const analysis = makeImportAnalysis();
    const provider = analysis.prestadoresIdentificados![0];
    provider.papelNoDocumento = "Elaborado por";
    provider.evidencias[0].trecho =
      "Elaborado por: Prestador Sintético Ltda, CNPJ 12.345.678/0001-95";
    expect(buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY)).toHaveLength(1);
    analysis.prestadoresIdentificados!.push({
      ...provider,
      nome: "Outra Identidade",
      evidencias: [
        { pagina: 1, trecho: "Elaborado por: Outra Identidade CNPJ 12.345.678/0001-95" },
      ],
    });
    expect(buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY)).toHaveLength(0);
  });

  it("não copia campos livres do documento clínico para o cadastro geral de prestador", () => {
    const analysis = makeImportAnalysis("ASO");
    const provider = analysis.prestadoresIdentificados![0];
    provider.especialidade = "CLINICAL_CANARY";
    provider.endereco = "CLINICAL_CANARY";
    provider.evidencias[0].trecho += " CLINICAL_CANARY";
    expect(JSON.stringify(buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY))).not.toContain(
      "CLINICAL_CANARY"
    );
  });

  it("não associa o nome de empregado ao CNPJ da clínica presente no mesmo trecho", () => {
    const analysis = makeImportAnalysis();
    const provider = analysis.prestadoresIdentificados![0];
    provider.nome = "PESSOA_SINTETICA";
    provider.papelNoDocumento = "Prestadora";
    provider.evidencias = [
      {
        pagina: 1,
        trecho: "Prestadora: Clínica Exemplo CNPJ 12.345.678/0001-95. Empregado: PESSOA_SINTETICA",
      },
    ];
    expect(buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY)).toHaveLength(0);
  });

  it("encerra o bloco do prestador antes dos dados do trabalhador ou de outro cliente", () => {
    const analysis = makeImportAnalysis();
    const provider = analysis.prestadoresIdentificados![0];
    provider.endereco = "ENDERECO_PESSOAL_SINTETICO";
    provider.evidencias[0].trecho +=
      ". Empregado: PESSOA_SINTETICA, endereço ENDERECO_PESSOAL_SINTETICO";
    const candidates = buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].address).toBe("");
    provider.evidencias[0].trecho =
      "Prestadora: Prestador Sintético Ltda. Cliente: Outra Empresa CNPJ 12.345.678/0001-95";
    expect(buildPgrProviderPlan(analysis, IMPORT_TEST_COMPANY)).toHaveLength(0);
  });
});
