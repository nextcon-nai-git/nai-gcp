import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
import { randomUUID } from "node:crypto";

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

const remote = vi.hoisted(() => ({ call: vi.fn(), scope: "same-app" }));
vi.mock("./omie-financial", () => ({
  omieConnectorSession: async () => ({
    scope: remote.scope,
    company: "Empresa teste",
    cnpj: "12345678000190",
    call: remote.call,
  }),
}));
import { SupplierBook } from "@/lib/suppliers/qualification";
import {
  emptyFinanceBook,
  applyFinanceCommand,
  FinanceCommandSchema,
} from "@/lib/financial/operations";
import {
  previewConnectorExport,
  executeConnectorExport,
  reconcileConnectorExport,
  connectorOverview,
  connectorCatalog,
} from "./omie-connectors";
import {
  uploadSupplierDocument,
  downloadSupplierDocument,
  validateSupplierBytes,
} from "./supplier-qualification";
const admin: AuthContext = {
  uid: "admin",
  email: "test@example.test",
  role: "SUPER_ADMIN",
  tenantId: null,
  permissions: [],
  servedCompanies: [],
};
const provider: AuthContext = { ...admin, uid: "supplier", role: "PROVIDER" };
const sp = "supplier-qualification/v1/book.json",
  fp = "financial-operations/v1/nextcon.json";
