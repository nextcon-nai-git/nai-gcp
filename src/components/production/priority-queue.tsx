"use client";
import * as React from "react";
import type { ProductionRecord } from "@/lib/production/model";
import { workQueue, queueStats, searchWorkItem } from "@/lib/production/queue";
import { stages, stageNames, type Stage } from "@/lib/production/instructions";
import { Button } from "@/components/ui/button";

const field = "rounded-md border border-input bg-background p-2 text-sm";
const statusName = {
  todo: "A fazer",
  doing: "Em andamento",
  blocked: "Bloqueado",
  done: "Concluído",
  na: "Não aplicável",
};
export function PriorityQueue({
  records,
  today,
  onOpen,
}: {
  records: ProductionRecord[];
  today: string;
  onOpen: (recordId: string, cycleId: string) => void;
}) {
  const [stage, setStage] = React.useState<Stage | "all">("all");
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [limit, setLimit] = React.useState(20);
  const items = React.useMemo(() => workQueue(records, today), [records, today]);
  const stats = queueStats(items);
  const filtered = items.filter(
    (item) =>
      (stage === "all" || item.stage === stage) &&
      searchWorkItem(item, search) &&
      (filter === "all" ||
        (filter === "overdue" && item.overdue) ||
        (filter === "blocked" && item.status === "blocked") ||
        (filter === "unplanned" && item.unplanned))
  );
  return (
    <section aria-label="Fila de prioridades" className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Fila de prioridades</h2>
        <p className="text-sm text-muted-foreground">
          Cards e obrigações dos contratos ativos. Datas de referência: Brasília. Prazos ausentes
          precisam ser programados.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Etapas e tarefas abertas", stats.open],
          ["Com prazo vencido", stats.overdue],
          ["Bloqueadas", stats.blocked],
          ["Sem responsável ou prazo", stats.unplanned],
        ].map(([label, value]) => (
          <div className="rounded-md bg-muted p-3" key={label}>
            <p className="text-xs">{label}</p>
            <strong className="text-xl">{value}</strong>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Uma tarefa pode estar em mais de um indicador. Concluir a etapa continua dependendo das
        conferências e evidências do contrato.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Buscar na fila
          <input
            className={field}
            value={search}
            placeholder="Cliente, CNPJ, tarefa ou responsável"
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(20);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Filtrar etapa
          <select
            className={field}
            value={stage}
            onChange={(e) => {
              setStage(e.target.value as Stage | "all");
              setLimit(20);
            }}
          >
            <option value="all">Todas as etapas</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {stageNames[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Filtrar prioridade
          <select
            className={field}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(20);
            }}
          >
            <option value="all">Todas as pendências</option>
            <option value="overdue">Prazo vencido</option>
            <option value="blocked">Bloqueadas</option>
            <option value="unplanned">Sem responsável ou prazo</option>
          </select>
        </label>
      </div>
      <p role="status" className="text-sm">
        {filtered.length} pendência(s) no filtro · exibindo {Math.min(limit, filtered.length)}
      </p>
      {filtered.length === 0 ? (
        <p className="text-sm">Nenhuma pendência corresponde a este filtro.</p>
      ) : (
        <div className="max-h-128 overflow-auto rounded border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Prioridades dos contratos ativos</caption>
            <thead className="sticky top-0 bg-muted">
              <tr>
                {[
                  "Cliente e contrato",
                  "Etapa e tarefa",
                  "Responsável e prazo",
                  "Situação",
                  "Ação",
                ].map((h) => (
                  <th key={h} scope="col" className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((item) => (
                <tr key={item.key} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-medium">{item.company}</p>
                    <p className="text-xs">{item.contract}</p>
                    {item.cycle && <p className="text-xs text-muted-foreground">{item.cycle}</p>}
                  </td>
                  <td className="p-3">
                    <p className="text-xs text-muted-foreground">{stageNames[item.stage]}</p>
                    {item.title}
                  </td>
                  <td className="p-3">
                    <p>{item.owner || "Responsável pendente"}</p>
                    <p>
                      {item.due ? item.due.split("-").reverse().join("/") : "Prazo não programado"}
                    </p>
                  </td>
                  <td className="p-3">
                    <p>
                      {statusName[item.status]}
                      {item.overdue ? " · Atrasado" : item.dueToday ? " · Vence hoje" : ""}
                    </p>
                    {item.status === "blocked" && (
                      <p className="mt-1 text-xs">{item.blocker || "Detalhar bloqueio"}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Abrir ${item.title} de ${item.company}`}
                      onClick={() => onOpen(item.recordId, item.cycleId)}
                    >
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {limit < filtered.length && (
        <Button type="button" variant="outline" onClick={() => setLimit((n) => n + 20)}>
          Mostrar mais 20
        </Button>
      )}
    </section>
  );
}
