"use client";

import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { Command, ProductionRecord } from "@/lib/production/model";
import {
  CycleSchedulePlanSchema,
  MAX_SCHEDULE_OCCURRENCES,
  TaskSchedulePlanSchema,
  parseScheduleAmount,
  previewCycleSchedule,
  previewTaskSchedule,
} from "@/lib/production/scheduling";

type ScheduleCommand = Extract<Command, { action: "scheduleTasks" | "scheduleCycles" }>;
type ScheduleMutation = ScheduleCommand extends infer C
  ? C extends ScheduleCommand
    ? Omit<C, "requestId" | "expectedVersion" | "recordId">
    : never
  : never;
type PreviewRow = {
  key: string;
  period: string;
  anchorOn: string;
  title: string;
  sourceReference: string;
  offsetDays: number | null;
  previousDue: string;
  due: string;
};
type Preview = {
  record: ProductionRecord;
  cycleId: string;
  command: ScheduleMutation;
  rows: PreviewRow[];
  cycleCount: number;
  contractedCents: number | null;
  startsOn: string;
  endsOn: string;
};
const fieldClass = "w-full rounded-md border border-input bg-background p-2 text-sm";
const value = (form: FormData, key: string) => String(form.get(key) || "").trim();
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const errorMessage = (error: unknown) =>
  error instanceof z.ZodError
    ? error.issues[0]?.message || "Confira os dados da programação."
    : error instanceof Error
      ? error.message
      : "Não foi possível conferir a programação.";
const integer = (raw: string) => {
  if (!/^-?\d+$/.test(raw))
    throw new Error("Informe uma quantidade inteira de dias ou ocorrências.");
  return Number(raw);
};

