import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { AuthContext } from "@/lib/auth/auth-context";
import {
  emptyFinanceBook,
  applyFinanceCommand,
  FinanceCommandSchema,
} from "@/lib/financial/operations";
import { checkCycleFinance } from "@/lib/production/finance";
import { progress, type ProductionCard } from "@/lib/production/model";
import { ContractCommercialTermsSchema } from "@/lib/financial/contract-flow";
const state = vi.hoisted(() => ({
  files: new Map<string, { bytes: Buffer; generation: string; metadata?: object }>(),
  calls: 0,
  writes: 0,
  sequence: 0,
  conflict: false,
  failRead: false,
  company: { active: true, cnpj: "11222333000181", name: "Cliente" } as Record<string, unknown>,
  finance: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: async () => ({ data: () => state.company }) }) }),
  },
}));
vi.mock("./financial-operations", () => ({ getFinanceBook: state.finance }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => {
      state.calls++;
      return {
        file: (name: string, pin?: { generation: string }) => ({
          getMetadata: async () => {
            const f = state.files.get(name);
            if (!f) throw { code: 404 };
            return [{ generation: f.generation, size: f.bytes.length, ...f.metadata }];
          },
          download: async () => {
            if (state.failRead) throw new Error("read unavailable");
            const f = state.files.get(name);
            if (!f || (pin && pin.generation !== f.generation)) throw { code: 404 };
            return [f.bytes];
          },
          save: async (
            json: string | Buffer,
            options: { preconditionOpts: { ifGenerationMatch: string | number }; metadata: object }
          ) => {
            const f = state.files.get(name);
            if (
              state.conflict ||
              String(options.preconditionOpts.ifGenerationMatch) !== (f?.generation || "0")
            )
              throw { code: 412 };
            if (name.endsWith(".json"))
              expect(options.metadata).toEqual({ cacheControl: "private, no-store" });
            state.writes++;
            state.files.set(name, {
              bytes: Buffer.from(json),
              generation: String(++state.sequence),
              metadata: options.metadata,
            });
          },
        }),
      };
    },
  }),
}));
import {
  getProductionBook,
  saveProductionCommand,
  readProductionSource,
  preserveProductionSource,
} from "./production-central";
const admin: AuthContext = {
  uid: "admin",
  email: "",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const command = () => ({
  action: "create",
  requestId: randomUUID(),
  expectedVersion: 0,
  recordId: "record1",
  companyId: "company1",
  cnpj: "11222333000181",
  name: "Serviço",
  owner: "Gestora",
  terms: {
    scope: "Serviço aprovado",
    units: "Unidade A",
    deliverables: "Relatório",
    valueCents: 10000,
    startsOn: "2026-10-01",
    endsOn: "",
    paymentTerms: "Mensal",
    recurring: true,
  },
  document: null,
  effectiveOn: "2026-10-01",
  evidence: "Conferência do cliente",
  reviewed: true,
});
beforeEach(() => {
  state.files.clear();
  state.calls = state.writes = state.sequence = 0;
  state.conflict = state.failRead = false;
  state.company = { active: true, cnpj: "11222333000181", name: "Cliente" };
  state.finance.mockReset().mockResolvedValue(emptyFinanceBook());
});
describe("private central persistence", () => {
  it("persists a reviewed schedule with server-calculated deadlines and replays it without duplicate cycles", async () => {
    const initial = command();
    const b = await saveProductionCommand(admin, {
      ...initial,
      terms: {
        ...initial.terms,
        obligations: [
          {
            id: "report",
            title: "Relatório periódico",
            serviceType: "OUTRO",
            owner: "Equipe técnica",
            due: "",
            trigger: "Ordem de serviço",
            deadlineRule: "Cinco dias corridos após a ordem de serviço",
            sourceReference: "Cláusula 3",
            sourceExcerpt: "Entregar relatório em cinco dias corridos após a ordem de serviço.",
          },
        ],
      },
    });
    const record = b.records[0];
    record.formalizedAt = "2026-10-01T12:00:00Z";
    for (const card of record.commercial) {
      Object.assign(card, {
        status: "done",
        owner: "Responsável",
        checks: [true, true, true, true],
        evidence: "Contrato conferido",
      });
    }
    const stored = state.files.get("financial-operations/v1/production-central.json")!;
    stored.bytes = Buffer.from(JSON.stringify(b));
    const schedule = {
      action: "scheduleCycles",
      requestId: randomUUID(),
      expectedVersion: b.version,
      recordId: record.id,
      seriesId: randomUUID(),
      plan: {
        revision: 0,
        service: "Rotina de SST",
        anchorLabel: "Ordem de serviço conferida",
        firstOn: "2027-01-31",
        frequency: "monthly",
        occurrences: 2,
        contractedCents: null,
        rules: [{ obligationId: "report", offsetDays: 5 }],
      },
      reason: "Programação sintética aprovada para teste",
      reviewed: true,
    };
    const result = await saveProductionCommand(admin, schedule);
    expect(result.version).toBe(b.version + 1);
    expect(result.records[0].cycles.slice(1).map((cycle) => cycle.tasks[0].due)).toEqual([
      "2027-02-05",
      "2027-03-05",
    ]);
    expect(result.records[0].cycles.slice(1).every((cycle) => cycle.contractedCents === null)).toBe(
      true
    );
    expect(result.records[0].cycles[0]).toEqual(record.cycles[0]);
    expect(await saveProductionCommand(admin, schedule)).toEqual(result);
    expect(state.writes).toBe(2);
    expect(state.finance).not.toHaveBeenCalled();
    await expect(
      saveProductionCommand(admin, {
        ...schedule,
        plan: { ...schedule.plan, firstOn: "2027-02-01" },
      })
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveProductionCommand({ ...admin, uid: "another-admin" }, schedule)
    ).rejects.toMatchObject({ status: 409 });
    expect(state.writes).toBe(2);
  });

  it("keeps the stored book intact when a reviewed recurring schedule loses its generation lease", async () => {
    const b = await saveProductionCommand(admin, command());
    const record = b.records[0];
    record.formalizedAt = "2026-10-01T12:00:00Z";
    record.revisions[0].terms.obligations.push({
      id: "report",
      title: "Relatório periódico",
      serviceType: "OUTRO",
      owner: "",
      due: "",
      trigger: "Ordem de serviço",
      deadlineRule: "Prazo a conferir",
      sourceReference: "Cláusula 3",
      sourceExcerpt: "Relatório recorrente mediante ordem de serviço.",
    });
    const stored = state.files.get("financial-operations/v1/production-central.json")!;
    stored.bytes = Buffer.from(JSON.stringify(b));
    const originalBytes = Buffer.from(stored.bytes);
    state.conflict = true;
    await expect(
      saveProductionCommand(admin, {
        action: "scheduleCycles",
        requestId: randomUUID(),
        expectedVersion: b.version,
        recordId: record.id,
        seriesId: randomUUID(),
        plan: {
          revision: 0,
          service: "Rotina de SST",
          anchorLabel: "Ordem de serviço conferida",
          firstOn: "2027-01-31",
          frequency: "monthly",
          occurrences: 2,
          contractedCents: null,
          rules: [{ obligationId: "report", offsetDays: null }],
        },
        reason: "Programação sintética aprovada para teste",
        reviewed: true,
      })
    ).rejects.toMatchObject({ status: 409 });
    expect(state.writes).toBe(1);
    expect(stored.bytes).toEqual(originalBytes);
    expect(state.finance).not.toHaveBeenCalled();
  });

  it("requires bank reconciliation, not just a recorded settlement, before closing a cycle", async () => {
    const b = await saveProductionCommand(admin, command());
    const record = b.records[0];
    record.financeContractId = "fin1";
    record.formalizedAt = "2026-10-01T12:00:00Z";
    const cycle = record.cycles[0];
    for (const card of [...record.commercial, ...cycle.cards.slice(0, 5)]) {
      Object.assign(card, {
        status: "done",
        owner: "Responsável",
        checks: [true, true, true, true],
        evidence: "Conferido",
      });
    }
    Object.assign(cycle, {
      financeTitleId: "title1",
      measuredCents: 10000,
      invoicedCents: 10000,
      receivedCents: 9000,
      adjustmentCents: 1000,
      measurementEvidence: "Medição aprovada",
      invoiceReference: "NF1",
      invoiceEvidence: "Autorização fiscal",
      receiptEvidence: "Baixa registrada",
      adjustmentEvidence: "Retenção aprovada",
    });
    state.files.get("financial-operations/v1/production-central.json")!.bytes = Buffer.from(
      JSON.stringify(b)
    );
    const finance = emptyFinanceBook();
    finance.accounts.push({ id: "account1", name: "Conta sintética" });
    finance.contracts.push({
      id: "fin1",
      name: "Contrato sintético",
      client: "Cliente sintético",
      center: "SST",
      monthlyCents: 10000,
      dueDay: 10,
      active: true,
      commercialTerms: ContractCommercialTermsSchema.parse({}),
    });
    finance.contractFlows.push({ contractId: "fin1", customerDocument: "11222333000181" } as never);
    finance.titles.push({
      id: "title1",
      contractId: "fin1",
      kind: "receivable",
      status: "approved",
      amountCents: 10000,
    } as never);
    finance.settlements.push({
      id: "s1",
      titleId: "title1",
      accountId: "account1",
      date: "2026-10-18",
      principalCents: 10000,
      discountCents: 0,
      withholdingCents: 1000,
      interestCents: 200,
      fineCents: 0,
      evidence: "Baixa",
      reversed: false,
    });
    state.finance.mockResolvedValue(finance);
    const close = {
      action: "card",
      recordId: "record1",
      requestId: randomUUID(),
      expectedVersion: b.version,
      cycleId: cycle.id,
      card: {
        ...cycle.cards[5],
        status: "done",
        owner: "Responsável",
        checks: [true, true, true, true],
        evidence: "Fechamento conferido",
      },
      reason: "Encerrar ciclo",
    };
    await expect(saveProductionCommand(admin, close)).rejects.toThrow("conciliação bancária");
    expect(state.writes).toBe(1);
    finance.bank.push({
      id: "bank1",
      accountId: "account1",
      bankId: "extrato1",
      date: "2026-10-18",
      amountCents: 9200,
      memo: "Recebimento",
      settlementIds: ["s1"],
      transferPeer: null,
    });
    finance.contracts[0].active = false;
    await expect(saveProductionCommand(admin, close)).rejects.toThrow("contrato financeiro ativo");
    finance.contracts[0].active = true;
    finance.contractFlows[0].customerDocument = "44337647000189";
    await expect(saveProductionCommand(admin, close)).rejects.toThrow("CNPJ correspondente");
    finance.contractFlows[0].customerDocument = "11222333000181";
    expect(state.writes).toBe(1);
    const closed = await saveProductionCommand(admin, close);
    expect(closed.records[0].cycles[0].cards[5].status).toBe("done");
    expect(closed.records[0].cycles[0].receivedCents).toBe(9000);
    // An ERP unmatch after cycle closure must also block closing the parent contract.
    finance.bank[0].settlementIds = [];
    await expect(
      saveProductionCommand(admin, {
        action: "active",
        active: false,
        recordId: "record1",
        requestId: randomUUID(),
        expectedVersion: closed.version,
        reason: "Encerrar contrato",
      })
    ).rejects.toThrow("conciliação bancária");
  });
  it.each(["OPERATIONS", "DOCTOR", "CLIENT_ADMIN", "PROVIDER", "GUEST"] as const)(
    "denies %s before any storage or AI work",
    async (role) => {
      await expect(getProductionBook({ ...admin, role })).rejects.toMatchObject({ status: 403 });
      await expect(saveProductionCommand({ ...admin, role }, command())).rejects.toMatchObject({
        status: 403,
      });
      await expect(readProductionSource({ ...admin, role }, {})).rejects.toMatchObject({
        status: 403,
      });
      expect(state.calls).toBe(0);
    }
  );
  it("denies tenant administrator", async () => {
    await expect(
      getProductionBook({ ...admin, role: "ADMIN", tenantId: "client" })
    ).rejects.toMatchObject({ status: 403 });
    expect(state.calls).toBe(0);
  });
  it("persists once and replays a confirmed command even after registry changes", async () => {
    const c = command();
    const b = await saveProductionCommand(admin, c);
    state.company.active = false;
    expect(await saveProductionCommand(admin, c)).toEqual(b);
    expect(state.writes).toBe(1);
    expect(b.records[0].companyName).toBe("Cliente");
  });
  it("rejects soft-deleted customers even when still active", async () => {
    state.company.isDeleted = true;
    await expect(saveProductionCommand(admin, command())).rejects.toMatchObject({ status: 400 });
    expect(state.writes).toBe(0);
  });
  it("rejects inactive or mismatched customer", async () => {
    state.company.active = false;
    await expect(saveProductionCommand(admin, command())).rejects.toMatchObject({ status: 400 });
    state.company.active = true;
    state.company.cnpj = "other";
    await expect(saveProductionCommand(admin, command())).rejects.toMatchObject({ status: 400 });
    expect(state.writes).toBe(0);
  });
  it("never overwrites concurrent updates or unreadable books", async () => {
    state.conflict = true;
    await expect(saveProductionCommand(admin, command())).rejects.toMatchObject({ status: 409 });
    expect(state.writes).toBe(0);
    state.conflict = false;
    await saveProductionCommand(admin, command());
    state.failRead = true;
    await expect(getProductionBook(admin)).rejects.toThrow("unavailable");
    expect(state.writes).toBe(1);
  });
  it("verifies immutable PDF bytes, hash, metadata and generation", async () => {
    const bytes = Buffer.from("%PDF-1.7 synthetic");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const source = {
      sha256: hash,
      storagePath: `internos_nextcon/contract-sources/${hash}`,
      generation: "1",
      sizeBytes: bytes.length,
    };
    state.files.set(source.storagePath, {
      bytes,
      generation: "1",
      metadata: { contentType: "application/pdf", metadata: { sourceSha256: hash } },
    });
    expect(await readProductionSource(admin, source)).toEqual(bytes);
    await expect(
      readProductionSource(admin, {
        ...source,
        storagePath: "financial-operations/v1/nextcon.json",
      })
    ).rejects.toMatchObject({ status: 400 });
    state.files.get(source.storagePath)!.bytes = Buffer.from("%PDF-1.7 corrupted");
    await expect(readProductionSource(admin, source)).rejects.toThrow("Integridade");
  });
  it("links only an active financial contract with matching CNPJ", async () => {
    const b = await saveProductionCommand(admin, command());
    const link = {
      action: "linkFinance",
      recordId: "record1",
      requestId: randomUUID(),
      expectedVersion: b.version,
      financeContractId: "fin1",
      reason: "Conferido",
    };
    await expect(saveProductionCommand(admin, link)).rejects.toMatchObject({ status: 400 });
    const finance = emptyFinanceBook();
    finance.accounts.push({ id: "account1", name: "Conta sintética" });
    finance.contracts.push({
      id: "fin1",
      name: "Contrato",
      client: "Cliente",
      center: "SST",
      monthlyCents: 10000,
      commercialTerms: ContractCommercialTermsSchema.parse({}),
      dueDay: 10,
      active: true,
    });
    finance.contractFlows.push({ contractId: "fin1", customerDocument: "11222333000181" } as never);
    state.finance.mockResolvedValue(finance);
    const linked = await saveProductionCommand(admin, link);
    expect(linked.records[0].financeContractId).toBe("fin1");
    expect(state.writes).toBe(2);
  });
  it("checks billing against the stored cycle competence before persisting a title link", async () => {
    const book = await saveProductionCommand(admin, command());
    const record = book.records[0];
    record.financeContractId = "fin1";
    const cycle = record.cycles[0];
    cycle.period = "2026-10";
    state.files.get("financial-operations/v1/production-central.json")!.bytes = Buffer.from(
      JSON.stringify(book)
    );
    const finance = emptyFinanceBook();
    finance.contracts.push({
      id: "fin1",
      name: "Contrato sintético",
      client: "Cliente sintético",
      center: "SST",
      monthlyCents: 10000,
      dueDay: 10,
      active: true,
      commercialTerms: ContractCommercialTermsSchema.parse({}),
    });
    finance.contractFlows.push({ contractId: "fin1", customerDocument: "11222333000181" } as never);
    finance.titles.push({
      id: "title1",
      contractId: "fin1",
      kind: "receivable",
      status: "approved",
      amountCents: 10000,
      competence: "2026-09",
    } as never);
    state.finance.mockResolvedValue(finance);
    const billing = {
      action: "billing",
      recordId: record.id,
      cycleId: cycle.id,
      requestId: randomUUID(),
      expectedVersion: book.version,
      data: {
        measuredCents: 10000,
        invoicedCents: 10000,
        receivedCents: 0,
        adjustmentCents: 0,
        measurementEvidence: "Medição aprovada",
        invoiceReference: "NF teste",
        invoiceEvidence: "Evidência fiscal",
        receiptEvidence: "",
        adjustmentEvidence: "",
        financeTitleId: "title1",
      },
      reason: "Conferência sintética de competência",
    };
    await expect(saveProductionCommand(admin, billing)).rejects.toThrow("competência");
    expect(state.writes).toBe(1);
    finance.titles[0].competence = "2026-10";
    const saved = await saveProductionCommand(admin, billing);
    expect(saved.records[0].cycles[0]).toMatchObject({
      period: "2026-10",
      financeTitleId: "title1",
    });
    expect(state.writes).toBe(2);
  });

  it("rejects ERP receipt mismatch and revalidates ERP at cycle closure", async () => {
    const b = await saveProductionCommand(admin, command());
    const stored = state.files.get("financial-operations/v1/production-central.json")!;
    b.records[0].financeContractId = "fin1";
    const cycle = b.records[0].cycles[0];
    Object.assign(cycle, {
      financeTitleId: "title1",
      measuredCents: 10000,
      invoicedCents: 10000,
      receivedCents: 10000,
      measurementEvidence: "Medição",
      invoiceReference: "NF1",
      invoiceEvidence: "NF válida",
      receiptEvidence: "Extrato",
    });
    stored.bytes = Buffer.from(JSON.stringify(b));
    const finance = emptyFinanceBook();
    finance.accounts.push({ id: "account1", name: "Conta sintética" });
    finance.contracts.push({
      id: "fin1",
      name: "Contrato sintético",
      client: "Cliente sintético",
      center: "SST",
      monthlyCents: 10000,
      dueDay: 10,
      active: true,
      commercialTerms: ContractCommercialTermsSchema.parse({}),
    });
    finance.contractFlows.push({ contractId: "fin1", customerDocument: "11222333000181" } as never);
    finance.titles.push({
      id: "title1",
      contractId: "fin1",
      kind: "receivable",
      status: "approved",
      amountCents: 10000,
    } as never);
    state.finance.mockResolvedValue(finance);
    await expect(
      saveProductionCommand(admin, {
        action: "card",
        recordId: "record1",
        requestId: randomUUID(),
        expectedVersion: b.version,
        cycleId: cycle.id,
        card: {
          ...cycle.cards[5],
          status: "done",
          owner: "Pessoa",
          checks: [true, true, true, true],
          evidence: "Fechamento",
        },
        reason: "Fechar",
      })
    ).rejects.toThrow("divergem");
    expect(state.writes).toBe(1);
  });
});

describe("immutable source upload", () => {
  it("uploads, verifies, and reuses an identical PDF without replacement", async () => {
    const bytes = Buffer.from("%PDF-1.7\noriginal");
    const source = await preserveProductionSource(admin, bytes);
    expect(source.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(await preserveProductionSource(admin, bytes)).toEqual(source);
    expect(state.writes).toBe(1);
    expect(await readProductionSource(admin, source)).toEqual(bytes);
  });
  it("rejects tenant admins before touching storage", async () => {
    await expect(
      preserveProductionSource(
        { ...admin, role: "ADMIN", tenantId: "client" },
        Buffer.from("%PDF-")
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(state.calls).toBe(0);
  });
  it("rejects non-PDF and oversized content", async () => {
    await expect(preserveProductionSource(admin, Buffer.from("not PDF"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      preserveProductionSource(admin, Buffer.alloc(10 * 1024 * 1024))
    ).rejects.toMatchObject({ status: 413 });
    expect(state.writes).toBe(0);
  });
  it("does not trust or overwrite a corrupt existing object", async () => {
    const bytes = Buffer.from("%PDF-1.7\noriginal");
    const source = await preserveProductionSource(admin, bytes);
    state.files.get(source.storagePath)!.bytes = Buffer.from("%PDF-1.7\nmodified");
    await expect(preserveProductionSource(admin, bytes)).rejects.toMatchObject({ status: 400 });
    expect(state.writes).toBe(1);
  });
  it("does not report success when verification fails", async () => {
    state.failRead = true;
    await expect(preserveProductionSource(admin, Buffer.from("%PDF-1.7"))).rejects.toThrow(
      "read unavailable"
    );
    state.failRead = false;
    await preserveProductionSource(admin, Buffer.from("%PDF-1.7"));
    expect(state.writes).toBe(1);
  });
});

/** All persistence stays in state.files; finance commands use the real domain model.
 * This is service/domain integration, not a browser or live-provider homologation. */
async function integratedContract() {
  let finance = emptyFinanceBook();
  const fin = (payload: object, actor = "finance-creator") => {
    const command = FinanceCommandSchema.parse({
      requestId: randomUUID(),
      expectedVersion: finance.version,
      ...payload,
    });
    finance = applyFinanceCommand(
      finance,
      command,
      actor,
      "2026-10-24T12:00:00Z",
      JSON.stringify(command)
    );
    return finance;
  };
  state.finance.mockImplementation(async () => structuredClone(finance));
  fin({
    action: "erpParty",
    id: null,
    data: {
      name: "Cliente sintético",
      document: "11222333000181",
      role: "customer",
      email: "",
      phone: "",
      active: true,
    },
    reason: "Cadastro de homologação",
  });
  fin({
    action: "erpCategory",
    id: null,
    data: { code: "1.01", name: "Mensalidade", kind: "revenue", active: true },
    reason: "Categoria sintética",
  });
  fin({
    action: "erpCenter",
    id: null,
    data: { code: "SST", name: "SST", active: true },
    reason: "Centro sintético",
  });
  fin({
    action: "erpOrder",
    id: null,
    data: {
      kind: "sale",
      number: "HOMOLOG-001",
      partyId: finance.erp.parties[0].id,
      categoryId: finance.erp.categories[0].id,
      centerId: finance.erp.centers[0].id,
      competence: "2026-10",
      dueDate: "2026-10-24",
      items: [{ description: "Serviço mensal sintético", quantity: 1, unitCents: 10000 }],
      discountCents: 0,
      evidence: "Proposta sintética aprovada",
    },
    reason: "Pedido de homologação",
  });
  const orderId = finance.erp.orders[0].id;
  fin({ action: "erpReviewOrder", id: orderId, status: "submitted", reason: "Revisão do pedido" });
  fin(
    { action: "erpReviewOrder", id: orderId, status: "approved", reason: "Segunda conferência" },
    "finance-reviewer"
  );
  fin({
    action: "contractFromOrder",
    orderId,
    owner: "Operação sintética",
    acceptedOn: "2026-10-01",
    implementationDue: "2026-10-10",
    dueDay: 24,
    billingRequiresReadiness: true,
    monthlyPriceConfirmed: true,
    acceptanceEvidence: "Contrato sintético conferido",
    commercialTerms: { buyerCnpj: "11222333000181" },
  });
  const contractId = finance.contracts[0].id;
  expect(finance.titles).toHaveLength(0);
  const source = await preserveProductionSource(
    admin,
    Buffer.from("%PDF-1.7\ncontrato sintetico de homologacao")
  );
  const initial = command();
  let central = await saveProductionCommand(admin, {
    ...initial,
    document: { name: "contrato-sintetico.pdf", kind: "contrato", source },
    terms: {
      ...initial.terms,
      obligations: [
        {
          id: "report",
          title: "Relatório sintético",
          serviceType: "OUTRO",
          owner: "Técnico sintético",
          due: "2026-10-20",
          deadlineRule: "Prazo contratual conferido",
          sourceReference: "Cláusula 1",
          sourceExcerpt: "Entregar relatório revisado no ciclo mensal.",
        },
      ],
    },
  });
  const cycleId = central.records[0].cycles[0].id;
  const save = async (payload: object) => {
    central = await saveProductionCommand(admin, {
      requestId: randomUUID(),
      expectedVersion: central.version,
      recordId: "record1",
      ...payload,
    });
    return central;
  };
  const card = async (id: ProductionCard["id"]) => {
    const r = central.records[0];
    const commercial = ["budget", "proposal", "contract"].includes(id);
    const value = (commercial ? r.commercial : r.cycles[0].cards).find((c) => c.id === id)!;
    return save({
      action: "card",
      cycleId: commercial ? "" : cycleId,
      card: {
        ...value,
        owner: "Revisor sintético",
        status: "done",
        checks: [true, true, true, true],
        evidence: "Conferência humana sintética registrada",
      },
      reason: "Homologação sem operação real",
    });
  };
  for (const id of ["budget", "proposal", "contract"] as const) await card(id);
  await save({
    action: "linkFinance",
    financeContractId: contractId,
    reason: "CNPJ e contrato conferidos",
  });
  expect(() => fin({ action: "recurring", contractId, month: "2026-10" })).toThrow(/implantação/i);
  fin({
    action: "flowChecklist",
    contractId,
    checklist: { clientData: true, scope: true, network: true, schedule: true },
    reason: "Implantação sintética conferida",
  });
  await card("mobilize");
  await expect(card("produce")).rejects.toThrow(/obrigaç/i);
  await save({
    action: "task",
    cycleId,
    taskId: "report",
    data: {
      owner: "Técnico sintético",
      due: "2026-10-20",
      status: "done",
      checks: [true, true, true, true],
      evidence: "Relatório sintético revisado e entregue",
      blocker: "",
    },
    reason: "Execução sintética",
  });
  await card("produce");
  await card("deliver");
  fin({
    action: "service",
    data: {
      contractId,
      date: "2026-10-20",
      description: "Relatório sintético",
      supplier: "Equipe sintética",
      city: "Curitiba",
      quantity: 1,
      unitRevenueCents: 10000,
      unitCostCents: 2000,
      evidence: "Execução sintética",
      billingMode: "included",
    },
  });
  const serviceId = finance.services[0].id;
  fin(
    { action: "flowReviewService", contractId, serviceId, evidence: "Segunda revisão sintética" },
    "finance-reviewer"
  );
  expect(() => fin({ action: "billService", id: serviceId, dueDate: "2026-10-24" })).toThrow(
    /incluído/i
  );
  fin({ action: "recurring", contractId, month: "2026-10" });
  expect(() => fin({ action: "recurring", contractId, month: "2026-10" })).toThrow(/já possui/i);
  const titleId = finance.titles[0].id;
  fin({ action: "review", id: titleId, status: "submitted", reason: "Submeter medição sintética" });
  fin(
    { action: "review", id: titleId, status: "approved", reason: "Título sintético conferido" },
    "finance-reviewer"
  );
  const billing = async (patch: object = {}) => {
    const c = central.records[0].cycles[0];
    const {
      measuredCents,
      invoicedCents,
      receivedCents,
      adjustmentCents,
      measurementEvidence,
      invoiceReference,
      invoiceEvidence,
      receiptEvidence,
      adjustmentEvidence,
      financeTitleId,
    } = c;
    return save({
      action: "billing",
      cycleId,
      data: {
        measuredCents,
        invoicedCents,
        receivedCents,
        adjustmentCents,
        measurementEvidence,
        invoiceReference,
        invoiceEvidence,
        receiptEvidence,
        adjustmentEvidence,
        financeTitleId,
        ...patch,
      },
      reason: "Registro sintético de medição e conciliação",
    });
  };
  await billing({ measuredCents: 10000, measurementEvidence: "Medição sintética aprovada" });
  await card("measure");
  await billing({
    invoicedCents: 10000,
    invoiceReference: "SINTETICO/TESTE/001",
    invoiceEvidence: "Referência fiscal fictícia para teste isolado",
    financeTitleId: titleId,
  });
  await card("invoice");
  fin({ action: "account", name: "Banco sintético" });
  const accountId = finance.accounts[0].id;
  const settle = (principalCents: number, withholdingCents = 0, interestCents = 0) => {
    fin({
      action: "settle",
      data: {
        titleId,
        accountId,
        date: "2026-10-24",
        principalCents,
        interestCents,
        fineCents: 0,
        discountCents: 0,
        withholdingCents,
        evidence: "Comprovante sintético",
      },
    });
    return finance.settlements.at(-1)!;
  };
  const reconcile = (settlementId: string, amountCents: number) => {
    fin({
      action: "bank",
      accountId,
      rows: [
        {
          bankId: `sintetico-${settlementId}`,
          date: "2026-10-24",
          amountCents,
          memo: "Crédito sintético",
        },
      ],
    });
    const row = finance.bank.at(-1)!;
    fin({ action: "match", id: row.id, settlementIds: [settlementId] });
    return row.id;
  };
  return {
    fin,
    save,
    card,
    billing,
    settle,
    reconcile,
    contractId,
    titleId,
    central: () => central,
    finance: () => finance,
  };
}

describe("homologação sintética integrada do contrato ao recebimento", () => {
  it("percorre upload, nove cards, revisão, medição e quitação conciliada preservando o contrato recorrente", async () => {
    const f = await integratedContract();
    const partial = f.settle(4000);
    f.reconcile(partial.id, 4000);
    await f.billing({ receivedCents: 4000, receiptEvidence: "Extrato sintético parcial" });
    const before = await getProductionBook(admin);
    await expect(f.card("receive")).rejects.toThrow(/saldo/i);
    expect(await getProductionBook(admin)).toEqual(before);
    const last = f.settle(6000, 1000, 200);
    await f.billing({
      receivedCents: 9000,
      adjustmentCents: 1000,
      receiptEvidence: "Baixas sintéticas conferidas",
      adjustmentEvidence: "Retenção sintética comprovada",
    });
    await expect(f.card("receive")).rejects.toThrow(/conciliação bancária/i);
    f.reconcile(last.id, 5200);
    await f.card("receive");
    const final = await getProductionBook(admin);
    expect(progress(final.records[0])).toEqual({ completed: 10, total: 10 });
    expect(final.records[0].active).toBe(true);
    expect(f.finance().contracts[0].active).toBe(true);
    expect(f.finance().titles).toHaveLength(1);
    expect(final.records[0].documents[0].source).toEqual(before.records[0].documents[0].source);
    expect(final.audit.length).toBeGreaterThan(before.audit.length);
    expect(
      checkCycleFinance(final.records[0], final.records[0].cycles[0], f.finance())
    ).toMatchObject({
      status: "reconciled",
      outstandingCents: 0,
      receipts: {
        receivedCents: 9000,
        adjustmentCents: 1000,
        cashCents: 9200,
        unreconciledCount: 0,
      },
    });
  });
  it("revalida um estorno posterior e impede encerrar o contrato com recebimento divergente", async () => {
    const f = await integratedContract();
    const receipt = f.settle(10000);
    const bankId = f.reconcile(receipt.id, 10000);
    await f.billing({ receivedCents: 10000, receiptEvidence: "Extrato sintético integral" });
    await f.card("receive");
    expect(() => f.fin({ action: "reverse", id: receipt.id, reason: "Estorno sintético" })).toThrow(
      /conciliação/i
    );
    f.fin({ action: "unmatch", id: bankId, reason: "Desfazer conciliação sintética" });
    f.fin({ action: "reverse", id: receipt.id, reason: "Estorno sintético" });
    const before = await getProductionBook(admin);
    await expect(
      f.save({ action: "active", active: false, reason: "Tentar encerrar após estorno" })
    ).rejects.toThrow(/divergem/i);
    expect(await getProductionBook(admin)).toEqual(before);
    expect(
      checkCycleFinance(before.records[0], before.records[0].cycles[0], f.finance())
    ).toMatchObject({ status: "divergent", outstandingCents: 10000 });
  });
  it("rejeita confirmação concorrente sem apagar o histórico nem duplicar a gravação confirmada", async () => {
    const f = await integratedContract();
    const current = await getProductionBook(admin);
    const payload = {
      action: "billing",
      requestId: randomUUID(),
      expectedVersion: current.version,
      recordId: "record1",
      cycleId: current.records[0].cycles[0].id,
      data: {
        measuredCents: 10000,
        invoicedCents: 10000,
        receivedCents: 0,
        adjustmentCents: 0,
        measurementEvidence: "Medição sintética aprovada",
        invoiceReference: "SINTETICO/TESTE/001",
        invoiceEvidence: "Referência fiscal fictícia para teste isolado",
        receiptEvidence: "",
        adjustmentEvidence: "",
        financeTitleId: f.titleId,
      },
      reason: "Confirmar versão sintética",
    };
    const saved = await saveProductionCommand(admin, payload);
    const writes = state.writes;
    expect(await saveProductionCommand(admin, payload)).toEqual(saved);
    expect(state.writes).toBe(writes);
    await expect(
      saveProductionCommand(admin, { ...payload, requestId: randomUUID() })
    ).rejects.toMatchObject({ status: 409 });
    expect(await getProductionBook(admin)).toEqual(saved);
    expect(saved.audit.slice(0, current.audit.length)).toEqual(current.audit);
  });
});
