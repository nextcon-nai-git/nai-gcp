import { z } from "zod";

/** Accept only an existing Google Meet room; this does not create or verify the room. */
export function isValidMeetUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "meet.google.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export const appointmentSchema = z.object({
  pacienteEmail: z.string().trim().email("Informe o e-mail do paciente.").max(254),
  medicoEmail: z.string().trim().email("Informe o e-mail do médico.").max(254),
  titulo: z.string().trim().min(1).max(200),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  linkMeet: z.string().trim().refine(isValidMeetUrl, "Cole um link de sala Google Meet existente."),
});

export function prepareAppointment(input: unknown, now = new Date()) {
  const data = appointmentSchema.parse(input);
  // The scheduling form explicitly uses Brasília time, independent of device/server timezone.
  const start = new Date(`${data.data}T${data.hora}:00-03:00`);
  const calendarDate = new Date(`${data.data}T12:00:00Z`);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== data.data ||
    start <= now
  ) {
    throw new Error("Escolha uma data válida e um horário futuro (Brasília).");
  }
  return { ...data, start, end: new Date(start.getTime() + 30 * 60_000) };
}
