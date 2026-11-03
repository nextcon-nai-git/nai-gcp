"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupPeriodicWorkByCity } from "@/lib/avp-periodic-city-groups";
import {
  PERIODIC_STAGES,
  PERIODIC_STAGE_LABELS,
  type PeriodicWorkCard,
} from "@/lib/avp-periodic-workflow";

const CITY_PAGE_SIZE = 12;
const RECORD_PAGE_SIZE = 15;
const searchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const displayDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/")
    : value || "Prazo a definir";

type Props = {
  cards: PeriodicWorkCard[];
  busy: boolean;
  onEdit: (card: PeriodicWorkCard) => void;
  onHistory: (id: string) => void;
  onNavigate: () => void;
};

function Pagination({
  page,
  count,
  pageSize,
  onChange,
  label,
}: {
  page: number;
  count: number;
  pageSize: number;
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={label}>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Página {page + 1} de {Math.max(1, Math.ceil(count / pageSize))}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!page} onClick={() => onChange(page - 1)}>
          <ChevronLeft aria-hidden="true" /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(page + 1) * pageSize >= count}
          onClick={() => onChange(page + 1)}
        >
          Próxima <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

function RecordsTable({ cards, busy, onEdit, onHistory }: Omit<Props, "onNavigate">) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm" aria-label="Colaboradores e vínculos da campanha">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 font-medium">Colaborador / unidade</th>
            <th className="p-3 font-medium">Etapa operacional</th>
            <th className="p-3 font-medium">Responsável / prazo</th>
            <th className="p-3 font-medium">Agenda na fonte</th>
            <th className="p-3 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id} className="border-t align-top">
              <td className="p-3 min-w-48">
                <p className="font-medium">{card.person.name}</p>
                <p className="text-xs text-muted-foreground">
                  {card.person.unit || "Unidade ausente"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {card.person.city}/{card.person.uf}
                </p>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">Dados da convocação</summary>
                  <div className="mt-2 space-y-1">
                    <p>Admissão: {card.person.admission || "Não informada"}</p>
                    <p>
                      Fonte: {card.person.status} · {card.person.review || "Sem conferência"}
                    </p>
                    <p>Último exame: {card.person.lastExam || "Não informado"}</p>
                    <p>Periodicidade: {card.person.periodicityMonths || "A confirmar"} meses</p>
                    {card.person.reviewDetail && <p>{card.person.reviewDetail}</p>}
                    {card.person.asoReceivedAt && (
                      <p>ASO recebido na fonte: {card.person.asoReceivedAt}</p>
                    )}
                    {card.state && (
                      <p>
                        Último registro: {new Date(card.state.updatedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                </details>
              </td>
              <td className="p-3 min-w-40">
                <p>
                  {card.person.classification === "cancelled"
                    ? "Cancelado na fonte"
                    : PERIODIC_STAGE_LABELS[card.stage]}
                </p>
                {card.blocked && card.person.classification !== "cancelled" && (
                  <p className="mt-1 text-xs text-destructive">
                    Bloqueado: conferir vínculo, unidade ou duplicidade.
                  </p>
                )}
                {card.sourceChanged && (
                  <p className="mt-1 text-xs font-medium">
                    Fonte alterada: validar novamente. Histórico preservado.
                  </p>
                )}
              </td>
              <td className="p-3 min-w-36">
                <p>{card.state?.responsible || "Não informado"}</p>
                <p
                  className={
                    card.overdue
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {displayDate(card.state?.nextDate || null)}
                  {card.overdue ? " · Vencida" : ""}
                </p>
              </td>
              <td className="p-3 min-w-40 text-xs">
                {card.person.sourceAppointmentConflict ? (
                  <p>Agendas divergentes: conferir fonte.</p>
                ) : card.person.sourceAppointment ? (
                  <>
                    <p>{card.person.sourceAppointment.clinic || "Clínica a definir"}</p>
                    <p>
                      {card.person.sourceAppointment.date || "Data a definir"} ·{" "}
                      {card.person.sourceAppointment.time || "Horário a definir"}
                    </p>
                    {card.person.sourceAppointment.city && (
                      <p className="text-muted-foreground">
                        {card.person.sourceAppointment.city}/{card.person.sourceAppointment.uf}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Não informada</p>
                )}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onEdit(card)}
                    aria-label={`Registrar próxima ação de ${card.person.name} — ${card.person.unit}`}
                  >
                    <ClipboardList aria-hidden="true" /> Registrar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onHistory(card.id)}
                    aria-label={`Histórico e evidências de ${card.person.name} — ${card.person.unit}`}
                  >
                    <History aria-hidden="true" /> Histórico
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceAppointments({ cards }: { cards: PeriodicWorkCard[] }) {
  const [page, setPage] = useState(0);
  const groups = new Map<
    string,
    {
      campaignCityKey: string;
      campaignCity: string;
      campaignUf: string;
      unit: string;
      clinic: string;
      date: string;
      time: string;
      city: string;
      uf: string;
      count: number;
      conflict: boolean;
    }
  >();
  for (const card of cards) {
    const appointment = card.person.sourceAppointment;
    const values = {
      campaignCityKey: card.person.cityKey,
      campaignCity: card.person.city,
      campaignUf: card.person.uf,
      unit: card.person.unit || "Unidade ausente",
      clinic: appointment?.clinic || "Clínica a definir",
      date: appointment?.date || "Data a definir",
      time: appointment?.time || "Horário a definir",
      city: appointment?.city || "",
      uf: appointment?.uf || "",
      conflict: !!card.person.sourceAppointmentConflict,
    };
    const key = JSON.stringify(values);
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { ...values, count: 1 });
  }
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(groups.size / RECORD_PAGE_SIZE) - 1));
  if (!cards.length) return <p>Nenhum registro ativo nesta seleção.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Agendas informadas na fonte. A confirmação e o avanço permanecem individuais.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm" aria-label="Agendas por unidade e clínica">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 font-medium">Cidade / unidade</th>
              <th className="p-3 font-medium">Clínica</th>
              <th className="p-3 font-medium">Data / horário</th>
              <th className="p-3 font-medium">Registros</th>
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()]
              .slice(visiblePage * RECORD_PAGE_SIZE, (visiblePage + 1) * RECORD_PAGE_SIZE)
              .map(([key, group]) => (
                <tr key={key} className="border-t align-top">
                  <td className="p-3">
                    {group.unit}
                    <p className="text-xs text-muted-foreground">
                      {group.campaignCity}/{group.campaignUf}
                    </p>
                  </td>
                  <td className="p-3">
                    {group.conflict ? "Agendas divergentes: conferir fonte" : group.clinic}
                    {!group.conflict && group.city && (
                      <p className="text-xs text-muted-foreground">
                        {group.city}/{group.uf}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    {group.conflict ? (
                      "A conferir"
                    ) : (
                      <>
                        {group.date}
                        <p className="text-xs text-muted-foreground">{group.time}</p>
                      </>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{group.count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination
        label="Páginas de agendas"
        page={visiblePage}
        count={groups.size}
        pageSize={RECORD_PAGE_SIZE}
        onChange={setPage}
      />
    </div>
  );
}

export function AvpPeriodicCityBrowser({ cards, busy, onEdit, onHistory, onNavigate }: Props) {
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const cityButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusKey = useRef<string | null>(null);
  const [view, setView] = useState<"cities" | "people">("cities");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [owner, setOwner] = useState("");
  const [unit, setUnit] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [recordPage, setRecordPage] = useState(0);
  const [tab, setTab] = useState<"people" | "appointments" | "cancelled">("people");
  const groups = useMemo(() => groupPeriodicWorkByCity(cards), [cards]);
  const needle = searchText(query.trim());
  const filtered = cards.filter(
    (card) =>
      (!city || card.person.cityKey === city) &&
      (!unit || card.person.unit === unit) &&
      (!owner ||
        (owner === "unassigned" ? !card.state?.responsible : card.state?.responsible === owner)) &&
      (!filter ||
        (filter === "overdue"
          ? card.overdue
          : filter === "blocked"
            ? card.blocked
            : card.stage === filter)) &&
      (!needle ||
        searchText(
          `${card.person.city} ${card.person.uf} ${card.person.name} ${card.person.unit}`
        ).includes(needle))
  );
  const filteredIds = new Set(filtered.map((card) => card.id));
  const matchedGroups = groups.filter((group) =>
    group.cards.some((card) => filteredIds.has(card.id))
  );
  const selected = groups.find((group) => group.key === selectedKey);
  const selectedCityKey = selected?.key;
  useLayoutEffect(() => {
    if (selectedCityKey) detailHeading.current?.focus();
    else if (returnFocusKey.current) {
      cityButtons.current.get(returnFocusKey.current)?.focus();
      returnFocusKey.current = null;
    }
  }, [selectedCityKey]);
  const visiblePage = Math.min(
    page,
    Math.max(0, Math.ceil(matchedGroups.length / CITY_PAGE_SIZE) - 1)
  );
  const localCards = selected
    ? filtered.filter((card) => card.person.cityKey === selected.cityKey)
    : filtered;
  const active = localCards.filter((card) => card.person.classification !== "cancelled");
  const cancelled = localCards.filter((card) => card.person.classification === "cancelled");
  const currentTab = tab === "people" && !active.length && cancelled.length ? "cancelled" : tab;
  const records = currentTab === "cancelled" ? cancelled : active;
  const visibleRecordPage = Math.min(
    recordPage,
    Math.max(0, Math.ceil(records.length / RECORD_PAGE_SIZE) - 1)
  );
  const totalRecords = selected?.total ?? cards.length;
  function changeFilter(change: () => void) {
    change();
    setPage(0);
    setRecordPage(0);
    setSelectedKey(null);
    setTab("people");
    onNavigate();
  }
  function openCity(key: string) {
    returnFocusKey.current = key;
    setSelectedKey(key);
    setRecordPage(0);
    setTab("people");
    onNavigate();
  }
  function changeView(next: "cities" | "people") {
    setView(next);
    setSelectedKey(null);
    setRecordPage(0);
    onNavigate();
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Visão da campanha">
        <Button
          variant={view === "cities" ? "default" : "outline"}
          size="sm"
          aria-pressed={view === "cities"}
          onClick={() => changeView("cities")}
        >
          <MapPin aria-hidden="true" /> Cidades
        </Button>
        <Button
          variant={view === "people" ? "default" : "outline"}
          size="sm"
          aria-pressed={view === "people"}
          onClick={() => changeView("people")}
        >
          <Users aria-hidden="true" /> Colaboradores
        </Button>
        <span className="text-xs text-muted-foreground">
          Campanha 2026 · {groups.length} cidades · {cards.length} registros
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs sm:col-span-2 lg:col-span-4">
          <span className="flex items-center gap-1">
            <Search className="size-3" aria-hidden="true" /> Buscar cidade, colaborador ou unidade
          </span>
          <Input
            value={query}
            onChange={(event) => changeFilter(() => setQuery(event.target.value))}
            type="search"
            placeholder="Buscar na campanha"
          />
        </label>
        <label className="space-y-1 text-xs">
          Cidade
          <select
            aria-label="Cidade dos registros"
            className="block w-full rounded border bg-background p-2 text-sm"
            value={city}
            onChange={(event) => changeFilter(() => setCity(event.target.value))}
          >
            <option value="">Todas as cidades</option>
            {[...groups]
              .sort((a, b) => a.city.localeCompare(b.city, "pt-BR"))
              .map((group) => (
                <option key={group.key} value={group.cityKey}>
                  {group.city}/{group.uf}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Responsável
          <select
            aria-label="Responsável dos registros"
            className="block w-full rounded border bg-background p-2 text-sm"
            value={owner}
            onChange={(event) => changeFilter(() => setOwner(event.target.value))}
          >
            <option value="">Todos os responsáveis</option>
            <option value="unassigned">Sem responsável</option>
            {[...new Set(cards.map((card) => card.state?.responsible).filter(Boolean))]
              .sort()
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Unidade
          <select
            aria-label="Unidade dos registros"
            className="block w-full rounded border bg-background p-2 text-sm"
            value={unit}
            onChange={(event) => changeFilter(() => setUnit(event.target.value))}
          >
            <option value="">Todas as unidades</option>
            {[...new Set(cards.map((card) => card.person.unit).filter(Boolean))]
              .sort()
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Etapa / pendência
          <select
            aria-label="Etapa dos registros"
            className="block w-full rounded border bg-background p-2 text-sm"
            value={filter}
            onChange={(event) => changeFilter(() => setFilter(event.target.value))}
          >
            <option value="">Todas as etapas</option>
            <option value="blocked">Bloqueados na fonte</option>
            <option value="overdue">Próxima ação vencida</option>
            {PERIODIC_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {PERIODIC_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {view === "cities" && !selected ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {matchedGroups.length} cidades · {filtered.length} registros correspondem aos filtros
          </p>
          {!matchedGroups.length && <p>Nenhuma cidade corresponde aos filtros.</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchedGroups
              .slice(visiblePage * CITY_PAGE_SIZE, (visiblePage + 1) * CITY_PAGE_SIZE)
              .map((group) => {
                const matched = group.cards.filter((card) => filteredIds.has(card.id)).length;
                return (
                  <article
                    key={group.key}
                    aria-label={`${group.city}/${group.uf}`}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold">
                        {group.city}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          {group.uf}
                        </span>
                      </h4>
                      <MapPin
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {group.total} registros · {group.units.length} unidades
                      {group.cancelled > 0 ? ` · ${group.cancelled} cancelados na fonte` : ""}
                    </p>
                    <p className="text-sm font-medium">{group.priority.label}</p>
                    <div className="flex flex-wrap gap-1.5" aria-label="Etapas da cidade inteira">
                      {PERIODIC_STAGES.filter((stage) => group.stageCounts[stage] > 0).map(
                        (stage) => (
                          <span key={stage} className="rounded bg-muted px-2 py-1 text-xs">
                            {PERIODIC_STAGE_LABELS[stage]}: {group.stageCounts[stage]}
                          </span>
                        )
                      )}
                    </div>
                    {group.active > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs">
                          {group.completed} de {group.active} ativos concluídos
                        </p>
                        <div
                          className="h-1.5 overflow-hidden rounded bg-muted"
                          role="progressbar"
                          aria-label="Registros ativos concluídos"
                          aria-valuemin={0}
                          aria-valuemax={group.active}
                          aria-valuenow={group.completed}
                        >
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(100 * group.completed) / group.active}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {(group.blocked > 0 || group.sourceChanged > 0 || group.overdue > 0) && (
                      <p className="text-xs font-medium">
                        {[
                          group.blocked > 0 && `${group.blocked} bloqueados`,
                          group.sourceChanged > 0 && `${group.sourceChanged} fontes alteradas`,
                          group.overdue > 0 && `${group.overdue} prazos vencidos`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <p>
                        Responsável:{" "}
                        {group.owners.length === 1
                          ? group.owners[0]
                          : group.owners.length > 1
                            ? `${group.owners.length} responsáveis`
                            : "Não informado"}
                        {group.unassigned > 0 ? ` · ${group.unassigned} a atribuir` : ""}
                      </p>
                      <p>Próxima ação: {displayDate(group.nextDate)}</p>
                    </div>
                    {matched !== group.total && (
                      <p className="text-xs font-medium">
                        {matched} de {group.total} registros correspondem aos filtros
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      aria-label={`Abrir colaboradores de ${group.city}/${group.uf}`}
                      ref={(button) => {
                        if (button) cityButtons.current.set(group.key, button);
                        else cityButtons.current.delete(group.key);
                      }}
                      onClick={() => openCity(group.key)}
                    >
                      <Users aria-hidden="true" /> Abrir colaboradores
                    </Button>
                  </article>
                );
              })}
          </div>
          <Pagination
            label="Páginas de cidades"
            page={visiblePage}
            count={matchedGroups.length}
            pageSize={CITY_PAGE_SIZE}
            onChange={setPage}
          />
        </>
      ) : (
        <section className="space-y-4" aria-label="Registros da cidade selecionada">
          {selected && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedKey(null);
                  onNavigate();
                }}
              >
                <ArrowLeft aria-hidden="true" /> Voltar às cidades
              </Button>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 ref={detailHeading} tabIndex={-1} className="text-lg font-semibold">
                    {selected.city}/{selected.uf}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {selected.total} registros · {selected.active} ativos · {selected.cancelled}{" "}
                    cancelados na fonte · {selected.units.length} unidades
                  </p>
                </div>
                <span className="rounded bg-muted px-2 py-1 text-xs">
                  {selected.priority.label}
                </span>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2" aria-label="Conteúdo dos registros">
            <Button
              size="sm"
              variant={currentTab === "people" ? "default" : "outline"}
              aria-pressed={currentTab === "people"}
              disabled={!active.length}
              onClick={() => {
                setTab("people");
                setRecordPage(0);
                onNavigate();
              }}
            >
              <Users aria-hidden="true" /> Ativos ({active.length})
            </Button>
            <Button
              size="sm"
              variant={currentTab === "appointments" ? "default" : "outline"}
              aria-pressed={currentTab === "appointments"}
              onClick={() => {
                setTab("appointments");
                onNavigate();
              }}
            >
              <CalendarDays aria-hidden="true" /> Agendas
            </Button>
            <Button
              size="sm"
              variant={currentTab === "cancelled" ? "default" : "outline"}
              aria-pressed={currentTab === "cancelled"}
              onClick={() => {
                setTab("cancelled");
                setRecordPage(0);
                onNavigate();
              }}
            >
              Cancelados ({cancelled.length})
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {localCards.length} de {totalRecords} registros correspondem aos filtros
            </p>
            {selected && localCards.length !== selected.total && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setCity("");
                  setOwner("");
                  setUnit("");
                  setFilter("");
                  setRecordPage(0);
                  onNavigate();
                }}
              >
                Ver todos da cidade
              </Button>
            )}
          </div>
          {currentTab === "appointments" ? (
            <SourceAppointments cards={active} />
          ) : records.length ? (
            <>
              <RecordsTable
                cards={records.slice(
                  visibleRecordPage * RECORD_PAGE_SIZE,
                  (visibleRecordPage + 1) * RECORD_PAGE_SIZE
                )}
                busy={busy}
                onEdit={onEdit}
                onHistory={onHistory}
              />
              <Pagination
                label="Páginas de colaboradores"
                page={visibleRecordPage}
                count={records.length}
                pageSize={RECORD_PAGE_SIZE}
                onChange={(next) => {
                  setRecordPage(next);
                  onNavigate();
                }}
              />
            </>
          ) : (
            <p>Nenhum registro nesta seleção.</p>
          )}
        </section>
      )}
    </div>
  );
}
