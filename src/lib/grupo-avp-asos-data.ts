// Dados Estruturados de Agendamentos de ASO do Cliente GRUPO AVP
// Tipos operacionais da fila; os pedidos são lidos da fonte privada configurada.

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
  | "DESISTIU DA VAGA"
  | "ESPERANDO CNPJ E VALOR"
  | "RESGATAR ASO"
  | "AG. RETORNO DO GESTOR"
  | "AG. RETORNO DO COLABORADOR"
  | "STATUS NÃO RECONHECIDO";

export const AVP_STATUSES: AsoStatus[] = [
  "NÃO INICIADO",
  "ESPERANDO CNPJ E VALOR",
  "CADASTRANDO NO SOC",
  "AGENDADO",
  "EXAME FEITO",
  "DESISTIU DA VAGA",
  "AG. RETORNO CLINICA",
  "2 VIA ASO",
  "GESTOR CANCELOU",
  "REAGENDAMENTO",
  "ENVIAR COMPROV. PAG",
  "RESGATAR ASO",
  "AG. RETORNO DO GESTOR",
  "AG. RETORNO DO COLABORADOR",
  "STATUS NÃO RECONHECIDO",
];

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
  observacoes?: string;
  statusRaw?: string;
  sourceRow?: number;
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
