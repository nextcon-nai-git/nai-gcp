"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ObligationSchema,
  MAX_OBLIGATIONS,
  serviceTypes,
  taskSteps,
  type Obligation,
  type ProductionTask,
  type TaskUpdateSchema,
} from "@/lib/production/obligations";
import type { ProductionRecord } from "@/lib/production/model";
import type { z } from "zod";

const inputClass = "w-full rounded-md border border-input bg-background p-2 text-sm";
const value = (f: FormData, key: string) => String(f.get(key) || "").trim();
const states = {
  todo: "A fazer",
  doing: "Em andamento",
  blocked: "Bloqueado",
  done: "Concluído",
  na: "Condição não acionada neste ciclo",
};

export function readObligations(f: FormData): Obligation[] {
  return f.getAll("obligationId").map((id) => {
    const field = (name: string) => value(f, `obligation.${id}.${name}`);
    return ObligationSchema.parse({
      id: String(id),
      title: field("title"),
      serviceType: field("serviceType"),
      owner: field("owner"),
      due: field("due"),
      deadlineRule: field("deadlineRule"),
      trigger: field("trigger"),
      sourceReference: field("sourceReference"),
      sourceExcerpt: field("sourceExcerpt"),
    });
  });
}

export function ObligationsFields({ initial }: { initial: Obligation[] }) {
  const [items, setItems] = React.useState(initial);
  return (
    <section className="space-y-3 md:col-span-2" aria-label="Obrigações contratuais revisadas">
      <h3 className="font-semibold">Serviços contratados → tarefas individuais</h3>
      <p className="text-sm text-muted-foreground">
        Confira cada obrigação no original. As {items.length} tarefas serão acrescentadas às nove
        etapas gerais, sem duplicar o valor do contrato. Datas ausentes ficam pendentes; prazos
        relativos precisam de programação.
      </p>
      {items.map((item, index) => (
        <fieldset key={item.id} className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Obrigação {index + 1}</legend>
          <input type="hidden" name="obligationId" value={item.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Tarefa
              <input
                className={inputClass}
                name={`obligation.${item.id}.title`}
                defaultValue={item.title}
                required
                minLength={3}
                maxLength={180}
              />
            </label>
            <label className="text-sm">
              Tipo de serviço
              <select
                className={inputClass}
                name={`obligation.${item.id}.serviceType`}
                defaultValue={item.serviceType}
              >
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Responsável; vazio = pendente
              <input
                className={inputClass}
                name={`obligation.${item.id}.owner`}
                defaultValue={item.owner}
                maxLength={180}
              />
            </label>
            <label className="text-sm">
              Data de entrega conferida; vazio = pendente
              <input
                className={inputClass}
                name={`obligation.${item.id}.due`}
                type="date"
                defaultValue={item.due}
              />
            </label>
            <label className="text-sm md:col-span-2">
              Condição de acionamento no contrato; vazio = sempre aplicável
              <input
                className={inputClass}
                name={`obligation.${item.id}.trigger`}
                defaultValue={item.trigger}
                maxLength={500}
              />
            </label>
            <label className="text-sm">
              Regra de prazo ou frequência no contrato
              <input
                className={inputClass}
                name={`obligation.${item.id}.deadlineRule`}
                defaultValue={item.deadlineRule}
                maxLength={500}
              />
            </label>
            <label className="text-sm">
              Documento, página / cláusula
              <input
                className={inputClass}
                name={`obligation.${item.id}.sourceReference`}
                defaultValue={item.sourceReference}
                required
                minLength={3}
                maxLength={300}
              />
            </label>
            <label className="text-sm md:col-span-2">
              Trecho que comprova a obrigação
              <textarea
                className={inputClass}
                name={`obligation.${item.id}.sourceExcerpt`}
                defaultValue={item.sourceExcerpt}
                required
                minLength={3}
                maxLength={600}
                rows={2}
              />
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((old) => old.filter((o) => o.id !== item.id))}
          >
            Remover obrigação {index + 1} da prévia
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={items.length >= MAX_OBLIGATIONS}
        onClick={() =>
          setItems((old) => [
            ...old,
            {
              id: crypto.randomUUID(),
              title: "",
              serviceType: "OUTRO",
              owner: "",
              due: "",
              deadlineRule: "",
              trigger: "",
              sourceReference: "",
              sourceExcerpt: "",
            },
          ])
        }
      >
        Adicionar obrigação
      </Button>
      <p className="text-xs text-muted-foreground">
        Em aditivos, consolide as obrigações que continuam vigentes. Remover uma linha desta prévia
        não altera ciclos já registrados.
      </p>
    </section>
  );
}

export function RevisionObligationSelection({
  record,
  initialRevision,
  selected = [],
}: {
  record: ProductionRecord;
  initialRevision: number;
  selected?: string[];
}) {
  const [revision, setRevision] = React.useState(initialRevision);
  const obligations = record.revisions[revision].terms.obligations;
  return (
    <div className="space-y-3 md:col-span-2">
      <label className="text-sm">
        Versão contratual aplicável
        <select
          className={inputClass}
          name="revision"
          value={revision}
          onChange={(e) => setRevision(Number(e.target.value))}
        >
          {record.revisions.map((r, n) => (
            <option key={n} value={n}>
              Revisão {n + 1} · efeito {r.effectiveOn}
            </option>
          ))}
        </select>
      </label>
      <div key={revision} className="space-y-2">
        <p className="text-sm">
          Selecione as obrigações aplicáveis a este ciclo. Programe seus prazos após criar as
          tarefas.
        </p>
        {obligations.length === 0 && (
          <p className="text-xs">Esta versão não contém obrigações estruturadas.</p>
        )}
        {obligations.map((o) => (
          <label key={o.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="obligationIds"
              value={o.id}
              defaultChecked={selected.includes(o.id)}
            />
            {o.title} · {o.sourceReference}
          </label>
        ))}
      </div>
    </div>
  );
}

export function ObligationTaskEditor({
  task,
  disabled,
  save,
}: {
  task: ProductionTask;
  disabled: boolean;
  save: (data: z.infer<typeof TaskUpdateSchema>, reason: string) => Promise<boolean>;
}) {
  const [error, setError] = React.useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{task.obligation.title}</CardTitle>
        <p className="text-xs">
          {task.obligation.serviceType} · {states[task.status]} ·{" "}
          {task.owner || "Responsável pendente"} · {task.due || "Prazo pendente"}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs">{task.obligation.sourceReference}</p>
        <blockquote className="border-l-2 pl-2 text-xs">{task.obligation.sourceExcerpt}</blockquote>
        {task.obligation.trigger && (
          <p className="text-xs">
            Acionamento: {task.obligation.trigger}. Se a condição não ocorreu, registre a
            justificativa e o responsável.
          </p>
        )}
        {task.obligation.deadlineRule && (
          <p className="text-xs">Regra contratual: {task.obligation.deadlineRule}</p>
        )}
        {task.obligation.due && (
          <p className="text-xs">Data na versão contratual: {task.obligation.due}</p>
        )}
        <details>
          <summary className="cursor-pointer text-sm">
            Executar obrigação e registrar evidência
          </summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                await save(
                  {
                    owner: value(f, "owner"),
                    due: value(f, "due"),
                    status: value(f, "status") as ProductionTask["status"],
                    checks: taskSteps.map((_, n) => f.get(`check${n}`) === "on"),
                    evidence: value(f, "evidence"),
                    blocker: value(f, "blocker"),
                  },
                  value(f, "reason")
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <fieldset disabled={disabled} className="space-y-3">
              {taskSteps.map((step, n) => (
                <label key={n} className="flex items-start gap-2 text-xs">
                  <input type="checkbox" name={`check${n}`} defaultChecked={task.checks[n]} />
                  {step}
                </label>
              ))}
              <label className="block text-sm">
                Responsável
                <input
                  className={inputClass}
                  name="owner"
                  defaultValue={task.owner}
                  maxLength={180}
                />
              </label>
              <label className="block text-sm">
                Prazo programado
                <input className={inputClass} name="due" type="date" defaultValue={task.due} />
              </label>
              <label className="block text-sm">
                Situação
                <select className={inputClass} name="status" defaultValue={task.status}>
                  {Object.entries(states)
                    .filter(([key]) => key !== "na" || task.obligation.trigger)
                    .map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Evidência da execução e revisão
                <textarea
                  className={inputClass}
                  name="evidence"
                  defaultValue={task.evidence}
                  maxLength={2000}
                />
              </label>
              <label className="block text-sm">
                Bloqueio e responsável pela resolução
                <textarea
                  className={inputClass}
                  name="blocker"
                  defaultValue={task.blocker}
                  maxLength={1000}
                />
              </label>
              <label className="block text-sm">
                Motivo da atualização
                <textarea
                  className={inputClass}
                  name="reason"
                  required
                  minLength={3}
                  maxLength={2000}
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <Button type="submit" size="sm">
                Salvar tarefa
              </Button>
            </fieldset>
          </form>
        </details>
      </CardContent>
    </Card>
  );
}
