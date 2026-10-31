// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
const m = vi.hoisted(() => ({
  collection: vi.fn(),
  getAll: vi.fn(),
  transaction: vi.fn(),
  pdf: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: { collection: m.collection, getAll: m.getAll, runTransaction: m.transaction },
}));
vi.mock("./occupational-kit-pdf", () => ({
  generateOccupationalKitPdf: m.pdf,
  occupationalKitFilename: () => "Kit-NAI-Teste.pdf",
}));
import { prepareKitBatch, confirmKitBatch, downloadKit, kitOperationId } from "./operational-kits";
import { KitSelection, type KitSelectionData } from "@/lib/operational-kits";

const user = {
  uid: "admin",
  role: "SUPER_ADMIN",
  tenantId: null,
  servedCompanies: [],
} as unknown as AuthContext;
const input: KitSelectionData = {
  employeeIds: ["e1"],
  clinicId: "clinic",
  cycle: "2026-11",
  examType: "periodico",
  pcmsoDocumentId: "a".repeat(64),
  pgrDocumentId: "b".repeat(64),
  exams: ["Exame clínico"],
  risks: ["Conforme PGR revisado"],
  pcmsoDoctor: "Médico Teste",
  pcmsoCrm: "12345/SP",
};
type Data = Record<string, any>;
let db: Map<string, Data>, version: number, queue: Promise<unknown>;
const put = (path: string, value: Data) => {
  db.set(path, { value: structuredClone(value), version: ++version });
};
function reference(path: string): any {
  return {
    path,
    id: path.split("/").at(-1),
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => snapshot(path),
    create: async (value: Data) => {
      if (db.has(path)) throw Error("exists");
      put(path, value);
    },
  };
}
function collection(path: string): any {
  return {
    doc: (id: string) => reference(`${path}/${id}`),
    add: async (value: Data) => put(`${path}/audit-${version}`, value),
  };
}
function snapshot(path: string): any {
  const saved = db.get(path);
  return {
    exists: !!saved,
    ref: reference(path),
    updateTime: { seconds: 0, nanoseconds: saved?.version || 0 },
    data: () => (saved ? structuredClone(saved.value) : undefined),
  };
}
const issued = () => [...db.values()].filter((x) => x.value.kind === "kit-issued");
beforeEach(() => {
  vi.clearAllMocks();
  db = new Map();
  version = 0;
  queue = Promise.resolve();
  m.collection.mockImplementation(collection);
  m.getAll.mockImplementation(async (...refs) => refs.map((r) => snapshot(r.path)));
  m.transaction.mockImplementation((fn) => {
    const run = queue.then(async () => {
      const writes: (() => void)[] = [];
      const result = await fn({
        get: async (ref: any) => snapshot(ref.path),
        getAll: async (...refs: any[]) => refs.map((r) => snapshot(r.path)),
        create: (ref: any, value: Data) => {
          if (db.has(ref.path)) throw Error("exists");
          writes.push(() => put(ref.path, value));
        },
        update: (ref: any, patch: Data) =>
          writes.push(() => put(ref.path, { ...db.get(ref.path)!.value, ...patch })),
      });
      writes.forEach((write) => write());
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  });
  m.pdf.mockReturnValue({ output: () => Buffer.from("%PDF-1.7 test") });
  put("companies/ONE", {
    name: "Empresa Teste",
    cnpj: "11.222.333/0001-81",
    active: true,
    address: "Rua Teste",
  });
  put("providers/clinic", {
    name: "Clínica Teste",
    cnpj: "11.222.333/0001-81",
    active: true,
    type: "CLINIC",
    servedCompanies: ["ONE"],
    address: "Rua Clínica",
    phone: "41999999999",
  });
  put(`companies/ONE/sourceDocuments/${input.pcmsoDocumentId}`, {
    name: "PCMSO_2026.pdf",
    companyId: "ONE",
  });
  put(`companies/ONE/sourceDocuments/${input.pgrDocumentId}`, {
    name: "PGR_2026.pdf",
    companyId: "ONE",
  });
  put("companies/ONE/employees/e1", {
    name: "Colaborador Teste",
    cpf: "529.982.247-25",
    companyId: "ONE",
    status: "active",
    job_role: { title: "Assistente" },
    department: "Administrativo",
  });
});
describe("operational kit transactions", () => {
  it("renders and archives a real PDF in the Node server runtime", async () => {
    const actual =
      await vi.importActual<typeof import("./occupational-kit-pdf")>("./occupational-kit-pdf");
    m.pdf.mockImplementation(actual.generateOccupationalKitPdf);
    const p = await prepareKitBatch(user, "ONE", input);
    const [kit] = await confirmKitBatch(user, "ONE", p.proposalId);
    const { bytes } = await downloadKit(user, "ONE", kit.id);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(10000);
    expect(bytes.toString("latin1")).toContain("/Count 4");
  });
  it("prepares without emission, confirms once and archives PDF plus scheduler request", async () => {
    const preview = await prepareKitBatch(user, "ONE", input);
    expect(m.pdf).not.toHaveBeenCalled();
    expect(issued()).toHaveLength(0);
    const first = await confirmKitBatch(user, "ONE", preview.proposalId);
    expect(first).toHaveLength(1);
    expect(issued()).toHaveLength(1);
    expect(db.get(`users/admin/asoRequests/${first[0].id}`)?.value.status).toBe("kit_montado");
    expect(issued()[0].value).toMatchObject({
      createdBy: "admin",
      socStatus: "not_transmitted",
      deliveryStatus: "not_sent",
    });
    expect(await confirmKitBatch(user, "ONE", preview.proposalId)).toEqual(
      first.map((item) => ({ ...item, reused: true }))
    );
    expect(m.pdf).toHaveBeenCalledTimes(1);
    const downloaded = await downloadKit(user, "ONE", first[0].id);
    expect(downloaded.bytes.toString()).toBe("%PDF-1.7 test");
    expect([...db.keys()].some((p) => p.includes(`${first[0].id}/audit/`))).toBe(true);
  });
  it("deduplicates simultaneous proposals, including another authorized administrator", async () => {
    const other = { ...user, uid: "other" };
    const [a, b] = await Promise.all([
      prepareKitBatch(user, "ONE", input),
      prepareKitBatch(other, "ONE", input),
    ]);
    const result = await Promise.all([
      confirmKitBatch(user, "ONE", a.proposalId),
      confirmKitBatch(other, "ONE", b.proposalId),
    ]);
    expect(issued()).toHaveLength(1);
    expect(result[1][0].reused).toBe(true);
    expect(m.pdf).toHaveBeenCalledOnce();
  });
  it("blocks changed protocols for the same employee/type/cycle", async () => {
    const a = await prepareKitBatch(user, "ONE", input);
    await confirmKitBatch(user, "ONE", a.proposalId);
    const b = await prepareKitBatch(user, "ONE", { ...input, exams: ["Outro exame"] });
    await expect(confirmKitBatch(user, "ONE", b.proposalId)).rejects.toThrow("dados diferentes");
    expect(issued()).toHaveLength(1);
  });
  it.each([
    "companies/ONE",
    "providers/clinic",
    "companies/ONE/employees/e1",
    `companies/ONE/sourceDocuments/${input.pcmsoDocumentId}`,
  ])("requires a new preview after source change: %s", async (path) => {
    const p = await prepareKitBatch(user, "ONE", input);
    put(path, { ...db.get(path)!.value, updatedAt: "changed" });
    await expect(confirmKitBatch(user, "ONE", p.proposalId)).rejects.toThrow("mudaram");
    expect(issued()).toHaveLength(0);
  });
  it("does not let another user confirm a preview", async () => {
    const p = await prepareKitBatch(user, "ONE", input);
    await expect(confirmKitBatch({ ...user, uid: "other" }, "ONE", p.proposalId)).rejects.toThrow(
      "sessão"
    );
    await expect(confirmKitBatch(user, "OTHER", p.proposalId)).rejects.toThrow("sessão");
  });
  it("rejects expired previews", async () => {
    const p = await prepareKitBatch(user, "ONE", input),
      path = `workAssistantProposals/${p.proposalId}`;
    put(path, { ...db.get(path)!.value, expiresAt: 0 });
    await expect(confirmKitBatch(user, "ONE", p.proposalId)).rejects.toThrow("expirou");
  });
  it.each(["OPERATIONS", "SCOPED_PROVIDER", "CLIENT_ADMIN", "DOCTOR", "GUEST"])(
    "denies role %s before reads",
    async (role) => {
      await expect(prepareKitBatch({ ...user, role } as AuthContext, "ONE", input)).rejects.toThrow(
        "autorizada"
      );
      expect(m.getAll).not.toHaveBeenCalled();
    }
  );
  it("denies a tenant admin", async () => {
    await expect(
      prepareKitBatch({ ...user, role: "ADMIN", tenantId: "ONE" }, "ONE", input)
    ).rejects.toThrow("autorizada");
  });
  it.each([
    ["providers/clinic", { active: false }],
    ["providers/clinic", { servedCompanies: [] }],
    ["providers/clinic", { address: "" }],
    ["companies/ONE/employees/e1", { companyId: "OTHER" }],
    ["companies/ONE/employees/e1", { cpf: "00000000000" }],
    ["companies/ONE/employees/e1", { status: "fired" }],
    [`companies/ONE/sourceDocuments/${input.pcmsoDocumentId}`, { name: "Outro.pdf" }],
    [`companies/ONE/sourceDocuments/${input.pcmsoDocumentId}`, { companyId: "OTHER" }],
  ] as const)("rejects incomplete/unavailable sources %s %o", async (path, patch) => {
    put(path, { ...db.get(path)!.value, ...patch });
    await expect(prepareKitBatch(user, "ONE", input)).rejects.toThrow();
    expect(m.pdf).not.toHaveBeenCalled();
  });
  it("rejects duplicate CPFs and mixed protocols", async () => {
    put("companies/ONE/employees/e2", { ...db.get("companies/ONE/employees/e1")!.value });
    await expect(
      prepareKitBatch(user, "ONE", { ...input, employeeIds: ["e1", "e2"] })
    ).rejects.toThrow("mesmo CPF");
    put("companies/ONE/employees/e2", {
      ...db.get("companies/ONE/employees/e1")!.value,
      cpf: "11144477735",
      department: "Outro",
    });
    await expect(
      prepareKitBatch(user, "ONE", { ...input, employeeIds: ["e1", "e2"] })
    ).rejects.toThrow("cargo e setor");
  });
  it("rolls back all records if any PDF fails", async () => {
    put("companies/ONE/employees/e2", {
      ...db.get("companies/ONE/employees/e1")!.value,
      cpf: "11144477735",
    });
    const p = await prepareKitBatch(user, "ONE", { ...input, employeeIds: ["e1", "e2"] });
    m.pdf
      .mockImplementationOnce(() => ({ output: () => Buffer.from("%PDF-test") }))
      .mockImplementationOnce(() => {
        throw Error("PDF failed");
      });
    await expect(confirmKitBatch(user, "ONE", p.proposalId)).rejects.toThrow("PDF failed");
    expect(issued()).toHaveLength(0);
    expect([...db.keys()].some((p) => p.includes("/asoRequests/"))).toBe(false);
  });
  it("protects archived PDF against cross-company access and corruption", async () => {
    const p = await prepareKitBatch(user, "ONE", input),
      [kit] = await confirmKitBatch(user, "ONE", p.proposalId);
    await expect(downloadKit(user, "OTHER", kit.id)).rejects.toThrow("não encontrado");
    const path = `workAssistantProposals/${kit.id}`;
    put(path, { ...db.get(path)!.value, pdfBase64: "Zm9yZ2Vk" });
    await expect(downloadKit(user, "ONE", kit.id)).rejects.toThrow("validar");
  });
  it("uses CPF identity and validates bounds and path traversal", () => {
    expect(kitOperationId("ONE", "529.982.247-25", "2026-11", "periodico")).toBe(
      kitOperationId("ONE", "52998224725", "2026-11", "periodico")
    );
    for (const patch of [
      { employeeIds: ["../other"] },
      { employeeIds: ["e1", "e1"] },
      { clinicId: "all" },
      { cycle: "2026-13" },
      { exams: [] },
      { exams: ["A", "a"] },
      { pcmsoDocumentId: input.pgrDocumentId },
    ])
      expect(KitSelection.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});
