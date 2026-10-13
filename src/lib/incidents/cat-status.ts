/** Displays recorded data only; it does not infer clinical facts or legal deadlines. */
export interface CatStatusInfo {
  requiresCat: boolean | null;
  severity: "LEVE" | "GRAVE" | "FATAL" | null;
  hasLeave: boolean | null;
  daysOfLeave: number | null;
  label: string;
  badgeClass: string;
  isExpired: boolean;
  isCritical: boolean;
  deadlineTs?: number;
}

export function getCatInfo(incident: Record<string, unknown>, now = Date.now()): CatStatusInfo {
  const severity = ["LEVE", "GRAVE", "FATAL"].includes(String(incident.severity))
    ? (incident.severity as CatStatusInfo["severity"])
    : null;
  const hasLeave = typeof incident.hasLeave === "boolean" ? incident.hasLeave : null;
  const daysOfLeave =
    hasLeave === true &&
    typeof incident.daysOfLeave === "number" &&
    Number.isInteger(incident.daysOfLeave) &&
    incident.daysOfLeave >= 0
      ? incident.daysOfLeave
      : null;
  const requiresCat =
    typeof incident.requiresCatS2210 === "boolean" ? incident.requiresCatS2210 : null;
  const info: CatStatusInfo = {
    requiresCat,
    severity,
    hasLeave,
    daysOfLeave,
    label: "CAT a confirmar na revisão",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    isExpired: false,
    isCritical: false,
  };
  if (incident.catStatus === "EMITIDA")
    return { ...info, label: "Emissão informada — conferir recibo" };
  if (requiresCat === null) return info;
  if (!requiresCat) return { ...info, label: "CAT não indicada no registro" };

  const deadline = incident.catDeadlineTimestamp;
  if (
    typeof deadline !== "number" ||
    !Number.isFinite(deadline) ||
    deadline <= 0 ||
    !Number.isFinite(new Date(deadline).getTime())
  )
    return { ...info, label: "Prazo da CAT a confirmar" };
  const isExpired = deadline <= now;
  return {
    ...info,
    deadlineTs: deadline,
    isExpired,
    isCritical: isExpired || deadline - now < 6 * 3_600_000,
    label: isExpired ? "Prazo registrado ultrapassado" : "Prazo registrado — conferir",
    badgeClass: isExpired
      ? "bg-red-100 text-red-700 border-red-300"
      : "bg-amber-100 text-amber-800 border-amber-300",
  };
}
