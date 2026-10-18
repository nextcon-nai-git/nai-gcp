import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  applyCommand,
  emptyBook,
  CommandSchema,
  type ProductionBook,
  type ProductionCard,
  progress,
} from "./model";
import { agentSystem, instructions, stages } from "./instructions";
const terms = {
  scope: "Serviço de teste",
  units: "Unidade A",
  deliverables: "Relatório revisado",
  valueCents: 10000,
  startsOn: "2026-10-01",
  endsOn: "",
  paymentTerms: "Mensal por medição",
  recurring: true,
  obligations: [],
};
const document = {
  name: "contrato.pdf",
  kind: "contrato" as const,
  source: {
    sha256: "a".repeat(64),
    storagePath: "internos_nextcon/contract-sources/" + "a".repeat(64),
    generation: "1",
    sizeBytes: 100,
  },
};
function create() {
  return CommandSchema.parse({
    action: "create",
    requestId: randomUUID(),
    expectedVersion: 0,
    recordId: "r1",
    companyId: "c1",
    cnpj: "11222333000181",
    name: "Serviço",
    owner: "Gestora",
    terms,
    document,
    effectiveOn: "2026-10-01",
    evidence: "Revisão do original",
    reviewed: true,
  });
}
function apply(book: ProductionBook, input: object) {
  const c = CommandSchema.parse({
    requestId: randomUUID(),
    expectedVersion: book.version,
    recordId: "r1",
    ...input,
  });
  return applyCommand(book, c, "admin", "2026-10-14T10:00:00Z", JSON.stringify(c), "Cliente");
}
function initial() {
  const c = create();
  return applyCommand(
    emptyBook(),
    c,
    "admin",
    "2026-10-14T10:00:00Z",
    JSON.stringify(c),
    "Cliente"
  );
}
function finish(book: ProductionBook, id: ProductionCard["id"], cycleId = "") {
  const r = book.records[0];
  const c = (cycleId ? r.cycles.find((c) => c.id === cycleId)!.cards : r.commercial).find(
    (c) => c.id === id
  )!;
  return apply(book, {
    action: "card",
    cycleId,
    card: {
      ...c,
      owner: "Pessoa responsável",
      status: "done",
      checks: [true, true, true, true],
      evidence: "Evidência revisada",
    },
    reason: "Conferência concluída",
  });
}
function signed() {
  let b = initial();
  for (const id of ["budget", "proposal", "contract"] as const) b = finish(b, id);
  return b;
}
const bill = {
  measuredCents: 10000,
  invoicedCents: 0,
  receivedCents: 0,
  adjustmentCents: 0,
  measurementEvidence: "Medição aprovada",
  invoiceReference: "",
  invoiceEvidence: "",
  receiptEvidence: "",
  adjustmentEvidence: "",
  financeTitleId: "",
};
describe("production lifecycle", () => {
  it("blocks additional cycles before formalization without blocking initial corrections", () => {
    const b = initial();
    expect(() =>
      apply(b, {
        action: "cycle",
        cycleId: "c2",
        service: "Novo serviço",
        period: "2026-11",
        revision: 0,
        contractedCents: 10000,
        advanceEvidence: "",
      })
    ).toThrow("Formalize");
    expect(
      apply(b, {
        action: "revise",
        terms,
        effectiveOn: "2026-10-01",
        evidence: "Dados corrigidos",
        reviewed: true,
      }).version
    ).toBe(2);
  });
  it("rejects attaching the same source to another existing record", () => {
    let b = initial();
    b = apply(b, {
      ...create(),
      requestId: randomUUID(),
      expectedVersion: b.version,
      recordId: "r2",
      document: null,
    });
    expect(() =>
      apply(b, { action: "document", recordId: "r2", document, evidence: "Nova vinculação" })
    ).toThrow("já anexado");
  });
  it("rejects zero-price contracts and cycles instead of creating unclosable free billing", () => {
    const c = create();
    expect(CommandSchema.safeParse({ ...c, terms: { ...terms, valueCents: 0 } }).success).toBe(
      false
    );
    expect(
      CommandSchema.safeParse({
        action: "cycle",
        recordId: "r1",
        requestId: randomUUID(),
        expectedVersion: 1,
        cycleId: "c2",
        service: "Gratuito",
        period: "2026-11",
        revision: 0,
        contractedCents: 0,
        advanceEvidence: "",
      }).success
    ).toBe(false);
  });
  it("returns a deterministic capacity error without modifying the stored book", () => {
    const b = initial();
    b.audit = Array.from({ length: 20000 }, (_, n) => ({
      ...b.audit[0],
      requestId: randomUUID(),
      hash: String(n),
    }));
    try {
      apply(b, { action: "active", active: false, reason: "Cancelado pelo cliente" });
      throw new Error("Expected capacity rejection");
    } catch (e) {
      expect(e).toMatchObject({ status: 413 });
    }
    expect(b.records[0].active).toBe(true);
    expect(b.version).toBe(1);
  });

  it("closes a rejected proposal without inventing completed service cards", () => {
    const b = apply(initial(), {
      action: "active",
      active: false,
      reason: "Proposta recusada pelo cliente",
    });
    expect(b.records[0].active).toBe(false);
    expect(progress(b.records[0]).completed).toBe(0);
    expect(b.audit.at(-1)?.reason).toContain("recusada");
  });
  it("replans only untouched cycles and removes superseded advance approval", () => {
    let b = signed();
    b.records[0].revisions.push({
      ...b.records[0].revisions[0],
      terms: { ...terms, valueCents: 20000 },
      effectiveOn: "2026-11-01",
    });
    b.records[0].cycles[0].advanceEvidence = "Sinal anterior";
    const next = apply(b, {
      action: "replan",
      cycleId: "r1_initial",
      revision: 1,
      contractedCents: 20000,
      reason: "Novo escopo aprovado para ciclo futuro",
      reviewed: true,
    });
    expect(next.records[0].cycles[0]).toMatchObject({
      revision: 1,
      contractedCents: 20000,
      advanceEvidence: "",
    });
    expect(b.records[0].cycles[0].revision).toBe(0);
    b = finish(b, "mobilize", "r1_initial");
    expect(() =>
      apply(b, {
        action: "replan",
        cycleId: "r1_initial",
        revision: 1,
        contractedCents: 20000,
        reason: "Tentativa sobre execução",
        reviewed: true,
      })
    ).toThrow("não iniciados");
  });

  it("creates exactly nine cards and leaves human confirmations pending", () => {
    const b = initial();
    expect(progress(b.records[0])).toEqual({ completed: 0, total: 9 });
    expect(b.records[0].cycles[0].revision).toBe(0);
  });
  it("rejects missing human review and invalid CNPJ", () => {
    const c = create();
    expect(CommandSchema.safeParse({ ...c, reviewed: false }).success).toBe(false);
    expect(CommandSchema.safeParse({ ...c, cnpj: "123" }).success).toBe(false);
  });
  it("replays an identical request and rejects request reuse or stale versions", () => {
    const c = create();
    const b = applyCommand(emptyBook(), c, "admin", "now", "hash", "Cliente");
    expect(applyCommand(b, c, "admin", "later", "hash")).toBe(b);
    expect(() => applyCommand(b, c, "other", "later", "hash")).toThrow("Identificador");
    expect(() => applyCommand(b, c, "admin", "later", "other")).toThrow("Identificador");
    expect(() =>
      applyCommand(b, { ...c, requestId: randomUUID() }, "admin", "later", "new")
    ).toThrow("Outra sessão");
  });
  it("blocks duplicate sources even on another record", () => {
    expect(() => apply(initial(), { ...create(), expectedVersion: 1, recordId: "r2" })).toThrow(
      "Documento já"
    );
  });
  it("requires predecessor, checklist, owner and evidence", () => {
    const b = initial();
    expect(() => finish(b, "proposal")).toThrow("anterior");
    const card = b.records[0].commercial[0];
    for (const patch of [{ owner: "" }, { evidence: "" }, { checks: [true, true, false, true] }])
      expect(() =>
        apply(b, {
          action: "card",
          cycleId: "",
          card: {
            ...card,
            owner: "Pessoa",
            evidence: "Conferido",
            checks: [true, true, true, true],
            status: "done",
            ...patch,
          },
          reason: "Teste",
        })
      ).toThrow();
  });
  it("allows justified non-applicable earlier commercial cards but never skips delivery", () => {
    let b = initial();
    for (const id of ["budget", "proposal"] as const) {
      const card = b.records[0].commercial.find((c) => c.id === id)!;
      b = apply(b, {
        action: "card",
        cycleId: "",
        card: { ...card, status: "na", owner: "Pessoa", evidence: "Contrato existente assinado" },
        reason: "Migração",
      });
    }
    b = finish(b, "contract");
    const c = b.records[0].cycles[0];
    expect(() =>
      apply(b, {
        action: "card",
        cycleId: c.id,
        card: { ...c.cards[0], status: "na", owner: "Pessoa", evidence: "Sem implantação" },
        reason: "Teste",
      })
    ).toThrow("Somente etapas");
  });
  it("blocks contract release with missing original or payment data", () => {
    const b = initial();
    b.records[0].documents = [];
    const p = finish(finish(b, "budget"), "proposal");
    expect(() => finish(p, "contract")).toThrow("Anexe");
    p.records[0].documents = [document];
    p.records[0].revisions[0].terms.paymentTerms = "";
    expect(() => finish(p, "contract")).toThrow("Anexe");
  });
  it("blocks operation before commercial release", () => {
    const b = initial();
    expect(() => finish(b, "mobilize", "r1_initial")).toThrow("Formalize");
  });
  it("preserves existing cycles and prices when an amendment is approved", () => {
    const b = signed();
    const amended = apply(b, {
      action: "amend",
      terms: { ...terms, valueCents: 20000 },
      effectiveOn: "2026-11-01",
      document: {
        ...document,
        kind: "aditivo",
        source: {
          ...document.source,
          sha256: "b".repeat(64),
          storagePath: "internos_nextcon/contract-sources/" + "b".repeat(64),
        },
      },
      reviewed: true,
      evidence: "Aditivo aprovado",
    });
    expect(amended.records[0].cycles).toEqual(b.records[0].cycles);
    expect(amended.records[0].revisions).toHaveLength(2);
    expect(b.records[0].revisions).toHaveLength(1);
    const next = apply(amended, {
      action: "cycle",
      cycleId: "nov",
      service: "Serviço",
      period: "2026-11",
      revision: 1,
      contractedCents: 20000,
      advanceEvidence: "",
    });
    expect(next.records[0].cycles[1].revision).toBe(1);
  });
  it("rejects duplicate cycle periods and invalid revision", () => {
    const b = signed();
    const c = {
      action: "cycle",
      cycleId: "other",
      service: "Serviço",
      period: "2026-10-01",
      revision: 0,
      contractedCents: 100,
      advanceEvidence: "",
    };
    expect(() => apply(b, c)).toThrow("já possui");
    expect(() => apply(b, { ...c, period: "2026-11", revision: 10 })).toThrow("inexistente");
  });
  it("requires documented advance to measure before delivery", () => {
    let b = signed();
    b = apply(b, { action: "billing", cycleId: "r1_initial", data: bill, reason: "Medição" });
    expect(() => finish(b, "measure", "r1_initial")).toThrow("anterior");
    b.records[0].cycles[0].advanceEvidence = "Cláusula 4, sinal aprovado";
    b = finish(b, "measure", "r1_initial");
    expect(b.records[0].cycles[0].cards[3].status).toBe("done");
  });
  it("allows invoices after measurement, receipts after invoice, and closes only the cycle", () => {
    let b = signed();
    for (const id of ["mobilize", "produce", "deliver"] as const) b = finish(b, id, "r1_initial");
    b = apply(b, { action: "billing", cycleId: "r1_initial", data: bill, reason: "Medição" });
    b = finish(b, "measure", "r1_initial");
    const invoice = {
      ...bill,
      invoicedCents: 10000,
      invoiceReference: "EMISSOR/1/123",
      invoiceEvidence: "NF autorizada e cobrança registrada",
    };
    b = apply(b, {
      action: "billing",
      cycleId: "r1_initial",
      data: invoice,
      reason: "Nota fiscal",
    });
    b = finish(b, "invoice", "r1_initial");
    expect(() => finish(b, "receive", "r1_initial")).toThrow("saldo");
    b = apply(b, {
      action: "billing",
      cycleId: "r1_initial",
      data: {
        ...invoice,
        receivedCents: 9000,
        adjustmentCents: 1000,
        receiptEvidence: "Extrato conciliado",
        adjustmentEvidence: "Retenção aprovada",
      },
      reason: "Recebimento",
    });
    b = finish(b, "receive", "r1_initial");
    expect(progress(b.records[0])).toEqual({ completed: 9, total: 9 });
    expect(b.records[0].active).toBe(true);
  });
  it("does not silently change an approved measurement or reopen predecessors", () => {
    let b = signed();
    b.records[0].cycles[0].advanceEvidence = "Sinal aprovado";
    b = apply(b, { action: "billing", cycleId: "r1_initial", data: bill, reason: "Medição" });
    b = finish(b, "measure", "r1_initial");
    expect(() =>
      apply(b, {
        action: "billing",
        cycleId: "r1_initial",
        data: { ...bill, measuredCents: 20000 },
        reason: "Correção",
      })
    ).toThrow("Reabra");
    expect(() =>
      apply(b, {
        action: "card",
        cycleId: "",
        card: { ...b.records[0].commercial[2], status: "doing" },
        reason: "Reabrir",
      })
    ).toThrow("dependentes");
  });
  it("rejects unsupported financial amounts and duplicate NF across contracts", () => {
    let b = initial();
    expect(() =>
      apply(b, {
        action: "billing",
        cycleId: "r1_initial",
        data: { ...bill, invoicedCents: 10001 },
        reason: "Teste",
      })
    ).toThrow();
    b = apply(b, {
      action: "billing",
      cycleId: "r1_initial",
      data: {
        ...bill,
        invoicedCents: 10000,
        invoiceReference: "NF-1",
        invoiceEvidence: "Autorizada",
      },
      reason: "Nota fiscal",
    });
    const c = {
      ...create(),
      requestId: randomUUID(),
      expectedVersion: b.version,
      recordId: "r2",
      document: null,
    };
    b = apply(b, c);
    expect(() =>
      apply(b, {
        action: "billing",
        recordId: "r2",
        cycleId: "r2_initial",
        data: {
          ...bill,
          invoicedCents: 10000,
          invoiceReference: "NF-1",
          invoiceEvidence: "Autorizada",
        },
        reason: "Duplicada",
      })
    ).toThrow("NF já");
  });
  it("preserves initial revisions and requires reopening before correcting terms", () => {
    let b = initial();
    b = apply(b, {
      action: "revise",
      terms: { ...terms, valueCents: 15000 },
      effectiveOn: "2026-10-01",
      evidence: "Valor corrigido",
      reviewed: true,
    });
    expect(b.records[0].revisions[0].terms.valueCents).toBe(10000);
    expect(b.records[0].cycles[0].contractedCents).toBe(15000);
    b = finish(b, "budget");
    expect(() =>
      apply(b, {
        action: "revise",
        terms,
        effectiveOn: "2026-10-01",
        evidence: "Correção",
        reviewed: true,
      })
    ).toThrow("Revisão inicial");
  });
  it("cannot close contract with pending cycles", () =>
    expect(() =>
      apply(signed(), { action: "active", active: false, reason: "Fim da vigência" })
    ).toThrow("ciclos pendentes"));
  it("provides nine complete instructions and three bounded advisory agents", () => {
    expect(instructions).toHaveLength(9);
    for (const s of stages) {
      expect(instructions.filter((i) => i.stage === s)).toHaveLength(3);
      expect(agentSystem(s)).toContain("não tem ferramentas");
      expect(agentSystem(s)).toContain("RASCUNHO NÃO ENVIADO");
    }
  });
});

