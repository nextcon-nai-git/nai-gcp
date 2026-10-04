export type Status =
  | "to_review"
  | "sent"
  | "approved"
  | "implementation"
  | "started"
  | "todo"
  | "doing"
  | "review"
  | "done"
  | "archived";
export type Priority = "low" | "medium" | "high" | "critical";
export type TaskType =
  "pgr" | "pcmso" | "treinamento" | "vistoria" | "esocial" | "comercial" | "rnc" | "ambiental";

export interface SSTTask {
  id: string;
  title: string;
  company: string;
  status: Status;
  priority: Priority;
  type: TaskType;
  dueDate?: Date;
  assigneeAvatar?: string;
}

export const COMMERCIAL_COLUMNS: { id: Status; title: string; color: string }[] = [
  { id: "to_review", title: "Propostas a Revisar", color: "bg-orange-50" },
  { id: "sent", title: "Propostas Enviadas", color: "bg-blue-50" },
  { id: "approved", title: "Propostas Aprovadas", color: "bg-emerald-50" },
  { id: "implementation", title: "Implantação Projeto", color: "bg-purple-50" },
];

export const OPERATIONAL_COLUMNS: { id: Status; title: string; color: string }[] = [
  { id: "started", title: "Triagem / Backlog", color: "bg-indigo-50" },
  { id: "todo", title: "Planejamento", color: "bg-slate-100" },
  { id: "doing", title: "Em Execução", color: "bg-blue-50" },
  { id: "review", title: "Revisão Técnica", color: "bg-yellow-50" },
  { id: "done", title: "Protocolado / Concluído", color: "bg-green-50" },
];

export const SGI_OPERATIONAL_COLUMNS: { id: Status; title: string; color: string }[] = [
  { id: "todo", title: "Planejamento", color: "bg-amber-500/10" },
  { id: "doing", title: "Execução", color: "bg-blue-500/10" },
  { id: "review", title: "Revisão / Eficácia", color: "bg-indigo-500/10" },
  { id: "done", title: "Concluído", color: "bg-emerald-500/10" },
];

export const KANBAN_COLUMNS = OPERATIONAL_COLUMNS; // Fonte canônica padrão

/**
 * Normaliza qualquer status legado ou string com acentos para a taxonomia canônica.
 * Previne perda visual ou desaparecimento de cards ao alternar fluxos de trabalho.
 */
export function normalizeTaskStatus(rawStatus: string | undefined | null): Status {
  if (!rawStatus) return "todo";
  const clean = rawStatus.trim().toLowerCase();

  switch (clean) {
    case "planejamento":
    case "todo":
    case "a_fazer":
      return "todo";
    case "execução":
    case "execucao":
    case "doing":
    case "em_andamento":
      return "doing";
    case "revisão":
    case "revisao":
    case "review":
    case "efficacy_check":
      return "review";
    case "concluído":
    case "concluido":
    case "done":
    case "finalizado":
    case "protocolado":
      return "done";
    case "propostas":
    case "to_review":
      return "to_review";
    case "sent":
    case "enviado":
      return "sent";
    case "approved":
    case "aprovado":
      return "approved";
    case "implementation":
    case "implantacao":
      return "implementation";
    case "archived":
    case "arquivado":
      return "archived";
    case "started":
    case "iniciado":
      return "started";
    default:
      return "todo";
  }
}
