import { z } from "zod";
import type { PeriodicPerson } from "./avp-periodic-control";

export const PERIODIC_STAGES = [
  "validar",
  "agendar",
  "confirmar_realizacao",
  "resgatar_aso",
  "conferir_esocial",
  "concluido",
] as const;
export type PeriodicStage = (typeof PERIODIC_STAGES)[number];
export const PERIODIC_STAGE_LABELS: Record<PeriodicStage, string> = {
  validar: "Validar convocação",
  agendar: "Agendar",
  confirmar_realizacao: "Confirmar realização",
  resgatar_aso: "Resgatar e conferir ASO",
  conferir_esocial: "Conferir eSocial",
  concluido: "Concluído com evidências",
};
export const periodicPatchSchema = z
  .object({
    id: z.string().regex(/^periodico-2026-\d+$/),
    sourceVersion: z.string().regex(/^[a-f0-9]{64}$/),
    revision: z.number().int().nonnegative(),
    stage: z.enum(PERIODIC_STAGES),
    responsible: z.string().trim().min(2).max(100),
    nextDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal("")),
    evidence: z.string().trim().min(10).max(1000),
  })
  .strict();
export type PeriodicPatch = z.infer<typeof periodicPatchSchema>;
export type PeriodicWorkState = Omit<PeriodicPatch, "id" | "evidence"> & {
  updatedAt: string;
  updatedBy: string;
};
export type PeriodicWorkCard = {
  person: PeriodicPerson;
  sourceVersion: string;
  state: PeriodicWorkState | null;
  stage: PeriodicStage;
  blocked: boolean;
  sourceChanged: boolean;
  overdue: boolean;
};

export function validatePeriodicTransition(
  person: PeriodicPerson,
  current: PeriodicWorkState | null,
  patch: PeriodicPatch
) {
  if (patch.stage !== "validar" && person.classification === "cancelled")
    throw new Error("Cancelado na fonte: corrija a origem antes de avançar.");
  if (patch.stage !== "validar" && (!person.unit || person.duplicateRows > 0))
    throw new Error("Confirme a unidade e resolva duplicidades na fonte antes de avançar.");
  const from = PERIODIC_STAGES.indexOf(current?.stage || "validar");
  const to = PERIODIC_STAGES.indexOf(patch.stage);
  // Returning to validation is always possible; no skipped or inferred completion.
  if (to !== 0 && to !== from && to !== from + 1)
    throw new Error("Avance uma etapa por vez e registre a evidência correspondente.");
  if (
    patch.nextDate &&
    (Number.isNaN(Date.parse(patch.nextDate + "T12:00:00Z")) ||
      new Date(patch.nextDate + "T12:00:00Z").toISOString().slice(0, 10) !== patch.nextDate)
  )
    throw new Error("Data da próxima ação inválida.");
}

export function periodicActionEvidence(stage: PeriodicStage) {
  return {
    validar: "Fonte e motivo da revisão; confirmar vínculo, último exame e periodicidade.",
    agendar:
      "Referência da validação: vínculo, último exame, periodicidade e necessidade da convocação.",
    confirmar_realizacao:
      "Confirmação da agenda, data, horário e clínica. Agendamento não comprova realização.",
    resgatar_aso: "Comprovante de comparecimento/realização com referência e data.",
    conferir_esocial: "Referência do ASO recebido e conferido e data. Não inserir diagnóstico.",
    concluido:
      "Número/data do recibo de aceitação no eSocial ou justificativa documentada de não aplicabilidade.",
  }[stage];
}
