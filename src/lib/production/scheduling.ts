import { z } from "zod";
import { isCalendarDate } from "@/lib/financial/omie-dre";
import { MAX_OBLIGATIONS, type ProductionTask } from "./obligations";
import type { ProductionRecord } from "./model";

export const MAX_SCHEDULE_OCCURRENCES = 12;
export const MAX_CYCLE_COUNT = 200;
const date = z
  .string()
  .refine(
    (value) => isCalendarDate(value) && value >= "2000-01-01" && value <= "2100-12-31",
    "Informe uma data válida entre 2000 e 2100."
  );
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const rules = z
  .array(
    z
      .object({
        obligationId: id,
        offsetDays: z.number().int().min(-3650).max(3650).nullable(),
      })
      .strict()
  )
  .min(1, "Selecione ao menos uma obrigação.")
  .max(MAX_OBLIGATIONS)
  .refine(
    (items) => new Set(items.map((item) => item.obligationId)).size === items.length,
    "Selecione obrigações sem repetição."
  );

export const TaskSchedulePlanSchema = z
  .object({
    anchorLabel: z.string().trim().min(3).max(180),
    anchorOn: date,
    rules,
  })
  .strict();
export type TaskSchedulePlan = z.infer<typeof TaskSchedulePlanSchema>;

export const CycleSchedulePlanSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    service: z.string().trim().min(3).max(180),
    anchorLabel: z.string().trim().min(3).max(180),
    firstOn: date,
    frequency: z.enum(["monthly", "quarterly", "annual"]),
    occurrences: z.number().int().min(2).max(MAX_SCHEDULE_OCCURRENCES),
    contractedCents: z.number().int().positive().max(100_000_000_000).nullable(),
    rules,
  })
  .strict();
export type CycleSchedulePlan = z.infer<typeof CycleSchedulePlanSchema>;
export type ScheduledTask = {
  obligationId: string;
  title: string;
  sourceReference: string;
  previousDue: string;
  due: string;
};
export type ScheduledCycle = {
  id: string;
  period: string;
  anchorOn: string;
  tasks: ScheduledTask[];
};

/** UI input is parsed as integer cents, without treating blank or ambiguous money as zero. */
export function parseScheduleAmount(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match)
    throw new Error(
      "Informe o valor por ciclo sem separador de milhar e com até duas casas decimais."
    );
  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!CycleSchedulePlanSchema.shape.contractedCents.safeParse(cents).success)
    throw new Error(
      "Informe um valor positivo por ciclo, dentro do limite permitido, ou deixe pendente."
    );
  return cents;
}

function validResult(value: Date): string {
  if (!Number.isFinite(value.getTime()))
    throw new Error("A programação excede as datas suportadas.");
  const result = value.toISOString().slice(0, 10);
  if (!date.safeParse(result).success)
    throw new Error("A programação deve permanecer entre 2000 e 2100.");
  return result;
}

