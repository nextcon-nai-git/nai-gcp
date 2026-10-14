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
    const b = initial();
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
      apply(initial(), { action: "active", active: false, reason: "Fim da vigência" })
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
