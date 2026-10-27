import type { OpsTask } from "@/types/schema";

export const priorityLabels = { low: "Baixa", medium: "Média", high: "Alta", critical: "Crítica" };
export function taskDate(value?: string): string {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (!match) return "";
  const parsed = new Date(`${match[1]}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === match[1]
    ? match[1]
    : "";
}
export function displayTaskDate(value?: string) {
  const day = taskDate(value);
  return day ? day.split("-").reverse().join("/") : "Sem prazo";
}
export function taskKey(task: OpsTask) {
  return `${task.companyId}/${task.id}`;
}
export function isOverdue(task: OpsTask, today: string) {
  const day = taskDate(task.dueDate);
  return !!day && day < today && !["done", "archived"].includes(task.status);
}
export function hasCoordinates(task: OpsTask) {
  return (
    typeof task.latitude === "number" &&
    typeof task.longitude === "number" &&
    Number.isFinite(task.latitude) &&
    Number.isFinite(task.longitude) &&
    Math.abs(task.latitude) <= 90 &&
    Math.abs(task.longitude) <= 180
  );
}
const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export function taskCalendar(tasks: OpsTask[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NEXTCON//NAI Cards//PT-BR",
    "CALSCALE:GREGORIAN",
  ];
  for (const task of tasks) {
    const day = taskDate(task.dueDate);
    if (!day) continue;
    const end = new Date(`${day}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(taskKey(task))}@nai.nextconsaude.com.br`,
      `DTSTAMP:${now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z/, "Z")}`,
      `DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(task.companyName || "")}`,
      `LOCATION:${escapeIcs(task.location || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  // Fold at 75 UTF-8 octets without splitting multibyte characters (RFC 5545).
  return (
    lines
      .map((line) => {
        let result = "",
          bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            result += "\r\n ";
            bytes = 1;
          }
          result += char;
          bytes += size;
        }
        return result;
      })
      .join("\r\n") + "\r\n"
  );
}
export function downloadTaskCalendar(tasks: OpsTask[]) {
  const url = URL.createObjectURL(
    new Blob([taskCalendar(tasks)], { type: "text/calendar;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "nai-agenda.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
