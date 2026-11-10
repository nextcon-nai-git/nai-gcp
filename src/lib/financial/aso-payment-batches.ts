import { MAX_FINANCE_CENTS, MAX_CLINIC_BATCH_ITEMS, type FinanceBook } from "./operations";
import {
  avpCalendarDay,
  avpPixStatus,
  avpRequestIdentity,
  completedAvpStatus,
  normalizeAvpText,
  type GrupoAvpAso,
} from "@/lib/grupo-avp-asos-data";
import { brazilToday } from "./treasury";
import { isCalendarDate } from "@/lib/calendar-date";
import { parseBrlCents } from "@/lib/avp-costs";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";

export type ClinicPaymentBlockCode =
  | "ALREADY_PAID"
  | "UNCONFIRMED_PAYMENT"
  | "SOURCE_CONFLICT"
  | "DUPLICATE_REQUEST"
  | "FUTURE_EXAM"
  | "ALREADY_BATCHED"
  | "MISSING_CLINIC"
  | "INVALID_DOCUMENT"
  | "INVALID_AMOUNT"
  | "MISSING_EXAM_DATE";

export type ClinicPaymentBlocked = {
  asoId: string;
  collaborator: string;
  clinicName: string;
  code: ClinicPaymentBlockCode;
  reason: string;
};

export type ClinicPaymentCandidateItem = {
  asoId: string;
  collaborator: string;
  city: string;
  examDate: string;
  amountCents: number;
};

export type ClinicPaymentCandidateBatch = {
  key: string;
  clinicName: string;
  clinicDocument: string;
  competence: string;
  amountCents: number;
  items: ClinicPaymentCandidateItem[];
  warnings: string[];
};

export type ClinicPaymentPreview = {
  batches: ClinicPaymentCandidateBatch[];
  blocked: ClinicPaymentBlocked[];
  ignored: number;
  totals: {
    clinics: number;
    asos: number;
    amountCents: number;
  };
};

const paymentFields = new Set([
  "status",
  "manualStatusRaw",
  "nomeClinica",
  "cnpjClinica",
  "dataAgendada",
  "valorAso",
  "pixRealizado",
]);

function activeBatchedAsoIds(book: FinanceBook) {
  const titleState = new Map(book.titles.map((title) => [title.id, title.status]));
  const ids = new Set<string>();
  for (const batch of book.clinicPaymentBatches) {
    if (titleState.get(batch.titleId) === "cancelled") continue;
    for (const item of batch.items) ids.add(item.asoId);
  }
  return ids;
}

function blocked(
  aso: GrupoAvpAso,
  code: ClinicPaymentBlockCode,
  reason: string
): ClinicPaymentBlocked {
  return {
    asoId: aso.id,
    collaborator: aso.colaborador,
    clinicName: aso.nomeClinica,
    code,
    reason,
  };
}

/**
 * Builds a review-only payment proposal from completed AVP ASOs.
 * No title, Omie record, bank instruction or settlement is created here.
 */
