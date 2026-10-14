import { z } from "zod";

export const FINANCIAL_ACTION_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const financialActionPriorities = ["critical", "high", "medium", "low"] as const;
export const financialActionStatuses = ["proposed", "in_progress", "blocked", "done"] as const;
export const priorityLabels: Record<(typeof financialActionPriorities)[number], string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
export const statusLabels: Record<(typeof financialActionStatuses)[number], string> = {
  proposed: "Proposta",
  in_progress: "Em andamento",
  blocked: "Aguardando informação",
  done: "Concluída",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const key = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/, "Identificador inválido");
const hash = z.string().regex(/^[a-f0-9]{64}$/, "Identificador inválido");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Data inválida");
const amount = z.number().int().nonnegative().max(1e14).nullable().default(null);

export function isFinancialEvidenceUrl(value: string): boolean {
  if (/[\u0000-\u0020\\]/.test(value)) return false;
  try {
    const parsed = new URL(value, "https://nai.invalid");
    if (value.startsWith("/")) {
      return (
        !value.startsWith("//") &&
        parsed.origin === "https://nai.invalid" &&
        (parsed.pathname === "/financial" || parsed.pathname.startsWith("/financial/"))
      );
    }
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export const FinancialActionEvidenceSchema = z
  .object({
    label: text(160),
    detail: text(4000),
    url: z.string().max(2048).refine(isFinancialEvidenceUrl, "Link de fonte inválido").optional(),
    sourceName: text(240).optional(),
    sourceSha256: hash.optional(),
    page: z.number().int().min(1).max(30000).optional(),
    document: z
      .object({ kind: z.enum(["ledger", "balance"]), id: hash })
      .strict()
      .optional(),
  })
  .strict();

const checklistItem = z
  .object({
    id: key,
    text: text(600),
    required: z.boolean().default(true),
    checked: z.boolean().default(false),
  })
  .strict();
const actionFields = {
  key,
  title: text(180),
  action: text(4000),
  rationale: text(4000),
  priority: z.enum(financialActionPriorities),
  status: z.enum(financialActionStatuses).default("proposed"),
  suggestedOwner: text(200),
  proposedDueDate: date.nullable().default(null),
  period: z.object({ start: date, end: date, label: text(120) }).strict(),
  checklist: z.array(checklistItem).min(1).max(40),
  evidence: z.array(FinancialActionEvidenceSchema).min(1).max(12),
  baseAmountCents: amount,
  estimatedSavingsCents: amount,
  estimateBasis: text(2000).optional(),
  caveat: text(3000),
};
const actionObject = z.object(actionFields).strict();
function checkAction(action: z.infer<typeof actionObject>, ctx: z.RefinementCtx) {
  if (action.period.start > action.period.end)
    ctx.addIssue({ code: "custom", path: ["period"], message: "Período invertido" });
  if (new Set(action.checklist.map((item) => item.id)).size !== action.checklist.length)
    ctx.addIssue({ code: "custom", path: ["checklist"], message: "Item de checklist duplicado" });
  if (action.status === "done" && action.checklist.some((item) => item.required && !item.checked))
    ctx.addIssue({
      code: "custom",
      path: ["status"],
      message: "Conclua os itens obrigatórios antes de concluir a ação",
    });
  if (
    (action.baseAmountCents !== null || action.estimatedSavingsCents !== null) &&
    !action.estimateBasis
  )
    ctx.addIssue({
      code: "custom",
      path: ["estimateBasis"],
      message: "Informe a base de cálculo e as condições dos valores estimados",
    });
}
export const FinancialActionSchema = actionObject.superRefine(checkAction);
export const FinancialActionImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/),
    title: text(200),
    actions: z.array(FinancialActionSchema).min(1).max(100),
  })
  .strict()
  .superRefine((batch, ctx) => {
    if (new Set(batch.actions.map((action) => action.key)).size !== batch.actions.length)
      ctx.addIssue({ code: "custom", path: ["actions"], message: "Chave de ação duplicada" });
  });
export const SavedFinancialActionSchema = actionObject
  .extend({
    id: hash,
    batchId: hash,
    version: z.number().int().min(1),
    updatedAt: z.string().datetime(),
    updatedBy: text(200),
  })
  .strict()
  .superRefine(checkAction);
export const SavedFinancialActionBatchSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: hash,
    idempotencyKey: text(120),
    title: text(200),
    importHash: hash,
    version: z.number().int().min(1),
    importedAt: z.string().datetime(),
    importedBy: text(200),
    updatedAt: z.string().datetime(),
    updatedBy: text(200),
    actions: z.array(SavedFinancialActionSchema).min(1).max(100),
  })
  .strict();
export const FinancialActionPatchSchema = z
  .object({
    batchId: hash,
    actionId: hash,
    expectedVersion: z.number().int().min(1),
    status: z.enum(financialActionStatuses).optional(),
    checklist: z
      .array(z.object({ id: key, checked: z.boolean() }).strict())
      .min(1)
      .max(40)
      .optional(),
  })
  .strict()
  .superRefine((patch, ctx) => {
    if (!patch.status && !patch.checklist)
      ctx.addIssue({ code: "custom", message: "Informe uma alteração de status ou checklist" });
    if (
      patch.checklist &&
      new Set(patch.checklist.map((item) => item.id)).size !== patch.checklist.length
    )
      ctx.addIssue({ code: "custom", path: ["checklist"], message: "Item de checklist duplicado" });
  });
export const FinancialActionListQuerySchema = z
  .object({ cursor: z.string().max(2000).optional() })
  .strict();
export type FinancialActionImport = z.infer<typeof FinancialActionImportSchema>;
export type FinancialAction = z.infer<typeof FinancialActionSchema>;
export type FinancialActionEvidence = z.infer<typeof FinancialActionEvidenceSchema>;
export type FinancialActionPatch = z.infer<typeof FinancialActionPatchSchema>;
export type SavedFinancialAction = z.infer<typeof SavedFinancialActionSchema>;
export type SavedFinancialActionBatch = z.infer<typeof SavedFinancialActionBatchSchema>;
export type FinancialActionList = {
  schemaVersion: 1;
  batches: SavedFinancialActionBatch[];
  nextCursor: string | null;
};
