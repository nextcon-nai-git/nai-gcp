import { describe, expect, it } from "vitest";
import { isValidMeetUrl, prepareAppointment } from "./telemedicine";

const input = {
  pacienteEmail: "paciente@example.com",
  medicoEmail: "medico@example.com",
  titulo: "Consulta",
  data: "2026-10-20",
  hora: "09:30",
  linkMeet: "https://meet.google.com/abc-defg-hij",
};
const now = new Date("2026-10-10T12:00:00Z");
describe("Agendamento real de telemedicina", () => {
  it.each([
    "javascript:alert(1)",
    "https://meet.google.com.evil.test/abc-defg-hij",
    "https://evil.test/abc-defg-hij",
    "https://user@meet.google.com/abc-defg-hij",
    "https://meet.google.com/nai-abc-defg-hij",
    "https://meet.google.com/abc-defg-hij?auth=secret",
    "https://meet.google.com/abc-defg-hij#x",
    "http://meet.google.com/abc-defg-hij",
  ])("rejeita link inválido ou simulado: %s", (url) => expect(isValidMeetUrl(url)).toBe(false));
  it("preserva a sala informada e agenda em Brasília, sem depender do fuso do dispositivo", () => {
    const result = prepareAppointment(input, now);
    expect(result.start.toISOString()).toBe("2026-10-20T12:30:00.000Z");
    expect(result.end.toISOString()).toBe("2026-10-20T13:00:00.000Z");
    expect(result.linkMeet).toBe(input.linkMeet);
  });
  it.each([
    { data: "2026-02-30" },
    { data: "2026-10-01" },
    { hora: "25:00" },
    { medicoEmail: "" },
    { linkMeet: "" },
  ])("rejeita agendamento incompleto/inválido %j", (change) =>
    expect(() => prepareAppointment({ ...input, ...change }, now)).toThrow()
  );
});
