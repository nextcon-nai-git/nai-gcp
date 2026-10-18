import { z } from "zod";
import { isCalendarDate } from "./omie-dre";
const day = z.string().refine(isCalendarDate, "Data inválida");
export const ReportInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    periodStart: day,
    periodEnd: day,
    description: z.string().trim().max(4000).default(""),
  })
  .strict()
  .refine((v) => v.periodStart <= v.periodEnd, "Período invertido");
export type FinancialReport = z.infer<typeof ReportInputSchema> & {
  id: string;
  sourceName: string;
  importedAt: string;
  importedBy: string;
};
