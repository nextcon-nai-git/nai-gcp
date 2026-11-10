import React, { useId, useState } from "react";
import { AlertCircle, ChevronDown, FileText, MapPin, Search } from "lucide-react";
import { PIPELINE_STEPS_CONFIG } from "@/lib/aso-scheduler-data";
import type {
  AsoAgentAlert,
  AsoPipelineStep,
  AsoRequest,
  ExamType,
} from "@/types/aso-scheduler-types";

const steps = Object.keys(PIPELINE_STEPS_CONFIG) as AsoPipelineStep[];
const examNames: Record<ExamType, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  demissional: "Demissional",
  retorno_trabalho: "Retorno ao trabalho",
  mudanca_funcao: "Mudança de função",
};
const nextAction: Record<AsoPipelineStep, string> = {
  solicitado: "Conferir a solicitação",
  validando: "Revisar os exames previstos no PCMSO",
  exames_definidos: "Selecionar a clínica",
  clinica_selecionada: "Combinar a data com a clínica",
  agendado: "Conferir o kit do atendimento",
  kit_montado: "Conferir o envio do kit",
  kit_enviado: "Acompanhar a confirmação da clínica",
  clinica_confirmou: "Conferir o comparecimento",
  exame_realizado: "Conferir o recebimento e o arquivamento do ASO",
  aso_concluido: "Atendimento concluído",
};
const priority = { CRITICAL: 3, WARNING: 2, INFO: 1 };
const control =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-200 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-cyan-300";
const stageLabel = (stage: AsoPipelineStep) =>
  PIPELINE_STEPS_CONFIG[stage].label.replace(/^\d+\.\s*/, "");
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
function humanAlert(request: AsoRequest) {
  return (request.alerts ?? []).reduce<AsoAgentAlert | undefined>(
    (top, item) =>
      item.status === "PENDING" &&
      item.requiresHumanIntervention &&
      (!top || priority[item.severity] > priority[top.severity])
        ? item
        : top,
    undefined
  );
}
function clinicOf(request: AsoRequest) {
  const name = request.clinicName?.trim();
  return name && fold(name) !== "a confirmar" ? name : undefined;
}
function appointment(request: AsoRequest) {
  const date = request.appointmentDate?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
  return [date, request.appointmentTime].filter(Boolean).join(" às ");
}
type CardControls = {
  busy: boolean;
  dragProps: (request: AsoRequest) => React.HTMLAttributes<HTMLDivElement>;
  onMove: (request: AsoRequest, stage: AsoPipelineStep) => void;
  onSelect: (request: AsoRequest) => void;
  onKit: (request: AsoRequest) => void;
};

