/** Dados informados para a minuta de OS de cada empregador e função. */
export interface WorkOrderCompanyInfo {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  grauRisco: string;
  endereco: string;
  cidadeUf: string;
  contratante: string;
  unidadeOperacional: string;
}
export interface WorkOrderEmployeeInfo {
  nome: string;
  cpf: string;
  matricula: string;
  cargo: string;
  setor: string;
  ghe: string;
  dataAdmissao: string;
  dataEmissaoOs: string;
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
export interface WorkOrderData {
  id: string;
  numeroControle: string;
  versaoPgr: string;
  vigenciaPgr: string;
  empresa: WorkOrderCompanyInfo;
  colaborador: WorkOrderEmployeeInfo;
  descricaoAtividades: string[];
  riscosIdentificados: WorkOrderRiskItem[];
  episObrigatorios: WorkOrderPpeItem[];
  regrasSeguranca: WorkOrderRuleItem[];
  proibicoesExpressas: string[];
  procedimentosEmergencia: string[];
  orientacoesGerais: string;
  responsavelSst: { nome: string; cargo: string; registroProfissional: string };
}
