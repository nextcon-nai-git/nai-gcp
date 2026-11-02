import { z } from "zod/v3";
import { WorkflowSchema, WORKFLOW_STAGES, workflowProblems } from "./avp-workflow";
import { periodicProgress, type PeriodicProgress } from "./avp-periodic-status";
import type { PeriodicPerson } from "./avp-periodic-control";

export const AVP_WORKFLOW_UPDATED_EVENT = "nai:avp-workflow-updated";

const StoredWorkflowSchema = WorkflowSchema.extend({
  id: z.string().min(1),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
});
const identity = (sourceId: string, unit: string, admission: string) =>
  JSON.stringify([sourceId, unit, admission]);

/** Operational progress is projected only onto one exact, validated source identity. */
export function projectAvpWorkflowProgress(
  people: PeriodicPerson[],
  records: unknown[]
): PeriodicPerson[] {
  const byIdentity = new Map<string, unknown[]>();
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const r = record as Record<string, unknown>;
    if ([r.sourceId, r.unit, r.admission].some((v) => typeof v !== "string")) continue;
    const key = identity(r.sourceId as string, r.unit as string, r.admission as string);
    byIdentity.set(key, [...(byIdentity.get(key) || []), record]);
  }
  const sourceCounts = new Map<string, number>();
  for (const p of people) {
    const key = identity(p.id, p.unit, p.admission);
    sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
  }
  return people.map((person) => {
    const sourceStatus = person.sourceStatus ?? person.status;
    const sourceProgress =
      person.sourceProgress ??
      person.progress ??
      periodicProgress(sourceStatus, person.asoReceivedAt);
    const original: PeriodicPerson = {
      ...person,
      status: sourceStatus,
      progress: sourceProgress,
      sourceStatus,
      sourceProgress,
      progressSource: "spreadsheet",
    };
    const key = identity(person.id, person.unit, person.admission);
    const matches = byIdentity.get(key) || [];
    if (!matches.length) return original;
    const conflict = (reason: string, progress: PeriodicProgress = "unknown"): PeriodicPerson => ({
      ...original,
      progress,
      progressConflict: reason,
      review: [person.review, reason].filter(Boolean).join(" · "),
    });
    if (matches.length !== 1 || sourceCounts.get(key) !== 1)
      return conflict(
        "Há mais de um vínculo para este caso. Confira a identidade antes de atualizar o mapa."
      );
    const parsed = StoredWorkflowSchema.safeParse(matches[0]);
    if (!parsed.success || workflowProblems(parsed.data).length)
      return conflict("O caso da esteira tem campos ou evidências pendentes de conferência.");
    const record = parsed.data;
    if (record.employee !== person.name || record.city !== person.city)
      return conflict("A identificação ou o local da esteira diverge da planilha.");
    // Unknown, conflicting and duplicate source rows must never be painted as a success.
    if (sourceProgress === "unknown" || person.duplicateRows > 0)
      return conflict(
        "Há status desconhecido ou linhas divergentes na fonte. Confira antes de conciliar."
      );
    if (sourceProgress === "cancelled" || person.classification === "cancelled")
      return record.stage === "pending"
        ? { ...original, progress: "cancelled" }
        : conflict(
            "A fonte registra cancelamento ou falta; confira o caso antes de reabrir.",
            "cancelled"
          );
    if (person.classification === "review")
      return conflict(
        "A identidade na fonte ainda está em conferência; o avanço não foi conciliado."
      );
    const workflowProgress: PeriodicProgress | null =
      record.stage === "scheduled" || record.stage === "waiting"
        ? "scheduled"
        : ["review", "ready", "delivered"].includes(record.stage)
          ? "received"
          : null;
    if (!workflowProgress) return original;
    if (sourceProgress === "received" && workflowProgress === "scheduled")
      return conflict("A fonte informa ASO recebido, mas a esteira ainda aguarda o documento.");
    return {
      ...original,
      status: WORKFLOW_STAGES[record.stage],
      progress: workflowProgress,
      progressSource: "workflow",
      workflowStage: record.stage,
      workflowUpdatedAt: record.updatedAt,
    };
  });
}
