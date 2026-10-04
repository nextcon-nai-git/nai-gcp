/**
 * Modelos de Dados e Tipagem para Ordem de Serviço de SST - NR-01 (subitem 1.4.1) e Art. 157 da CLT.
 * Calibrada com o PGR Oficial da CONSTRUFAM ENGENHARIA E EMPREENDIMENTOS LTDA.
 */

export interface WorkOrderCompanyInfo {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  grauRisco: number;
  endereco: string;
  cidadeUf: string;
  contratante: string;
  unidadeOperacional: string;
}

export interface WorkOrderEmployeeInfo {
  nome: string;
  cpf: string;
  matricula?: string;
  cargo: string;
  setor: string;
  ghe: string;
  dataAdmissao?: string;
  dataEmissaoOs: string;
  numeroColeteSalvaVidas?: string;
  registroArrais?: string;
}

export interface WorkOrderRiskItem {
  fatorRisco: string;
  grupo: "Acidente" | "Físico" | "Químico" | "Biológico" | "Ergonômico";
  severidade: string;
  probabilidade: string;
  nivelRisco: string;
  fontes: string;
  possiveisDanos: string;
  medidasPrevenconais: string;
}

export interface WorkOrderPpeItem {
  equipamento: string;
  ca: string;
  obrigatoriedade: string;
  finalidade: string;
}

export interface WorkOrderRuleItem {
  titulo: string;
  descricao: string;
}

export interface WorkOrderConstrufamData {
  id: string;
  numeroControle: string;
  versaoPgr: string;
  vigenciaPgr: string;
  empresa: WorkOrderCompanyInfo;
  colaborador: WorkOrderEmployeeInfo;
  descricaoAtividades: string[];
  riscosIdentificados: WorkOrderRiskItem[];
  episObrigatorios: WorkOrderPpeItem[];
  regrasOuroEmbarcado: WorkOrderRuleItem[];
  proibicoesExpressas: string[];
  procedimentoHomemAoMar: string[];
  direitosDeveresClt: {
    artigo157: string;
    artigo158: string;
    item141Nr01: string;
    item143DireitoRecusa: string;
  };
  responsavelSst: {
    nome: string;
    cargo: string;
    registroProfissional: string;
  };
}
