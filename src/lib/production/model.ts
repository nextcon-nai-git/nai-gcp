import { z } from "zod";
import { isCalendarDate } from "@/lib/financial/omie-dre";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import { instructions, type CardId } from "./instructions";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const label = z.string().trim().min(1).max(180);
const note = z.string().trim().min(3).max(2000);
const date = z.string().refine(isCalendarDate, "Data inválida.");
const optionalDate = z.union([z.literal(""), date]);
const cents = z.number().int().min(0).max(100_000_000_000);
export const SourceSchema = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    storagePath: z.string(),
    generation: z.string().regex(/^\d+$/),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024 - 1),
  })
  .strict()
  .refine(
    (s) => s.storagePath === `internos_nextcon/contract-sources/${s.sha256}`,
    "Fonte inválida."
  );
export const DocumentSchema = z.object({
  name: label,
  kind: z.enum(["proposta", "contrato", "anexo", "aditivo"]),
  source: SourceSchema,
});
export const TermsSchema = z
  .object({
    scope: note,
    units: z.string().max(1000),
    deliverables: z.string().max(2000),
    valueCents: cents.nullable(),
    startsOn: optionalDate,
    endsOn: optionalDate,
    paymentTerms: z.string().max(2000),
    recurring: z.boolean(),
  })
  .strict()
  .refine(
    (t) => !t.endsOn || !t.startsOn || t.endsOn >= t.startsOn,
    "Vigência final anterior ao início."
  );
export const CardSchema = z
  .object({
    id: z.enum([
      "budget",
      "proposal",
      "contract",
      "mobilize",
      "produce",
      "deliver",
      "measure",
      "invoice",
      "receive",
    ]),
    owner: z.string().max(180),
    due: optionalDate,
    status: z.enum(["todo", "doing", "blocked", "done", "na"]),
    checks: z.array(z.boolean()).length(4),
    evidence: z.string().max(2000),
    blocker: z.string().max(1000),
  })
  .strict();
