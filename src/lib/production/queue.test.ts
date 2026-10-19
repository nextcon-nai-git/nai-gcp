import { describe, it, expect } from "vitest";
import { applyCommand, CommandSchema, emptyBook } from "./model";
import { workQueue, queueStats, searchWorkItem } from "./queue";
const fixture = () =>
  applyCommand(
    emptyBook(),
    CommandSchema.parse({
      action: "create",
      requestId: "8c7c5546-2ea6-4b18-ae48-bb566ba9bcdb",
      expectedVersion: 0,
      recordId: "r1",
      companyId: "c1",
      cnpj: "11222333000181",
      name: "Contrato técnico",
      owner: "Gestor",
      document: null,
      effectiveOn: "2026-10-01",
      evidence: "Revisão do contrato",
      reviewed: true,
      terms: {
        scope: "Saúde e segurança",
        units: "Matriz",
        deliverables: "PGR",
        valueCents: 10000,
        startsOn: "2026-10-01",
        endsOn: "",
        paymentTerms: "Mensal",
        recurring: true,
        obligations: [
          {
            id: "pgr",
            serviceType: "PGR",
            title: "Elaborar PGR",
            owner: "José",
            due: "2026-10-18",
            trigger: "",
            deadlineRule: "Conforme contrato",
            sourceReference: "Cláusula 4",
            sourceExcerpt: "Elaborar PGR",
          },
        ],
      },
    }),
    "admin",
    "2026-10-18T12:00:00Z",
    "hash",
    "Saúde Exemplo"
  ).records[0];
describe("contract priority queue", () => {
  it("finds a formatted alphanumeric CNPJ without dropping its letters", () => {
    const record = fixture();
    record.cnpj = "12ABC34501DE35";
    expect(searchWorkItem(workQueue([record], "2026-10-19")[0], "12.ABC.345/01DE-35")).toBe(true);
  });

  it("counts tasks and stages once without treating an absent deadline as overdue", () => {
    const record = fixture(),
      original = structuredClone(record);
    const queue = workQueue([record], "2026-10-19");
    expect(queueStats(queue)).toEqual({ open: 10, overdue: 1, blocked: 0, unplanned: 9 });
    expect(queue[0].title).toBe("Elaborar PGR");
    expect(queue[0].cycleId).toBe("r1_initial");
    expect(record).toEqual(original);
  });
  it("prioritizes explicit blockers and distinguishes due today from overdue", () => {
    const record = fixture();
    Object.assign(record.commercial[0], {
      status: "blocked",
      blocker: "Aguardar assinatura",
      due: "2026-10-30",
      owner: "Comercial",
    });
    const queue = workQueue([record], "2026-10-18");
    expect(queue[0]).toMatchObject({
      title: "1. Elaborar orçamento",
      blocker: "Aguardar assinatura",
      overdue: false,
    });
    expect(queue[1]).toMatchObject({ title: "Elaborar PGR", dueToday: true, overdue: false });
  });
  it("excludes completed, waived and closed work without hiding active cycles", () => {
    const record = fixture();
    record.commercial[0].status = "done";
    record.commercial[1].status = "na";
    record.cycles[0].tasks[0].status = "done";
    expect(workQueue([record], "2026-10-19")).toHaveLength(7);
    record.active = false;
    expect(workQueue([record], "2026-10-19")).toEqual([]);
  });
  it("preserves unique targets for recurring obligations across cycles and contracts", () => {
    const record = fixture();
    record.cycles.push({ ...structuredClone(record.cycles[0]), id: "c2", period: "2026-11" });
    const other = { ...structuredClone(record), id: "r2" };
    const queue = workQueue([record, other], "2026-10-18");
    expect(new Set(queue.map((i) => i.key)).size).toBe(queue.length);
    expect(queue.filter((i) => i.title === "Elaborar PGR")).toHaveLength(4);
  });
  it("finds a responsible person, accented name or formatted CNPJ", () => {
    const item = workQueue([fixture()], "2026-10-19")[0];
    for (const query of ["jose", "saude", "11.222.333/0001-81", "PGR", "   "])
      expect(searchWorkItem(item, query)).toBe(true);
    expect(searchWorkItem(item, "outra empresa")).toBe(false);
  });
});
