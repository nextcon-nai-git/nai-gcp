import { isCalendarDate } from "./calendar-date";

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

export const normalizeAvpText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export function avpRequestIdentity(row: Partial<GrupoAvpAso>) {
  return [row.numero, row.colaborador, row.cidade, row.uf, row.dataPedido, row.tipoExame]
    .map((value) => normalizeAvpText(value || ""))
    .join("|");
}

export function avpPixStatus(value: string) {
  switch (normalizeAvpText(value)) {
    case "SIM":
    case "PAGO":
    case "REALIZADO":
    case "PIX REALIZADO":
      return "PAGO";
    case "NAO":
    case "NAO PAGO":
    case "NAO REALIZADO":
    case "PENDENTE":
      return "PENDENTE";
    default:
      return "A CONFERIR";
  }
}

// Captura a data de realização apenas quando o status inteiro confirma o exame.
export function completedAvpStatus(value: string) {
  return /^(?:(?:EXAME|ASO) (?:FOI )?)?(?:FEITO|CONCLUIDO|REALIZADO)(?: EM (\d{1,2}\/\d{1,2}(?:\/\d{2,4})?))?[.!]?$/.exec(
    normalizeAvpText(value)
  );
}

/** A planilha exibe o dia local, com horário opcional. Não infere ano ou intervalo. */
export function avpCalendarDay(value: string) {
  const day = value.trim().replace(/(?: |T)(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "");
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(day);
  const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : day;
  return isCalendarDate(iso) ? iso : "";
}

export const AVP_EDITABLE_FIELDS = [
  "urgencia",
  "status",
  "manualStatusRaw",
  "responsavel",
  "dataAgendada",
  "tipoSolicitacao",
  "nomeClinica",
  "telefoneClinica",
  "emailClinica",
  "valorAso",
  "cnpjClinica",
  "chavePix",
  "pixRealizado",
  "enderecoClinica",
  "oQueFazer",
  "observacoes",
] as const;

export function avpQueueEditFields(previous: GrupoAvpAso, updated: GrupoAvpAso) {
  return Object.fromEntries(
    AVP_EDITABLE_FIELDS.filter(
      (field) => String(previous[field] ?? "") !== String(updated[field] ?? "")
    ).map((field) => [field, String(updated[field] ?? "")])
  );
}

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
  manualStatusRaw?: string;
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
