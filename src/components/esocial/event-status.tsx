import { ESOCIAL_MESSAGE_STATUSES, type EsocialMessageEvent } from "@/lib/esocial-messaging";

export function EventStatus({ event }: { event: Pick<EsocialMessageEvent, "status" | "receipt"> }) {
  const accepted = event.status === "accepted" && !!event.receipt;
  const uncertain = event.status === "uncertain" || (event.status === "accepted" && !event.receipt);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${accepted ? "bg-green-50 text-green-800" : uncertain || event.status === "rejected" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}
    >
      {event.status === "accepted" && !event.receipt
        ? "Conferir aceite: recibo ausente"
        : ESOCIAL_MESSAGE_STATUSES[event.status] || "Status a conferir"}
    </span>
  );
}
