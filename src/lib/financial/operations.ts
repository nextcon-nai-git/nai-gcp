import { ContractFlowSchema, flowCommands, applyFlowCommand, flowReady } from "./contract-flow";
import { OmieExport } from "./omie-export";
import { z } from "zod";
import { isCalendarDate } from "./omie-dre";
import { ErpSchema, erpCommands, applyErpCommand } from "./erp";

const text = z.string().trim().min(1).max(180);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const date = z.string().refine(isCalendarDate, "Data inválida.");
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const cents = z.number().int().min(0).max(100_000_000_000);
const signed = z.number().int().min(-100_000_000_000).max(100_000_000_000);
const note = z.string().trim().min(3).max(1000);
const Account = z.object({ id, name: text });
const Contract = z.object({
  id,
  name: text,
  client: text,
  center: text,
  monthlyCents: cents,
  dueDay: z.number().int().min(1).max(28),
  active: z.boolean(),
});
const Service = z.object({
  id,
  contractId: id,
  date,
  description: text,
  supplier: text,
  city: text,
  quantity: z.number().int().positive().max(100000),
  unitRevenueCents: cents,
  unitCostCents: cents,
  evidence: note,
  titleId: id.nullable(),
  billingMode: z.enum(["separate", "included"]),
});
const Title = z.object({
  id,
  kind: z.enum(["receivable", "payable"]),
  party: text,
  description: text,
  amountCents: cents.refine((v) => v > 0),
  competence: month,
  dueDate: date,
  category: text,
  center: text,
  contractId: id.nullable(),
  sourceKey: text,
  source: z.enum(["manual", "recurring", "service", "order"]),
  externalReference: z.string().trim().max(180),
  evidence: note,
  status: z.enum(["draft", "submitted", "approved", "rejected", "cancelled"]),
  createdBy: text,
  approvedBy: text.nullable(),
});
const Settlement = z.object({
  id,
  titleId: id,
  accountId: id,
  date,
  principalCents: cents.refine((v) => v > 0),
  interestCents: cents,
  fineCents: cents,
  discountCents: cents,
  withholdingCents: cents,
  evidence: note,
  reversed: z.boolean(),
});
const BankRow = z.object({
  id,
  accountId: id,
  bankId: text,
  date,
  amountCents: signed.refine((v) => v !== 0),
  memo: text,
  settlementIds: z.array(id).max(100),
  transferPeer: id.nullable(),
});
const Statement = z.object({
  id,
  accountId: id,
  month,
  openingCents: signed,
  closingCents: signed,
  evidence: note,
});
const Budget = z.object({ id, month, center: text, amountCents: cents });
const Period = z.object({
  month,
  closed: z.boolean(),
  evidence: note,
  updatedBy: text,
  updatedAt: z.string(),
});
const Audit = z.object({
  id,
  hash: z.string(),
  action: text,
  actor: text,
  at: z.string(),
  reason: z.string(),
  version: z.number().int(),
  details: z.string().max(524288),
});
export const FinanceBookSchema = z.object({
  schemaVersion: z.literal(1),
  contractFlows: z.array(ContractFlowSchema).max(3000).default([]),
  omieExports: z.array(OmieExport).max(20000).default([]),
  erp: ErpSchema.default({}),
  version: z.number().int().nonnegative(),
  accounts: z.array(Account).max(100),
  contracts: z.array(Contract).max(3000),
  services: z.array(Service).max(20000),
  titles: z.array(Title).max(20000),
  settlements: z.array(Settlement).max(40000),
  bank: z.array(BankRow).max(40000),
  statements: z.array(Statement).max(3000),
  budgets: z.array(Budget).max(5000),
  periods: z.array(Period).max(1200),
  audit: z.array(Audit).max(100000),
});
export type FinanceBook = z.infer<typeof FinanceBookSchema>;
export type FinanceTitle = z.infer<typeof Title>;
export function emptyFinanceBook(): FinanceBook {
  return {
    schemaVersion: 1,
    contractFlows: [],
    omieExports: [],
    erp: ErpSchema.parse({}),
    version: 0,
    accounts: [],
    contracts: [],
    services: [],
    titles: [],
    settlements: [],
    bank: [],
    statements: [],
    budgets: [],
    periods: [],
    audit: [],
  };
}
const common = { requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative() };
export const FinanceCommandSchema = z.discriminatedUnion("action", [
  ...erpCommands,
  ...flowCommands,
  z
    .object({
      ...common,
      action: z.literal("editContract"),
      id,
      data: Contract.omit({ id: true }),
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("editTitle"),
      id,
      data: Title.pick({
        description: true,
        amountCents: true,
        competence: true,
        dueDate: true,
        category: true,
        center: true,
        contractId: true,
        evidence: true,
      }),
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("installments"),
      count: z.number().int().min(2).max(36),
      data: Title.omit({ id: true, source: true, status: true, createdBy: true, approvedBy: true }),
    })
    .strict(),

  z.object({ ...common, action: z.literal("account"), name: text }).strict(),
  z
    .object({ ...common, action: z.literal("contract"), data: Contract.omit({ id: true }) })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("contractStatus"),
      id,
      active: z.boolean(),
      reason: note,
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("service"),
      data: Service.omit({ id: true, titleId: true }),
    })
    .strict(),
  z.object({ ...common, action: z.literal("billService"), id, dueDate: date }).strict(),
  z.object({ ...common, action: z.literal("recurring"), contractId: id, month }).strict(),
  z
    .object({
      ...common,
      action: z.literal("title"),
      data: Title.omit({ id: true, source: true, status: true, createdBy: true, approvedBy: true }),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("review"),
      id,
      status: z.enum(["submitted", "approved", "rejected", "cancelled"]),
      reason: note,
    })
    .strict(),
  z
    .object({ ...common, action: z.literal("reference"), id, reference: text, reason: note })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("settle"),
      data: Settlement.omit({ id: true, reversed: true }),
    })
    .strict(),
  z.object({ ...common, action: z.literal("reverse"), id, reason: note }).strict(),
  z
    .object({
      ...common,
      action: z.literal("bank"),
      accountId: id,
      rows: z
        .array(BankRow.pick({ bankId: true, date: true, amountCents: true, memo: true }))
        .min(1)
        .max(1000),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("match"),
      id,
      settlementIds: z.array(id).min(1).max(100),
    })
    .strict(),
  z.object({ ...common, action: z.literal("unmatch"), id, reason: note }).strict(),
  z.object({ ...common, action: z.literal("transfer"), id, peerId: id, reason: note }).strict(),
  z
    .object({ ...common, action: z.literal("statement"), data: Statement.omit({ id: true }) })
    .strict(),
  z.object({ ...common, action: z.literal("budget"), data: Budget.omit({ id: true }) }).strict(),
  z
    .object({ ...common, action: z.literal("period"), month, close: z.boolean(), evidence: note })
    .strict(),
]);
export type FinanceCommand = z.infer<typeof FinanceCommandSchema>;
export class FinanceConflict extends Error {
  status = 409;
}
const fail = (message: string): never => {
  throw new FinanceConflict(message);
};
export function sumCents(values: number[]): number {
  const n = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(n)) fail("Total excede a precisão permitida.");
  return n;
}
export function settlementCash(s: FinanceBook["settlements"][number]) {
  return sumCents([
    s.principalCents,
    s.interestCents,
    s.fineCents,
    -s.discountCents,
    -s.withholdingCents,
  ]);
}
export function outstanding(book: FinanceBook, title: FinanceTitle) {
  return (
    title.amountCents -
    sumCents(
      book.settlements
        .filter((s) => s.titleId === title.id && !s.reversed)
        .map((s) => s.principalCents)
    )
  );
}
function unlocked(book: FinanceBook, period: string) {
  if (book.periods.some((p) => p.month === period && p.closed))
    fail(`O período ${period} está fechado. Reabra com justificativa antes de alterar.`);
}
function one<T extends { id: string }>(rows: T[], key: string): T {
  return rows.find((r) => r.id === key) || fail("Registro não encontrado. Atualize a consulta.");
}
function titleFor(book: FinanceBook, key: string) {
  const t = one(book.titles, key);
  unlocked(book, t.competence);
  return t;
}
function addTitle(book: FinanceBook, title: FinanceTitle) {
  unlocked(book, title.competence);
  if (book.titles.some((t) => t.sourceKey === title.sourceKey && t.status !== "cancelled"))
    fail("Esta origem já possui título. Confira o registro existente.");
  if (title.contractId) {
    one(book.contracts, title.contractId);
    if (
      title.kind === "receivable" &&
      title.source === "manual" &&
      book.contractFlows.some((f) => f.contractId === title.contractId)
    )
      fail("Use mensalidade ou serviço conferido para cobrar um contrato do fluxo integrado.");
  }
  book.titles.push(title);
}
export function closingIssues(book: FinanceBook, period: string): string[] {
  const issues: string[] = [];
  if (
    book.erp.orders.some(
      (o) => o.competence === period && !["converted", "cancelled"].includes(o.status)
    )
  )
    issues.push("Existem pedidos sem conversão financeira ou cancelamento.");
  if (
    book.titles.some(
      (t) => t.competence === period && ["draft", "submitted", "rejected"].includes(t.status)
    )
  )
    issues.push("Existem títulos sem aprovação ou cancelamento.");
  if (
    book.services.some(
      (s) => s.date.startsWith(period) && !s.titleId && s.billingMode === "separate"
    )
  )
    issues.push("Existem serviços realizados ainda não faturados.");
  const cash = book.settlements.filter((s) => !s.reversed && s.date.startsWith(period));
  const rows = book.bank.filter((b) => b.date.startsWith(period));
  if (cash.some((s) => !book.bank.some((b) => b.settlementIds.includes(s.id))))
    issues.push("Existem baixas sem conciliação bancária.");
  if (rows.some((b) => !b.settlementIds.length && !b.transferPeer))
    issues.push("Existem movimentos de extrato sem conciliação.");
  const activeAccounts = new Set(book.accounts.map((a) => a.id));
  if (!activeAccounts.size)
    issues.push("Importe extratos e confira os saldos antes de fechar o período.");
  for (const accountId of activeAccounts) {
    const statement = book.statements.find((s) => s.accountId === accountId && s.month === period);
    if (!statement) {
      issues.push(
        `Faltam saldos de abertura e encerramento: ${one(book.accounts, accountId).name}.`
      );
      continue;
    }
    const movement = sumCents(
      rows.filter((b) => b.accountId === accountId).map((b) => b.amountCents)
    );
    if (statement.openingCents + movement !== statement.closingCents)
      issues.push(`Saldo do extrato divergente: ${one(book.accounts, accountId).name}.`);
  }
  return issues;
}
/** Pure transition. The server authorizes before reading and commits via generation compare-and-swap. */
export function applyFinanceCommand(
  current: FinanceBook,
  command: FinanceCommand,
  actor: string,
  now: string,
  hash: string
): FinanceBook {
  const prior = current.audit.find((a) => a.id === command.requestId);
  if (prior) {
    if (prior.hash !== hash || prior.actor !== actor)
      fail("Chave de operação já utilizada para outro conteúdo.");
    return current;
  }
  if (command.expectedVersion !== current.version)
    fail("Os dados foram alterados em outra sessão. Atualize e revise antes de salvar.");
  const touchedTitle =
    command.action === "settle"
      ? command.data.titleId
      : command.action === "reverse"
        ? current.settlements.find((s) => s.id === command.id)?.titleId
        : ["editTitle", "review", "reference"].includes(command.action) && "id" in command
          ? command.id
          : undefined;
  if (touchedTitle && current.omieExports.some((e) => e.sourceId === touchedTitle))
    fail(
      "Título reservado ou enviado ao Omie. Alterações e baixas devem ser conferidas no Omie; o conector não sincroniza baixas automaticamente."
    );
  if (
    (command.action === "erpReviewOrder" ||
      command.action === "erpConvertOrder" ||
      command.action === "erpOrder") &&
    current.contractFlows.some((f) => f.orderId !== null && f.orderId === command.id)
  )
    fail("Pedido vinculado a contrato. Não pode ser alterado nem gerar cobrança paralela.");
  if (
    command.action === "editContract" &&
    current.contractFlows.some((f) => f.contractId === command.id)
  )
    fail(
      "Contrato do fluxo integrado. Alterações comerciais exigem aditivo; não edite o valor diretamente."
    );
  if (command.action === "editTitle") {
    const title = current.titles.find((t) => t.id === command.id);
    if (title?.contractId && current.contractFlows.some((f) => f.contractId === title.contractId))
      fail("Cobrança do fluxo integrado: cancele e revise a origem antes de gerar novamente.");
  }
  const contractId =
    command.action === "service"
      ? command.data.contractId
      : command.action === "recurring"
        ? command.contractId
        : command.action === "billService"
          ? current.services.find((s) => s.id === command.id)?.contractId
          : null;
  const flow = current.contractFlows.find((f) => f.contractId === contractId);
  if (flow) {
    if (!current.contracts.find((c) => c.id === contractId)?.active) fail("Contrato inativo.");
    const operationMonth =
      command.action === "recurring"
        ? command.month
        : command.action === "service"
          ? command.data.date.slice(0, 7)
          : command.action === "billService"
            ? current.services.find((s) => s.id === command.id)?.date.slice(0, 7)
            : undefined;
    if (flow.migration && operationMonth && operationMonth < flow.migration.billingStartMonth)
      fail(
        "Competência anterior à entrada no fluxo integrado. Preserve e confira o histórico anterior."
      );
    if (command.action === "service" && (!flowReady(flow) || command.data.date < flow.acceptedOn))
      fail("Conclua a implantação e confira a data de aceite antes de registrar a produção.");
    if (
      command.action === "recurring" &&
      (command.month < flow.acceptedOn.slice(0, 7) ||
        (flow.billingRequiresReadiness && !flowReady(flow)))
    )
      fail("Mensalidade bloqueada: confira aceite e implantação.");
    if (
      command.action === "billService" &&
      (!flowReady(flow) || !flow.serviceReviews.some((r) => r.serviceId === command.id))
    )
      fail("A cobrança avulsa exige implantação concluída e conferência independente do serviço.");
  }
  const book = structuredClone(current),
    key = command.requestId;
  switch (command.action) {
    case "enrollExistingContract":
    case "contractFromOrder":
    case "flowChecklist":
    case "flowReviewService":
      applyFlowCommand(book, command, actor, now, fail);
      break;
    case "erpParty":
    case "erpCategory":
    case "erpCenter":
    case "erpOrder":
    case "erpReviewOrder":
    case "erpConvertOrder":
    case "erpFollowUp":
      applyErpCommand(book, command, actor, { fail, unlocked, addTitle });
      break;
    case "account":
      if (book.accounts.some((a) => a.name.toLowerCase() === command.name.toLowerCase()))
        fail("Conta já cadastrada.");
      book.accounts.push({ id: key, name: command.name });
      break;
    case "contract":
      book.contracts.push({ ...command.data, id: key });
      break;
    case "contractStatus":
      one(book.contracts, command.id).active = command.active;
      break;
    case "service":
      unlocked(book, command.data.date.slice(0, 7));
      if (!one(book.contracts, command.data.contractId).active) fail("Contrato inativo.");
      sumCents([command.data.quantity * command.data.unitRevenueCents]);
      sumCents([command.data.quantity * command.data.unitCostCents]);
      book.services.push({ ...command.data, id: key, titleId: null });
      break;
    case "billService": {
      const s = one(book.services, command.id),
        c = one(book.contracts, s.contractId);
      if (s.billingMode === "included")
        fail("Serviço incluído na mensalidade não gera cobrança avulsa.");
      if (s.titleId) fail("Serviço já possui título de faturamento.");
      if (s.quantity * s.unitRevenueCents <= 0) fail("Informe receita positiva antes de faturar.");
      addTitle(book, {
        id: key,
        kind: "receivable",
        party: c.client,
        description: s.description,
        amountCents: s.quantity * s.unitRevenueCents,
        competence: s.date.slice(0, 7),
        dueDate: command.dueDate,
        category: "Serviços SST",
        center: c.center,
        contractId: c.id,
        sourceKey: `service:${s.id}`,
        source: "service",
        externalReference: "",
        evidence: s.evidence,
        status: "draft",
        createdBy: actor,
        approvedBy: null,
      });
      s.titleId = key;
      break;
    }
    case "recurring": {
      const c = one(book.contracts, command.contractId);
      if (!c.active || c.monthlyCents <= 0) fail("Contrato sem mensalidade ativa.");
      addTitle(book, {
        id: key,
        kind: "receivable",
        party: c.client,
        description: `${c.name} · ${command.month}`,
        amountCents: c.monthlyCents,
        competence: command.month,
        dueDate: `${command.month}-${String(c.dueDay).padStart(2, "0")}`,
        category: "Mensalidades SST",
        center: c.center,
        contractId: c.id,
        sourceKey: `recurring:${c.id}:${command.month}`,
        source: "recurring",
        externalReference: "",
        evidence: `Contrato ${c.name}; mensalidade cadastrada e sujeita a aprovação.`,
        status: "draft",
        createdBy: actor,
        approvedBy: null,
      });
      break;
    }
    case "title":
      addTitle(book, {
        ...command.data,
        id: key,
        source: "manual",
        status: "draft",
        createdBy: actor,
        approvedBy: null,
      });
      break;
    case "editContract": {
      Object.assign(one(book.contracts, command.id), command.data);
      break;
    }
    case "editTitle": {
      const t = titleFor(book, command.id);
      if (t.source === "order")
        fail("Título originado de pedido: cancele e registre um novo pedido corrigido.");
      if (!["draft", "rejected"].includes(t.status))
        fail("Somente rascunhos ou títulos devolvidos podem ser corrigidos.");
      unlocked(book, command.data.competence);
      if (command.data.contractId) one(book.contracts, command.data.contractId);
      Object.assign(t, command.data);
      break;
    }
    case "installments": {
      if (command.data.amountCents < command.count)
        fail("Valor insuficiente para distribuir as parcelas em centavos.");
      const [year, monthIndex, day] = command.data.dueDate.split("-").map(Number);
      for (let i = 0; i < command.count; i++) {
        const target = new Date(Date.UTC(year, monthIndex - 1 + i, 1));
        const last = new Date(
          Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
        ).getUTCDate();
        const dueDate = `${target.toISOString().slice(0, 7)}-${String(Math.min(day, last)).padStart(2, "0")}`;
        addTitle(book, {
          ...command.data,
          id: `${key}_${i}`,
          description: `${command.data.description} (${i + 1}/${command.count})`,
          amountCents:
            Math.floor(command.data.amountCents / command.count) +
            (i < command.data.amountCents % command.count ? 1 : 0),
          dueDate,
          sourceKey: `${command.data.sourceKey}/${i + 1}`,
          source: "manual",
          status: "draft",
          createdBy: actor,
          approvedBy: null,
        });
      }
      break;
    }
    case "review": {
      const t = titleFor(book, command.id);
      const allowed: Record<FinanceTitle["status"], string[]> = {
        draft: ["submitted", "cancelled"],
        submitted: ["approved", "rejected", "cancelled"],
        rejected: ["submitted", "cancelled"],
        approved: ["cancelled"],
        cancelled: [],
      };
      if (!allowed[t.status].includes(command.status)) fail("Transição de aprovação inválida.");
      if (["approved", "rejected"].includes(command.status) && t.createdBy === actor)
        fail("A revisão exige outro administrador financeiro, diferente do criador.");
      if (
        command.status === "cancelled" &&
        book.settlements.some((s) => s.titleId === t.id && !s.reversed)
      )
        fail("Estorne as baixas antes de cancelar o título.");
      if (command.status === "cancelled" && t.source === "order") {
        const order = book.erp.orders.find((o) => o.titleId === t.id);
        if (order) {
          unlocked(book, order.competence);
          order.status = "cancelled";
        }
      }
      if (command.status === "cancelled" && t.source === "service") {
        const service = book.services.find((s) => s.titleId === t.id);
        if (service) {
          unlocked(book, service.date.slice(0, 7));
          service.titleId = null;
        }
      }
      t.status = command.status;
      if (command.status === "approved") t.approvedBy = actor;
      break;
    }
    case "reference":
      titleFor(book, command.id).externalReference = command.reference;
      break;
    case "settle": {
      const t = one(book.titles, command.data.titleId);
      unlocked(book, command.data.date.slice(0, 7));
      one(book.accounts, command.data.accountId);
      if (t.status !== "approved") fail("A baixa exige título aprovado.");
      if (command.data.principalCents > outstanding(book, t))
        fail("A baixa excede o saldo residual do título.");
      const s = { ...command.data, id: key, reversed: false };
      if (s.discountCents + s.withholdingCents > s.principalCents || settlementCash(s) <= 0)
        fail("Descontos e retenções incompatíveis com a baixa.");
      book.settlements.push(s);
      break;
    }
    case "reverse": {
      const s = one(book.settlements, command.id);
      one(book.titles, s.titleId);
      unlocked(book, s.date.slice(0, 7));
      if (s.reversed) fail("Baixa já estornada.");
      if (book.bank.some((b) => b.settlementIds.includes(s.id)))
        fail("Desfaça a conciliação antes de estornar.");
      s.reversed = true;
      break;
    }
    case "bank": {
      one(book.accounts, command.accountId);
      for (const [index, r] of command.rows.entries()) {
        unlocked(book, r.date.slice(0, 7));
        const existing = book.bank.find(
          (b) => b.accountId === command.accountId && b.bankId === r.bankId
        );
        if (existing) {
          if (
            existing.date !== r.date ||
            existing.amountCents !== r.amountCents ||
            existing.memo !== r.memo
          )
            fail(`Identificador bancário conflitante: ${r.bankId}.`);
          continue;
        }
        book.bank.push({
          ...r,
          id: `${key}_${index}`,
          accountId: command.accountId,
          settlementIds: [],
          transferPeer: null,
        });
      }
      break;
    }
    case "match": {
      const b = one(book.bank, command.id);
      unlocked(book, b.date.slice(0, 7));
      if (b.settlementIds.length || b.transferPeer) fail("Movimento já conciliado.");
      if (new Set(command.settlementIds).size !== command.settlementIds.length)
        fail("Baixa repetida na conciliação.");
      const values = command.settlementIds.map((sid) => {
        const s = one(book.settlements, sid);
        const t = one(book.titles, s.titleId);
        unlocked(book, s.date.slice(0, 7));
        if (
          s.reversed ||
          s.accountId !== b.accountId ||
          s.date !== b.date ||
          book.bank.some((row) => row.settlementIds.includes(s.id))
        )
          fail("Baixa incompatível, estornada ou já conciliada. Confira conta e data efetiva.");
        return settlementCash(s) * (t.kind === "receivable" ? 1 : -1);
      });
      if (sumCents(values) !== b.amountCents)
        fail("O total das baixas difere do movimento bancário.");
      b.settlementIds = command.settlementIds;
      break;
    }
    case "unmatch": {
      const b = one(book.bank, command.id);
      unlocked(book, b.date.slice(0, 7));
      for (const sid of b.settlementIds)
        unlocked(book, one(book.settlements, sid).date.slice(0, 7));
      if (b.transferPeer) {
        const peer = one(book.bank, b.transferPeer);
        unlocked(book, peer.date.slice(0, 7));
        peer.transferPeer = null;
      }
      b.settlementIds = [];
      b.transferPeer = null;
      break;
    }
    case "transfer": {
      const b = one(book.bank, command.id),
        p = one(book.bank, command.peerId);
      unlocked(book, b.date.slice(0, 7));
      unlocked(book, p.date.slice(0, 7));
      if (
        b.accountId === p.accountId ||
        b.date !== p.date ||
        b.amountCents !== -p.amountCents ||
        b.settlementIds.length ||
        p.settlementIds.length ||
        b.transferPeer ||
        p.transferPeer
      )
        fail(
          "Transferência exige contas distintas, mesma data, valores opostos e movimentos livres."
        );
      b.transferPeer = p.id;
      p.transferPeer = b.id;
      break;
    }
    case "statement": {
      unlocked(book, command.data.month);
      one(book.accounts, command.data.accountId);
      const old = book.statements.find(
        (s) => s.accountId === command.data.accountId && s.month === command.data.month
      );
      if (old) Object.assign(old, command.data);
      else book.statements.push({ ...command.data, id: key });
      break;
    }
    case "budget": {
      unlocked(book, command.data.month);
      const old = book.budgets.find(
        (b) => b.month === command.data.month && b.center === command.data.center
      );
      if (old) Object.assign(old, command.data);
      else book.budgets.push({ ...command.data, id: key });
      break;
    }
    case "period": {
      const old = book.periods.find((p) => p.month === command.month);
      if (Boolean(old?.closed) === command.close) fail("O período já está neste estado.");
      if (command.close) {
        const issues = closingIssues(book, command.month);
        if (issues.length) fail(issues.join(" "));
      }
      const p = {
        month: command.month,
        closed: command.close,
        evidence: command.evidence,
        updatedBy: actor,
        updatedAt: now,
      };
      if (old) Object.assign(old, p);
      else book.periods.push(p);
      break;
    }
  }
  book.version++;
  book.audit.push({
    id: key,
    hash,
    actor,
    at: now,
    action: command.action,
    reason:
      "reason" in command
        ? command.reason
        : "evidence" in command
          ? command.evidence
          : "Registro confirmado",
    version: book.version,
    details: JSON.stringify(command),
  });
  return FinanceBookSchema.parse(book);
}

