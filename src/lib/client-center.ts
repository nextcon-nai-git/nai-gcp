import { z } from "zod";
import { dateOnly, saoPauloDay, type TaskSummary } from "@/lib/executive-dashboard";

export const REQUEST_DEPARTMENTS = {
  scheduling: "Agendamento de exames",
  engineering: "Engenharia e segurança",
  documents: "Documentos e laudos",
  registration: "Cadastros",
  financial: "Atendimento financeiro",
  support: "Suporte ao sistema",
} as const;
export const ClientRequestSchema = z
  .object({
    companyId: z.string().min(1).max(128),
    requestId: z.string().uuid(),
    department: z.enum([
      "scheduling",
      "engineering",
      "documents",
      "registration",
      "financial",
      "support",
    ]),
    title: z.string().trim().min(5).max(160),
    description: z.string().trim().min(15).max(3000),
    priority: z.enum(["medium", "high"]),
  })
  .strict();
export type ClientRequestInput = z.infer<typeof ClientRequestSchema>;
export type PeriodicItem = {
  id: string;
  name: string;
  department: string;
  dueDate: string | null;
  situation: "overdue" | "soon" | "current" | "missing";
};
export type PeriodicSummary = {
  total: number;
  overdue: number;
  soon: number;
  current: number;
  missing: number;
  items: PeriodicItem[];
  truncated: boolean;
};
export function summarizePeriodics(
  records: { id: string; data: Record<string, unknown> }[],
  now = new Date(),
  truncated = false
): PeriodicSummary {
  const today = saoPauloDay(now);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  const limit = end.toISOString().slice(0, 10);
  const result: PeriodicSummary = {
    total: 0,
    overdue: 0,
    soon: 0,
    current: 0,
    missing: 0,
    items: [],
    truncated,
  };
  for (const { id, data } of records) {
    if (data.isDeleted === true || data.status === "fired" || data.active === false) continue;
    const dueDate = dateOnly(data.nextAsoDate);
    const situation = !dueDate
      ? "missing"
      : dueDate < today
        ? "overdue"
        : dueDate <= limit
          ? "soon"
          : "current";
    result.total++;
    result[situation]++;
    result.items.push({
      id,
      name: String(data.name || "Nome não informado"),
      department: String(data.department || "Não informado"),
      dueDate,
      situation,
    });
  }
  const rank = { overdue: 0, soon: 1, missing: 2, current: 3 };
  result.items.sort(
    (a, b) =>
      rank[a.situation] - rank[b.situation] ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.name.localeCompare(b.name, "pt-BR")
  );
  return result;
}
export const PERIODIC_LABELS = {
  overdue: "Prazo vencido",
  soon: "Próximos 30 dias",
  current: "Prazo futuro",
  missing: "Data não informada",
};
export function periodicsCsv(items: PeriodicItem[]): string {
  const escape = (value: string) =>
    `"${(/^[\s]*[=+@\-]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      ["Colaborador", "Setor", "Próximo ASO cadastrado", "Situação"],
      ...items.map((i) => [i.name, i.department, i.dueDate || "", PERIODIC_LABELS[i.situation]]),
    ]
      .map((row) => row.map(escape).join(";"))
      .join("\r\n")
  );
}
export type PortalRequest = {
  id: string;
  title: string;
  department: string;
  status: string;
  createdAt: string;
  priority: string;
};
export type ClientCenterData = {
  company: { id: string; name: string };
  generatedAt: string;
  periodics: PeriodicSummary | null;
  tasks: TaskSummary | null;
  requests: PortalRequest[] | null;
  documents: { id: string; name: string; type: string; status: string }[] | null;
  issues: string[];
};
export function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    todo: "Recebida",
    started: "Em atendimento",
    doing: "Em atendimento",
    review: "Em revisão",
    done: "Concluída",
    cancelled: "Cancelada",
    archived: "Arquivada",
  };
  return labels[status] || "Em acompanhamento";
}
