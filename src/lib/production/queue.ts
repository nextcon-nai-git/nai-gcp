import type { ProductionRecord, ProductionCard } from "./model";
import { instructions, type Stage } from "./instructions";

export type WorkItem = {
  key: string;
  recordId: string;
  cycleId: string;
  company: string;
  cnpj: string;
  contract: string;
  cycle: string;
  title: string;
  stage: Stage;
  owner: string;
  due: string;
  status: ProductionCard["status"];
  blocker: string;
  overdue: boolean;
  dueToday: boolean;
  unplanned: boolean;
};
const complete = (status: ProductionCard["status"]) => status === "done" || status === "na";
export function workQueue(records: ProductionRecord[], today: string): WorkItem[] {
  const result: WorkItem[] = [];
  for (const record of records) {
    if (!record.active) continue;
    const add = (
      item: Pick<ProductionCard, "owner" | "due" | "status" | "blocker">,
      key: string,
      title: string,
      stage: Stage,
      cycleId = "",
      cycle = ""
    ) => {
      if (complete(item.status)) return;
      result.push({
        ...item,
        key: `${record.id}:${cycleId}:${key}`,
        recordId: record.id,
        cycleId,
        company: record.companyName,
        cnpj: record.cnpj,
        contract: record.name,
        cycle,
        title,
        stage,
        overdue: Boolean(item.due && item.due < today),
        dueToday: item.due === today,
        unplanned: !item.owner.trim() || !item.due,
      });
    };
    const addCard = (card: ProductionCard, cycleId = "", cycle = "") => {
      const instruction = instructions.find((i) => i.id === card.id)!;
      add(card, `card:${card.id}`, instruction.title, instruction.stage, cycleId, cycle);
    };
    record.commercial.forEach((card) => addCard(card));
    for (const cycle of record.cycles) {
      const name = `${cycle.service} · ${cycle.period}`;
      cycle.cards.forEach((card) => addCard(card, cycle.id, name));
      cycle.tasks.forEach((task) =>
        add(
          task,
          `task:${task.obligation.id}`,
          task.obligation.title,
          "operacional",
          cycle.id,
          name
        )
      );
    }
  }
  const priority = (item: WorkItem) =>
    item.status === "blocked" ? 0 : item.overdue ? 1 : item.dueToday ? 2 : item.unplanned ? 3 : 4;
  return result.sort(
    (a, b) => priority(a) - priority(b) || (a.due || "9999").localeCompare(b.due || "9999")
  );
}
const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchWorkItem(item: WorkItem, query: string) {
  const search = searchable(query.trim());
  if (!search) return true;
  const haystack = searchable(
    `${item.company} ${item.cnpj} ${item.contract} ${item.cycle} ${item.title} ${item.owner}`
  );
  return (
    haystack.includes(search) ||
    (query.replace(/\D/g, "").length >= 8 && item.cnpj.includes(query.replace(/\D/g, "")))
  );
}
export function queueStats(items: WorkItem[]) {
  return {
    open: items.length,
    overdue: items.filter((i) => i.overdue).length,
    blocked: items.filter((i) => i.status === "blocked").length,
    unplanned: items.filter((i) => i.unplanned).length,
  };
}
