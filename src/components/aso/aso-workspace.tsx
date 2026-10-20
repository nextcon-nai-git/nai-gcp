"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { CalendarDays, Stethoscope } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  asoWorkspaceHref,
  type AsoSearchParams,
  type AsoWorkspaceView,
} from "@/lib/aso-workspace-navigation";
import { cn } from "@/lib/utils";
const ClinicalWorkspace = dynamic(() => import("./clinical-workspace"), {
  loading: () => <p role="status">Carregando clínica…</p>,
});
const SchedulingWorkspace = dynamic(() => import("./scheduling-workspace"), {
  loading: () => <p role="status">Carregando agendamento…</p>,
});

const areas = [
  { id: "agendamento" as const, label: "Agendamento e kits", icon: CalendarDays },
  { id: "clinica" as const, label: "Clínica e ASO digital", icon: Stethoscope },
];

export function AsoWorkspace({
  view,
  searchParams = {},
}: {
  view: AsoWorkspaceView;
  searchParams?: AsoSearchParams;
}) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-700 bg-slate-950 p-5 text-white sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          ASO — Agendamento e Clínica
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Solicitações, kits para clínicas, agenda, atendimento e revisão do ASO em um só lugar.
        </p>
        <nav aria-label="Áreas de ASO" className="mt-5 flex flex-wrap gap-2">
          {areas.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={asoWorkspaceHref(id, searchParams)}
              scroll={false}
              aria-current={view === id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-300",
                view === id
                  ? "border-cyan-500 bg-cyan-600 text-white"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <ErrorBoundary key={view}>
        {view === "agendamento" ? <SchedulingWorkspace /> : <ClinicalWorkspace />}
      </ErrorBoundary>
    </div>
  );
}
