import { z } from "zod";
import { isCalendarDate } from "./omie-dre";
import type { FinanceBook, FinanceTitle } from "./operations";
import { financialLabel } from "./labels";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const text = z.string().trim().min(1).max(180);
const note = z.string().trim().min(3).max(1000);
const date = z.string().refine(isCalendarDate, "Data inválida.");
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const cents = z.number().int().nonnegative().max(100_000_000_000);
const common = { requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative() };
export const PartySchema = z.object({
  id,
  name: text,
  document: z.string().trim().max(30),
  role: z.enum(["customer", "supplier", "both"]),
  email: z.union([z.literal(""), z.string().email().max(180)]),
  phone: z.string().trim().max(40),
  active: z.boolean(),
});
export const LedgerCategorySchema = z.object({
  id,
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9.-]{1,30}$/),
  name: text,
  kind: z.enum(["revenue", "expense"]),
  active: z.boolean(),
});
export const CostCenterSchema = z.object({ id, code: text, name: text, active: z.boolean() });
export const OrderInputSchema = z.object({
  kind: z.enum(["sale", "purchase"]),
  number: text,
  partyId: id,
  categoryId: id,
  centerId: id,
  competence: month,
  dueDate: date,
  items: z
    .array(
      z.object({
        description: text,
        quantity: z.number().int().positive().max(100000),
        unitCents: cents.refine((v) => v > 0),
      })
    )
    .min(1)
    .max(100),
  discountCents: cents,
  evidence: note,
});
const OrderSchema = OrderInputSchema.extend({
  id,
  partyName: text,
  categoryName: text,
  centerName: text,
  totalCents: cents.refine((v) => v > 0),
  status: z.enum(["draft", "submitted", "approved", "rejected", "converted", "cancelled"]),
  createdBy: text,
  approvedBy: text.nullable(),
  titleId: id.nullable(),
});
const FollowUpSchema = z.object({
  id,
  titleId: id,
  date,
  nextDate: date.nullable(),
  outcome: z.enum(["attempt", "contacted", "promise", "disputed", "resolved"]),
  note,
  actor: text,
});
export const ErpSchema = z.object({
  parties: z.array(PartySchema).max(20000).default([]),
  categories: z.array(LedgerCategorySchema).max(3000).default([]),
  centers: z.array(CostCenterSchema).max(3000).default([]),
  orders: z.array(OrderSchema).max(20000).default([]),
  followUps: z.array(FollowUpSchema).max(40000).default([]),
});
export const erpCommands = [
  z
    .object({
      ...common,
      action: z.literal("erpParty"),
      id: id.nullable(),
      data: PartySchema.omit({ id: true }),
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("erpCategory"),
      id: id.nullable(),
      data: LedgerCategorySchema.omit({ id: true }),
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("erpCenter"),
      id: id.nullable(),
      data: CostCenterSchema.omit({ id: true }),
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("erpOrder"),
      id: id.nullable(),
      data: OrderInputSchema,
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("erpReviewOrder"),
      id,
      status: z.enum(["submitted", "approved", "rejected", "cancelled"]),
      reason: note,
    })
    .strict(),
  z.object({ ...common, action: z.literal("erpConvertOrder"), id, reason: note }).strict(),
  z
    .object({
      ...common,
      action: z.literal("erpFollowUp"),
      data: FollowUpSchema.omit({ id: true, actor: true }),
    })
    .strict(),
] as const;
const CommandSchema = z.discriminatedUnion("action", [...erpCommands]);
type ErpCommand = z.infer<typeof CommandSchema>;
type Context = {
  fail: (message: string) => never;
  unlocked: (book: FinanceBook, month: string) => void;
  addTitle: (book: FinanceBook, title: FinanceTitle) => void;
};
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const documentKey = (s: string) => normalized(s).replace(/[^A-Z0-9]/g, "");
export function orderTotal(data: z.infer<typeof OrderInputSchema>): number {
  const total =
    data.items.reduce((sum, line) => sum + line.quantity * line.unitCents, 0) - data.discountCents;
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100_000_000_000)
    throw new Error("Total do pedido inválido. Confira itens, desconto e limite de valor.");
  return total;
}
export function applyErpCommand(
  book: FinanceBook,
  command: ErpCommand,
  actor: string,
  ctx: Context
) {
  const { fail, unlocked, addTitle } = ctx;
  const erp = book.erp;
  const find = <T extends { id: string }>(rows: T[], key: string): T =>
    rows.find((r) => r.id === key) || fail("Cadastro não encontrado.");
  const upsert = <T extends { id: string }>(rows: T[], key: string | null, data: Omit<T, "id">) => {
    if (key) Object.assign(find(rows, key), data);
    else rows.push({ ...data, id: command.requestId } as T);
  };
  switch (command.action) {
    case "erpParty": {
      const doc = documentKey(command.data.document);
      if (command.data.document && !doc) fail("Identificação inválida.");
      if (
        erp.parties.some(
          (p) =>
            p.id !== command.id &&
            (doc
              ? documentKey(p.document) === doc
              : !p.document && normalized(p.name) === normalized(command.data.name))
        )
      )
        fail("Cliente/fornecedor já cadastrado. Edite o cadastro existente.");
      upsert(erp.parties, command.id, command.data);
      break;
    }
    case "erpCategory":
      if (
        erp.categories.some(
          (c) => c.id !== command.id && normalized(c.code) === normalized(command.data.code)
        )
      )
        fail("Código de conta já cadastrado.");
      if (
        command.id &&
        find(erp.categories, command.id).kind !== command.data.kind &&
        erp.orders.some((o) => o.categoryId === command.id)
      )
        fail("Natureza já utilizada em pedido; crie outra conta.");
      upsert(erp.categories, command.id, command.data);
      break;
    case "erpCenter":
      if (
        erp.centers.some(
          (c) => c.id !== command.id && normalized(c.code) === normalized(command.data.code)
        )
      )
        fail("Código de centro já cadastrado.");
      upsert(erp.centers, command.id, command.data);
      break;
    case "erpOrder": {
      unlocked(book, command.data.competence);
      const old = command.id ? find(erp.orders, command.id) : null;
      if (old) {
        unlocked(book, old.competence);
        if (!["draft", "rejected"].includes(old.status))
          fail("Somente pedidos em rascunho ou devolvidos podem ser editados.");
        if (old.createdBy !== actor) fail("A correção deve ser feita pelo criador do pedido.");
      }
      if (
        erp.orders.some(
          (o) =>
            o.id !== command.id &&
            o.kind === command.data.kind &&
            normalized(o.number) === normalized(command.data.number)
        )
      )
        fail("Número de pedido já utilizado nesta carteira.");
      const p = find(erp.parties, command.data.partyId),
        c = find(erp.categories, command.data.categoryId),
        center = find(erp.centers, command.data.centerId);
      const sale = command.data.kind === "sale";
      if (!p.active || !c.active || !center.active) fail("Use cadastros ativos.");
      if (p.role !== "both" && p.role !== (sale ? "customer" : "supplier"))
        fail("Perfil do cliente/fornecedor incompatível com o pedido.");
      if (c.kind !== (sale ? "revenue" : "expense"))
        fail("Natureza da conta incompatível com o pedido.");
      let total: number;
      try {
        total = orderTotal(command.data);
      } catch {
        return fail("Total do pedido inválido. Confira itens e desconto.");
      }
      const order = {
        ...command.data,
        partyName: p.name,
        categoryName: financialLabel(`${c.code} · ${c.name}`),
        centerName: financialLabel(`${center.code} · ${center.name}`),
        totalCents: total,
        status: "draft" as const,
        createdBy: actor,
        approvedBy: null,
        titleId: null,
      };
      upsert(erp.orders, command.id, order);
      break;
    }
    case "erpReviewOrder": {
      const o = find(erp.orders, command.id);
      unlocked(book, o.competence);
      const allowed: Record<typeof o.status, string[]> = {
        draft: ["submitted", "cancelled"],
        submitted: ["approved", "rejected", "cancelled"],
        rejected: ["submitted", "cancelled"],
        approved: ["cancelled"],
        converted: [],
        cancelled: [],
      };
      if (!allowed[o.status].includes(command.status)) fail("Transição de pedido inválida.");
      if (["approved", "rejected"].includes(command.status) && o.createdBy === actor)
        fail("Aprovação exige outra pessoa, diferente do criador.");
      o.status = command.status;
      if (command.status === "approved") o.approvedBy = actor;
      break;
    }
    case "erpConvertOrder": {
      const o = find(erp.orders, command.id);
      unlocked(book, o.competence);
      if (o.status !== "approved" || o.titleId)
        fail("Somente pedido aprovado e ainda não convertido pode gerar título.");
      if (
        !find(erp.parties, o.partyId).active ||
        !find(erp.categories, o.categoryId).active ||
        !find(erp.centers, o.centerId).active
      )
        fail("Reative ou revise os cadastros antes de converter o pedido.");
      addTitle(book, {
        id: command.requestId,
        kind: o.kind === "sale" ? "receivable" : "payable",
        party: o.partyName,
        description: financialLabel(`${o.kind === "sale" ? "Venda" : "Compra"} · ${o.number}`),
        amountCents: o.totalCents,
        competence: o.competence,
        dueDate: o.dueDate,
        category: o.categoryName,
        center: o.centerName,
        contractId: null,
        sourceKey: `order:${o.id}`,
        source: "order",
        externalReference: "",
        evidence: o.evidence,
        status: "draft",
        createdBy: actor,
        approvedBy: null,
      });
      o.titleId = command.requestId;
      o.status = "converted";
      break;
    }
    case "erpFollowUp": {
      const t = find(book.titles, command.data.titleId);
      if (t.kind !== "receivable" || t.status !== "approved")
        fail("Acompanhamento exige título a receber aprovado.");
      if (command.data.nextDate && command.data.nextDate < command.data.date)
        fail("Próximo contato não pode anteceder o registro.");
      erp.followUps.push({ ...command.data, id: command.requestId, actor });
      break;
    }
  }
}
