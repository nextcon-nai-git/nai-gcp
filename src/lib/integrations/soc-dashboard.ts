import { z } from "zod";

export const SOC_DASHBOARD_MAX_BYTES = 750_000;
const text = z.string().trim().min(1).max(400);
const id = z.string().regex(/^\d{1,20}$/);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida");

export const reportStatuses = {
  ready: "Disponível no SOC · conteúdo não lido",
  scheduled: "Processamento agendado",
  empty: "Sem resultado neste filtro",
} as const;

const reportSchema = z
  .object({
    id,
    title: text,
    category: z.enum([
      "convocation",
      "attendance",
      "documents",
      "esocial",
      "registration",
      "exams",
    ]),
    status: z.enum(["ready", "scheduled", "empty"]),
    scope: text,
    periodStart: day.nullable(),
    periodEnd: day.nullable(),
    scheduledFor: day.nullable(),
    note: text,
  })
  .strict()
  .superRefine((report, context) => {
    if (
      (report.periodStart === null) !== (report.periodEnd === null) ||
      (report.periodStart && report.periodEnd && report.periodStart > report.periodEnd)
    ) {
      context.addIssue({ code: "custom", message: "Período inválido" });
    }
    if ((report.status === "scheduled") !== (report.scheduledFor !== null)) {
      context.addIssue({ code: "custom", message: "Agendamento incompatível com a situação" });
    }
  });

/** Administrative evidence only. No patient records, credentials or report payloads. */
export const socDashboardSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.literal("SOC · consulta manual"),
    observedAt: z.string().datetime({ offset: true }),
    dueSoonEnd: day,
    inactiveExcluded: z.number().int().min(0).max(100_000),
    activeCompanies: z
      .array(z.object({ id, name: text }).strict())
      .min(1)
      .max(2_000),
    reports: z.array(reportSchema).max(100),
    administrativeTasks: z
      .array(
        z
          .object({
            id,
            company: text,
            task: text,
          })
          .strict()
      )
      .max(100),
    limitation: text,
  })
  .strict()
  .superRefine((snapshot, context) => {
    for (const key of ["activeCompanies", "reports", "administrativeTasks"] as const) {
      if (new Set(snapshot[key].map((item) => item.id)).size !== snapshot[key].length) {
        context.addIssue({ code: "custom", path: [key], message: "Códigos repetidos" });
      }
    }
    if (!Number.isFinite(Date.parse(snapshot.observedAt))) return;
    const observedDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(snapshot.observedAt)
    );
    if (snapshot.dueSoonEnd < observedDay) {
      context.addIssue({
        code: "custom",
        path: ["dueSoonEnd"],
        message: "Prazo anterior à consulta",
      });
    }
  });

export type SocDashboardSnapshot = z.infer<typeof socDashboardSchema>;
export type SocDashboardResponse = {
  snapshot: SocDashboardSnapshot | null;
  version: string | null;
  savedAt: string | null;
  canPublish: boolean;
};
export const socDashboardWriteSchema = z
  .object({
    snapshot: socDashboardSchema,
    expectedVersion: z.string().uuid().nullable(),
  })
  .strict();

export function summarizeSocDashboard(snapshot: SocDashboardSnapshot) {
  return {
    activeCompanies: snapshot.activeCompanies.length,
    readyReports: snapshot.reports.filter((report) => report.status === "ready").length,
    scheduledReports: snapshot.reports.filter((report) => report.status === "scheduled").length,
    administrativeTasks: snapshot.administrativeTasks.length,
    // Availability of a report never proves that there are zero overdue/pending ASOs.
    overdue: null,
    dueSoon: null,
    pendingAsos: null,
  };
}
