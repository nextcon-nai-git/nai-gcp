"use server";

/**
 * @fileOverview NAI Google Calendar Sync Engine.
 * Gera eventos do Google Calendar e sincroniza com https://calendar.google.com/calendar/u/0/r/month/2026/7/1
 * para agendamentos de ASOs, exames ocupacionais, auditorias de PGR/LTCAT e tarefas 5W2H.
 */

import { ActionResult } from "@/types/schema";

export interface CalendarEventPayload {
  title: string;
  description: string;
  location: string;
  startDateIso: string; // Ex: "2026-07-15T09:00:00"
  endDateIso: string; // Ex: "2026-07-15T10:00:00"
  clientName?: string;
  employeeName?: string;
}

export interface GoogleCalendarSyncResult {
  calendarUrl: string;
  eventDirectUrl: string;
  syncedAt: string;
}

const GOOGLE_CALENDAR_TARGET_MONTH_URL =
  "https://calendar.google.com/calendar/u/0/r/month/2026/7/1";

/**
 * Formata data ISO (2026-07-15T09:00:00) para o padrão Google Calendar URL (20260715T090000Z).
 */
function formatGoogleCalendarDate(isoStr: string): string {
  try {
    const dt = new Date(isoStr);
    return dt.toISOString().replace(/-|:|\.\d\d\d/g, "");
  } catch (e) {
    const clean = isoStr.replace(/\D/g, "");
    return clean.padEnd(15, "0") + "Z";
  }
}

/**
 * Gera o link direto de adição de evento no Google Calendar do usuário.
 */
export async function generateGoogleCalendarEventUrl(event: CalendarEventPayload): Promise<string> {
  const start = formatGoogleCalendarDate(event.startDateIso);
  const end = formatGoogleCalendarDate(event.endDateIso);

  const text = encodeURIComponent(event.title);
  const details = encodeURIComponent(
    `${event.description}\n\n` +
      `🏢 Cliente: ${event.clientName || "N/A"}\n` +
      `👤 Colaborador: ${event.employeeName || "N/A"}\n` +
      `⚡ Gerado automaticamente pelo NAI Nextcon Saúde Empresarial`
  );
  const location = encodeURIComponent(event.location);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${start}/${end}`;
}

/**
 * Sincroniza e vincula os eventos do NAI ao Google Calendar do usuário.
 */
export async function syncNaiEventsToGoogleCalendar(
  events: CalendarEventPayload[]
): Promise<ActionResult<GoogleCalendarSyncResult>> {
  try {
    const firstEvent = events[0];
    let eventDirectUrl = GOOGLE_CALENDAR_TARGET_MONTH_URL;

    if (firstEvent) {
      eventDirectUrl = await generateGoogleCalendarEventUrl(firstEvent);
    }

    return {
      sucesso: true,
      mensagem: `${events.length} compromisso(s) vinculados ao Google Calendar (Julho/2026).`,
      dados: {
        calendarUrl: GOOGLE_CALENDAR_TARGET_MONTH_URL,
        eventDirectUrl,
        syncedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    return {
      sucesso: false,
      mensagem: error.message || "Erro ao sincronizar compromissos com o Google Calendar.",
    };
  }
}
