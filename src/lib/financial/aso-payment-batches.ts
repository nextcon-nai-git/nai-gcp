import type { FinanceBook } from "./operations";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { parseBrlCents } from "@/lib/avp-costs";

export type ClinicPaymentBlockCode =
  | "ALREADY_PAID"
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

const normalizedText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const digits = (value: string) => value.replace(/\D/g, "");

function validCalendarDate(value: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

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
  book: FinanceBook
): ClinicPaymentPreview {
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
    if (aso.status !== "EXAME FEITO") {
      ignored++;
      continue;
    }
    if (aso.pixRealizado.trim().toUpperCase() === "SIM") {
      blockedRows.push(blocked(aso, "ALREADY_PAID", "A fila informa pagamento já realizado."));
      continue;
    }
    if (alreadyBatched.has(aso.id)) {
      blockedRows.push(
        blocked(aso, "ALREADY_BATCHED", "O ASO já pertence a um lote financeiro ativo.")
      );
      continue;
    }
    const clinicName = aso.nomeClinica.trim();
    if (!clinicName) {
      blockedRows.push(blocked(aso, "MISSING_CLINIC", "Clínica não informada."));
      continue;
    }
    const clinicDocument = digits(aso.cnpjClinica);
    if (!/^\d{14}$/.test(clinicDocument)) {
      blockedRows.push(
        blocked(aso, "INVALID_DOCUMENT", "CNPJ da clínica ausente ou inválido.")
      );
      continue;
    }
    const amountCents = parseBrlCents(aso.valorAso);
    if (amountCents === null || amountCents <= 0) {
      blockedRows.push(
        blocked(aso, "INVALID_AMOUNT", "Valor unitário do ASO ausente ou inválido.")
      );
      continue;
    }
    const examDate = aso.dataAgendadaIso;
    if (!validCalendarDate(examDate)) {
      blockedRows.push(
        blocked(
          aso,
          "MISSING_EXAM_DATE",
          "Data efetiva/confirmada do exame não está disponível para definir a competência."
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
    group.names.add(normalizedText(clinicName));
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
      for (let offset = 0; offset < items.length; offset += 500) {
        const chunk = items.slice(offset, offset + 500);
        const amountCents = chunk.reduce((sum, item) => sum + item.amountCents, 0);
        if (!Number.isSafeInteger(amountCents))
          throw new Error("Total do lote excede a precisão financeira permitida.");
        chunks.push({
          key: key + ":" + String(Math.floor(offset / 500) + 1),
          clinicName: group.clinicName,
          clinicDocument: group.clinicDocument,
          competence: group.competence,
          amountCents,
          items: chunk,
          warnings,
        });
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
  if (!validCalendarDate(today)) throw new Error("Data de referência inválida.");
  const start = new Date(today + "T12:00:00Z");
  for (let offset = 0; offset <= 6; offset++) {
    const candidate = new Date(start);
    candidate.setUTCDate(start.getUTCDate() + offset);
    const weekday = candidate.getUTCDay();
    if (weekday === 2 || weekday === 5) return candidate.toISOString().slice(0, 10);
  }
  throw new Error("Não foi possível calcular a próxima data de pagamento.");
}
