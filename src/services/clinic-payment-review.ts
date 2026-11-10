import "server-only";

import type { AuthContext } from "@/lib/auth/auth-context";
import { AuthError } from "@/lib/auth/errors";
import { buildClinicPaymentPreview } from "@/lib/financial/aso-payment-batches";
import type { FinanceBook, FinanceTitle } from "@/lib/financial/operations";
import { getAvpSnapshot, syncAvpSource } from "./avp-sheet-sync";
import { requireCurrentFinancialAccess } from "./financial-access";

function conflict(message: string): never {
  throw new AuthError(message, 409);
}

type ClinicBatch = FinanceBook["clinicPaymentBatches"][number];

export function clinicBatchForTitle(book: FinanceBook, title: FinanceTitle) {
  const linked = book.clinicPaymentBatches.filter((batch) => batch.titleId === title.id);
  const batch = linked[0];
  const tagged = title.sourceKey.startsWith("clinic-asos:");
  if (!batch && !tagged) return;
  if (
    !batch ||
    linked.length !== 1 ||
    title.kind !== "payable" ||
    (tagged && title.sourceKey !== `clinic-asos:${batch.id}`) ||
    batch.amountCents !== title.amountCents ||
    batch.competence !== title.competence ||
    batch.dueDate !== title.dueDate ||
    batch.items.reduce((sum, item) => sum + item.amountCents, 0) !== batch.amountCents ||
    new Set(batch.items.map((item) => item.asoId)).size !== batch.items.length
  )
    conflict(
      "O vínculo entre o título e os ASOs está inconsistente. Confira o lote no financeiro."
    );
  return batch;
}

async function freshAvpSnapshot(actor: string) {
  try {
    const sync = await syncAvpSource("financial-review", actor);
    if (!sync.started || sync.error)
      conflict("A fila AVP não pôde ser atualizada agora. Aguarde e confira o lote novamente.");
    return await getAvpSnapshot();
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      "Não foi possível confirmar a fila AVP. Atualize e confira o lote novamente.",
      503
    );
  }
}

export async function verifyClinicPayment(
  user: AuthContext,
  book: FinanceBook,
  batch: ClinicBatch
) {
  const snapshot = await freshAvpSnapshot(user.uid);
  await requireCurrentFinancialAccess(user);
  if (
    !snapshot.revision ||
    snapshot.status !== "CONNECTED" ||
    snapshot.error ||
    snapshot.refreshInProgress
  )
    conflict("A atualização da fila AVP está pendente. Aguarde e confira o lote novamente.");

  // Only this batch can release its own ASOs for re-evaluation. Other active batches still count.
  const preview = buildClinicPaymentPreview(
    snapshot.items,
    {
      ...book,
      clinicPaymentBatches: book.clinicPaymentBatches.filter(
        (other) => other.titleId !== batch.titleId
      ),
    },
    { conflicts: snapshot.conflicts }
  );
  const candidates = new Map(
    preview.batches
      .filter(
        (row) => row.clinicDocument === batch.clinicDocument && row.competence === batch.competence
      )
      .flatMap((row) => row.items.map((item) => [item.asoId, item] as const))
  );
  const blocked = new Map(preview.blocked.map((item) => [item.asoId, item.reason]));
  const rows = new Map(snapshot.items.map((row) => [row.id, row]));
  for (const item of batch.items) {
    const current = candidates.get(item.asoId);
    if (current && current.examDate === item.examDate && current.amountCents === item.amountCents)
      continue;
    const source = rows.get(item.asoId);
    const line = source ? source.sourceRow : item.sourceRow;
    const label = line ? `${source ? "Linha atual" : "Linha original"} ${line}` : "ASO";
    const reason =
      blocked.get(item.asoId) ||
      (!source
        ? "O pedido não foi localizado na fila atual."
        : source.status !== "EXAME FEITO"
          ? "O exame deixou de constar como concluído."
          : "O CNPJ da clínica, a data do exame ou o valor mudou.");
    conflict(`${label} · ${item.collaborator}. ${reason} Revise o lote antes de prosseguir.`);
  }
}
