import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import { randomUUID } from "node:crypto";
import { emptyFinanceBook } from "@/lib/financial/operations";
import { ContractCommercialTermsSchema, ContractFlowSchema } from "@/lib/financial/contract-flow";
import {
  applyCommand as applyProductionCommand,
  CommandSchema as ProductionCommandSchema,
  emptyBook as emptyProductionBook,
} from "@/lib/production/model";
import { serviceOccurrenceFingerprint } from "@/lib/production/service-allocation-validation";
import { buildServiceReceiptsSnapshot } from "@/lib/production/service-receipts";
import { makeTasks } from "@/lib/production/obligations";

const storage = vi.hoisted(() => ({
  files: new Map<string, { bytes: Buffer; generation: string }>(),
  calls: 0,
  sequence: 0,
  writes: [] as {
    name: string;
    options: { preconditionOpts?: { ifGenerationMatch?: number | string }; metadata?: unknown };
  }[],
  beforeWrite: null as (() => void) | null,
  failRead: false,
}));
const production = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./production-central", () => ({ getProductionBook: production.read }));
vi.mock("@/lib/firebase-admin", () => ({}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => {
      storage.calls++;
      const file = (name: string, pin?: { generation?: number | string }) => ({
        name,
        getMetadata: async () => {
          const record = storage.files.get(name);
          if (!record) throw { code: 404 };
          return [{ generation: record.generation }];
        },
        download: async () => {
          if (storage.failRead) {
            storage.failRead = false;
            throw new Error("temporary storage outage");
          }
          const record = storage.files.get(name);
          if (!record || (pin?.generation && String(pin.generation) !== record.generation))
            throw { code: 404 };
          return [record.bytes];
        },
        save: async (
          data: string,
          options: {
            preconditionOpts?: { ifGenerationMatch?: number | string };
            metadata?: unknown;
          }
        ) => {
          storage.beforeWrite?.();
          storage.beforeWrite = null;
          const record = storage.files.get(name);
          const expected = options.preconditionOpts?.ifGenerationMatch;
          storage.writes.push({ name, options });
          if (
            Number(expected) === 0
              ? Boolean(record)
              : !record || String(expected) !== record.generation
          )
            throw { code: 412 };
          storage.files.set(name, {
            bytes: Buffer.from(data),
            generation: String(++storage.sequence),
          });
        },
      });
      return {
        file,
        getFiles: async () => [[...storage.files.keys()].map((name) => file(name)), {}],
      };
    },
  }),
}));

import { getFinanceBook, saveFinanceCommand } from "./financial-operations";
const admin: AuthContext = {
  uid: "admin",
  email: "test@example.com",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const cmd = () => ({
  action: "account",
  name: "Banco sintético",
  requestId: randomUUID(),
  expectedVersion: 0,
});
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
  storage.sequence = 0;
  storage.writes = [];
  storage.beforeWrite = null;
  storage.failRead = false;
  production.read.mockReset();
});
describe("financial control persistence", () => {
  it.each(["CLIENT_ADMIN", "OPERATIONS", "DOCTOR", "PROVIDER", "GUEST"] as const)(
    "denies %s before storage",
    async (role) => {
      await expect(getFinanceBook({ ...admin, role })).rejects.toMatchObject({ status: 403 });
      await expect(saveFinanceCommand({ ...admin, role }, cmd())).rejects.toMatchObject({
        status: 403,
      });
      expect(storage.calls).toBe(0);
    }
  );
  it("denies tenant admin and permits internal admin", async () => {
    await expect(
      getFinanceBook({ ...admin, role: "ADMIN", tenantId: "client" })
    ).rejects.toMatchObject({ status: 403 });
    expect(storage.calls).toBe(0);
    expect((await getFinanceBook({ ...admin, role: "ADMIN" })).version).toBe(0);
  });
  it("persists private atomic data and replays a committed command once", async () => {
    const c = cmd();
    const a = await saveFinanceCommand(admin, c);
    const b = await saveFinanceCommand(admin, c);
    expect(a).toEqual(b);
    expect(b.accounts).toHaveLength(1);
    expect(storage.writes).toHaveLength(1);
    expect(storage.writes[0].options.metadata).toEqual({ cacheControl: "private, no-store" });
  });
  it("reads the deployed book with additive ERP defaults and preserves existing records", async () => {
    const saved = await saveFinanceCommand(admin, cmd());
    const record = storage.files.get("financial-operations/v1/nextcon.json")!;
    const legacy = JSON.parse(record.bytes.toString());
    delete legacy.erp;
    delete legacy.serviceBillingAllocations;
    delete legacy.serviceSettlementAllocations;
    delete legacy.serviceProductionLinks;
    record.bytes = Buffer.from(JSON.stringify(legacy));
    const read = await getFinanceBook(admin);
    expect(read.accounts).toEqual(saved.accounts);
    expect(read.audit).toEqual(saved.audit);
    expect(read.version).toBe(saved.version);
    expect(read.erp.orders).toEqual([]);
    expect(read.serviceBillingAllocations).toEqual([]);
    expect(read.serviceSettlementAllocations).toEqual([]);
    expect(read.serviceProductionLinks).toEqual([]);
    expect(storage.writes).toHaveLength(1);
  });
  it("does not overwrite a concurrent writer", async () => {
    storage.beforeWrite = () => {
      storage.files.set("financial-operations/v1/nextcon.json", {
        bytes: Buffer.from("new data"),
        generation: "42",
      });
    };
    await expect(saveFinanceCommand(admin, cmd())).rejects.toMatchObject({ status: 409 });
    expect(storage.files.get("financial-operations/v1/nextcon.json")?.bytes.toString()).toBe(
      "new data"
    );
  });
  it("does not replace unreadable data with an empty book", async () => {
    await saveFinanceCommand(admin, cmd());
    storage.failRead = true;
    await expect(getFinanceBook(admin)).rejects.toThrow("outage");
    expect(storage.writes).toHaveLength(1);
  });
});

