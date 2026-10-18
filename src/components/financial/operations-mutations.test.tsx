import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
import {
  financeFixture,
  withTitle,
  command,
  period,
  today,
} from "../../../tests/ui/finance-fixture";
import {
  FinanceCommandSchema,
  applyFinanceCommand,
  emptyFinanceBook,
} from "@/lib/financial/operations";
const m = vi.hoisted(() => ({ user: null as any, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("@/lib/financial/treasury", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  brazilToday: () => "2026-10-18",
}));
import { FinanceOperationsWorkspace } from "./operations-workspace";
let v: ReturnType<typeof ui>, book: ReturnType<typeof financeFixture>;
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
function lastPost() {
  return JSON.parse(
    m.fetch.mock.calls.filter(([, options]) => options.method === "POST").at(-1)![1].body
  );
}
beforeEach(() => {
  v = ui();
  book = financeFixture();
  m.user = { uid: "author", getIdToken: vi.fn().mockResolvedValue("token") };
  m.fetch.mockReset().mockImplementation(async (_url, options) => {
    if (options.method === "POST") {
      const payload = FinanceCommandSchema.parse(JSON.parse(options.body));
      try {
        book = applyFinanceCommand(
          book,
          payload,
          m.user.uid,
          `${today}T12:00:00Z`,
          JSON.stringify(payload)
        );
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    }
    return json(book);
  });
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function open(tab = "Pagar e receber") {
  await v.render(<FinanceOperationsWorkspace />);
  await v.click("Abrir controle");
  await v.click(tab);
}
async function fields(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) await v.input(`[name="${name}"]`, value);
}
async function confirm(values: Record<string, string> = {}) {
  await fields(values);
  await v.submit();
}
async function titleForm() {
  await v.click("Novo título");
  await fields({
    kind: "receivable",
    party: "Pessoa sintética",
    description: "Serviço teste",
    amount: "100,01",
    sourceKey: "TEST-NEW",
    category: "Receita teste",
    center: "Centro teste",
    evidence: "Documento teste",
  });
}
async function csv(text: string, size?: number) {
  const file = new File([text], "teste.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
  if (size) Object.defineProperty(file, "size", { value: size });
  const input = v.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
describe("financial forms and confirmed writes", () => {
  it("creates one title with exact cents, credentials and expected version", async () => {
    await open();
    const version = book.version;
    await titleForm();
    await confirm();
    expect(lastPost()).toMatchObject({
      action: "title",
      expectedVersion: version,
      data: { amountCents: 10001, contractId: null },
    });
    expect(m.fetch.mock.calls.at(-1)![1].headers.Authorization).toBe("Bearer token");
    expect(v.container.textContent).toContain("Registro salvo e conferido");
    expect(book.titles).toHaveLength(1);
  });
  it("splits installments without losing a cent", async () => {
    await open();
    await titleForm();
    await confirm({ installments: "3" });
    expect(lastPost()).toMatchObject({ action: "installments", count: 3 });
    expect(book.titles).toHaveLength(3);
    expect(book.titles.reduce((n, t) => n + t.amountCents, 0)).toBe(10001);
  });
  it("rejects malformed monetary inputs locally and preserves the draft", async () => {
    await open();
    await titleForm();
    await confirm({ amount: "wrong" });
    expect(m.fetch).toHaveBeenCalledOnce();
    expect(document.querySelector('[name="party"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] [role="alert"]')).not.toBeNull();
  });
  it("reuses the exact operation ID after an unconfirmed server error", async () => {
    await open();
    await titleForm();
    m.fetch.mockResolvedValueOnce(json({ error: "Unconfirmed" }, 503));
    await confirm();
    const first = lastPost();
    await confirm();
    expect(lastPost()).toEqual(first);
    expect(book.titles).toHaveLength(1);
  });
  it("blocks a different mutation until an uncertain response is reconciled", async () => {
    await open();
    await titleForm();
    m.fetch.mockResolvedValueOnce(json({ error: "Unconfirmed" }, 503));
    await confirm();
    await confirm({ amount: "200,00" });
    expect(m.fetch).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain(
      "Atualize os dados antes de iniciar outra operação"
    );
  });
  it("keeps the save pending until server confirmation and ignores late response after logout", async () => {
    await open();
    await titleForm();
    const p = deferred<Response>();
    m.fetch.mockReturnValueOnce(p.promise);
    await confirm();
    expect(v.button("Salvando e conferindo").disabled).toBe(true);
    m.user = null;
    await v.render(<FinanceOperationsWorkspace />);
    await act(async () => p.resolve(json(book)));
    expect(v.container.textContent).toContain("Entre com seu perfil");
    expect(v.container.textContent).not.toContain("Registro salvo");
  });
  it("edits a draft with explicit reason and resubmits it for independent review", async () => {
    book = withTitle(book);
    await open();
    await v.click("Corrigir rascunho");
    await confirm({ amount: "222,22", description: "Corrigido", reason: "Documento corrigido" });
    expect(book.titles[0]).toMatchObject({ amountCents: 22222, description: "Corrigido" });
    await v.click("Enviar para aprovação");
    await confirm({ reason: "Conferido" });
    expect(book.titles[0].status).toBe("submitted");
    expect(v.button("Aprovar").disabled).toBe(true);
  });
  it.each([
    ["Aprovar", "approved"],
    ["Solicitar revisão", "rejected"],
  ])("allows an independent operator to %s", async (label, status) => {
    book = withTitle(book, "submitted");
    m.user.uid = "reviewer";
    await open();
    await v.click(label);
    await confirm({ reason: "Conferência independente" });
    expect(book.titles[0].status).toBe(status);
  });
  it("cancels with a reason instead of deleting the title", async () => {
    book = withTitle(book);
    await open();
    await v.click("Cancelar");
    await confirm({ reason: "Origem cancelada" });
    expect(book.titles).toHaveLength(1);
    expect(book.titles[0].status).toBe("cancelled");
  });
  it("builds a separate reference verification command without issuing payments", async () => {
    book = withTitle(book);
    await open();
    await v.click("Referência Omie");
    await confirm({ reference: "REF-TEST", reason: "Comparar com a origem" });
    expect(lastPost()).toMatchObject({
      action: "reference",
      reference: "REF-TEST",
      id: book.titles[0].id,
    });
  });
  it("records and reverses a partial settlement, retaining the audit trail", async () => {
    book = withTitle(book, "approved");
    await open();
    await v.click("Registrar baixa");
    await confirm({
      principal: "100,00",
      interest: "1,00",
      fine: "2,00",
      discount: "0,50",
      withholding: "3,00",
      evidence: "Comprovante sintético",
    });
    expect(book.settlements[0]).toMatchObject({
      principalCents: 10000,
      interestCents: 100,
      fineCents: 200,
      discountCents: 50,
      withholdingCents: 300,
    });
    expect(v.container.textContent).toContain("23,45");
    await v.click("Estornar registro");
    await confirm({ reason: "Conferência do comprovante" });
    expect(book.settlements[0].reversed).toBe(true);
    expect(v.container.textContent).toContain("123,45");
  });
  it("creates and revises a contract then changes its active state", async () => {
    await open("Contratos");
    await v.click("Novo contrato");
    await confirm({
      name: "Novo contrato sintético",
      client: "Cliente sintético",
      center: "Centro teste",
      monthly: "123,45",
      dueDay: "24",
    });
    expect(book.contracts.at(-1)).toMatchObject({ monthlyCents: 12345, dueDay: 24 });
    await v.click("Revisar / reajustar");
    await confirm({ monthly: "200,50", reason: "Aditivo sintético" });
    expect(book.contracts[0].monthlyCents).toBe(20050);
    await v.click("Inativar");
    await confirm({ reason: "Fim de vigência" });
    expect(book.contracts[0].active).toBe(false);
    await v.click("Reativar");
    await confirm({ reason: "Nova vigência" });
    expect(book.contracts[0].active).toBe(true);
  });
  it("generates recurring charges only once for a contract and month", async () => {
    await open("Contratos");
    await v.click("Gerar mensalidade");
    await confirm({ month: period, dueDate: "2026-10-24", reason: "Exceção contratual sintética" });
    expect(book.titles[0].dueDate).toBe("2026-10-24");
    await v.click("Gerar mensalidade");
    await confirm({ month: period });
    expect(book.titles).toHaveLength(1);
  });
  it("records production then creates only an internal billing draft", async () => {
    await open("Produção SST");
    await v.click("Registrar serviço realizado");
    await confirm({
      description: "Serviço sintético",
      supplier: "Prestador teste",
      city: "Vitória/ES",
      quantity: "2",
      billingMode: "separate",
      revenue: "20,50",
      cost: "10,25",
      evidence: "Medição sintética",
    });
    expect(book.services[0]).toMatchObject({
      quantity: 2,
      unitRevenueCents: 2050,
      unitCostCents: 1025,
    });
    await v.click("Gerar faturamento");
    await confirm({ dueDate: "2026-10-24" });
    expect(book.titles[0]).toMatchObject({ amountCents: 4100, status: "draft" });
  });
  it("voids an unbilled production while keeping it in history", async () => {
    book = command(book, {
      action: "service",
      data: {
        contractId: book.contracts[0].id,
        date: today,
        description: "Serviço teste",
        supplier: "Prestador teste",
        city: "Cidade teste",
        quantity: 1,
        billingMode: "included",
        unitRevenueCents: 0,
        unitCostCents: 100,
        evidence: "Medição teste",
      },
    });
    await open("Produção SST");
    await v.click("Anular registro de produção");
    await confirm({ reason: "Medição incorreta" });
    expect(book.services[0].voided).toBe(true);
  });
  it("previews CSV in cents and imports only after explicit confirmation", async () => {
    await open("Bancos e conciliação");
    await v.input('select[aria-label="Conta do extrato"]', book.accounts[0].id);
    await csv("id;data;valor;historico\nBANK-1;2026-10-18;123,45;Crédito teste");
    expect(book.bank).toHaveLength(0);
    expect(v.container.textContent).toContain("1 movimentos para conferir");
    await v.click("Confirmar importação");
    expect(book.bank[0]).toMatchObject({ bankId: "BANK-1", amountCents: 12345 });
  });
  it.each([
    ["wrong;header\n1;2", undefined, "CSV inválido"],
    ["id;data;valor;historico", 600000, "512 KB"],
  ])("rejects invalid CSV before persistence: %s", async (text, size, error) => {
    await open("Bancos e conciliação");
    await v.input('select[aria-label="Conta do extrato"]', book.accounts[0].id);
    await csv(text as string, size as number | undefined);
    expect(v.container.textContent).toContain(error);
    expect(book.bank).toHaveLength(0);
  });
  it("invalidates an earlier CSV read when the account selection changes", async () => {
    await open("Bancos e conciliação");
    await v.input('select[aria-label="Conta do extrato"]', book.accounts[0].id);
    const p = deferred<string>();
    const input = v.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["x"], "test.csv");
    Object.defineProperty(file, "text", { value: () => p.promise });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await v.input('select[aria-label="Conta do extrato"]', "");
    await act(async () => p.resolve("id;data;valor;historico\nBANK-OLD;2026-10-18;1,00;Antigo"));
    expect(v.container.textContent).not.toContain("BANK-OLD");
  });
  it("registers a bank reference and month-end statement without credentials", async () => {
    await open("Bancos e conciliação");
    await v.click("Cadastrar conta de referência");
    await confirm({ name: "Outra conta sintética" });
    expect(book.accounts).toHaveLength(2);
    await v.click("Informar saldos mensais");
    await confirm({
      month: period,
      opening: "10,00",
      closing: "10,00",
      evidence: "Extrato completo sintético",
    });
    expect(lastPost()).toMatchObject({
      action: "statement",
      data: { openingCents: 1000, closingCents: 1000 },
    });
  });
  it("sets a budget by competence and cost center", async () => {
    await open("Orçamento");
    await v.click("Definir / revisar orçamento");
    await confirm({ month: period, center: "Centro teste", amount: "1234,56" });
    expect(book.budgets[0].amountCents).toBe(123456);
    expect(v.container.textContent).toContain("1.234,56");
  });
  it("closes a reconciled empty book and requires evidence to reopen", async () => {
    book = command(book, {
      action: "statement",
      data: {
        accountId: book.accounts[0].id,
        month: period,
        openingCents: 0,
        closingCents: 0,
        evidence: "Extrato sintético completo",
      },
    });
    await open("Fechamento");
    await v.click("Fechar período");
    await confirm({ evidence: "Conferência sintética" });
    expect(book.periods[0].closed).toBe(true);
    await v.click("Reabrir com justificativa");
    await confirm({ evidence: "Revisão sintética" });
    expect(book.periods[0].closed).toBe(false);
    await v.click("Histórico");
    expect(v.container.textContent).toContain("Responsável: author");
  });
});
