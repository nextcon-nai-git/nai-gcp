import { collection, limit, orderBy, query, where, type Firestore } from "firebase/firestore";

export const CLINICAL_QUEUE_PAGE_SIZE = 50;

export function clinicalQueueToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayBounds(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return null;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return { start: `${day}T00:00:00`, end: `${parsed.toISOString().slice(0, 10)}T00:00:00` };
}

/** Queries remain scoped to a company's collection. The extra row signals more results. */
export function clinicalQueueQuery(
  db: Firestore,
  companyId: string,
  mode: "scheduled" | "active" | "completed",
  day: string,
  visibleLimit = CLINICAL_QUEUE_PAGE_SIZE
) {
  if (
    !companyId ||
    companyId.length > 128 ||
    /[\/\u0000]/.test(companyId) ||
    ["all", "unauthorized", ".", ".."].includes(companyId) ||
    !Number.isSafeInteger(visibleLimit) ||
    visibleLimit < 1
  )
    return null;
  const appointments = collection(db, "companies", companyId, "agendamentos");
  if (mode === "active") {
    // No date condition: an unfinished consultation must survive midnight or
    // selection of another agenda day. Default document ordering also retains
    // older appointments whose scheduled time is missing.
    return query(
      appointments,
      where("status", "in", ["Em Espera", "Em Atendimento"]),
      limit(visibleLimit + 1)
    );
  }
  if (mode === "completed")
    return query(
      appointments,
      where("status", "==", "Concluído"),
      orderBy("completedAt", "desc"),
      limit(visibleLimit + 1)
    );
  const bounds = dayBounds(day);
  if (!bounds) return null;
  return query(
    appointments,
    where("status", "==", "Agendado"),
    where("data_hora", ">=", bounds.start),
    where("data_hora", "<", bounds.end),
    orderBy("data_hora", "asc"),
    limit(visibleLimit + 1)
  );
}

export function clinicalQueuePage<T>(items: readonly T[] | null, visibleLimit: number) {
  return {
    items: items?.slice(0, visibleLimit) ?? [],
    hasMore: (items?.length ?? 0) > visibleLimit,
  };
}