export function buildClinicPaymentPreview(
  asos: GrupoAvpAso[],
  book: FinanceBook,
  {
    today = brazilToday(),
    conflicts = [],
  }: {
    today?: string;
    conflicts?: ReadonlyArray<{ id: string; field: string }>;
  } = {}
): ClinicPaymentPreview {
  const contested = new Set(conflicts.filter((c) => paymentFields.has(c.field)).map((c) => c.id));
  const identityCounts = new Map<string, number>();
  for (const row of asos) {
    const identity = avpRequestIdentity(row);
    identityCounts.set(identity, (identityCounts.get(identity) || 0) + 1);
  }
  const alreadyBatched = activeBatchedAsoIds(book);
  const groups = new Map<
    string,
    {
      clinicName: string;
      clinicDocument: string;
      competence: string;
      names: Set<string>;
      items: ClinicPaymentCandidateItem[];
    }
  >();
  const blockedRows: ClinicPaymentBlocked[] = [];
  let ignored = 0;

  for (const aso of asos) {
    if (contested.has(aso.id)) {
      blockedRows.push(
        blocked(
          aso,
          "SOURCE_CONFLICT",
          "Há divergência entre a fila e a planilha em um campo do pagamento."
        )
      );
      continue;
    }
    if (aso.status !== "EXAME FEITO") {
      ignored++;
      continue;
    }
    const pix = avpPixStatus(aso.pixRealizado);
    if (pix === "PAGO") {
      blockedRows.push(blocked(aso, "ALREADY_PAID", "A fila informa pagamento já realizado."));
      continue;
    }
    if (alreadyBatched.has(aso.id)) {
      blockedRows.push(
        blocked(aso, "ALREADY_BATCHED", "O ASO já pertence a um lote financeiro ativo.")
      );
      continue;
    }
    if (pix === "A CONFERIR") {
      blockedRows.push(
        blocked(aso, "UNCONFIRMED_PAYMENT", "Confira na origem se o Pix já foi realizado.")
      );
      continue;
    }
    if ((identityCounts.get(avpRequestIdentity(aso)) || 0) > 1) {
      blockedRows.push(
        blocked(
          aso,
          "DUPLICATE_REQUEST",
          "Há pedidos com a mesma identificação na fila. Confira a duplicidade."
        )
      );
      continue;
    }
    const clinicName = aso.nomeClinica.trim();
    if (!clinicName) {
      blockedRows.push(blocked(aso, "MISSING_CLINIC", "Clínica não informada."));
      continue;
    }
    const clinicDocument = normalizeCnpj(aso.cnpjClinica);
    if (!isValidCnpj(aso.cnpjClinica)) {
      blockedRows.push(blocked(aso, "INVALID_DOCUMENT", "CNPJ da clínica ausente ou inválido."));
      continue;
    }
    const amountCents = parseBrlCents(aso.valorAso);
    if (amountCents === null || amountCents <= 0 || amountCents > MAX_FINANCE_CENTS) {
      blockedRows.push(
        blocked(aso, "INVALID_AMOUNT", "Valor unitário do ASO ausente ou inválido.")
      );
      continue;
    }
    const reportedDate = completedAvpStatus(aso.manualStatusRaw || aso.statusRaw || "")?.[1];
    const examDate = reportedDate ? avpCalendarDay(reportedDate) : aso.dataAgendadaIso;
    if (!examDate.startsWith("20") || !isCalendarDate(examDate)) {
      blockedRows.push(
        blocked(
          aso,
          "MISSING_EXAM_DATE",
          "Data efetiva/confirmada do exame não está disponível para definir a competência."
        )
      );
      continue;
    }

    if (examDate > today) {
      blockedRows.push(
        blocked(
          aso,
          "FUTURE_EXAM",
          "O exame consta como concluído com data futura. Confira a realização."
        )
      );
      continue;
    }
    const competence = examDate.slice(0, 7);
    const key = clinicDocument + ":" + competence;
    const group = groups.get(key) || {
      clinicName,
      clinicDocument,
      competence,
      names: new Set<string>(),
      items: [],
    };
    group.names.add(normalizeAvpText(clinicName));
    group.items.push({
      asoId: aso.id,
      collaborator: aso.colaborador.trim() || "Colaborador não identificado",
      city: [aso.cidade.trim(), aso.uf.trim()].filter(Boolean).join("/") || "Cidade não informada",
      examDate,
      amountCents,
    });
    groups.set(key, group);
  }

  const batches = [...groups.entries()]
    .flatMap(([key, group]) => {
      const items = [...group.items].sort(
        (a, b) =>
          a.examDate.localeCompare(b.examDate) ||
          a.collaborator.localeCompare(b.collaborator, "pt-BR") ||
          a.asoId.localeCompare(b.asoId)
      );
      const warnings: string[] = [];
      if (group.names.size > 1)
        warnings.push(
          "O mesmo CNPJ aparece com nomes de clínica diferentes; confira o cadastro antes do envio ao Omie."
        );
      const chunks: ClinicPaymentCandidateBatch[] = [];
      for (const item of items) {
        let current = chunks.at(-1);
        if (
          !current ||
          current.items.length >= MAX_CLINIC_BATCH_ITEMS ||
          current.amountCents + item.amountCents > MAX_FINANCE_CENTS
        ) {
          current = {
            key: `${key}:${chunks.length + 1}`,
            clinicName: group.clinicName,
            clinicDocument: group.clinicDocument,
            competence: group.competence,
            amountCents: 0,
            items: [],
            warnings,
          };
          chunks.push(current);
        }
        current.items.push(item);
        current.amountCents += item.amountCents;
      }
      return chunks;
    })
    .sort(
      (a, b) =>
        a.competence.localeCompare(b.competence) ||
        a.clinicName.localeCompare(b.clinicName, "pt-BR") ||
        a.clinicDocument.localeCompare(b.clinicDocument)
    );

  return {
    batches,
    blocked: blockedRows,
    ignored,
    totals: {
      clinics: new Set(batches.map((batch) => batch.clinicDocument)).size,
      asos: batches.reduce((sum, batch) => sum + batch.items.length, 0),
      amountCents: batches.reduce((sum, batch) => sum + batch.amountCents, 0),
    },
  };
}

/** Tuesday/Friday review cadence, using an ISO calendar date in Brazil as input. */
export function nextClinicPaymentDate(today: string) {
  if (!today.startsWith("20") || !isCalendarDate(today))
    throw new Error("Data de referência inválida.");
  const start = new Date(today + "T12:00:00Z");
  for (let offset = 0; offset <= 6; offset++) {
    const candidate = new Date(start);
    candidate.setUTCDate(start.getUTCDate() + offset);
    const weekday = candidate.getUTCDay();
    if (weekday === 2 || weekday === 5) return candidate.toISOString().slice(0, 10);
  }
  throw new Error("Não foi possível calcular a próxima data de pagamento.");
}
