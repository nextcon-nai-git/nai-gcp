import type {
  FinancialActionImport,
  SavedFinancialActionBatch,
} from "../../src/lib/financial/actions";

export const actionImportFixture: FinancialActionImport = {
  schemaVersion: 1,
  idempotencyKey: "test-financial-review-v1",
  title: "Revisão financeira de teste",
  actions: [
    {
      key: "conferir-lancamento",
      title: "Conferir lançamento de teste",
      action: "Conferir o documento e registrar o resultado da conciliação.",
      rationale: "A competência do documento precisa ser confirmada.",
      priority: "high",
      status: "proposed",
      suggestedOwner: "Financeiro de teste",
      proposedDueDate: "2026-10-20",
      period: { start: "2026-01-01", end: "2026-09-30", label: "Período de teste" },
      checklist: [
        { id: "documento", text: "Conferir documento", required: true, checked: false },
        { id: "comprovante", text: "Conferir comprovante", required: true, checked: false },
        { id: "nota", text: "Anexar nota complementar", required: false, checked: false },
      ],
      evidence: [
        {
          label: "Documento de teste",
          detail: "Referência fictícia para testes.",
          sourceName: "teste.pdf",
          page: 1,
          url: "https://example.com/financeiro",
        },
      ],
      baseAmountCents: 10000,
      estimatedSavingsCents: null,
      estimateBasis: "Valor fictício; nenhum ganho reconhecido.",
      caveat: "Conferência documental pendente.",
    },
  ],
};

export function savedActionBatchFixture(): SavedFinancialActionBatch {
  const id = "a".repeat(64);
  const now = "2026-10-11T12:00:00.000Z";
  return {
    ...structuredClone(actionImportFixture),
    id,
    importHash: "b".repeat(64),
    version: 1,
    importedAt: now,
    importedBy: "test-admin",
    updatedAt: now,
    updatedBy: "test-admin",
    actions: actionImportFixture.actions.map((action) => ({
      ...structuredClone(action),
      id: "c".repeat(64),
      batchId: id,
      version: 1,
      updatedAt: now,
      updatedBy: "test-admin",
    })),
  };
}
