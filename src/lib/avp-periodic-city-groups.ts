import {
  PERIODIC_STAGES,
  PERIODIC_STAGE_LABELS,
  type PeriodicStage,
  type PeriodicWorkCard,
} from "./avp-periodic-workflow";

export type PeriodicCityGroup = {
  key: string;
  campaign: string;
  cityKey: string;
  city: string;
  uf: string;
  cards: PeriodicWorkCard[];
  total: number;
  active: number;
  cancelled: number;
  completed: number;
  pending: number;
  kitSent: number | null;
  appointmentsConfirmed: number;
  examsPerformed: number;
  asoReceived: number;
  blocked: number;
  sourceChanged: number;
  overdue: number;
  unassigned: number;
  units: string[];
  owners: string[];
  nextDate: string | null;
  /** Counts all active records, including records awaiting source review. */
  stageCounts: Record<PeriodicStage, number>;
  priority: { label: string; rank: number };
  complete: boolean;
};

const compareText = (a: string, b: string) => a.localeCompare(b, "pt-BR");
const uniqueLabels = (values: string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(compareText);
const isComplete = (card: PeriodicWorkCard) =>
  card.stage === "concluido" && !card.blocked && !card.sourceChanged;

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function summarizeGroup(
  cards: PeriodicWorkCard[],
  campaign: string,
  cityKey: string
): PeriodicCityGroup {
  const active = cards.filter((card) => card.person.classification !== "cancelled");
  const pending = active.filter((card) => !isComplete(card));
  const blocked = active.filter((card) => card.blocked).length;
  const sourceChanged = active.filter((card) => card.sourceChanged).length;
  const overdue = pending.filter((card) => card.overdue).length;
  const complete = active.length > 0 && pending.length === 0;
  const stageIndex = (stage: PeriodicStage) => PERIODIC_STAGES.indexOf(stage);
  const atLeast = (card: PeriodicWorkCard, stage: PeriodicStage) =>
    stageIndex(card.stage) >= stageIndex(stage) && !card.blocked && !card.sourceChanged;
  const kitEvidence = active.filter((card) =>
    /\bkit\s+enviado\b/i.test(
      [card.person.status, card.person.reviewDetail || ""].filter(Boolean).join(" ")
    )
  );
  const kitSignalAvailable = active.some((card) =>
    /\bkit\b/i.test([card.person.status, card.person.reviewDetail || ""].filter(Boolean).join(" "))
  );
  const appointmentsConfirmed = active.filter((card) =>
    atLeast(card, "confirmar_realizacao")
  ).length;
  const examsPerformed = active.filter((card) => atLeast(card, "resgatar_aso")).length;
  const asoReceived = active.filter(
    (card) => atLeast(card, "conferir_esocial") || Boolean(card.person.asoReceivedAt)
  ).length;
  const stageCounts = Object.fromEntries(PERIODIC_STAGES.map((stage) => [stage, 0])) as Record<
    PeriodicStage,
    number
  >;
  for (const card of active) stageCounts[card.stage]++;
  const nextDates = pending
    .map((card) => card.state?.nextDate)
    .filter(validDate)
    .sort();
  let priority: PeriodicCityGroup["priority"];
  if (!active.length) {
    priority = { label: "Sem registros ativos", rank: PERIODIC_STAGES.length + 2 };
  } else if (sourceChanged || blocked) {
    priority = {
      label:
        sourceChanged && blocked
          ? "Revalidar fonte e bloqueios"
          : sourceChanged
            ? "Revalidar fonte"
            : "Resolver bloqueios",
      rank: 0,
    };
  } else if (overdue) {
    priority = { label: "Ações vencidas", rank: 1 };
  } else if (complete) {
    priority = { label: "Concluída", rank: PERIODIC_STAGES.length + 1 };
  } else {
    const earliestStage = PERIODIC_STAGES.find((stage) =>
      pending.some((card) => card.stage === stage)
    )!;
    priority = {
      label: PERIODIC_STAGE_LABELS[earliestStage],
      rank: PERIODIC_STAGES.indexOf(earliestStage) + 2,
    };
  }
  return {
    key: `${campaign}:${cityKey}`,
    campaign,
    cityKey,
    city: cards[0].person.city,
    uf: cards[0].person.uf,
    cards,
    total: cards.length,
    active: active.length,
    cancelled: cards.length - active.length,
    completed: active.length - pending.length,
    pending: pending.length,
    kitSent: kitSignalAvailable ? kitEvidence.length : null,
    appointmentsConfirmed,
    examsPerformed,
    asoReceived,
    blocked,
    sourceChanged,
    overdue,
    unassigned: pending.filter((card) => !card.state?.responsible.trim()).length,
    units: uniqueLabels(cards.map((card) => card.person.unit)),
    owners: uniqueLabels(cards.map((card) => card.state?.responsible || "")),
    nextDate: nextDates[0] || null,
    stageCounts,
    priority,
    complete,
  };
}

/**
 * Group the complete campaign snapshot before applying UI filters to groups.
 * Counts refer to workflow records/vínculos, never inferred distinct people.
 * The campaign is explicit; neither names nor IDs determine group membership.
 */
export function groupPeriodicWorkByCity(
  cards: readonly PeriodicWorkCard[],
  campaign = "2026"
): PeriodicCityGroup[] {
  const groups = new Map<string, PeriodicWorkCard[]>();
  for (const card of cards) {
    const group = groups.get(card.person.cityKey);
    if (group) group.push(card);
    else groups.set(card.person.cityKey, [card]);
  }
  return [...groups]
    .map(([cityKey, group]) => summarizeGroup(group, campaign, cityKey))
    .sort(
      (a, b) =>
        a.priority.rank - b.priority.rank ||
        (a.nextDate || "9999-12-31").localeCompare(b.nextDate || "9999-12-31") ||
        b.pending - a.pending ||
        compareText(a.city, b.city) ||
        compareText(a.uf, b.uf) ||
        compareText(a.key, b.key)
    );
}
