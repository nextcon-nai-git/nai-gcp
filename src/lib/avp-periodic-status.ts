export const AVP_PERIODIC_INTERVAL_MS = 60 * 60 * 1000;
export const AVP_PERIODIC_PROGRESS = {
  pending: { label: "Não iniciados", color: "#dc2626" },
  scheduled: { label: "Agendados", color: "#15803d" },
  received: { label: "ASOs recebidos", color: "#2563eb" },
  cancelled: { label: "Cancelados ou faltas", color: "#ca8a04" },
} as const;
export type PeriodicProgress = keyof typeof AVP_PERIODIC_PROGRESS | "unknown";
export function periodicProgress(status: string, receivedDate = ""): PeriodicProgress {
  const value = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const cancelled = /CANCELAD|FALTOU|\bFALTAS?\b|NAO COMPARECEU/.test(value);
  // A negative statement must never become evidence of completed progress.
  if (/\b(?:NAO|SEM|NUNCA)\b/.test(value) && !cancelled) {
    if (/^NAO (?:INICIAD[OA]|AGENDAD[OA])$/.test(value) && !receivedDate.trim()) return "pending";
    return "unknown";
  }
  const received =
    /ASOS? RECEBID|RECEBID[OA]S? ASOS?/.test(value) ||
    /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(receivedDate.trim());
  if (cancelled && received) return "unknown";
  if (cancelled) return "cancelled";
  if (received) return "received";
  if (/AGENDAD|REALIZAD|EXAME FEITO|AGUARDANDO ASO|COBRAR ASO/.test(value)) return "scheduled";
  if (/^(NAO INICIAD[OA]|EM CONTATO|CONTATO INICIADO|PENDENTE)$/.test(value)) return "pending";
  return "unknown";
}
