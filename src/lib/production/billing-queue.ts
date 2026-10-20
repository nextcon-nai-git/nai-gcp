import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import { flowReady } from "@/lib/financial/contract-flow";
import type { FinanceBook, FinanceTitle } from "@/lib/financial/operations";
import type { ProductionBook, ProductionCard, ProductionRecord } from "./model";
import type { ProductionTask } from "./obligations";

export const billingStatusNames = {
  measurement: "Aguardando medição",
  invoice: "Medição com saldo a conferir",
  advance: "Antecipação documentada",
  review: "Revisão necessária",
} as const;
export type BillingQueueStatus = keyof typeof billingStatusNames;
type BillingTitle = Pick<FinanceTitle, "id" | "status" | "competence" | "amountCents" | "source">;
export type BillingQueueItem = {
  key: string;
  recordId: string;
  cycleId: string;
  company: string;
  cnpj: string;
  contract: string;
  service: string;
  period: string;
  competence: string | null;
  revision: number;
  owner: string;
  due: string;
  origin: "delivery" | "advance" | "measurement";
  status: BillingQueueStatus;
  issues: string[];
  nextAction: string;
  delivered: boolean;
  recurring: boolean;
  obligations: { total: number; completed: number; waived: number };
  measuredCents: number;
  invoicedCents: number;
  balanceCents: number | null;
  measurementApproved: boolean;
  financeTitleId: string;
  linkedTitle: BillingTitle | null;
  candidateCount: number;
  candidates: BillingTitle[];
};
export type BillingQueueSummary = {
  cycles: number;
  delivered: number;
  awaitingMeasurement: number;
  advances: number;
  needsReview: number;
  measuredBalanceCents: number;
};
export type BillingQueueSnapshot = {
  centralVersion: number;
  financeVersion: number;
  generatedAt: string;
  items: BillingQueueItem[];
  summary: BillingQueueSummary;
};

/** Only unambiguous month values can be compared to ERP competencies. A free-form
 * cycle period (for example "Inicial") is never replaced by today's month.
 */
export function billingCompetence(period: string): string | null {
  const value = period.trim();
  if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)) return value;
  const br = /^(0[1-9]|1[0-2])\/(20\d{2}|2100)$/.exec(value);
  return br ? `${br[2]}-${br[1]}` : null;
}

const evidence = (value: string) => value.trim().length >= 3;
const done = (card: ProductionCard | undefined) =>
  Boolean(
    card &&
    card.status === "done" &&
    card.owner.trim() &&
    evidence(card.evidence) &&
    card.checks.every(Boolean)
  );
const taskDone = (task: ProductionTask) =>
  Boolean(
    task.owner.trim() &&
    evidence(task.evidence) &&
    (task.status === "done"
      ? task.due && task.checks.every(Boolean)
      : task.status === "na" && task.obligation.trigger.trim())
  );
const commercialDone = (record: ProductionRecord) =>
  Boolean(
    record.formalizedAt &&
    record.commercial.every(
      (card) =>
        done(card) ||
        (["budget", "proposal"].includes(card.id) &&
          card.status === "na" &&
          card.owner.trim() &&
          evidence(card.evidence))
    )
  );
const titleKey = (contractId: string, competence: string) => `${contractId}:${competence}`;
const titleSummary = ({
  id,
  status,
  competence,
  amountCents,
  source,
}: FinanceTitle): BillingTitle => ({
  id,
  status,
  competence,
  amountCents,
  source,
});

/** Derived handoff only. It never creates titles, recognizes revenue, or equates
 * an obligation with an independently chargeable service. Central cycles and ERP
 * services have no one-to-one link, so their balances must not be added together.
 */
