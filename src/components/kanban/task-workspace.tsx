"use client";
import * as React from "react";
import type { OpsTask } from "@/types/schema";
import { KanbanBoard } from "./kanban-board";
import { TaskEditDialog } from "./task-edit-dialog";
import { OPERATIONAL_COLUMNS } from "@/types/kanban";
import {
  displayTaskDate,
  taskDate,
  taskKey,
  isOverdue,
  hasCoordinates,
  downloadTaskCalendar,
  priorityLabels,
} from "@/lib/task-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  LayoutGrid,
  List,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

const views = [
  { id: "board", label: "Quadro", icon: LayoutGrid },
  { id: "list", label: "Lista", icon: List },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "map", label: "Mapa", icon: MapPin },
  { id: "people", label: "Pessoas", icon: Users },
];
export function TaskWorkspace({ tasks }: { tasks: OpsTask[] }) {
  const [view, setView] = React.useState("board");
  const [search, setSearch] = React.useState("");
  const [person, setPerson] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [late, setLate] = React.useState(false);
  const [selected, setSelected] = React.useState<OpsTask | null>(null);
  const [place, setPlace] = React.useState<OpsTask | null>(null);
  const [month, setMonth] = React.useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );
  const personKey = (task: OpsTask) =>
    task.responsibleId || task.assigneeId || task.responsibleName || "unassigned";
  const people = Array.from(
    new Map(tasks.map((t) => [personKey(t), t.responsibleName || "Sem responsável"])).entries()
  );
  const filtered = tasks.filter(
    (t) =>
      (!search ||
        [t.title, t.companyName, t.location, t.responsibleName]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"))) &&
      (!person || personKey(t) === person) &&
      (!priority || t.priority === priority) &&
      (!late || isOverdue(t, today))
  );
  const activeTask = selected && tasks.find((t) => taskKey(t) === taskKey(selected));
  const placeTask = place && filtered.find((t) => taskKey(t) === taskKey(place));
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const openTask = (task: OpsTask) => (
    <button
      key={taskKey(task)}
      onClick={() => setSelected(task)}
      className="block w-full rounded-lg border border-border bg-card p-2 text-left text-sm hover:border-blue-500"
    >
      <span className="block font-medium break-words">{task.title}</span>
      <span className="block text-xs text-muted-foreground">
        {task.companyName} · {displayTaskDate(task.dueDate)}
      </span>
    </button>
  );
  return (
    <section className="min-w-0 space-y-4" aria-label="Área de trabalho dos cards">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
        role="group"
        aria-label="Visualização dos cards"
      >
        {views.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={view === id ? "default" : "ghost"}
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className="gap-2"
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} de {tasks.length} cards
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Buscar cards"
          placeholder="Buscar título, cliente, pessoa ou local…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          aria-label="Filtrar responsável"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="rounded-md border border-input bg-background p-2 text-sm"
        >
          <option value="">Todas as pessoas</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar prioridade"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-md border border-input bg-background p-2 text-sm"
        >
          <option value="">Todas as prioridades</option>
          {Object.entries(priorityLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <Button
          variant={late ? "default" : "outline"}
          aria-pressed={late}
          onClick={() => setLate(!late)}
        >
          Vencidos
        </Button>
        {(search || person || priority || late) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setPerson("");
              setPriority("");
              setLate(false);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
      {filtered.length === 0 && (
        <p role="status" className="p-6 text-muted-foreground">
          Nenhum card corresponde aos filtros.
        </p>
      )}
      {view === "board" && <KanbanBoard tasks={filtered} columns={OPERATIONAL_COLUMNS} />}
      {view === "list" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {["Atividade", "Cliente", "Etapa", "Responsável", "Prazo"].map((label) => (
                  <th className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={taskKey(task)} className="border-b border-border">
                  <td className="p-3">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => setSelected(task)}
                    >
                      {task.title}
                    </button>
                  </td>
                  <td className="p-3">{task.companyName}</td>
                  <td className="p-3">
                    {OPERATIONAL_COLUMNS.find((c) => c.id === task.status)?.title}
                  </td>
                  <td className="p-3">{task.responsibleName || "Sem responsável"}</td>
                  <td className="p-3 whitespace-nowrap">{displayTaskDate(task.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === "calendar" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <ChevronLeft />
            </Button>
            <h2 className="min-w-40 text-center font-semibold">
              {month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </h2>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              disabled={!filtered.some((t) => taskDate(t.dueDate))}
              onClick={() => downloadTaskCalendar(filtered)}
              className="ml-auto gap-2"
            >
              <Download className="size-4" />
              Exportar agenda (.ics)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Clique no card para ajustar o prazo. A exportação permite importar no Google Calendar ou
            Outlook; não há sincronização automática.
          </p>
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-7 gap-1">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-semibold">
                  {d}
                </div>
              ))}
              {Array.from({ length: month.getDay() }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = `${monthKey}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <div
                    key={day}
                    className={`min-h-28 rounded-lg border p-2 space-y-1 ${day === today ? "border-blue-500 bg-blue-500/5" : "border-border"}`}
                  >
                    <span className="text-xs font-semibold">{i + 1}</span>
                    {filtered.filter((t) => taskDate(t.dueDate) === day).map(openTask)}
                  </div>
                );
              })}
            </div>
          </div>
          <h3 className="font-semibold">
            Sem prazo ({filtered.filter((t) => !taskDate(t.dueDate)).length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.filter((t) => !taskDate(t.dueDate)).map(openTask)}
          </div>
        </div>
      )}
      {view === "people" && (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people
            .filter(([id]) => filtered.some((t) => personKey(t) === id))
            .map(([id, name]) => {
              const own = filtered.filter((t) => personKey(t) === id);
              return (
                <section
                  key={id}
                  className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
                >
                  <h2 className="font-semibold">{name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {own.filter((t) => t.status !== "done").length} em aberto ·{" "}
                    {own.filter((t) => isOverdue(t, today)).length} vencidos
                  </p>
                  {own.map(openTask)}
                </section>
              );
            })}
        </div>
      )}
      {view === "map" && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Selecione uma atividade para localizar e abrir o card.{" "}
              {filtered.filter((t) => !t.location && !hasCoordinates(t)).length} sem localização.
            </p>
            {filtered
              .filter((t) => t.location || hasCoordinates(t))
              .map((t) => (
                <button
                  key={taskKey(t)}
                  onClick={() => setPlace(t)}
                  className={`w-full rounded-lg border p-3 text-left ${placeTask && taskKey(placeTask) === taskKey(t) ? "border-blue-500" : "border-border"}`}
                >
                  <span className="block text-sm font-semibold">
                    {t.location || "Coordenadas cadastradas"}
                  </span>
                  <span className="block text-xs text-muted-foreground">{t.title}</span>
                </button>
              ))}
          </div>
          <div className="rounded-xl border border-border p-4 space-y-3">
            {placeTask ? (
              <>
                <h2 className="font-semibold">{placeTask.title}</h2>
                {hasCoordinates(placeTask) ? (
                  <iframe
                    title="Localização da atividade no OpenStreetMap"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-96 w-full rounded-lg"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${placeTask.longitude! - 0.04},${placeTask.latitude! - 0.04},${placeTask.longitude! + 0.04},${placeTask.latitude! + 0.04}&layer=mapnik&marker=${placeTask.latitude},${placeTask.longitude}`}
                  />
                ) : (
                  <p className="py-8 text-sm text-muted-foreground">
                    Cadastre latitude e longitude no card para exibir um ponto no mapa. O endereço
                    pode ser consultado na busca externa.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => setSelected(placeTask)}>Abrir card</Button>
                  <Button asChild variant="outline">
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hasCoordinates(placeTask) ? `${placeTask.latitude},${placeTask.longitude}` : placeTask.location || "")}`}
                    >
                      Consultar localização
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <p className="py-20 text-center text-muted-foreground">
                Selecione uma localização à esquerda.
              </p>
            )}
          </div>
        </div>
      )}
      {activeTask && (
        <TaskEditDialog
          key={`${taskKey(activeTask)}:${activeTask.restricted}:${activeTask.documentType}`}
          task={activeTask}
          isOpen
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        />
      )}
    </section>
  );
}
