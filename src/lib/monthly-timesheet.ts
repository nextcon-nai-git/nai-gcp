/** Read-only reporting over original internal records. Does not perform payroll treatment. */
export interface TimesheetPunch {
  id: string;
  type: string;
  time: string;
  date: string;
  timestamp: string;
  reference?: string;
  hash?: string;
}
const types = ["entrada", "almoco_saida", "almoco_retorno", "saida"];
export const punchLabels: Record<string, string> = {
  entrada: "Entrada",
  almoco_saida: "Saída intervalo",
  almoco_retorno: "Retorno intervalo",
  saida: "Saída",
};
export function monthPeriod(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900) return null;
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const next =
    number === 12 ? `${year + 1}-01-01` : `${year}-${String(number + 1).padStart(2, "0")}-01`;
  return { start: `${month}-01`, end: `${month}-${days}`, next, days };
}
export function hours(seconds: number) {
  seconds = Math.floor(seconds);
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function monthlyRows(month: string, punches: TimesheetPunch[]) {
  const period = monthPeriod(month);
  if (!period) return [];
  return Array.from({ length: period.days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const entries = punches
      .filter((p) => p.date === date)
      .sort(
        (a, b) =>
          String(a.timestamp || "").localeCompare(String(b.timestamp || "")) ||
          String(a.id).localeCompare(String(b.id))
      );
    const expected = entries.length === 2 ? ["entrada", "saida"] : types;
    const ordered = expected.map((type) => entries.find((p) => p.type === type));
    const valid =
      (entries.length === 4 || entries.length === 2) &&
      ordered.every(Boolean) &&
      ordered.every((p, index) => {
        if (
          !p ||
          !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(p.timestamp) ||
          !Number.isFinite(Date.parse(p.timestamp))
        )
          return false;
        const local = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(p.timestamp));
        const time = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(new Date(p.timestamp));
        return (
          local === date &&
          time === p.time &&
          (index === 0 || Date.parse(p.timestamp) > Date.parse(ordered[index - 1]!.timestamp))
        );
      });
    const intervals = valid
      ? ordered.length === 2
        ? [[ordered[0]!, ordered[1]!]]
        : [
            [ordered[0]!, ordered[1]!],
            [ordered[2]!, ordered[3]!],
          ]
      : [];
    const night = intervals.some(
      ([start, end]) => start.time < "05:00:00" || end.time > "22:00:00"
    );
    const seconds = valid
      ? intervals.reduce(
          (sum, [start, end]) =>
            sum + (Date.parse(end.timestamp) - Date.parse(start.timestamp)) / 1000,
          0
        )
      : null;
    return {
      date,
      entries,
      seconds,
      status: !entries.length
        ? "Sem marcações — conferir escala/ocorrência"
        : !valid
          ? "Marcações incompletas ou inconsistentes — conferir"
          : night
            ? "Apuração noturna pendente: conferir regime e hora reduzida"
            : "Intervalos diurnos calculados; tratamento pendente",
      night,
    };
  });
}