const obligations = [
  {
    id: "pgr",
    title: "Elaborar PGR",
    serviceType: "PGR",
    owner: "Engenharia",
    due: "2026-10-30",
    deadlineRule: "Entrega em 30/10/2026",
    sourceReference: "Contrato, cláusula 4",
    sourceExcerpt: "Elaborar PGR e realizar exames ASO.",
  },
  {
    id: "aso",
    title: "Realizar ASOs",
    serviceType: "ASO",
    owner: "",
    due: "",
    deadlineRule: "Após solicitação do cliente",
    sourceReference: "Contrato, cláusula 4",
    sourceExcerpt: "Elaborar PGR e realizar exames ASO.",
  },
];
function withTasks() {
  const command = create();
  if (command.action !== "create") throw new Error("fixture");
  return apply(emptyBook(), { ...command, terms: { ...terms, obligations } });
}
function mobilizedTasks() {
  let b = withTasks();
  for (const id of ["budget", "proposal", "contract"] as const) b = finish(b, id);
  return finish(b, "mobilize", "r1_initial");
}
function changeTask(b: ProductionBook, taskId = "pgr", patch: object = {}) {
  return apply(b, {
    action: "task",
    cycleId: "r1_initial",
    taskId,
    data: {
      owner: "Responsável técnico",
      due: "2026-10-30",
      status: "done",
      checks: [true, true, true, true],
      evidence: "Documento revisado e assinado, referência de teste",
      blocker: "",
      ...patch,
    },
    reason: "Conferência da obrigação",
  });
}
describe("contract obligations through delivery and collection", () => {
  it("creates separate PGR and ASO tasks without multiplying contract value or guessing dates", () => {
    const b = withTasks(),
      cycle = b.records[0].cycles[0];
    expect(cycle.tasks).toHaveLength(2);
    expect(cycle.tasks[0].obligation).toEqual(obligations[0]);
    expect(cycle.tasks[0].due).toBe("2026-10-30");
    expect(cycle.tasks[1].due).toBe("");
    expect(cycle.tasks[1].owner).toBe("");
    expect(cycle.contractedCents).toBe(10000);
    expect(progress(b.records[0])).toEqual({ total: 11, completed: 0 });
  });
  it("requires contract release and mobilization before task execution", () => {
    expect(() => changeTask(withTasks(), "pgr", { status: "doing" })).toThrow("Formalize");
    expect(() => changeTask(withTasks())).toThrow("Formalize");
    expect(changeTask(mobilizedTasks()).records[0].cycles[0].tasks[0].status).toBe("done");
  });
  it.each([{ owner: " " }, { due: "" }, { checks: [true, false, true, true] }, { evidence: " " }])(
    "requires real scheduling and execution evidence: %j",
    (patch) => {
      expect(() => changeTask(mobilizedTasks(), "pgr", patch)).toThrow("Conclusão exige");
    }
  );
  it("keeps execution and delivery blocked until every contractual service is complete", () => {
    const b = changeTask(mobilizedTasks());
    expect(() => finish(b, "produce", "r1_initial")).toThrow("obrigações contratuais");
    const finished = changeTask(b, "aso");
    const delivered = finish(finish(finished, "produce", "r1_initial"), "deliver", "r1_initial");
    expect(delivered.records[0].cycles[0].cards[2].status).toBe("done");
    expect(() => changeTask(delivered, "pgr", { status: "todo" })).toThrow("Reabra primeiro");
    expect(() => apply(delivered, { action: "active", active: false, reason: "Encerrar" })).toThrow(
      "pendentes"
    );
  });
  it("blocks closing an advance-invoiced cycle while obligations remain open", () => {
    let b = mobilizedTasks();
    b.records[0].cycles[0].advanceEvidence = "Sinal aprovado em cláusula expressa";
    b = apply(b, {
      action: "billing",
      cycleId: "r1_initial",
      data: bill,
      reason: "Medição aprovada",
    });
    b = finish(b, "measure", "r1_initial");
    b = apply(b, {
      action: "billing",
      cycleId: "r1_initial",
      data: {
        ...bill,
        invoicedCents: 10000,
        receivedCents: 10000,
        invoiceReference: "NF-teste-1",
        invoiceEvidence: "Autorização fiscal",
        receiptEvidence: "Extrato conciliado",
      },
      reason: "Antecipação conciliada",
    });
    b = finish(b, "invoice", "r1_initial");
    expect(() => finish(b, "receive", "r1_initial")).toThrow("obrigações contratuais");
  });
  it("rejects forged task sources, invalid dates and tasks from another cycle", () => {
    expect(() => changeTask(mobilizedTasks(), "pgr", { obligation: obligations[1] })).toThrow();
    expect(() => changeTask(mobilizedTasks(), "pgr", { due: "2026-02-30" })).toThrow(
      "Data inválida"
    );
    expect(() => changeTask(mobilizedTasks(), "unknown")).toThrow("não pertence");
    expect(() => changeTask(mobilizedTasks(), "pgr", { status: "blocked", blocker: "" })).toThrow(
      "bloqueio"
    );
  });
  it("preserves task history against initial revision or replan", () => {
    const planned = changeTask(withTasks(), "pgr", {
      status: "todo",
      evidence: "",
      checks: [false, false, false, false],
    });
    expect(() =>
      apply(planned, {
        action: "revise",
        terms: { ...terms, obligations: [] },
        effectiveOn: "2026-10-01",
        evidence: "Revisar",
        reviewed: true,
      })
    ).toThrow("Revisão inicial");
    let b = mobilizedTasks();
    b = apply(b, {
      action: "amend",
      terms: { ...terms, obligations },
      effectiveOn: "2026-11-01",
      document: {
        ...document,
        kind: "aditivo",
        source: {
          ...document.source,
          sha256: "b".repeat(64),
          storagePath: "internos_nextcon/contract-sources/" + "b".repeat(64),
        },
      },
      evidence: "Aditivo revisado",
      reviewed: true,
    });
    expect(b.records[0].cycles[0].tasks[0].obligation).toEqual(obligations[0]);
    const input = {
      action: "cycle",
      cycleId: "nov",
      service: "Ciclo novembro",
      period: "2026-11",
      revision: 1,
      contractedCents: 10000,
      advanceEvidence: "",
      obligationIds: ["aso"],
    };
    const next = apply(b, input);
    expect(next.records[0].cycles[1].tasks.map((t) => t.obligation.id)).toEqual(["aso"]);
    expect(next.records[0].cycles[1].tasks[0].due).toBe("");
    expect(apply(b, { ...input, obligationIds: [] }).records[0].cycles[1].tasks).toEqual([]);
    expect(() => apply(b, { ...input, obligationIds: ["missing"] })).toThrow("obrigações válidas");
    expect(() => apply(b, { ...input, obligationIds: ["aso", "aso"] })).toThrow("sem repetição");
  });
  it("prevents reopening mobilization underneath completed work", () => {
    const b = changeTask(mobilizedTasks());
    const card = b.records[0].cycles[0].cards[0];
    expect(() =>
      apply(b, {
        action: "card",
        cycleId: "r1_initial",
        card: { ...card, status: "todo" },
        reason: "Replanejar",
      })
    ).toThrow("Reabra primeiro");
  });
  it("allows a full measured, delivered and reconciled cycle without closing recurrence", () => {
    let b = changeTask(changeTask(mobilizedTasks()), "aso");
    b = finish(finish(b, "produce", "r1_initial"), "deliver", "r1_initial");
    b = apply(b, {
      action: "billing",
      cycleId: "r1_initial",
      data: {
        ...bill,
        invoicedCents: 10000,
        receivedCents: 10000,
        invoiceReference: "NF-teste-2",
        invoiceEvidence: "Autorização fiscal conferida",
        receiptEvidence: "Extrato conciliado",
      },
      reason: "Valores conferidos",
    });
    for (const id of ["measure", "invoice", "receive"] as const) b = finish(b, id, "r1_initial");
    expect(progress(b.records[0])).toEqual({ completed: 11, total: 11 });
    expect(b.records[0].active).toBe(true);
  });
});