function seedServiceAllocation() {
  const create = ProductionCommandSchema.parse({
    action: "create",
    requestId: randomUUID(),
    expectedVersion: 0,
    recordId: "record1",
    companyId: "company1",
    cnpj: "11222333000181",
    name: "Contrato sintético",
    owner: "Gestora sintética",
    terms: {
      scope: "Relatório contratado",
      units: "Unidade sintética",
      deliverables: "Relatório revisado",
      valueCents: 10000,
      startsOn: "2026-10-01",
      endsOn: "",
      paymentTerms: "Após medição",
      recurring: false,
      obligations: [
        {
          id: "task1",
          title: "Relatório contratado",
          serviceType: "OUTRO",
          owner: "Técnico sintético",
          due: "2026-10-20",
          deadlineRule: "Prazo contratado",
          sourceReference: "Cláusula 1",
          sourceExcerpt: "Produzir relatório técnico",
        },
      ],
    },
    document: null,
    effectiveOn: "2026-10-01",
    evidence: "Contrato revisado",
    reviewed: true,
  });
  const central = applyProductionCommand(
    emptyProductionBook(),
    create,
    admin.uid,
    "2026-10-01T12:00:00Z",
    "synthetic",
    "Cliente sintético"
  );
  const record = central.records[0];
  record.financeContractId = "contract1";
  record.formalizedAt = "2026-10-01T12:00:00Z";
  record.cycles[0].period = "2026-10";
  production.read.mockImplementation(async () => structuredClone(central));
  const finance = emptyFinanceBook();
  finance.contracts.push({
    id: "contract1",
    name: "Contrato sintético",
    client: "Cliente sintético",
    center: "SST",
    monthlyCents: 0,
    dueDay: 10,
    active: true,
    commercialTerms: ContractCommercialTermsSchema.parse({}),
  });
  finance.contractFlows.push(
    ContractFlowSchema.parse({
      contractId: "contract1",
      orderId: null,
      customerDocument: "11222333000181",
      owner: "Gestora sintética",
      acceptedOn: "2026-10-01",
      acceptanceEvidence: "Aceite sintético",
      implementationDue: "2026-10-10",
      billingRequiresReadiness: false,
      checklist: { clientData: true, scope: true, network: true, schedule: true },
      createdBy: admin.uid,
      serviceReviews: [],
    })
  );
  finance.titles.push({
    id: "title1",
    kind: "receivable",
    party: "Cliente sintético",
    description: "Relatório técnico",
    amountCents: 10000,
    competence: "2026-10",
    dueDate: "2026-10-30",
    category: "SST",
    center: "SST",
    contractId: "contract1",
    sourceKey: "synthetic",
    source: "manual",
    externalReference: "",
    evidence: "Título sintético aprovado",
    status: "approved",
    createdBy: "author",
    approvedBy: "reviewer",
  });
  storage.files.set("financial-operations/v1/nextcon.json", {
    bytes: Buffer.from(JSON.stringify(finance)),
    generation: "1",
  });
  storage.sequence = 1;
  const payload = {
    action: "allocateServiceTitle",
    id: "allocation1",
    recordId: record.id,
    cycleId: record.cycles[0].id,
    taskId: "task1",
    sourceFingerprint: serviceOccurrenceFingerprint(central, {
      recordId: record.id,
      cycleId: record.cycles[0].id,
      taskId: "task1",
    })!,
    titleId: "title1",
    amountCents: 10000,
    evidence: "Medição sintética aprovada",
    requestId: randomUUID(),
    expectedVersion: finance.version,
    expectedCentralVersion: central.version,
    reviewed: true,
    reason: "Distribuição sintética conferida",
  };
  return { central, finance, payload };
}

