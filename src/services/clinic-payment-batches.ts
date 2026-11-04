import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod/v3";
import type { AuthContext } from "@/lib/auth/auth-context";
import { requireFinancialAccess } from "@/lib/auth/financial-access";
import { requireAvpAccess } from "@/lib/auth/avp-access";
import { AuthError, badRequest } from "@/lib/auth/errors";
import { FinanceBookSchema, emptyFinanceBook, type FinanceBook } from "@/lib/financial/operations";
import {
  buildClinicPaymentPreview,
  nextClinicPaymentDate,
  type ClinicPaymentCandidateBatch,
} from "@/lib/financial/aso-payment-batches";
import { brazilToday } from "@/lib/financial/treasury";
import { getAvpSnapshot, syncAvpSource } from "@/services/avp-sheet-sync";
import { readPrivate, writePrivate } from "@/services/private-json-store";

const financePath = "financial-operations/v1/nextcon.json";

const PreviewInput = z
  .object({
    dueDate: z.string().optional(),
  })
  .strict();

const CreateInput = z
  .object({
    dueDate: z.string(),
    hash: z.string().length(64),
  })
  .strict();

function conflict(message: string): never {
  throw new AuthError(message, 409);
}

function ensureDueDate(value: string, today: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value))
    throw badRequest("Data de pagamento inválida.");
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value)
    throw badRequest("Data de pagamento inválida.");
  if (value < today) throw badRequest("A data de pagamento não pode estar no passado.");
  const limit = new Date(today + "T00:00:00Z");
  limit.setUTCDate(limit.getUTCDate() + 31);
  if (value > limit.toISOString().slice(0, 10))
    throw badRequest("Escolha uma data de pagamento nos próximos 31 dias.");
  return value;
}

function batchDigest(
  revision: string,
  financeVersion: number,
  dueDate: string,
  batches: ClinicPaymentCandidateBatch[]
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        revision,
        financeVersion,
        dueDate,
        batches: batches.map((batch) => ({
          key: batch.key,
          clinicDocument: batch.clinicDocument,
          competence: batch.competence,
          amountCents: batch.amountCents,
          items: batch.items.map((item) => [item.asoId, item.amountCents, item.examDate]),
        })),
      })
    )
    .digest("hex");
}

async function loadState(user: AuthContext, input: unknown) {
  requireFinancialAccess(user);
  requireAvpAccess(user);

  const parsed = PreviewInput.parse(input);
  const today = brazilToday();
  const dueDate = ensureDueDate(parsed.dueDate || nextClinicPaymentDate(today), today);
  const [, finance] = await Promise.all([
    syncAvpSource(true, user.uid),
    readPrivate(financePath, FinanceBookSchema, emptyFinanceBook),
  ]);
  const snapshot = await getAvpSnapshot();

  if (!snapshot.revision)
    conflict("A fila AVP ainda não possui uma versão confirmada para montar pagamentos.");

  const preview = buildClinicPaymentPreview(snapshot.items, finance.value);
  const closed = new Set(
    finance.value.periods.filter((period) => period.closed).map((period) => period.month)
  );
  const closedCompetences = [
    ...new Set(
      preview.batches
        .filter((batch) => closed.has(batch.competence))
        .map((batch) => batch.competence)
    ),
  ].sort();

  return {
    today,
    dueDate,
    snapshot,
    finance,
    preview,
    closedCompetences,
    hash: batchDigest(snapshot.revision, finance.value.version, dueDate, preview.batches),
  };
}

export async function previewClinicPaymentBatches(user: AuthContext, input: unknown) {
  const state = await loadState(user, input);
  return {
    hash: state.hash,
    dueDate: state.dueDate,
    cadence: "TUESDAY_FRIDAY" as const,
    sourceRevision: state.snapshot.revision,
    sourceCheckedAt: state.snapshot.checkedAt,
    sourceStatus: state.snapshot.status,
    sourceError: state.snapshot.error || null,
    closedCompetences: state.closedCompetences,
    ...state.preview,
  };
}

function short(value: string, fallback: string) {
  const text = value.trim().replace(/\s+/g, " ");
  return (text || fallback).slice(0, 180);
}

