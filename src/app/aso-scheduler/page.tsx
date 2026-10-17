import { redirect } from "next/navigation";
import { asoWorkspaceHref, type AsoSearchParams } from "@/lib/aso-workspace-navigation";

export default async function AsoSchedulerPage({
  searchParams,
}: {
  searchParams: Promise<AsoSearchParams>;
}) {
  redirect(asoWorkspaceHref("agendamento", await searchParams));
}