export function financeSummary(book: FinanceBook, period: string, today: string) {
  const approved = book.titles.filter((t) => t.status === "approved");
  const competence = approved.filter((t) => t.competence === period);
  const revenue = sumCents(
    competence.filter((t) => t.kind === "receivable").map((t) => t.amountCents)
  );
  const expense = sumCents(
    competence.filter((t) => t.kind === "payable").map((t) => t.amountCents)
  );
  const cash = book.settlements.filter((s) => !s.reversed && s.date.startsWith(period));
  const cashNet = sumCents(
    cash.map(
      (s) => settlementCash(s) * (one(book.titles, s.titleId).kind === "receivable" ? 1 : -1)
    )
  );
  const overdue = approved.filter((t) => t.dueDate < today && outstanding(book, t) > 0);
  return {
    revenue,
    expense,
    result: revenue - expense,
    cashNet,
    overdue,
    unbilled: book.services.filter(
      (s) => s.date.startsWith(period) && !s.titleId && s.billingMode === "separate"
    ),
    budgets: book.budgets
      .filter((b) => b.month === period)
      .map((b) => {
        const actual = sumCents(
          competence
            .filter((t) => t.kind === "payable" && t.center === b.center)
            .map((t) => t.amountCents)
        );
        return { ...b, actual, remaining: b.amountCents - actual };
      }),
    contracts: book.contracts.map((c) => {
      const revenue = sumCents(
        competence
          .filter((t) => t.contractId === c.id && t.kind === "receivable")
          .map((t) => t.amountCents)
      );
      const cost = sumCents(
        competence
          .filter((t) => t.contractId === c.id && t.kind === "payable")
          .map((t) => t.amountCents)
      );
      const operationalCost = sumCents(
        book.services
          .filter((s) => s.contractId === c.id && s.date.startsWith(period))
          .map((s) => s.quantity * s.unitCostCents)
      );
      return { ...c, revenue, cost, operationalCost, contribution: revenue - cost };
    }),
  };
}
export function financeCsv(book: FinanceBook) {
  const cell = (v: unknown) => {
    const t = String(v ?? "");
    return `"${(/^[\s]*[=+@-]/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      [
        "Título",
        "Tipo",
        "Parte",
        "Descrição",
        "Competência",
        "Vencimento",
        "Categoria",
        "Centro",
        "Contrato",
        "Valor (centavos)",
        "Saldo (centavos)",
        "Status",
        "Referência externa",
      ],
      ...book.titles.map((t) => [
        t.id,
        t.kind,
        t.party,
        t.description,
        t.competence,
        t.dueDate,
        t.category,
        t.center,
        t.contractId,
        t.amountCents,
        outstanding(book, t),
        t.status,
        t.externalReference,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
/** Strict BRL input: no floating point or ambiguous thousands separator. */
export function parseBrl(value: string): number {
  if (!/^-?\d+(,\d{1,2})?$/.test(value.trim()))
    throw new Error("Use valor em reais, sem ponto de milhar; exemplo: 1234,56.");
  const [whole, fraction = ""] = value.trim().replace("-", "").split(",");
  const n =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (value.trim().startsWith("-") ? -1 : 1);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 100_000_000_000)
    throw new Error("Valor fora do limite.");
  return n;
}