/** Calendar dates are evaluated in UTC; a browser's timezone cannot change a deadline. */
export function addCalendarDays(anchorOn: string, offsetDays: number): string {
  date.parse(anchorOn);
  if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > 3650)
    throw new Error("Informe até 3.650 dias corridos antes ou depois do marco.");
  const result = new Date(`${anchorOn}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + offsetDays);
  return validResult(result);
}

/** Each occurrence uses the original day, avoiding Jan 31 -> Feb 28 -> Mar 28 drift. */
export function addCalendarMonths(anchorOn: string, offsetMonths: number): string {
  date.parse(anchorOn);
  if (!Number.isInteger(offsetMonths) || offsetMonths < 0 || offsetMonths > 132)
    throw new Error("Intervalo de recorrência inválido.");
  const original = new Date(`${anchorOn}T12:00:00Z`);
  const result = new Date(original);
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + offsetMonths);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0, 12)
  ).getUTCDate();
  result.setUTCDate(Math.min(original.getUTCDate(), lastDay));
  return validResult(result);
}

const normalized = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
const month = (value: string): string | null => {
  if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)) return value;
  const br = /^(0[1-9]|1[0-2])\/(20\d{2}|2100)$/.exec(value);
  return br ? `${br[2]}-${br[1]}` : null;
};

/** A monthly cycle also overlaps an existing dated cycle for the same service/month. */
export function sameCycleSlot(
  existing: { service: string; period: string },
  service: string,
  period: string
): boolean {
  if (normalized(existing.service) !== normalized(service)) return false;
  const a = normalized(existing.period);
  const b = normalized(period);
  const aMonth = month(a);
  const bMonth = month(b);
  return (
    a === b ||
    Boolean(aMonth && aMonth === bMonth) ||
    Boolean(aMonth && isCalendarDate(b) && b.slice(0, 7) === aMonth) ||
    Boolean(bMonth && isCalendarDate(a) && a.slice(0, 7) === bMonth)
  );
}

function assertAnchor(record: ProductionRecord, revision: number, anchorOn: string) {
  const selected = record.revisions[revision];
  if (!selected) throw new Error("Versão contratual inexistente.");
  if (
    anchorOn < selected.effectiveOn ||
    (selected.terms.startsOn && anchorOn < selected.terms.startsOn) ||
    (selected.terms.endsOn && anchorOn > selected.terms.endsOn)
  )
    throw new Error("O marco deve estar dentro da vigência da revisão contratual selecionada.");
  if (record.revisions.slice(revision + 1).some((item) => item.effectiveOn <= anchorOn))
    throw new Error(
      "Há uma revisão posterior vigente neste marco. Separe a programação e selecione a revisão aplicável."
    );
}

function scheduledTasks(
  obligations: ProductionRecord["revisions"][number]["terms"]["obligations"],
  planRules: TaskSchedulePlan["rules"],
  anchorOn: string,
  existingTasks: ProductionTask[] = []
): ScheduledTask[] {
  return planRules.map((rule) => {
    const obligation = obligations.find((item) => item.id === rule.obligationId);
    if (!obligation) throw new Error("Selecione obrigações pertencentes à revisão e ao ciclo.");
    return {
      obligationId: obligation.id,
      title: obligation.title,
      sourceReference: obligation.sourceReference,
      previousDue: existingTasks.find((task) => task.obligation.id === obligation.id)?.due || "",
      due: rule.offsetDays === null ? "" : addCalendarDays(anchorOn, rule.offsetDays),
    };
  });
}

export function previewTaskSchedule(
  record: ProductionRecord,
  cycleId: string,
  input: TaskSchedulePlan
): ScheduledTask[] {
  const plan = TaskSchedulePlanSchema.parse(input);
  if (!record.active) throw new Error("Reative o contrato antes de programar tarefas.");
  const cycle = record.cycles.find((item) => item.id === cycleId);
  if (!cycle) throw new Error("Ciclo não encontrado.");
  assertAnchor(record, cycle.revision, plan.anchorOn);
  if (
    cycle.cards.some(
      (card) =>
        ["produce", "deliver", "receive"].includes(card.id) &&
        !["todo", "blocked"].includes(card.status)
    )
  )
    throw new Error("Reabra a execução e as etapas dependentes antes de programar os prazos.");
  for (const rule of plan.rules) {
    const task = cycle.tasks.find((item) => item.obligation.id === rule.obligationId);
    if (!task) throw new Error("Selecione obrigações pertencentes à revisão e ao ciclo.");
    if (!["todo", "blocked"].includes(task.status))
      throw new Error("A programação em lote aceita apenas tarefas ainda não iniciadas.");
    if (rule.offsetDays === null)
      throw new Error(
        "Informe os dias corridos de cada tarefa selecionada; datas não são presumidas."
      );
  }
  return scheduledTasks(
    cycle.tasks.map((task) => task.obligation),
    plan.rules,
    plan.anchorOn,
    cycle.tasks
  );
}

export function previewCycleSchedule(
  record: ProductionRecord,
  seriesId: string,
  input: CycleSchedulePlan
): ScheduledCycle[] {
  z.string().uuid().parse(seriesId);
  const plan = CycleSchedulePlanSchema.parse(input);
  if (!record.active || !record.formalizedAt)
    throw new Error("Formalize um contrato ativo antes de programar ciclos recorrentes.");
  const revision = record.revisions[plan.revision];
  if (!revision) throw new Error("Versão contratual inexistente.");
  if (!revision.terms.recurring)
    throw new Error("A revisão selecionada não possui recorrência aprovada. Confira o contrato.");
  if (record.cycles.length + plan.occurrences > MAX_CYCLE_COUNT)
    throw new Error("A programação excede o limite de 200 ciclos deste contrato.");
  const interval = { monthly: 1, quarterly: 3, annual: 12 }[plan.frequency];
  return Array.from({ length: plan.occurrences }, (_, index) => {
    const anchorOn = addCalendarMonths(plan.firstOn, index * interval);
    assertAnchor(record, plan.revision, anchorOn);
    const cycleId = `${seriesId}_${index + 1}`;
    const period = anchorOn.slice(0, 7);
    if (
      record.cycles.some((item) => item.id === cycleId || sameCycleSlot(item, plan.service, period))
    )
      throw new Error(`Já existe ciclo deste serviço na competência ${period}. Confira a série.`);
    return {
      id: cycleId,
      period,
      anchorOn,
      tasks: scheduledTasks(revision.terms.obligations, plan.rules, anchorOn),
    };
  });
}
