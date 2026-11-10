import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AVP_SOURCE_HEADERS } from "@/lib/avp-source-config";
import { parseAvpSourceValues } from "@/lib/avp-source-parser";
import type { AuthContext } from "@/lib/auth/auth-context";
import { emptyFinanceBook, FinanceBookSchema, type FinanceBook } from "@/lib/financial/operations";
import { AuthError } from "@/lib/auth/errors";
const io = vi.hoisted(() => ({
  sync: vi.fn(),
  snapshot: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  access: vi.fn(),
}));
vi.mock("./avp-sheet-sync", () => ({ syncAvpSource: io.sync, getAvpSnapshot: io.snapshot }));
vi.mock("./private-json-store", () => ({ readPrivate: io.read, writePrivate: io.write }));
vi.mock("./financial-access", () => ({ requireCurrentFinancialAccess: io.access }));
import { previewClinicPaymentBatches, createClinicPaymentDrafts } from "./clinic-payment-batches";
import { clinicBatchForTitle, verifyClinicPayment } from "./clinic-payment-review";
const user: AuthContext = {
  uid: "operator",
  email: "finance@example.invalid",
  tenantId: null,
  role: "ADMIN",
  servedCompanies: [],
  permissions: [],
};
const row = (n: number, amount: string) => {
  const record: Record<string, string> = {
    Nº: String(n),
    "DATA DO PEDIDO": "01/10/2026",
    COLABORADOR: "Pessoa " + n,
    CIDADE: "Gurupi/TO",
    STATUS: "EXAME FEITO",
    "DATA AGENDADA": "31/10/2026 08:30",
    CNPJ: "00.000.000/E08G-12",
    "NOME CLÍNICA": "Clínica sintética",
    "PIX REALIZADO?": "NÃO",
    "VALOR ASO": amount,
  };
  return AVP_SOURCE_HEADERS.map((key) => record[key] || "");
};
const items = parseAvpSourceValues([
  [...AVP_SOURCE_HEADERS],
  row(1, "25,00"),
  row(2, "30,50"),
]).rows;
let book: FinanceBook;
let source: {
  status: string;
  refreshInProgress: boolean;
  revision: string;
  error: string | null;
  items: typeof items;
  conflicts: { id: string; field: string }[];
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T01:15:00Z"));
  vi.resetAllMocks();
  io.sync.mockResolvedValue({ started: true });
  book = emptyFinanceBook();
  source = {
    status: "CONNECTED",
    refreshInProgress: false,
    revision: "source:0",
    error: null,
    items,
    conflicts: [],
  };
  io.snapshot.mockImplementation(async () => source);
  io.read.mockImplementation(async () => ({
    value: structuredClone(book),
    generation: String(book.version),
  }));
  io.write.mockImplementation(async (_path: string, value: FinanceBook, version: string) => {
    if (String(book.version) !== version) throw new AuthError("Alteração concorrente.", 409);
    book = FinanceBookSchema.parse(value);
  });
});
afterEach(() => vi.useRealTimers());
async function request() {
  const { hash, dueDate } = await previewClinicPaymentBatches(user, {});
  return { hash, dueDate };
}
describe("rascunhos financeiros de ASOs da fila AVP", () => {
  it("concilia as linhas da planilha, salva um único lote com auditoria e recusa repetição da prévia", async () => {
    const input = await request();
    const results = await Promise.allSettled([
      createClinicPaymentDrafts(user, input),
      createClinicPaymentDrafts(user, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(book.titles).toHaveLength(1);
    expect(book.clinicPaymentBatches).toHaveLength(1);
    expect(book.clinicPaymentBatches[0]).toMatchObject({
      competence: "2026-10",
      dueDate: "2026-11-10",
      clinicDocument: "00000000E08G12",
      amountCents: 5550,
      titleId: book.titles[0].id,
    });
    expect(book.clinicPaymentBatches[0].sourceRevision).toBe("source:0");
    expect(book.clinicPaymentBatches[0].items.map((row) => row.sourceRow)).toEqual([2, 3]);
    expect(book.titles[0].status).toBe("draft");
    expect(book.audit).toHaveLength(1);
    expect(book.settlements).toEqual([]);
    expect(book.omieExports).toEqual([]);
    expect((await previewClinicPaymentBatches(user, {})).blocked.map((r) => r.code)).toEqual([
      "ALREADY_BATCHED",
      "ALREADY_BATCHED",
    ]);
    await expect(createClinicPaymentDrafts(user, input)).rejects.toMatchObject({ status: 409 });
  });
  it.each(["conflito", "atualizando", "desconectada", "competência fechada"])(
    "preserva o livro após mudança na fonte ou no financeiro: %s",
    async (failure) => {
      const input = await request();
      if (failure === "conflito") source.conflicts = [{ id: items[0].id, field: "pixRealizado" }];
      if (failure === "atualizando") source.refreshInProgress = true;
      if (failure === "desconectada") source.status = "ERROR";
      if (failure === "competência fechada")
        book.periods.push({
          month: "2026-10",
          closed: true,
          evidence: "Caso sintético",
          updatedAt: "2026-11-09",
          updatedBy: "admin",
        });
      await expect(createClinicPaymentDrafts(user, input)).rejects.toMatchObject({ status: 409 });
      expect(io.write).not.toHaveBeenCalled();
    }
  );
  it("reconfere o acesso após consultar a fonte e antes de entregar ou gravar dados financeiros", async () => {
    const input = await request();
    io.access.mockRejectedValue(new AuthError("Acesso suspenso.", 403));
    await expect(previewClinicPaymentBatches(user, {})).rejects.toMatchObject({ status: 403 });
    await expect(createClinicPaymentDrafts(user, input)).rejects.toMatchObject({ status: 403 });
    expect(io.write).not.toHaveBeenCalled();
  });
  it("recusa administrador de cliente antes de ler planilha ou livro", async () => {
    await expect(
      previewClinicPaymentBatches({ ...user, tenantId: "GRUPO_AVP" }, {})
    ).rejects.toMatchObject({ status: 403 });
    expect(io.sync).not.toHaveBeenCalled();
    expect(io.read).not.toHaveBeenCalled();
  });
});

describe("reconferência de lote existente", () => {
  async function draft() {
    await createClinicPaymentDrafts(user, await request());
    const batch = clinicBatchForTitle(book, book.titles[0])!;
    expect(batch.id).toBe(book.clinicPaymentBatches[0].id);
    return batch;
  }
  it.each([
    [{ pixRealizado: "PAGO" }, "pagamento já realizado"],
    [{ pixRealizado: "ver comprovante" }, "Confira na origem"],
    [{ status: "AGENDADO" as const }, "deixou de constar como concluído"],
    [{ valorAso: "99,00" }, "valor mudou"],
    [{ cnpjClinica: "11.222.333/0001-81" }, "CNPJ da clínica"],
    [{ dataAgendadaIso: "2026-10-11" }, "data do exame"],
  ] as const)("mostra a linha atual e impede que avance após %j", async (fields, reason) => {
    const batch = await draft();
    source.items = [{ ...items[0], ...fields, sourceRow: 42 }, items[1]];
    await expect(verifyClinicPayment(user, book, batch)).rejects.toThrow(
      "Linha atual 42 · Pessoa 1"
    );
    await expect(verifyClinicPayment(user, book, batch)).rejects.toThrow(reason);
    expect(io.sync).toHaveBeenLastCalledWith("financial-review", user.uid);
  });
  it("considera duplicidades fora do lote e conflitos no pagamento", async () => {
    const batch = await draft();
    source.items = [...items, { ...items[0], id: "outro-id" }];
    await expect(verifyClinicPayment(user, book, batch)).rejects.toThrow("duplicidade");
    source.items = items;
    source.conflicts = [{ id: items[1].id, field: "pixRealizado" }];
    await expect(verifyClinicPayment(user, book, batch)).rejects.toThrow("divergência");
  });
  it("identifica pedido removido pela linha original e aceita lotes antigos sem linha", async () => {
    const batch = await draft();
    source.items = [items[1]];
    await expect(verifyClinicPayment(user, book, batch)).rejects.toThrow("Linha original 2");
    delete batch.items[0].sourceRow;
    delete batch.sourceRevision;
    await expect(verifyClinicPayment(user, book, batch)).rejects.toThrow("ASO · Pessoa 1");
    source.items = [items[1], { ...items[0], sourceRow: 88 }];
    source.revision = "reordenada:8";
    source.conflicts = [{ id: items[0].id, field: "responsavel" }];
    await expect(verifyClinicPayment(user, book, batch)).resolves.toBeUndefined();
  });
  it("impede verificar com dados parciais, sincronização concorrente ou falha da origem", async () => {
    const batch = await draft();
    source.refreshInProgress = true;
    await expect(verifyClinicPayment(user, book, batch)).rejects.toMatchObject({ status: 409 });
    source.refreshInProgress = false;
    source.revision = "";
    await expect(verifyClinicPayment(user, book, batch)).rejects.toMatchObject({ status: 409 });
    io.sync.mockResolvedValue({ started: false });
    io.snapshot.mockClear();
    await expect(verifyClinicPayment(user, book, batch)).rejects.toMatchObject({ status: 409 });
    io.sync.mockResolvedValue({ started: true, error: "fonte fora" });
    await expect(verifyClinicPayment(user, book, batch)).rejects.toMatchObject({ status: 409 });
    expect(io.snapshot).not.toHaveBeenCalled();
    io.sync.mockResolvedValue({ started: true });
    io.snapshot.mockRejectedValue(new Error("falha de leitura"));
    await expect(verifyClinicPayment(user, book, batch)).rejects.toMatchObject({ status: 503 });
  });
  it("recusa vínculos quebrados, valores diferentes e itens repetidos no próprio título", async () => {
    const batch = await draft();
    const title = book.titles[0];
    expect(() => clinicBatchForTitle(book, { ...title, amountCents: 1 })).toThrow("inconsistente");
    expect(() => clinicBatchForTitle(book, { ...title, sourceKey: "clinic-asos:outro" })).toThrow(
      "inconsistente"
    );
    book.clinicPaymentBatches = [];
    expect(() => clinicBatchForTitle(book, title)).toThrow("inconsistente");
    book.clinicPaymentBatches = [batch, batch];
    expect(() => clinicBatchForTitle(book, title)).toThrow("inconsistente");
    book.clinicPaymentBatches = [batch];
    batch.items[0].asoId = batch.items[1].asoId;
    expect(() => clinicBatchForTitle(book, title)).toThrow("inconsistente");
  });
});