export function SchedulePlanner({
  record,
  cycleId,
  disabled,
  save,
}: {
  record: ProductionRecord;
  cycleId: string;
  disabled: boolean;
  save: (command: ScheduleMutation) => Promise<boolean>;
}) {
  const [mode, setMode] = React.useState<"tasks" | "cycles">("tasks");
  const [revision, setRevision] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [reviewed, setReviewed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const saving = React.useRef(false);
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const cycle = record.cycles.find((item) => item.id === cycleId);
  const selectedRevision =
    mode === "tasks" ? cycle?.revision : revision === "" ? undefined : Number(revision);
  const terms =
    selectedRevision === undefined ? undefined : record.revisions[selectedRevision]?.terms;
  const obligations =
    mode === "tasks" ? cycle?.tasks.map((task) => task.obligation) || [] : terms?.obligations || [];
  // A refreshed record or another selected cycle invalidates a preview even if its form
  // remained mounted. The workspace also keys this component to the book version.
  const currentPreview = preview?.record === record && preview.cycleId === cycleId ? preview : null;
  const blocked = disabled || busy || !record.active;
  const invalidate = () => {
    setPreview(null);
    setReviewed(false);
    setError("");
    setNotice("");
  };

  return (
    <details className="rounded border p-4">
      <summary className="cursor-pointer font-medium">Programar prazos e recorrências</summary>
      <section className="mt-3 space-y-4" aria-label="Programação contratual">
        <p className="text-sm text-muted-foreground">
          Informe o marco e a regra conferidos no contrato. O cálculo usa dias corridos e não
          interpreta a cláusula nem o calendário de feriados. Confira todas as datas na prévia.
        </p>
        <form
          aria-label="Preparar programação"
          className="space-y-4"
          onChange={invalidate}
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked) return;
            invalidate();
            try {
              const form = new FormData(event.currentTarget);
              const reason = value(form, "scheduleReason");
              if (reason.length < 3 || reason.length > 2000)
                throw new Error("Informe a fonte do marco, a regra e o motivo da programação.");
              const rules = form.getAll("scheduleObligationIds").map((id) => {
                const raw = value(form, `scheduleOffset.${id}`);
                return { obligationId: String(id), offsetDays: raw === "" ? null : integer(raw) };
              });
              if (mode === "tasks") {
                const plan = TaskSchedulePlanSchema.parse({
                  anchorLabel: value(form, "scheduleAnchorLabel"),
                  anchorOn: value(form, "scheduleAnchorOn"),
                  rules,
                });
                const rows = previewTaskSchedule(record, cycleId, plan);
                setPreview({
                  record,
                  cycleId,
                  command: { action: "scheduleTasks", cycleId, plan, reason, reviewed: true },
                  rows: rows.map((row) => ({
                    ...row,
                    key: row.obligationId,
                    period: cycle!.period,
                    anchorOn: plan.anchorOn,
                    offsetDays: plan.rules.find((rule) => rule.obligationId === row.obligationId)!
                      .offsetDays,
                  })),
                  cycleCount: 0,
                  contractedCents: null,
                  startsOn: terms?.startsOn || "",
                  endsOn: terms?.endsOn || "",
                });
              } else {
                const plan = CycleSchedulePlanSchema.parse({
                  revision: integer(value(form, "scheduleRevision")),
                  service: value(form, "scheduleService"),
                  anchorLabel: value(form, "scheduleAnchorLabel"),
                  firstOn: value(form, "scheduleAnchorOn"),
                  frequency: value(form, "scheduleFrequency"),
                  occurrences: integer(value(form, "scheduleOccurrences")),
                  contractedCents: parseScheduleAmount(value(form, "scheduleAmount")),
                  rules,
                });
                const seriesId = crypto.randomUUID();
                const cycles = previewCycleSchedule(record, seriesId, plan);
                setPreview({
                  record,
                  cycleId,
                  command: { action: "scheduleCycles", seriesId, plan, reason, reviewed: true },
                  rows: cycles.flatMap((item) =>
                    item.tasks.map((task) => ({
                      ...task,
                      key: `${item.id}:${task.obligationId}`,
                      period: item.period,
                      anchorOn: item.anchorOn,
                      offsetDays: plan.rules.find(
                        (rule) => rule.obligationId === task.obligationId
                      )!.offsetDays,
                    }))
                  ),
                  cycleCount: cycles.length,
                  contractedCents: plan.contractedCents,
                  startsOn: terms?.startsOn || "",
                  endsOn: terms?.endsOn || "",
                });
              }
            } catch (error) {
              setError(errorMessage(error));
            }
          }}
        >
          <fieldset disabled={blocked} className="grid gap-3 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              Tipo de programação
              <select
                className={fieldClass}
                name="scheduleMode"
                value={mode}
                onChange={(event) => setMode(event.target.value as "tasks" | "cycles")}
              >
                <option value="tasks">Prazos das tarefas deste ciclo</option>
                <option value="cycles">Novos ciclos recorrentes</option>
              </select>
            </label>
            {mode === "tasks" ? (
              <p className="text-sm md:col-span-2">
                Ciclo:{" "}
                {cycle
                  ? `${cycle.service} · ${cycle.period} · revisão ${cycle.revision + 1}`
                  : "Selecione um ciclo."}{" "}
                Somente tarefas ainda não iniciadas podem receber os prazos deste lote.
              </p>
            ) : (
              <>
                <label className="text-sm">
                  Revisão para os ciclos recorrentes
                  <select
                    className={fieldClass}
                    name="scheduleRevision"
                    value={revision}
                    required
                    onChange={(event) => setRevision(event.target.value)}
                  >
                    <option value="">Selecione a revisão aprovada</option>
                    {record.revisions.map((item, index) => (
                      <option key={index} value={index}>
                        Revisão {index + 1} · efeito {item.effectiveOn}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Serviço de cada ciclo
                  <input
                    className={fieldClass}
                    name="scheduleService"
                    required
                    minLength={3}
                    maxLength={180}
                  />
                </label>
                <label className="text-sm">
                  Frequência conferida
                  <select className={fieldClass} name="scheduleFrequency" required defaultValue="">
                    <option value="">Selecione a frequência</option>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </label>
                <label className="text-sm">
                  Quantidade de ciclos nesta aprovação
                  <input
                    className={fieldClass}
                    name="scheduleOccurrences"
                    type="number"
                    min={2}
                    max={MAX_SCHEDULE_OCCURRENCES}
                    step={1}
                    required
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Valor contratado por ciclo (R$); vazio = pendente
                  <input
                    className={fieldClass}
                    name="scheduleAmount"
                    inputMode="decimal"
                    placeholder="Ex.: 1234,56"
                    maxLength={20}
                  />
                </label>
                <p className="text-xs text-muted-foreground md:col-span-2">
                  Confira se o contrato define valor por competência. O valor global não é usado
                  como mensalidade. Esta aprovação cria somente os ciclos apresentados, sem emissão
                  de NF ou cobrança. Meses sem o dia informado usam o último dia do mês.
                </p>
              </>
            )}
            <label className="text-sm">
              Marco contratual conferido
              <input
                className={fieldClass}
                name="scheduleAnchorLabel"
                placeholder="Ex.: recebimento da ordem de serviço"
                required
                minLength={3}
                maxLength={180}
              />
            </label>
            <label className="text-sm">
              {mode === "tasks" ? "Data do marco" : "Data do primeiro marco da série"}
              <input
                className={fieldClass}
                name="scheduleAnchorOn"
                type="date"
                required
                min="2000-01-01"
                max="2100-12-31"
              />
            </label>
            <section
              key={`${mode}:${selectedRevision}:${cycleId}`}
              className="space-y-3 md:col-span-2"
              aria-label="Obrigações para programação"
            >
              <h3 className="text-sm font-semibold">
                Selecione as obrigações e informe os dias corridos
              </h3>
              {mode === "cycles" && (
                <p className="text-xs text-muted-foreground">
                  Todas as obrigações selecionadas serão repetidas em cada competência da prévia.
                  Confira quais são recorrentes e as condições de acionamento de cada serviço.
                </p>
              )}
              {obligations.length === 0 && (
                <p className="text-sm">Não há obrigações na seleção atual.</p>
              )}
              {obligations.map((obligation) => (
                <div key={obligation.id} className="space-y-2 rounded border p-3 text-sm">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name="scheduleObligationIds" value={obligation.id} />
                    {obligation.title}
                  </label>
                  <p className="text-xs">
                    {obligation.sourceReference} ·{" "}
                    {obligation.deadlineRule || "Prazo não definido na cláusula cadastrada."}
                  </p>
                  {obligation.trigger && <p className="text-xs">Condição: {obligation.trigger}</p>}
                  <label className="block text-sm">
                    Dias corridos — {obligation.title}
                    <input
                      className={fieldClass}
                      name={`scheduleOffset.${obligation.id}`}
                      type="number"
                      min={-3650}
                      max={3650}
                      step={1}
                    />
                  </label>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Zero usa a data do marco; número negativo indica dias antes do marco.
                {mode === "cycles"
                  ? " Vazio mantém o prazo pendente nos novos ciclos."
                  : " Informe os dias de cada tarefa selecionada para calcular o prazo."}
              </p>
            </section>
            <label className="text-sm md:col-span-2">
              Fonte do marco, regra e motivo da programação
              <textarea
                className={fieldClass}
                name="scheduleReason"
                required
                minLength={3}
                maxLength={2000}
                rows={2}
              />
            </label>
            <Button type="submit" variant="outline" className="md:col-span-2">
              Conferir prévia de datas
            </Button>
          </fieldset>
        </form>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        {currentPreview && (
          <section aria-label="Prévia da programação" className="space-y-3 rounded border p-3">
            <h3 className="font-semibold">
              {currentPreview.cycleCount
                ? `${currentPreview.cycleCount} novos ciclos`
                : "Prazos do ciclo existente"}{" "}
              · {currentPreview.rows.length} tarefas para conferir
            </h3>
            <p className="text-sm">Marco: {currentPreview.command.plan.anchorLabel}</p>
            {currentPreview.cycleCount > 0 && (
              <p className="text-sm">
                {currentPreview.contractedCents === null
                  ? "Valor por ciclo e total da programação: pendentes."
                  : `Valor por ciclo: ${money(currentPreview.contractedCents)} · Total desta programação: ${money(currentPreview.contractedCents * currentPreview.cycleCount)}.`}
              </p>
            )}
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Marcos, regras e prazos a aplicar após aprovação
                </caption>
                <thead>
                  <tr>
                    <th className="p-2">Competência</th>
                    <th className="p-2">Marco</th>
                    <th className="p-2">Obrigação e fonte</th>
                    <th className="p-2">Dias corridos</th>
                    <th className="p-2">Prazo atual</th>
                    <th className="p-2">Prazo programado</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPreview.rows.map((row) => {
                    const outside =
                      row.due &&
                      ((currentPreview.startsOn && row.due < currentPreview.startsOn) ||
                        (currentPreview.endsOn && row.due > currentPreview.endsOn));
                    return (
                      <tr key={row.key} className="border-t align-top">
                        <td className="p-2">{row.period}</td>
                        <td className="p-2">{row.anchorOn}</td>
                        <td className="p-2">
                          {row.title}
                          <br />
                          {row.sourceReference}
                        </td>
                        <td className="p-2">{row.offsetDays ?? "Pendente"}</td>
                        <td className="p-2">
                          {currentPreview.cycleCount ? "Novo ciclo" : row.previousDue || "Pendente"}
                        </td>
                        <td className="p-2">
                          {row.due || "Pendente"}
                          {outside && (
                            <p className="font-semibold">
                              Prazo fora da vigência; confira a regra de entrega.
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={reviewed}
                disabled={blocked}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              Conferi os marcos, as regras, todas as datas e os valores desta prévia e aprovo sua
              aplicação.
            </label>
            <Button
              type="button"
              disabled={blocked || !reviewed}
              onClick={async () => {
                if (blocked || saving.current || !reviewed) return;
                saving.current = true;
                setBusy(true);
                setError("");
                try {
                  const confirmed = await save(currentPreview.command);
                  if (!alive.current) return;
                  if (confirmed) {
                    setPreview(null);
                    setReviewed(false);
                    setNotice("Programação registrada. Confira os ciclos e tarefas atualizados.");
                  } else {
                    setReviewed(false);
                    setError(
                      "Gravação não confirmada. Confira a mensagem da central antes de tentar novamente."
                    );
                  }
                } catch (error) {
                  if (alive.current) {
                    setReviewed(false);
                    setError(errorMessage(error));
                  }
                } finally {
                  saving.current = false;
                  if (alive.current) setBusy(false);
                }
              }}
            >
              {busy ? "Aplicando programação..." : "Aplicar programação aprovada"}
            </Button>
          </section>
        )}
      </section>
    </details>
  );
}
