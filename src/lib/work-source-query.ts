import { z } from "zod/v3";
import { isCalendarDate } from "@/lib/financial/omie-dre";

export const workSourceModes = ["rd", "soc", "rd_soc", "omie"] as const;
export const WorkSourceQuery = z.object({
  source: z.enum(workSourceModes),
  start: z.string().refine(isCalendarDate),
  end: z.string().refine(isCalendarDate),
}).strict().refine(q => q.start >= "2000-01-01" && q.end <= "2100-12-31" &&
  q.start <= q.end && Date.parse(q.end) - Date.parse(q.start) <= 30 * 86400000,
  "Consulte um período de até 31 dias.");
export type WorkSourceSelection = z.infer<typeof WorkSourceQuery>;

// Resolve Brasília calendar days before comparing the UTC timestamps from RD.
const brazilDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
export const workDay = (instant: Date) => brazilDate.format(instant);
export function currentWorkWeek(instant = new Date()) {
  const monday = new Date(workDay(instant) + "T12:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return {start: monday.toISOString().slice(0,10), end: sunday.toISOString().slice(0,10)};
}
