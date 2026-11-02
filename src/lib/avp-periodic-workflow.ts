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
export const periodicWorkIdSchema = z.string().regex(/^periodico-2026-[a-f0-9]{64}$/);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida.");
const kinds = [
  "review",
  "eligibility",
  "appointment",
  "attendance",
  "aso",
  "esocial_receipt",
  "not_applicable",
] as const;
export type PeriodicEvidenceKind = (typeof kinds)[number];
export const periodicEvidenceKind = (stage: PeriodicStage): PeriodicEvidenceKind =>
  (
    ({
      validar: "review",
      agendar: "eligibility",
      confirmar_realizacao: "appointment",
      resgatar_aso: "attendance",
      conferir_esocial: "aso",
      concluido: "esocial_receipt",
    }) as const
  )[stage];
export const periodicPatchSchema = z
  .object({
    id: periodicWorkIdSchema,
    sourceVersion: z.string().regex(/^[a-f0-9]{64}$/),
    revision: z.number().int().nonnegative(),
    stage: z.enum(PERIODIC_STAGES),
    responsible: z.string().trim().min(2).max(100),
    nextDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal("")),
    evidence: z.string().trim().min(10).max(1000),
    evidenceDate: day,
    evidenceKind: z.enum(kinds),
    clinic: z.string().trim().max(240),
    appointmentTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
    receiptNumber: z.string().trim().max(120),
    nonApplicabilityReason: z.string().trim().max(1000),
  })
  .strict()
  .superRefine((patch, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
    if (patch.stage === "concluido") {
      if (patch.evidenceKind === "esocial_receipt") {
        if (!/^[A-Za-z0-9][A-Za-z0-9./-]{4,119}$/.test(patch.receiptNumber))
          invalid("Informe o número do recibo de aceitação do eSocial.");
      } else if (patch.evidenceKind === "not_applicable") {
        if (patch.nonApplicabilityReason.length < 20)
          invalid("Documente a justificativa de não aplicabilidade.");
      } else invalid("A conclusão exige recibo de aceitação ou não aplicabilidade documentada.");
    } else if (patch.evidenceKind !== periodicEvidenceKind(patch.stage)) {
      invalid("A evidência deve corresponder à etapa registrada.");
    }
    if (patch.evidenceKind === "appointment" && (!patch.clinic || !patch.appointmentTime))
      invalid("Informe clínica, data e horário confirmados do atendimento.");
  });
export type PeriodicPatch = z.infer<typeof periodicPatchSchema>;
export type PeriodicWorkState = Pick<
  PeriodicPatch,
  "sourceVersion" | "revision" | "stage" | "responsible" | "nextDate"
> & {
  updatedAt: string;
  updatedBy: string;
};
export type PeriodicWorkCard = {
  id: string;
  revision: number;
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
  periodicPatchSchema.parse(patch);
  if (patch.stage !== "validar" && person.classification === "cancelled")
    throw new Error("Cancelado na fonte: corrija a origem antes de avançar.");
  if (
    patch.stage !== "validar" &&
    (!person.unit || person.duplicateRows > 0 || !person.workIdentityComplete)
  )
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
