import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { AuthContext } from "@/lib/auth/auth-context";
import { emptyFinanceBook } from "@/lib/financial/operations";
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
            json: string,
            options: { preconditionOpts: { ifGenerationMatch: string }; metadata: object }
          ) => {
            const f = state.files.get(name);
            if (
              state.conflict ||
              options.preconditionOpts.ifGenerationMatch !== (f?.generation || "0")
            )
              throw { code: 412 };
            expect(options.metadata).toEqual({ cacheControl: "private, no-store" });
            state.writes++;
            state.files.set(name, {
              bytes: Buffer.from(json),
              generation: String(++state.sequence),
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
    finance.contracts.push({
      id: "fin1",
      name: "Contrato",
      client: "Cliente",
      center: "SST",
      monthlyCents: 10000,
      dueDay: 10,
      active: true,
    });
    finance.contractFlows.push({ contractId: "fin1", customerDocument: "11222333000181" } as never);
    state.finance.mockResolvedValue(finance);
    const linked = await saveProductionCommand(admin, link);
    expect(linked.records[0].financeContractId).toBe("fin1");
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