describe("service allocation persistence in the financial book", () => {
  it("persists only attribution metadata and replays after Central changes", async () => {
    const { finance, payload } = seedServiceAllocation();
    const saved = await saveFinanceCommand(admin, payload);
    expect(saved.serviceBillingAllocations).toHaveLength(1);
    expect(saved.titles).toEqual(finance.titles);
    expect(saved.settlements).toEqual(finance.settlements);
    expect(saved.omieExports).toEqual(finance.omieExports);
    expect(saved.audit.at(-1)).toMatchObject({ id: payload.requestId, actor: admin.uid });
    expect(production.read).toHaveBeenCalledTimes(1);
    production.read.mockRejectedValue(new Error("Central changed after confirmed write"));
    expect(await saveFinanceCommand(admin, payload)).toEqual(saved);
    expect(production.read).toHaveBeenCalledTimes(1);
    expect(storage.writes).toHaveLength(1);
    await expect(
      saveFinanceCommand(admin, { ...payload, amountCents: 9000 })
    ).rejects.toMatchObject({ status: 409 });
    expect(storage.writes).toHaveLength(1);
  });

  it("rejects a stale Central or a missing task without writing the financial book", async () => {
    const { central, payload } = seedServiceAllocation();
    await expect(
      saveFinanceCommand(admin, { ...payload, expectedCentralVersion: central.version - 1 })
    ).rejects.toMatchObject({ status: 409 });
    central.records[0].cycles[0].tasks = [];
    await expect(saveFinanceCommand(admin, payload)).rejects.toThrow(/tarefa existente/);
    expect(storage.writes).toHaveLength(0);
    expect((await getFinanceBook(admin)).serviceBillingAllocations).toEqual([]);
  });

  it("applies the customer guard through the shared service, including generic callers", async () => {
    const { central, payload } = seedServiceAllocation();
    central.records[0].cnpj = "44337647000189";
    await expect(saveFinanceCommand(admin, payload)).rejects.toThrow(/CNPJ/);
    expect(storage.writes).toHaveLength(0);
  });

  it("rejects an old finance version before consulting the Central", async () => {
    const { payload } = seedServiceAllocation();
    await expect(
      saveFinanceCommand(admin, { ...payload, expectedVersion: 1 })
    ).rejects.toMatchObject({ status: 409 });
    expect(production.read).not.toHaveBeenCalled();
    expect(storage.writes).toHaveLength(0);
  });

  it("keeps concurrent finance changes when the allocation loses its generation lease", async () => {
    const { finance, payload } = seedServiceAllocation();
    storage.beforeWrite = () => {
      storage.files.set("financial-operations/v1/nextcon.json", {
        bytes: Buffer.from(JSON.stringify({ ...finance, version: 42 })),
        generation: "42",
      });
    };
    await expect(saveFinanceCommand(admin, payload)).rejects.toMatchObject({ status: 409 });
    const current = await getFinanceBook(admin);
    expect(current.version).toBe(42);
    expect(current.serviceBillingAllocations).toEqual([]);
  });

  it("does not turn an unavailable Central into permission to associate a title", async () => {
    const { payload } = seedServiceAllocation();
    production.read.mockRejectedValue(new Error("temporary central read failure"));
    await expect(saveFinanceCommand(admin, payload)).rejects.toThrow(/central read failure/);
    expect(storage.writes).toHaveLength(0);
  });

  it("rejects a changed contractual fingerprint even when the Central version was refreshed", async () => {
    const { central, payload } = seedServiceAllocation();
    central.records[0].cycles[0].contractedCents = 20000;
    central.version++;
    await expect(
      saveFinanceCommand(admin, { ...payload, expectedCentralVersion: central.version })
    ).rejects.toThrow(/origem contratual/);
    expect(storage.writes).toHaveLength(0);
  });

  it("does not attribute an approved old title to a new task revision after a concurrent replan", async () => {
    const { central, payload } = seedServiceAllocation();
    storage.beforeWrite = () => {
      const record = central.records[0];
      const revision = structuredClone(record.revisions[0]);
      revision.terms.obligations[0].title = "Outro serviço da nova revisão";
      revision.terms.obligations[0].sourceExcerpt = "Escopo alterado por aditivo";
      record.revisions.push(revision);
      record.cycles[0].revision = 1;
      record.cycles[0].tasks = makeTasks(revision.terms.obligations);
      central.version++;
    };
    // The Central can change after validation: its CAS is independent of the financial book.
    const saved = await saveFinanceCommand(admin, payload);
    expect(saved.serviceBillingAllocations[0].sourceFingerprint).toBe(payload.sourceFingerprint);
    const result = buildServiceReceiptsSnapshot(central, saved, "2026-11-11T12:00:00Z");
    expect(result.items[0]).toMatchObject({
      title: "Outro serviço da nova revisão",
      financialStatus: "review",
      billedCents: null,
      receivedCents: null,
      outstandingCents: null,
    });
    expect(result.items[0].issues).toContain(
      "A origem contratual do serviço mudou desde a conferência. Revise e refaça a associação à versão correta."
    );
    expect(result.summary.billedCents).toBe(0);
  });
});