function titleForBatch(
  batch: ClinicPaymentCandidateBatch,
  dueDate: string,
  actor: string,
  sourceRevision: string,
  now: string
): {
  batch: FinanceBook["clinicPaymentBatches"][number];
  title: FinanceBook["titles"][number];
} {
  const batchId = randomUUID();
  const titleId = randomUUID();
  const title = {
    id: titleId,
    kind: "payable" as const,
    party: short(batch.clinicName, "Clínica não identificada"),
    description: short(
      `ASOs Grupo AVP · ${batch.items.length} exame(s) · ${batch.competence}`,
      "ASOs Grupo AVP"
    ),
    amountCents: batch.amountCents,
    competence: batch.competence,
    dueDate,
    category: "Exames ocupacionais",
    center: "Grupo AVP",
    contractId: null,
    sourceKey: `clinic-asos:${batchId}`,
    source: "manual" as const,
    externalReference: "",
    evidence: `Lote NAI ${batchId}; ${batch.items.length} ASO(s) concluído(s); CNPJ ${batch.clinicDocument}; origem AVP ${sourceRevision.slice(0, 64)}.`,
    status: "draft" as const,
    createdBy: actor,
    approvedBy: null,
  };
  return {
    title,
    batch: {
      id: batchId,
      clinicName: short(batch.clinicName, "Clínica não identificada"),
      clinicDocument: batch.clinicDocument,
      competence: batch.competence,
      dueDate,
      amountCents: batch.amountCents,
      titleId,
      items: batch.items.map((item) => ({
        asoId: item.asoId.slice(0, 180),
        collaborator: short(item.collaborator, "Colaborador não identificado"),
        city: short(item.city, "Cidade não informada"),
        examDate: item.examDate,
        amountCents: item.amountCents,
      })),
      createdBy: actor,
      createdAt: now,
    },
  };
}

export async function createClinicPaymentDrafts(user: AuthContext, input: unknown) {
  requireFinancialAccess(user);
  requireAvpAccess(user);
  const request = CreateInput.parse(input);
  const state = await loadState(user, { dueDate: request.dueDate });

  if (state.snapshot.status !== "CONNECTED" || state.snapshot.error)
    conflict(
      "A fonte AVP não está confirmada como conectada. Atualize a origem antes de gerar pagamentos."
    );
  if (state.hash !== request.hash)
    conflict("A fila AVP ou o financeiro mudou desde a prévia. Atualize e revise o lote.");
  if (!state.preview.batches.length)
    conflict("Não há ASOs concluídos e aptos para gerar rascunhos de pagamento.");
  if (state.closedCompetences.length)
    conflict(
      `Existem ASOs em competência fechada (${state.closedCompetences.join(", ")}). Reabra ou trate esses itens antes de gerar o lote.`
    );

  const now = new Date().toISOString();
  const book = structuredClone(state.finance.value);
  const created: Array<{
    batchId: string;
    titleId: string;
    clinicName: string;
    asoCount: number;
    amountCents: number;
  }> = [];

  for (const candidate of state.preview.batches) {
    const row = titleForBatch(candidate, state.dueDate, user.uid, state.snapshot.revision, now);
    book.titles.push(row.title);
    book.clinicPaymentBatches.push(row.batch);
    created.push({
      batchId: row.batch.id,
      titleId: row.title.id,
      clinicName: row.batch.clinicName,
      asoCount: row.batch.items.length,
      amountCents: row.batch.amountCents,
    });
  }

  book.version += 1;
  book.audit.push({
    id: randomUUID(),
    hash: state.hash,
    action: "clinicAsoBatch",
    actor: user.uid,
    at: now,
    reason:
      "Rascunhos de contas a pagar gerados por clínica a partir de ASOs concluídos; sem baixa, conciliação ou instrução bancária.",
    version: book.version,
    details: JSON.stringify({
      dueDate: state.dueDate,
      sourceRevision: state.snapshot.revision,
      created,
    }),
  });

  const validated = FinanceBookSchema.parse(book);
  await writePrivate(financePath, validated, state.finance.generation);

  return {
    success: true,
    dueDate: state.dueDate,
    created,
    totals: state.preview.totals,
    message:
      "Rascunhos criados. Eles ainda precisam ser submetidos e aprovados no financeiro antes de qualquer envio ao Omie.",
  };
}