export function billingQueue(central: ProductionBook, finance: FinanceBook): BillingQueueItem[] {
  const contracts = new Map(finance.contracts.map((contract) => [contract.id, contract]));
  const flows = new Map(finance.contractFlows.map((flow) => [flow.contractId, flow]));
  const closedPeriods = new Set(
    finance.periods.filter((period) => period.closed).map((period) => period.month)
  );
  const titles = new Map(finance.titles.map((title) => [title.id, title]));
  const byCompetence = new Map<string, FinanceTitle[]>();
  for (const title of finance.titles) {
    if (!title.contractId || title.kind !== "receivable" || title.status === "cancelled") continue;
    const key = titleKey(title.contractId, title.competence);
    const group = byCompetence.get(key) || [];
    group.push(title);
    byCompetence.set(key, group);
  }
  const titleUse = new Map<string, number>();
  const contractUse = new Map<string, number>();
  for (const record of central.records) {
    if (record.financeContractId)
      contractUse.set(
        record.financeContractId,
        (contractUse.get(record.financeContractId) || 0) + 1
      );
    for (const cycle of record.cycles)
      if (cycle.financeTitleId)
        titleUse.set(cycle.financeTitleId, (titleUse.get(cycle.financeTitleId) || 0) + 1);
  }

  const result: BillingQueueItem[] = [];
  for (const record of central.records) {
    if (!record.active) continue;
    for (const cycle of record.cycles) {
      const cards = new Map(cycle.cards.map((card) => [card.id, card]));
      const measure = cards.get("measure");
      const invoice = cards.get("invoice");
      const hasDelivery = cards.get("deliver")?.status === "done";
      const advance = evidence(cycle.advanceEvidence);
      if (!hasDelivery && !advance && cycle.measuredCents === 0 && cycle.invoicedCents === 0)
        continue;
      const competence = billingCompetence(cycle.period);
      const title = titles.get(cycle.financeTitleId);
      const titleIssues: string[] = [];
      if (cycle.financeTitleId) {
        if (
          !record.financeContractId ||
          !title ||
          title.contractId !== record.financeContractId ||
          title.kind !== "receivable" ||
          title.status !== "approved"
        )
          titleIssues.push(
            "Confira o título vinculado: deve estar aprovado e pertencer ao contrato financeiro."
          );
        else {
          if (title.amountCents !== cycle.invoicedCents)
            titleIssues.push("O valor faturado na Central diverge do título aprovado no ERP.");
          if (competence && title.competence !== competence)
            titleIssues.push("A competência do título vinculado diverge do período do ciclo.");
        }
        if ((titleUse.get(cycle.financeTitleId) || 0) > 1)
          titleIssues.push(
            "O mesmo título está vinculado a mais de um ciclo. Revise a associação."
          );
      }
      const terms = record.revisions[cycle.revision]?.terms;
      const tasksResolved = cycle.tasks.every(taskDone);
      const delivered =
        ["mobilize", "produce", "deliver"].every((id) =>
          done(cards.get(id as ProductionCard["id"]))
        ) && tasksResolved;
      const measurementApproved =
        done(measure) && cycle.measuredCents > 0 && evidence(cycle.measurementEvidence);
      const contract = contracts.get(record.financeContractId);
      const flow = flows.get(record.financeContractId);
      const contractMatches = Boolean(
        contract?.active &&
        flow &&
        isValidCnpj(record.cnpj) &&
        normalizeCnpj(flow.customerDocument) === normalizeCnpj(record.cnpj)
      );
      const recurring = Boolean(terms?.recurring || (contract?.monthlyCents || 0) > 0);
      const candidates =
        contractMatches && competence
          ? (byCompetence.get(titleKey(record.financeContractId, competence)) || []).filter(
              (candidate) => candidate.id !== cycle.financeTitleId
            )
          : [];
      const issues: string[] = [...titleIssues];
      if (!commercialDone(record))
        issues.push("Conclua a formalização e confira a autorização de início.");
      if (!terms) issues.push("A versão contratual deste ciclo não foi encontrada.");
      else if (!terms.paymentTerms.trim())
        issues.push("Registre as condições de pagamento da versão contratual.");
      if (!delivered && !advance)
        issues.push(
          "Confirme execução, obrigações, entrega e aceite ou a condição contratual para medir."
        );
      if (cycle.tasks.length && cycle.tasks.every((task) => task.status === "na"))
        issues.push(
          "Todas as obrigações foram dispensadas. Confira a condição contratual antes de cobrar."
        );
      if (!record.financeContractId)
        issues.push("Vincule ou confira o contrato no ERP antes de considerar uma nova cobrança.");
      else if (!contractMatches)
        issues.push("Confira o contrato financeiro ativo e o CNPJ correspondente no ERP.");
      if ((contractUse.get(record.financeContractId) || 0) > 1)
        issues.push("O contrato financeiro está ligado a mais de um registro da Central.");
      if (measure?.status === "blocked" || invoice?.status === "blocked")
        issues.push(
          (measure?.status === "blocked" ? measure : invoice)?.blocker.trim() ||
            "Resolva o bloqueio de faturamento registrado."
        );
      if (measure?.status === "done" && !measurementApproved)
        issues.push(
          "A medição marcada como concluída está sem valor positivo, checklist, responsável ou evidência."
        );
      if (cycle.invoicedCents > cycle.measuredCents)
        issues.push("O valor faturado excede a medição registrada. Revise os valores.");
      if (
        (cycle.invoicedCents > 0 &&
          (!cycle.invoiceReference.trim() || !evidence(cycle.invoiceEvidence))) ||
        (cycle.invoicedCents === 0 && (cycle.invoiceReference.trim() || invoice?.status === "done"))
      )
        issues.push("Confira valor, referência e evidência do faturamento já registrado.");
      const registeredInFull =
        cycle.measuredCents > 0 && cycle.invoicedCents === cycle.measuredCents;
      if (registeredInFull && (!done(invoice) || !measurementApproved))
        issues.push(
          "O valor integral está registrado, mas a medição e a etapa de faturamento ainda precisam ser conferidas e concluídas."
        );
      if (invoice?.status === "done" && (!registeredInFull || !done(invoice)))
        issues.push(
          "A etapa de faturamento concluída precisa de valor integral, responsável, checklist e evidência."
        );
      // Only a valid, completed invoice leaves this handoff. Reopened stages,
      // inconsistent links and missing approvals remain visible at zero balance.
      if (registeredInFull && done(invoice) && measurementApproved && !issues.length) continue;

      if (!competence)
        issues.push("Período sem competência mensal registrada; confira contrato e título no ERP.");
      if (competence && closedPeriods.has(competence))
        issues.push(
          "A competência está fechada no ERP. Confira o tratamento com a administração financeira."
        );
      if (contractMatches && flow) {
        if (flow.billingRequiresReadiness && !flowReady(flow))
          issues.push("O contrato exige concluir a implantação no ERP antes do faturamento.");
        if (competence && competence < flow.acceptedOn.slice(0, 7))
          issues.push("A competência antecede o aceite do contrato no ERP.");
        if (competence && flow.migration && competence < flow.migration.billingStartMonth)
          issues.push(
            "A competência antecede a entrada do contrato no fluxo financeiro integrado."
          );
        if (contract?.commercialTerms.paymentBasis !== "fixed_day")
          issues.push("Confira no ERP o prazo após a emissão ou a grade de pagamento contratada.");
      }
      if (recurring)
        issues.push(
          "Confira a cobertura da mensalidade. Uma obrigação entregue pode já estar incluída na cobrança recorrente."
        );
      if (candidates.length)
        issues.push(
          `${candidates.length} título(s) existente(s) no contrato e na competência. Confira o vínculo antes de cobrar novamente.`
        );

      const origin = delivered ? "delivery" : advance ? "advance" : "measurement";
      const status: BillingQueueStatus = issues.length
        ? "review"
        : !measurementApproved
          ? "measurement"
          : origin === "advance"
            ? "advance"
            : "invoice";
      const nextAction =
        status === "review"
          ? "Resolver as pendências no ciclo e conferir o ERP."
          : status === "measurement"
            ? "Conferir quantidades, preço, competência e aprovação da medição."
            : status === "advance"
              ? "Conferir a cláusula de antecipação e o registro financeiro antes da emissão."
              : "Conferir a medição e registrar NF e cobrança pelo fluxo existente.";
      const responsible = measurementApproved ? invoice : measure;
      result.push({
        key: `${record.id}:${cycle.id}`,
        recordId: record.id,
        cycleId: cycle.id,
        company: record.companyName,
        cnpj: record.cnpj,
        contract: record.name,
        service: cycle.service,
        period: cycle.period,
        competence,
        revision: cycle.revision,
        owner: responsible?.owner || "",
        due: responsible?.due || "",
        origin,
        status,
        issues,
        nextAction,
        delivered,
        recurring,
        obligations: {
          total: cycle.tasks.length,
          completed: cycle.tasks.filter((task) => task.status === "done" && taskDone(task)).length,
          waived: cycle.tasks.filter((task) => task.status === "na" && taskDone(task)).length,
        },
        measuredCents: cycle.measuredCents,
        invoicedCents: cycle.invoicedCents,
        balanceCents:
          cycle.measuredCents > 0 && cycle.measuredCents >= cycle.invoicedCents
            ? cycle.measuredCents - cycle.invoicedCents
            : null,
        measurementApproved,
        financeTitleId: cycle.financeTitleId,
        linkedTitle:
          contractMatches &&
          title?.contractId === record.financeContractId &&
          title.kind === "receivable"
            ? titleSummary(title)
            : null,
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 5).map(titleSummary),
      });
    }
  }
  const priority: Record<BillingQueueStatus, number> = {
    review: 0,
    invoice: 1,
    measurement: 2,
    advance: 3,
  };
  return result.sort(
    (a, b) =>
      priority[a.status] - priority[b.status] ||
      (a.due || "9999").localeCompare(b.due || "9999") ||
      a.key.localeCompare(b.key)
  );
}

export function billingQueueSummary(items: BillingQueueItem[]): BillingQueueSummary {
  const measuredBalanceCents = items
    .filter((item) => item.status === "invoice")
    .reduce((sum, item) => sum + (item.balanceCents || 0), 0);
  if (!Number.isSafeInteger(measuredBalanceCents))
    throw new Error("Billing summary exceeds safe integer range");
  return {
    cycles: items.length,
    delivered: items.filter((item) => item.delivered).length,
    awaitingMeasurement: items.filter((item) => !item.measurementApproved).length,
    advances: items.filter((item) => item.origin === "advance").length,
    needsReview: items.filter((item) => item.status === "review").length,
    measuredBalanceCents,
  };
}

export function searchBillingItem(item: BillingQueueItem, query: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const text = query.trim();
  if (!text) return true;
  return (
    normalize(
      `${item.company} ${item.cnpj} ${item.contract} ${item.service} ${item.period} ${item.owner}`
    ).includes(normalize(text)) ||
    (normalizeCnpj(text).length >= 8 && normalizeCnpj(item.cnpj).includes(normalizeCnpj(text)))
  );
}
