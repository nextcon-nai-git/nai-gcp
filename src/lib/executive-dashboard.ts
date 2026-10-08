import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { avpCostSummary } from "@/lib/avp-costs";

export type DashboardTask = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  status: string;
  priority: string;
  dueDate: string | null;
  owner: string;
  overdue: boolean;
  sourceType: string;
};
export type TaskSummary = {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  undated: number;
  unknownStatus: number;
  priorities: DashboardTask[];
  truncated: boolean;
};
export type DashboardClient = {
  portfolioClientId?: string | null;
  id: string;
  name: string;
  location: string;
  active: boolean | null;
  employees: number | null;
  pgr: number | null;
  risksToReview: number | null;
  tasks: TaskSummary | null;
};
export type AvpSummary = {
  total: number;
  scheduled: number;
  waiting: number;
  completed: number;
  cancelled: number;
  urgentWaiting: number;
  unknownStatus: number;
  quoted: number;
  missingCost: number;
  aboveTarget: number;
  checkedAt: string | null;
  status: string;
  stale: boolean;
  timeline: { date: string; count: number }[];
  invalidDates: number;
  stages: { label: string; count: number; color: string }[];
};
export type ExecutiveDashboard = {
  generatedAt: string;
  scope: string;
  choices: { id: string; name: string }[];
  clients: DashboardClient[];
  avp: AvpSummary | null;
  avpAvailable: boolean;
  issues: string[];
  clientsTruncated: boolean;
};

export function saoPauloDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateOnly(value: unknown): string | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof value.seconds === "number"
  ) {
    const date = new Date(value.seconds * 1000);
    return Number.isFinite(date.getTime()) ? saoPauloDay(date) : null;
  }
  if (typeof value !== "string") return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const day = iso ? value : br ? `${br[3]}-${br[2]}-${br[1]}` : null;
  if (day) {
    const parsed = new Date(`${day}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
      ? day
      : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? saoPauloDay(parsed) : null;
}

export function summarizeTasks(
  records: { id: string; data: Record<string, unknown> }[],
  company: { id: string; name: string },
  now = new Date(),
  truncated = false
): TaskSummary {
  const today = saoPauloDay(now);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const nextWeek = end.toISOString().slice(0, 10);
  const openStatuses = new Set([
    "to_review",
    "sent",
    "approved",
    "implementation",
    "started",
    "todo",
    "doing",
    "review",
    "efficacy_check",
  ]);
  const result: TaskSummary = {
    total: 0,
    open: 0,
    completed: 0,
    overdue: 0,
    dueSoon: 0,
    undated: 0,
    unknownStatus: 0,
    priorities: [],
    truncated,
  };
  for (const { id, data } of records) {
    if (data.isDeleted === true) continue;
    result.total++;
    const status = String(data.status || "").toLowerCase();
    if (status === "done") {
      result.completed++;
      continue;
    }
    if (["archived", "cancelled", "canceled"].includes(status)) continue;
    if (!openStatuses.has(status)) {
      result.unknownStatus++;
      continue;
    }
    result.open++;
    const dueDate = dateOnly(data.dueDate);
    const overdue = !!dueDate && dueDate < today;
    if (overdue) result.overdue++;
    if (!dueDate) result.undated++;
    if (dueDate && dueDate >= today && dueDate <= nextWeek) result.dueSoon++;
    result.priorities.push({
      id,
      companyId: company.id,
      companyName: company.name,
      title: String(data.title || "Atividade sem título"),
      status,
      priority: String(data.priority || ""),
      dueDate,
      overdue,
      owner: String(data.responsibleName || "Responsável não definido"),
      sourceType: String(data.sourceType || ""),
    });
  }
  result.priorities.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      Number(b.priority === "critical") - Number(a.priority === "critical") ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
  );
  result.priorities = result.priorities.slice(0, 8);
  return result;
}

export function summarizeAvp(
  items: GrupoAvpAso[],
  checkedAt: string | null,
  status: string,
  now = new Date()
): AvpSummary {
  const costs = avpCostSummary(items);
  const today = saoPauloDay(now);
  const timeline = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 29 + index);
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });
  const byDay = new Map(timeline.map((d) => [d.date, d]));
  let scheduled = 0,
    completed = 0,
    cancelled = 0,
    waiting = 0,
    urgentWaiting = 0,
    unknownStatus = 0,
    invalidDates = 0;
  for (const item of items) {
    if (item.status === "AGENDADO") scheduled++;
    else if (item.status === "EXAME FEITO") completed++;
    else if (["GESTOR CANCELOU", "DESISTIU DA VAGA"].includes(item.status)) cancelled++;
    else {
      waiting++;
      if (item.urgencia === "URGENTE") urgentWaiting++;
    }
    if (item.status === "STATUS NÃO RECONHECIDO") unknownStatus++;
    const date = dateOnly(item.dataPedidoIso) || dateOnly(item.dataPedido);
    if (!date) invalidDates++;
    else {
      const point = byDay.get(date);
      if (point) point.count++;
    }
  }
  const checked = checkedAt ? new Date(checkedAt).getTime() : NaN;
  return {
    total: items.length,
    scheduled,
    completed,
    cancelled,
    waiting,
    urgentWaiting,
    unknownStatus,
    quoted: costs.quoted,
    missingCost: costs.missing,
    aboveTarget: costs.aboveTarget,
    checkedAt,
    status,
    stale:
      !Number.isFinite(checked) || now.getTime() - checked > 20 * 60_000 || status !== "CONNECTED",
    timeline,
    invalidDates,
    stages: [
      { label: "Agendados", count: scheduled, color: "#0d9488" },
      { label: "Em tratamento", count: waiting, color: "#f59e0b" },
      { label: "Exames feitos", count: completed, color: "#3b82f6" },
      { label: "Cancelados / desistências", count: cancelled, color: "#cbd5e1" },
    ],
  };
}