function RequestCard({
  request,
  busy,
  dragProps,
  onMove,
  onSelect,
  onKit,
}: CardControls & { request: AsoRequest }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const alert = humanAlert(request);
  const when = appointment(request);
  return (
    <div
      {...dragProps(request)}
      onClick={(event) => {
        if (!(event.target as Element).closest("button, label, select")) onSelect(request);
      }}
      className={`space-y-3 rounded-xl border bg-slate-900 p-3 shadow-sm ${alert ? "border-amber-600/70" : "border-slate-700"}`}
    >
      <div>
        <span className="text-xs font-medium text-cyan-300">
          {examNames[request.examType] ?? request.examType}
        </span>
        <h4 className="mt-1 break-words text-base font-semibold leading-tight text-white">
          {request.employeeName}
        </h4>
        <p className="mt-1 break-words text-sm text-slate-300">
          {[request.companyName, request.requestedCity].filter(Boolean).join(" · ")}
        </p>
      </div>
      {when && <p className="text-xs text-slate-300">Agendamento · {when}</p>}
      <div className="text-sm">
        {alert ? (
          <div className="rounded-lg bg-amber-400/10 px-2.5 py-2 text-amber-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              Ação da equipe
            </div>
            <p className="mt-1 break-words">
              {alert.message || alert.suggestedAction || "Revisar o alerta do atendimento"}
            </p>
            {alert.message && alert.suggestedAction && alert.suggestedAction !== alert.message && (
              <p className="mt-1 break-words text-xs">{alert.suggestedAction}</p>
            )}
          </div>
        ) : (
          <p className="text-slate-200">{nextAction[request.status]}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-700/70 pt-1.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`Detalhes de ${request.employeeName}`}
          onClick={() => {
            setExpanded(!expanded);
            onSelect(request);
          }}
          className="min-h-11 rounded-md px-2 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-cyan-300"
        >
          Detalhes
        </button>
        <label
          className={`relative inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-cyan-300 ${busy || request.status === "aso_concluido" ? "bg-slate-800 text-slate-400" : "bg-cyan-400/15 text-cyan-200"}`}
        >
          Mover <ChevronDown className="size-4" aria-hidden="true" />
          <select
            aria-label={`Mover cartão de ${request.employeeName}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            disabled={busy || request.status === "aso_concluido"}
            value={request.status}
            onChange={(event) => onMove(request, event.target.value as AsoPipelineStep)}
          >
            {steps.map((step) => (
              <option key={step} value={step}>
                {stageLabel(step)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div id={detailsId} hidden={!expanded}>
        {expanded && (
          <div className="space-y-2 border-t border-slate-700 pt-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 [&_dt]:text-slate-400 [&_dd]:break-words">
              <dt>Pedido</dt>
              <dd className="min-w-0">{request.id}</dd>
              {request.roleTitle && (
                <>
                  <dt>Cargo</dt>
                  <dd>{request.roleTitle}</dd>
                </>
              )}
              <dt>Clínica</dt>
              <dd>{clinicOf(request) || "A confirmar"}</dd>
              <dt>Exames</dt>
              <dd>
                {request.exams
                  ?.map((exam) => exam.name)
                  .filter(Boolean)
                  .join(", ") || "Sem exames listados"}
              </dd>
              {request.source === "rd-conversas" && (
                <>
                  <dt>Origem</dt>
                  <dd>RD Conversas</dd>
                </>
              )}
            </dl>
            {request.digitalKit && (
              <button type="button" className={control} onClick={() => onKit(request)}>
                <FileText aria-hidden="true" className="size-4" />
                Abrir kit deste pedido
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CardList({ requests, ...controls }: CardControls & { requests: AsoRequest[] }) {
  const [limit, setLimit] = useState(20);
  return (
    <div className="space-y-2">
      {requests.slice(0, limit).map((request) => (
        <RequestCard key={request.id} request={request} {...controls} />
      ))}
      {requests.length > limit && (
        <button type="button" className={`${control} w-full`} onClick={() => setLimit(limit + 20)}>
          Mostrar mais ({requests.length - limit})
        </button>
      )}
    </div>
  );
}

function CityGroup({
  city,
  requests,
  expanded,
  onToggle,
  ...controls
}: CardControls & {
  city: string;
  requests: AsoRequest[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const clinics = [...new Set(requests.map(clinicOf).filter(Boolean))];
  const withoutClinic = requests.filter((request) => !clinicOf(request)).length;
  const linkedKits = requests.filter((request) => request.digitalKit).length;
  const sentKits = requests.filter((request) => request.digitalKit?.kitSentAt).length;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="w-full space-y-1.5 rounded-xl p-3 text-left hover:bg-slate-800"
      >
        <span className="flex items-center gap-2 font-semibold text-white">
          <MapPin className="size-4 shrink-0 text-cyan-300" aria-hidden="true" />
          Periódicos · {city}
          <ChevronDown
            aria-hidden="true"
            className={`ml-auto size-4 shrink-0 ${expanded ? "rotate-180" : ""}`}
          />
        </span>
        <span className="block text-sm text-slate-300">
          {requests.length} {requests.length === 1 ? "pedido" : "pedidos"} ·{" "}
          {requests.reduce((sum, req) => sum + (req.exams?.length ?? 0), 0)} exames
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-slate-300">
          {withoutClinic > 0 && <span>Sem clínica: {withoutClinic}</span>}
          {linkedKits < requests.length && (
            <span>Sem kit vinculado: {requests.length - linkedKits}</span>
          )}
          {linkedKits > 0 && <span>Com kit vinculado: {linkedKits}</span>}
          {sentKits > 0 && <span>Envio registrado: {sentKits}</span>}
        </span>
        {clinics.length > 0 && (
          <span className="block text-xs text-cyan-200">{clinics.join(", ")}</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-700 p-2">
          <CardList requests={requests} {...controls} />
        </div>
      )}
    </div>
  );
}

type QueueFilters = {
  query: string;
  stage: AsoPipelineStep | "";
  needsAction: boolean;
  groupCities: boolean;
};
export const initialQueueFilters: QueueFilters = {
  query: "",
  stage: "",
  needsAction: false,
  groupCities: false,
};
type QueueProps = CardControls & {
  filters: QueueFilters;
  setFilters: React.Dispatch<React.SetStateAction<QueueFilters>>;
  requests: AsoRequest[];
  ready: boolean;
  loadError: string;
  stageDropProps: (stage: AsoPipelineStep) => React.HTMLAttributes<HTMLDivElement>;
  dropTarget: AsoPipelineStep | null;
  expandedCities: Set<string>;
  onToggleCity: (key: string) => void;
};
export function SchedulingQueue({
  requests,
  ready,
  loadError,
  stageDropProps,
  dropTarget,
  expandedCities,
  onToggleCity,
  filters,
  setFilters,
  ...controls
}: QueueProps) {
  const { query, stage, needsAction, groupCities } = filters;
  const update = (change: Partial<QueueFilters>) =>
    setFilters((current) => ({ ...current, ...change }));
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const hasFilters = terms.length > 0 || !!stage || needsAction;
  const actionCount = requests.filter((request) => humanAlert(request)).length;
  const filtered = requests.filter((request) => {
    if ((stage && request.status !== stage) || (needsAction && !humanAlert(request))) return false;
    if (!terms.length) return true;
    const searchable = fold(
      [
        request.id,
        request.employeeName,
        request.companyName,
        request.requestedCity,
        clinicOf(request),
        examNames[request.examType],
      ]
        .filter(Boolean)
        .join(" ")
    );
    return terms.every((term) => searchable.includes(term));
  });
  const clear = () => update({ query: "", stage: "", needsAction: false });
  return (
    <section aria-label="Fila de atendimentos" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 focus-within:ring-2 focus-within:ring-cyan-300 sm:w-auto sm:flex-1">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            aria-label="Buscar atendimentos"
            type="search"
            placeholder="Nome, pedido, cidade, empresa ou clínica"
            value={query}
            onChange={(e) => update({ query: e.target.value })}
            className="min-w-0 w-full bg-transparent py-2 text-base text-white outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          aria-label="Filtrar por etapa"
          value={stage}
          onChange={(e) => update({ stage: e.target.value as QueueFilters["stage"] })}
          className={`${control} max-w-full bg-slate-900`}
        >
          <option value="">Todas as etapas</option>
          {steps.map((key) => (
            <option value={key} key={key}>
              {stageLabel(key)}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={needsAction}
          className={`${control} aria-pressed:border-amber-400 aria-pressed:bg-amber-400/15 aria-pressed:text-amber-100`}
          onClick={() => update({ needsAction: !needsAction })}
        >
          Ação da equipe ({actionCount})
        </button>
        <button
          type="button"
          aria-pressed={groupCities}
          className={`${control} aria-pressed:border-cyan-400 aria-pressed:bg-cyan-400/15`}
          onClick={() => update({ groupCities: !groupCities })}
        >
          Agrupar por cidade
        </button>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p role="status" className="text-sm text-slate-300">
          {ready &&
            `${filtered.length} de ${requests.length} ${requests.length === 1 ? "atendimento carregado" : "atendimentos carregados"}`}
        </p>
        {hasFilters && (
          <button
            type="button"
            className="min-h-11 rounded px-2 text-sm font-medium text-cyan-300 underline"
            onClick={clear}
          >
            Limpar filtros
          </button>
        )}
      </div>
      {!ready ? (
        !loadError && <p role="status">Carregando atendimentos…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-300">
          {requests.length
            ? "Nenhum atendimento corresponde aos filtros."
            : "Nenhum atendimento cadastrado nesta fila."}
        </p>
      ) : (
        <div className="md:overflow-x-auto md:pb-3">
          <div className="flex flex-col gap-3 md:w-max md:min-w-full md:flex-row md:items-start">
            {steps
              .filter((key) => !stage || stage === key)
              .map((key) => {
                const list = filtered.filter((request) => request.status === key);
                const emptyColumn = hasFilters
                  ? "hidden md:order-last md:block"
                  : "hidden md:block";
                const cities = new Map<string, AsoRequest[]>();
                const single: AsoRequest[] = [];
                for (const request of list) {
                  const city =
                    groupCities &&
                    request.examType === "periodico" &&
                    request.requestedCity?.trim().toLocaleUpperCase("pt-BR");
                  if (!city) single.push(request);
                  else {
                    const members = cities.get(city);
                    if (members) members.push(request);
                    else cities.set(city, [request]);
                  }
                }
                return (
                  <div
                    key={key}
                    data-aso-stage={key}
                    {...stageDropProps(key)}
                    className={`w-full space-y-2 rounded-xl border bg-slate-950/80 p-2.5 md:w-72 md:shrink-0 ${list.length ? "" : emptyColumn} ${dropTarget === key ? "border-cyan-400" : "border-slate-800"}`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-1">
                      <h3
                        className={`rounded-lg px-2 py-1 text-sm font-semibold ${PIPELINE_STEPS_CONFIG[key].badgeColor}`}
                      >
                        {stageLabel(key)}
                      </h3>
                      <span className="px-1 text-sm tabular-nums text-slate-300">
                        {list.length}
                      </span>
                    </div>
                    {single.length > 0 && <CardList requests={single} {...controls} />}
                    {[...cities].map(([city, members]) => {
                      const groupKey = `${key}:${city}`;
                      return (
                        <CityGroup
                          key={groupKey}
                          city={city}
                          requests={members}
                          expanded={expandedCities.has(groupKey)}
                          onToggle={() => onToggleCity(groupKey)}
                          {...controls}
                        />
                      );
                    })}
                    {!list.length && (
                      <p className="rounded-lg border border-dashed border-slate-800 py-4 text-center text-xs text-slate-400">
                        Sem atendimentos
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </section>
  );
}
