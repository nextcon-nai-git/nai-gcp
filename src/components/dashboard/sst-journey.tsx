"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, HeartPulse, ListChecks, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const journeys = [
  {
    id: "prevent",
    label: "Prevenir riscos",
    icon: ShieldCheck,
    title: "Do documento à prevenção em campo",
    description:
      "Reúna os documentos, confira os riscos e transforme as medidas de prevenção em ações acompanhadas.",
    steps: [
      "Conferir documentos e unidade",
      "Revisar inventário de riscos",
      "Acompanhar medidas e evidências",
    ],
    links: [
      { label: "Documentos do cliente", href: "/clients", scoped: "client" },
      { label: "Inventário de riscos", href: "/risk-management", scoped: "query" },
      { label: "Plano de ação", href: "/action-plans", scoped: "query" },
    ],
  },
  {
    id: "exams",
    label: "Organizar exames",
    icon: CalendarClock,
    title: "Uma jornada mais clara até a entrega do ASO",
    description:
      "Organize a solicitação, localize a rede de atendimento e acompanhe a conclusão no módulo de saúde.",
    steps: [
      "Preparar solicitação de exame",
      "Consultar a rede credenciada",
      "Conferir atendimento e ASO",
    ],
    links: [
      { label: "Agendamento de ASO", href: "/aso-scheduler" },
      { label: "Rede credenciada", href: "/accredited-network" },
      { label: "Clínica e ASO digital", href: "/health-control" },
    ],
  },
  {
    id: "followup",
    label: "Acompanhar afastamentos",
    icon: HeartPulse,
    title: "Continuidade do acompanhamento do trabalhador",
    description:
      "Acesse os registros de ausência e organize as próximas providências com a equipe responsável.",
    steps: [
      "Consultar registros de ausência",
      "Conferir documentação recebida",
      "Organizar acompanhamento e retorno",
    ],
    links: [
      { label: "Gestão de absenteísmo", href: "/absenteeism" },
      { label: "Atestados médicos", href: "/medical-certificates" },
      { label: "Ações de acompanhamento", href: "/action-plans", scoped: "query" },
    ],
  },
  {
    id: "deliver",
    label: "Gerir entregas",
    icon: ListChecks,
    title: "Responsáveis, prazos e evidências no mesmo fluxo",
    description: "Converta pendências em entregas verificáveis e acompanhe o trabalho por cliente.",
    steps: [
      "Revisar prioridades",
      "Definir responsável e prazo",
      "Registrar evidência de conclusão",
    ],
    links: [
      { label: "Centro de operação", href: "/action-plans", scoped: "query" },
      { label: "Responsáveis e prazos", href: "/action-plans", scoped: "query" },
      { label: "Evidências da ação", href: "/action-plans", scoped: "query" },
    ],
  },
];

export function SstJourney({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName?: string;
}) {
  const [selected, setSelected] = useState("prevent");
  const journey = journeys.find((item) => item.id === selected)!;
  const scoped = !!companyId && !["all", "unauthorized"].includes(companyId);
  return (
    <section
      aria-labelledby="sst-journey-title"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
          Jornada integrada
        </p>
        <h2 id="sst-journey-title" className="mt-2 text-xl font-semibold text-slate-900">
          O que você precisa resolver agora?
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Escolha uma etapa para acessar os módulos e os próximos passos.
        </p>
        <div
          className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Etapas da jornada"
        >
          {journeys.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === selected}
              aria-controls="sst-journey-detail"
              onClick={() => setSelected(id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2",
                id === selected
                  ? "border-teal-700 bg-teal-50 text-teal-900"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        id="sst-journey-detail"
        className="grid gap-6 bg-slate-50/60 p-5 sm:p-6 lg:grid-cols-[1fr_1.2fr]"
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{journey.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{journey.description}</p>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            {scoped
              ? `Cliente selecionado: ${companyName || "consulte o seletor acima"}.`
              : "Selecione um cliente acima para abrir seus documentos e ações."}{" "}
            Nos módulos de atendimento, confira a empresa e o colaborador antes de registrar
            informações.
          </p>
        </div>
        <ol className="space-y-2">
          {journey.steps.map((step, index) => {
            const link = journey.links[index];
            const href =
              scoped && link.scoped === "client"
                ? `/clients/${encodeURIComponent(companyId)}`
                : scoped && link.scoped === "query"
                  ? `${link.href}?company=${encodeURIComponent(companyId)}`
                  : link.href;
            return (
              <li key={step}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-800"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-800">{step}</span>
                    <span className="text-xs text-slate-500">{link.label}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-teal-700" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