const CycleSchema = z.object({
  id,
  service: label,
  period: label,
  revision: z.number().int().nonnegative(),
  contractedCents: cents.nullable(),
  cards: z.array(CardSchema).length(6),
  advanceEvidence: z.string().max(2000),
  measuredCents: cents,
  invoicedCents: cents,
  receivedCents: cents,
  adjustmentCents: cents,
  measurementEvidence: z.string().max(2000),
  invoiceReference: z.string().max(180),
  invoiceEvidence: z.string().max(2000),
  receiptEvidence: z.string().max(2000),
  adjustmentEvidence: z.string().max(2000),
  financeTitleId: z.string().max(100),
});
export type Cycle = z.infer<typeof CycleSchema>;
export const RecordSchema = z.object({
  id,
  companyId: id,
  companyName: label,
  cnpj: z.string(),
  name: label,
  owner: label,
  active: z.boolean(),
  financeContractId: z.string().max(100),
  formalizedAt: z.string().nullable().default(null),
  documents: z.array(DocumentSchema).max(100),
  revisions: z
    .array(
      z.object({
        terms: TermsSchema,
        effectiveOn: date,
        evidence: note,
        actor: label,
        at: z.string(),
        sourceHash: z.string(),
      })
    )
    .min(1)
    .max(100),
  commercial: z.array(CardSchema).length(3),
  cycles: z.array(CycleSchema).max(200),
  createdAt: z.string(),
});
export type ProductionRecord = z.infer<typeof RecordSchema>;
export type ProductionCard = z.infer<typeof CardSchema>;
export const BookSchema = z.object({
  version: z.number().int().nonnegative(),
  records: z.array(RecordSchema).max(1000),
  audit: z
    .array(
      z.object({
        requestId: z.string().uuid(),
        hash: z.string(),
        recordId: id,
        action: z.string(),
        actor: label,
        at: z.string(),
        reason: z.string(),
        details: z.string(),
      })
    )
    .max(20000),
});
export type ProductionBook = z.infer<typeof BookSchema>;
export const emptyBook = (): ProductionBook => ({ version: 0, records: [], audit: [] });
const common = {
  requestId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  recordId: id,
};
export const CommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...common,
      action: z.literal("revise"),
      terms: TermsSchema,
      effectiveOn: date,
      evidence: note,
      reviewed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("create"),
      companyId: id,
      cnpj: z.string().transform(normalizeCnpj).refine(isValidCnpj, "CNPJ inválido."),
      name: label,
      owner: label,
      terms: TermsSchema,
      document: DocumentSchema.nullable(),
      effectiveOn: date,
      evidence: note,
      reviewed: z.literal(true),
    })
    .strict(),
  z
    .object({ ...common, action: z.literal("document"), document: DocumentSchema, evidence: note })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("amend"),
      terms: TermsSchema,
      effectiveOn: date,
      document: DocumentSchema,
      evidence: note,
      reviewed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("cycle"),
      cycleId: id,
      service: label,
      period: label,
      revision: z.number().int().nonnegative(),
      contractedCents: cents.nullable(),
      advanceEvidence: z.string().max(2000),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("card"),
      cycleId: z.string().max(100),
      card: CardSchema,
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("billing"),
      cycleId: id,
      data: CycleSchema.pick({
        measuredCents: true,
        invoicedCents: true,
        receivedCents: true,
        adjustmentCents: true,
        measurementEvidence: true,
        invoiceReference: true,
        invoiceEvidence: true,
        receiptEvidence: true,
        adjustmentEvidence: true,
        financeTitleId: true,
      }),
      reason: note,
    })
    .strict(),
  z
    .object({ ...common, action: z.literal("linkFinance"), financeContractId: id, reason: note })
    .strict(),
  z.object({ ...common, action: z.literal("active"), active: z.boolean(), reason: note }).strict(),
]);
export type Command = z.infer<typeof CommandSchema>;
export class ProductionError extends Error {
  constructor(
    message: string,
    public status = 422
  ) {
    super(message);
  }
}
function fail(message: string): never {
  throw new ProductionError(message);
}
export function makeCards(ids: readonly CardId[]): ProductionCard[] {
  return ids.map((id) => ({
    id,
    owner: "",
    due: "",
    status: "todo",
    checks: [false, false, false, false],
    evidence: "",
    blocker: "",
  }));
}
const complete = (card: ProductionCard) => card.status === "done" || card.status === "na";
export function applyCommand(
  book: ProductionBook,
  command: Command,
  actor: string,
  now: string,
  hash: string,
  companyName = ""
): ProductionBook {
  const prior = book.audit.find((a) => a.requestId === command.requestId);
  if (prior) {
    if (prior.hash !== hash || prior.actor !== actor)
      throw new ProductionError("Identificador já utilizado por outra operação.", 409);
    return book;
  }
  if (book.version !== command.expectedVersion)
    throw new ProductionError("Outra sessão alterou a central. Atualize e revise.", 409);
  const next = structuredClone(book);
  let record = next.records.find((r) => r.id === command.recordId);
  if (command.action === "create") {
    if (record) fail("Identificador de contrato já cadastrado.");
    if (command.document && ["aditivo", "anexo"].includes(command.document.kind))
      fail(
        "Cadastre primeiro a proposta ou contrato e anexe este documento ao registro correspondente."
      );
    if (
      command.document &&
      next.records.some((r) =>
        r.documents.some((d) => d.source.sha256 === command.document!.source.sha256)
      )
    )
      fail("Documento já vinculado. Abra o registro existente.");
    record = {
      id: command.recordId,
      companyId: command.companyId,
      companyName,
      cnpj: command.cnpj,
      name: command.name,
      owner: command.owner,
      active: true,
      financeContractId: "",
      formalizedAt: null,
      documents: command.document ? [command.document] : [],
      revisions: [
        {
          terms: command.terms,
          effectiveOn: command.effectiveOn,
          evidence: command.evidence,
          actor,
          at: now,
          sourceHash: command.document?.source.sha256 || "",
        },
      ],
      commercial: makeCards(["budget", "proposal", "contract"]),
      cycles: [
        {
          id: command.recordId + "_initial",
          service: command.name,
          period: command.effectiveOn,
          revision: 0,
          contractedCents: command.terms.valueCents,
          cards: makeCards(["mobilize", "produce", "deliver", "measure", "invoice", "receive"]),
          advanceEvidence: "",
          measuredCents: 0,
          invoicedCents: 0,
          receivedCents: 0,
          adjustmentCents: 0,
          measurementEvidence: "",
          invoiceReference: "",
          invoiceEvidence: "",
          receiptEvidence: "",
          adjustmentEvidence: "",
          financeTitleId: "",
        },
      ],
      createdAt: now,
    };
    next.records.push(record);
  } else {
    if (!record) fail("Registro não encontrado.");
    if (!record.active && command.action !== "active")
      fail("Reative o contrato com justificativa antes de alterar.");
    if (command.action === "revise") {
      if (
        record.formalizedAt ||
        record.commercial.some(complete) ||
        record.cycles.length !== 1 ||
        record.cycles.some(
          (c) => c.cards.some(complete) || c.measuredCents > 0 || c.invoicedCents > 0
        )
      )
        fail(
          "Revisão inicial exige um único ciclo sem execução/medição e cards comerciais reabertos. Após formalização use aditivo."
        );
      record.revisions.push({
        terms: command.terms,
        effectiveOn: command.effectiveOn,
        evidence: command.evidence,
        actor,
        at: now,
        sourceHash: "",
      });
      record.cycles[0].revision = record.revisions.length - 1;
      record.cycles[0].contractedCents = command.terms.valueCents;
    }
    if (command.action === "document" || command.action === "amend") {
      if (record.documents.some((d) => d.source.sha256 === command.document.source.sha256))
        fail("Documento já anexado.");
      if (command.action === "document" && command.document.kind === "aditivo")
        fail("Use a aprovação de aditivo para registrar seus efeitos.");
      if (command.action === "amend") {
        if (!record.formalizedAt)
          fail(
            "Formalize o contrato antes de aprovar aditivo. Para corrigir o cadastro inicial, use revisão inicial."
          );
        if (command.document.kind !== "aditivo") fail("Selecione um documento do tipo aditivo.");
        if (command.effectiveOn < record.revisions.at(-1)!.effectiveOn)
          fail("Vigência anterior à última revisão. Trate ajustes históricos separadamente.");
        record.revisions.push({
          terms: command.terms,
          effectiveOn: command.effectiveOn,
          evidence: command.evidence,
          actor,
          at: now,
          sourceHash: command.document.source.sha256,
        });
      }
      record.documents.push(command.document);
    }
    if (command.action === "cycle") {
      if (
        record.cycles.some(
          (c) =>
            c.id === command.cycleId ||
            (c.service.toLowerCase() === command.service.toLowerCase() &&
              c.period.toLowerCase() === command.period.toLowerCase())
        )
      )
        fail("Este serviço já possui ciclo nesta competência/ordem.");
      if (!record.revisions[command.revision]) fail("Versão contratual inexistente.");
      if (command.advanceEvidence && command.advanceEvidence.trim().length < 3)
        fail("Informe a cláusula e autorização da antecipação.");
      record.cycles.push({
        id: command.cycleId,
        service: command.service,
        period: command.period,
        revision: command.revision,
        contractedCents: command.contractedCents,
        cards: makeCards(["mobilize", "produce", "deliver", "measure", "invoice", "receive"]),
        advanceEvidence: command.advanceEvidence,
        measuredCents: 0,
        invoicedCents: 0,
        receivedCents: 0,
        adjustmentCents: 0,
        measurementEvidence: "",
        invoiceReference: "",
        invoiceEvidence: "",
        receiptEvidence: "",
        adjustmentEvidence: "",
        financeTitleId: "",
      });
    }
    if (command.action === "card") {
      const cycle = record.cycles.find((c) => c.id === command.cycleId);
      const cards = command.cycleId ? cycle?.cards : record.commercial;
      const index = cards?.findIndex((c) => c.id === command.card.id) ?? -1;
      if (!cards || index < 0) fail("Card não pertence a este ciclo.");
      const card = command.card;
      if (complete(card)) {
        if (!card.owner.trim() || card.evidence.trim().length < 3)
          fail("Conclusão exige responsável e evidência/justificativa.");
        if (card.status === "done" && !card.checks.every(Boolean))
          fail("Conclua o checklist antes de finalizar.");
        if (card.status === "na" && !["budget", "proposal"].includes(card.id))
          fail("Somente etapas anteriores de contrato existente admitem não aplicável.");
        if (
          index > 0 &&
          !complete(cards[index - 1]) &&
          !(card.id === "measure" && cycle?.advanceEvidence)
        )
          fail("Conclua a etapa anterior ou registre a antecipação contratual.");
        if (card.id === "contract") {
          const terms = record.revisions.at(-1)!.terms;
          if (
            !record.documents.some((d) => d.kind === "contrato") ||
            !terms.startsOn ||
            terms.valueCents === null ||
            !terms.paymentTerms.trim() ||
            !terms.deliverables.trim() ||
            !terms.units.trim()
          )
            fail(
              "Anexe o contrato e complete vigência inicial, valor, pagamento, unidades e entregáveis antes de liberar início."
            );
        }
        if (cycle && !record.commercial.every(complete))
          fail("Formalize o contrato antes de liberar a execução ou o faturamento.");
        if (
          cycle &&
          card.id === "measure" &&
          (cycle.measuredCents <= 0 || cycle.measurementEvidence.trim().length < 3)
        )
          fail("Registre medição positiva e sua aprovação.");
        if (
          cycle &&
          card.id === "invoice" &&
          (!cycle.invoiceReference ||
            cycle.invoicedCents !== cycle.measuredCents ||
            cycle.invoiceEvidence.trim().length < 3)
        )
          fail("Registre NF válida, evidência e valor correspondente à medição.");
        if (
          cycle &&
          card.id === "receive" &&
          (cycle.receivedCents + cycle.adjustmentCents !== cycle.invoicedCents ||
            !cycle.cards.slice(0, 3).every(complete) ||
            (cycle.receivedCents > 0 && cycle.receiptEvidence.trim().length < 3))
        )
          fail("Resolva a entrega e o saldo financeiro antes de encerrar o ciclo.");
      }
      if (card.status === "blocked" && !card.blocker.trim()) fail("Descreva o bloqueio.");
      if (!complete(card) && complete(cards[index])) {
        if (
          cards.slice(index + 1).some(complete) ||
          (!cycle && record.cycles.some((c) => c.cards.some(complete)))
        )
          fail("Reabra primeiro as etapas dependentes, preservando a justificativa.");
      }
      cards[index] = card;
      if (card.id === "contract" && card.status === "done" && !record.formalizedAt)
        record.formalizedAt = now;
    }
    if (command.action === "billing") {
      const cycle =
        record.cycles.find((c) => c.id === command.cycleId) || fail("Ciclo não encontrado.");
      const d = command.data;
      const lockedFields = [
        ["measuredCents", "measurementEvidence"],
        ["invoicedCents", "invoiceReference", "invoiceEvidence", "financeTitleId"],
        ["receivedCents", "receiptEvidence", "adjustmentCents", "adjustmentEvidence"],
      ] as const;
      lockedFields.forEach((keys, i) => {
        if (complete(cycle.cards[i + 3]) && keys.some((k) => d[k] !== cycle[k]))
          fail("Reabra o card correspondente e suas etapas dependentes antes de corrigir valores.");
      });
      if (d.measuredCents > 0 && d.measurementEvidence.trim().length < 3)
        fail("Informe a evidência da medição.");
      if (d.invoicedCents > 0 && (!d.invoiceReference || d.invoiceEvidence.trim().length < 3))
        fail("Informe referência e evidência da NF válida.");
      if (d.receivedCents > 0 && d.receiptEvidence.trim().length < 3)
        fail("Informe evidência de conciliação do recebimento.");
      if (d.adjustmentCents > 0 && d.adjustmentEvidence.trim().length < 3)
        fail("Informe aprovação das retenções/descontos.");
      if (
        d.invoicedCents > d.measuredCents ||
        d.receivedCents + d.adjustmentCents > d.invoicedCents
      )
        fail("Valores excedem medição ou faturamento. Confira a conciliação.");
      if (
        d.invoiceReference &&
        next.records.some((r) =>
          r.cycles.some(
            (c) =>
              !(r.id === record!.id && c.id === cycle.id) &&
              c.invoiceReference === d.invoiceReference
          )
        )
      )
        fail("NF já registrada em outro ciclo deste contrato.");
      Object.assign(cycle, d);
    }
    if (command.action === "linkFinance") record.financeContractId = command.financeContractId;
    if (command.action === "active") {
      if (!command.active && record.cycles.some((c) => !c.cards.every(complete)))
        fail("Existem ciclos pendentes. Resolva-os antes de encerrar o contrato.");
      record.active = command.active;
    }
  }
  next.version++;
  next.audit.push({
    requestId: command.requestId,
    hash,
    recordId: command.recordId,
    action: command.action,
    actor,
    at: now,
    reason:
      "reason" in command
        ? command.reason
        : "evidence" in command
          ? command.evidence
          : "Novo ciclo",
    details: JSON.stringify(command),
  });
  return BookSchema.parse(next);
}
export function progress(record: ProductionRecord) {
  const cards = [...record.commercial, ...record.cycles.flatMap((c) => c.cards)];
  return { completed: cards.filter(complete).length, total: cards.length };
}
export function totals(record: ProductionRecord) {
  return record.cycles.reduce(
    (sum, c) => ({
      contracted: sum.contracted + (c.contractedCents || 0),
      measured: sum.measured + c.measuredCents,
      invoiced: sum.invoiced + c.invoicedCents,
      received: sum.received + c.receivedCents,
    }),
    { contracted: 0, measured: 0, invoiced: 0, received: 0 }
  );
}
export const instructionFor = (id: CardId) => instructions.find((i) => i.id === id)!;
