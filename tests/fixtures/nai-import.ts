import {
  PGR_VERSION,
  type NaiDocumentType,
  type PgrAnalysisOutput,
} from "../../src/lib/pgr-schema";

export const IMPORT_TEST_COMPANY = {
  id: "synthetic-company",
  name: "Empresa Sintética",
  cnpj: "11.222.333/0001-81",
};

export function makeImportAnalysis(type: NaiDocumentType = "PGR"): PgrAnalysisOutput {
  const clinical = ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(type);
  const role = clinical
    ? "medico_trabalho"
    : ["AEP", "AET", "DADOS_ERGONOMICOS"].includes(type)
      ? "ergonomista"
      : "engenheiro_seguranca";
  return {
    documento: {
      tipo: type,
      agenteResponsavel: role,
      statusClassificacao: "identificado",
      evidencias: [{ pagina: 1, trecho: `Documento ${type} de empresa sintética` }],
      justificativa: "Classificação sintética para teste",
      acesso: clinical ? "clinico_restrito" : "sst",
    },
    analiseAgente: { agente: role, status: "concluida", resumo: "Análise sintética concluída" },
    pgrCardDetalhado: {
      razaoSocial: IMPORT_TEST_COMPANY.name,
      cnpj: IMPORT_TEST_COMPANY.cnpj,
      cnae: "",
      grauDeRisco: null,
      enderecoCompleto: "",
      cidadeUf: "",
      dataEmissao: "",
      dataValidade: "",
      coordenadasGps: "",
      totalRiscosMapeados: 1,
      ghesIdentificados: ["Setor sintético"],
      esocialS2240Status: "A conferir",
    },
    identidade: {
      status: "identificada",
      evidencias: [{ pagina: 1, trecho: "Empresa Sintética CNPJ 11.222.333/0001-81" }],
      aviso: "",
    },
    riscosIdentificados: [
      {
        id: "risk-example",
        agente: "Ruído",
        categoria: "fisico",
        setorGhe: "Setor sintético",
        evidencia: { pagina: 2, trecho: "Exposição a ruído em ambiente sintético" },
        controlesDocumentados: [],
        classificacaoOriginal: "",
      },
    ],
    acoesCategorizadas: [
      {
        id: "action-example",
        tipoAcao: "Verificação",
        titulo: "Conferir risco documentado",
        descricaoDetalhada: "Validar a exposição ocupacional com o profissional responsável.",
        prioridade: "medium",
        colunaKanban: "todo",
        referenciaLegal: "Referência sintética",
        responsavelSugerido: "Equipe técnica",
        agenteSugerido: role,
        riscosRelacionados: ["risk-example"],
        evidencia: { pagina: 2, trecho: "Exposição a ruído em ambiente sintético" },
        checklist: ["Conferir evidência documental", "Registrar revisão técnica"],
        fundamento: "documento",
        prazoDocumentado: "",
      },
    ],
    prestadoresIdentificados: [
      {
        id: "untrusted-model-id",
        nome: "Prestador Sintético Ltda",
        cnpj: "12.345.678/0001-95",
        registroProfissional: "",
        especialidade: "",
        papelNoDocumento: "Empresa elaboradora",
        evidencias: [
          {
            pagina: 1,
            trecho: "Empresa elaboradora: Prestador Sintético Ltda. CNPJ: 12.345.678/0001-95",
          },
        ],
        cidadeUf: "",
        endereco: "",
        email: "",
        telefone: "",
      },
    ],
    parecerTecnicoIA: "Parecer sintético para teste de persistência",
    leitura: {
      modo: "ia_com_evidencias",
      paginas: 2,
      paginasComTexto: 2,
      avisos: [],
      versao: PGR_VERSION,
    },
  };
}