function put(path: string, value: unknown) {
  storage.files.set(path, {
    bytes: Buffer.from(JSON.stringify(value)),
    generation: String(++storage.sequence),
  });
}
function supplier() {
  const id = randomUUID(),
    req = randomUUID();
  return {
    id,
    owner: provider.uid,
    profile: {
      name: "Fornecedor sintético",
      document: "12345678000190",
      email: "x@example.test",
      phone: "",
      services: "Serviços teste",
      city: "SP",
    },
    requirements: [{ id: req, label: "Licença", required: true }],
    documents: [
      {
        id: randomUUID(),
        requirementId: req,
        name: "a.pdf",
        mime: "application/pdf",
        size: 8,
        sha256: "a".repeat(64),
        expires: "2099-12-31",
        uploadedBy: provider.uid,
        uploadedAt: "2026-10-12",
        review: "accepted",
        reviewer: admin.uid,
        reason: "Conferido",
      },
    ],
    status: "approved",
    validUntil: "2099-12-31",
    decision: "Conferido",
    reviewedBy: admin.uid,
    version: 4,
    createdAt: "2026-10-12",
    updatedAt: "2026-10-12",
    lastEditedBy: provider.uid,
  };
}
function seedSupplier() {
  const a = supplier();
  put(sp, SupplierBook.parse({ version: 1, applications: [a], audit: [] }));
  return a;
}
function seedTitle() {
  const b = emptyFinanceBook(),
    id = randomUUID();
  b.titles.push({
    id,
    kind: "payable",
    party: "Fornecedor sintético",
    description: "Serviço teste",
    amountCents: 10001,
    competence: "2026-10",
    dueDate: "2099-10-20",
    category: "Serviços",
    center: "Centro",
    contractId: null,
    sourceKey: "sintético",
    source: "manual",
    externalReference: "",
    evidence: "Conferido",
    status: "approved",
    createdBy: "creator",
    approvedBy: "approver",
  });
  put(fp, b);
  return {
    kind: "payable" as const,
    sourceId: id,
    partyCode: 123,
    categoryCode: "2.01",
    accountCode: 88,
  };
}
beforeEach(() => {
  storage.files.clear();
  storage.calls = 0;
  storage.sequence = 0;
  storage.writes = [];
  storage.beforeWrite = null;
  storage.failRead = false;
  remote.scope = "same-app";
  remote.call.mockReset();
  remote.call.mockImplementation(async (kind: string, param: Record<string, unknown>) => {
    if (kind === "partyDetail")
      return { codigo_cliente_omie: 123, razao_social: "Fornecedor sintético", inativo: "N" };
    if (kind === "categoryDetail") return { codigo: param.codigo, inativo: "N", totalizadora: "N" };
    if (kind === "accountDetail") return { nCodCC: param.nCodCC, inativo: "N" };
    return {};
  });
});
describe("private supplier evidence", () => {
  it("checks owner before blob access and enforces content signature", async () => {
    const a = seedSupplier();
    await expect(
      downloadSupplierDocument({ ...provider, uid: "other" }, a.id, a.documents[0].id)
    ).rejects.toThrow("não encontrado");
    expect(() => validateSupplierBytes(Buffer.from("<script>"), "application/pdf")).toThrow(
      "incompatível"
    );
    expect(() => validateSupplierBytes(Buffer.alloc(8 * 1024 * 1024 + 1), "image/png")).toThrow(
      "8 MiB"
    );
  });
  it("persists private immutable evidence and replays the same upload once", async () => {
    const a = seedSupplier();
    a.status = "draft";
    a.documents = [];
    put(sp, SupplierBook.parse({ version: 1, applications: [a], audit: [] }));
    const info = {
      applicationId: a.id,
      requirementId: a.requirements[0].id,
      requestId: randomUUID(),
      expectedVersion: a.version,
      name: "evidence.pdf",
      expires: "2099-01-01",
      mime: "application/pdf",
    };
    const bytes = Buffer.from("%PDF-1.7 test");
    await uploadSupplierDocument(provider, info, bytes);
    await uploadSupplierDocument(provider, info, bytes);
    const b = JSON.parse(storage.files.get(sp)!.bytes.toString());
    expect(b.applications[0].documents).toHaveLength(1);
    expect((await downloadSupplierDocument(provider, a.id, info.requestId)).bytes).toEqual(bytes);
    expect(
      storage.writes.every((w) => JSON.stringify(w.options.metadata).includes("private, no-store"))
    ).toBe(true);
    await expect(
      uploadSupplierDocument(provider, info, Buffer.from("%PDF-1.7 changed"))
    ).rejects.toThrow("outro envio");
  });
  it("does not replace a concurrent dossier or bypass submitted status", async () => {
    const a = seedSupplier();
    const info = {
      applicationId: a.id,
      requirementId: a.requirements[0].id,
      requestId: randomUUID(),
      expectedVersion: 0,
      name: "a.pdf",
      expires: null,
      mime: "application/pdf",
    };
    await expect(uploadSupplierDocument(provider, info, Buffer.from("%PDF-"))).rejects.toThrow(
      "alterado"
    );
    info.expectedVersion = a.version;
    await expect(uploadSupplierDocument(provider, info, Buffer.from("%PDF-"))).rejects.toThrow(
      "aberto"
    );
  });
});
describe("Omie controlled exports", () => {
  it("authorizes before private reads", async () => {
    await expect(connectorOverview(provider)).rejects.toThrow();
    await expect(
      executeConnectorExport({ ...admin, role: "ADMIN", tenantId: "client" }, {})
    ).rejects.toThrow();
    expect(storage.calls).toBe(0);
  });
  it("previews qualified supplier without writing or calling create", async () => {
    const a = seedSupplier();
    const p = await previewConnectorExport(admin, { kind: "supplier", sourceId: a.id });
    expect(p.payload.cnpj_cpf).toBe(a.profile.document);
    expect(p.payload.tags).toEqual([{ tag: "Fornecedor" }]);
    expect(storage.writes).toEqual([]);
    expect(remote.call).not.toHaveBeenCalled();
  });
  it("rejects expired qualification", async () => {
    const a = seedSupplier();
    a.validUntil = "2020-01-01";
    put(sp, SupplierBook.parse({ version: 1, applications: [a], audit: [] }));
    await expect(
      previewConnectorExport(admin, { kind: "supplier", sourceId: a.id })
    ).rejects.toThrow("vigente");
  });
  it("retains reservation on timeout and never repeats the write", async () => {
    const a = seedSupplier(),
      selection = { kind: "supplier", sourceId: a.id };
    const p = await previewConnectorExport(admin, selection);
    remote.call.mockRejectedValue(new Error("timeout"));
    expect((await executeConnectorExport(admin, { selection, hash: p.hash })).status).toBe(
      "reserved"
    );
    await expect(executeConnectorExport(admin, { selection, hash: p.hash })).rejects.toThrow(
      "Já existe"
    );
    expect(remote.call.mock.calls.filter((c) => c[0] === "createSupplier")).toHaveLength(1);
    await expect(reconcileConnectorExport(admin, selection)).rejects.toThrow("timeout");
    expect(remote.call.mock.calls.filter((c) => c[0] === "createSupplier")).toHaveLength(1);
  });
  it("confirms through readback and preserves audit", async () => {
    const a = seedSupplier(),
      selection = { kind: "supplier", sourceId: a.id };
    const p = await previewConnectorExport(admin, selection);
    remote.call.mockImplementation(async (k: string) =>
      k === "createSupplier"
        ? { codigo_cliente_omie: 456 }
        : { ...p.payload, codigo_cliente_omie: 456 }
    );
    const result = await executeConnectorExport(admin, { selection, hash: p.hash });
    expect(result.status).toBe("confirmed");
    const overview = await connectorOverview(admin);
    expect(overview.exports[0].remoteId).toBe(456);
    expect(overview.exports[0].confirmedBy).toBe(admin.uid);
    await reconcileConnectorExport(admin, selection);
    expect(remote.call.mock.calls.filter((c) => c[0] === "createSupplier")).toHaveLength(1);
  });
  it("blocks a changed app and mismatched remote record without recreating", async () => {
    const a = seedSupplier(),
      selection = { kind: "supplier", sourceId: a.id };
    const p = await previewConnectorExport(admin, selection);
    remote.call.mockRejectedValue(new Error("timeout"));
    await executeConnectorExport(admin, { selection, hash: p.hash });
    remote.scope = "other-app";
    await expect(reconcileConnectorExport(admin, selection)).rejects.toThrow("conexão Omie mudou");
    remote.scope = "same-app";
    remote.call.mockResolvedValue({
      ...p.payload,
      cnpj_cpf: "00000000000",
      codigo_cliente_omie: 456,
    });
    await expect(reconcileConnectorExport(admin, selection)).rejects.toThrow("integralmente");
    expect((await connectorOverview(admin)).exports[0].status).toBe("reserved");
  });
  it("losing source CAS does not call Omie", async () => {
    const a = seedSupplier(),
      selection = { kind: "supplier", sourceId: a.id },
      p = await previewConnectorExport(admin, selection);
    storage.beforeWrite = () => {
      put(sp, JSON.parse(storage.files.get(sp)!.bytes.toString()));
    };
    await expect(executeConnectorExport(admin, { selection, hash: p.hash })).rejects.toThrow(
      "Outra sessão"
    );
    expect(remote.call).not.toHaveBeenCalled();
  });
  it("rejects stale preview and mismatched party mapping", async () => {
    const selection = seedTitle();
    const p = await previewConnectorExport(admin, selection);
    expect(p.payload.valor_documento).toBe(100.01);
    expect(p.payload.baixar_documento).toBe("N");
    const b = JSON.parse(storage.files.get(fp)!.bytes.toString());
    b.version++;
    put(fp, b);
    await expect(executeConnectorExport(admin, { selection, hash: p.hash })).rejects.toThrow(
      "alterados"
    );
    remote.call.mockResolvedValue({ codigo_cliente_omie: 123, razao_social: "Outra empresa" });
    await expect(previewConnectorExport(admin, selection)).rejects.toThrow("não corresponde");
  });
  it("locks local title operations atomically when sending", async () => {
    const selection = seedTitle(),
      p = await previewConnectorExport(admin, selection);
    remote.call.mockImplementation(async (k: string, param: Record<string, unknown>) => {
      if (k === "partyDetail")
        return { codigo_cliente_omie: 123, razao_social: "Fornecedor sintético" };
      if (k === "categoryDetail") return { codigo: param.codigo };
      if (k === "accountDetail") return { nCodCC: param.nCodCC };
      throw new Error("unknown outcome");
    });
    await executeConnectorExport(admin, { selection, hash: p.hash });
    const b = JSON.parse(storage.files.get(fp)!.bytes.toString());
    const command = FinanceCommandSchema.parse({
      action: "review",
      id: selection.sourceId,
      status: "cancelled",
      reason: "Conferido",
      requestId: randomUUID(),
      expectedVersion: b.version,
    });
    expect(() => applyFinanceCommand(b, command, admin.uid, "2026-10-12", "hash")).toThrow(
      "reservado"
    );
  });
  it("validates catalog pagination and projects only allowed fields", async () => {
    remote.call.mockResolvedValue({
      pagina: 1,
      total_de_paginas: 2,
      total_de_registros: 60,
      clientes_cadastro: [
        {
          codigo_cliente_omie: 99,
          razao_social: "Cliente",
          cnpj_cpf: "12345678000190",
          secret: "must not escape",
        },
      ],
    });
    const r = await connectorCatalog(admin, { kind: "catalogParties", page: 1 });
    expect(r.pages).toBe(2);
    expect(JSON.stringify(r)).not.toContain("secret");
    await expect(connectorCatalog(admin, { kind: "catalogParties", page: 2 })).rejects.toThrow(
      "Página"
    );
  });
});
