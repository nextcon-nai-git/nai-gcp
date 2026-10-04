// Dados Estruturados de Agendamentos de ASO do Cliente GRUPO AVP
// Total de 223 solicitações operacionais mapeadas em 102 municípios

export type AsoUrgency = "URGENTE" | "E-MAIL" | "NORMAL";

export type AsoStatus =
  | "AGENDADO"
  | "NÃO INICIADO"
  | "EXAME FEITO"
  | "2 VIA ASO"
  | "CADASTRANDO NO SOC"
  | "GESTOR CANCELOU"
  | "REAGENDAMENTO"
  | "AG. RETORNO CLINICA"
  | "ENVIAR COMPROV. PAG"
  | "DESISTIU DA VAGA";

export interface GrupoAvpAso {
  id: string;
  numero: string;
  urgencia: AsoUrgency;
  urgenciaRaw: string;
  dataPedido: string;
  dataPedidoIso: string;
  diasParado: number;
  cidadeRaw: string;
  cidade: string;
  uf: string;
  colaborador: string;
  tipoExame: string;
  telefoneGestor: string;
  oQueFazer: string;
  status: AsoStatus;
  responsavel: string;
  dataAgendada: string;
  dataAgendadaIso: string;
  tipoSolicitacao: string;
  nomeClinica: string;
  telefoneClinica: string;
  emailClinica: string;
  valorAso: string;
  cnpjClinica: string;
  chavePix: string;
  pixRealizado: string;
  enderecoClinica: string;
}

export const GRUPO_AVP_ASO_LIST: GrupoAvpAso[] = [];
