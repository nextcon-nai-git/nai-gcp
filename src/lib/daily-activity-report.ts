import { z } from "zod";
export const dailyReportSchema = z.object({
  employeeName: z.string().trim().min(3).max(120),
  contractType: z.enum(["CLT", "PJ"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T12:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, "Data inválida"),
  reportText: z.string().trim().min(5).max(20000),
});
export function activityLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
}
export function normalizedEmployeeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
