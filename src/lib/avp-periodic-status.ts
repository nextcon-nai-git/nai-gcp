export const AVP_PERIODIC_INTERVAL_MS = 60 * 60 * 1000;
export const AVP_PERIODIC_PROGRESS = {
  pending: { label: "Não iniciados", color: "#dc2626" },
  scheduled: { label: "Agendados", color: "#15803d" },
  received: { label: "ASOs recebidos", color: "#2563eb" },
  cancelled: { label: "Cancelados ou faltas", color: "#ca8a04" },
} as const;
export type PeriodicProgress = keyof typeof AVP_PERIODIC_PROGRESS | "unknown";
function receiptDateStatus(value: string): "valid" | "invalid" | "absent" {
  const parts = /^(\d{1,4})([-/])(\d{1,2})\2(\d{1,4})$/.exec(value.trim());
  if (!parts) return "absent";
  const [, first, , middle, last] = parts;
  const [yearText, dayText] = first.length === 4 ? [first, last] : [last, first];
  if (![2, 4].includes(yearText.length) || dayText.length > 2) return "invalid";
  const year = Number(yearText) + (yearText.length === 2 ? 2000 : 0);
  const month = Number(middle);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year > 0 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? "valid"
    : "invalid";
}

export function periodicProgress(status: string, receivedDate = ""): PeriodicProgress {
  const value = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const unconfirmed = /\b(?:A CONFIRMAR|CONFIRMAR SE|(?:AGUARDANDO|SEM|PENDENTE DE) CONFIRMACAO)\b/.test(value);
  if (status.includes("?") || unconfirmed) return "unknown";
  const cancelled =
    /^(?:(?:EXAME|ASO|AGENDAMENTO) )?CANCELAD[OA](?: N A| SEM AVISO| PELO GESTOR)?$/.test(value) ||
    /^(?:(?:O |A )?COLABORADORA? )?(?:FALTOU|NAO COMPARECEU)(?: (?:AO|NO) EXAME| (?:A|NA) CONSULTA)?$/.test(value) ||
    /^(?:FALTAS?(?: AUSENCIA| D[OA] COLABORADORA?)?|AUSENCIA|(?:COLABORADORA? )?AUSENTE|NAO COMPARECIMENTO)$/.test(value);
  if (!cancelled && /\b(?:FALTAS?|FALTOU|AUSENCIA|AUSENTE|CANCELAD[OA])\b/.test(value))
    return "unknown";
  // A negative statement must never become evidence of completed progress.
  if (/\b(?:NAO|SEM|NUNCA)\b/.test(value) && !cancelled) {
    if (/^NAO (?:INICIAD[OA]|AGENDAD[OA])$/.test(value) && !receivedDate.trim()) return "pending";
    return "unknown";
  }
  const receiptDate = receiptDateStatus(receivedDate);
  if (receiptDate === "invalid") return "unknown";
  const received = /ASOS? RECEBID|RECEBID[OA]S? ASOS?/.test(value) || receiptDate === "valid";
  if (cancelled && received) return "unknown";
  if (cancelled) return "cancelled";
  if (received) return "received";
  if (/AGENDAD|REALIZAD|EXAME FEITO|AGUARDANDO ASO|COBRAR ASO/.test(value)) return "scheduled";
  if (/^(NAO INICIAD[OA]|EM CONTATO|CONTATO INICIADO|PENDENTE)$/.test(value)) return "pending";
  return "unknown";
}
