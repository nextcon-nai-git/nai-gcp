import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import {
  financeFixture,
  withOrder,
  withTitle,
  formData,
  command,
  period,
  today,
} from "../../../tests/ui/finance-fixture";
import { ErpWorkspace } from "./erp-workspace";
let v: ReturnType<typeof ui>, book: ReturnType<typeof financeFixture>;
const show = vi.fn(),
  request = vi.fn();
beforeEach(() => {
  v = ui();
  book = financeFixture();
  show.mockReset();
  request.mockReset().mockResolvedValue(true);
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(section = "masters", actor = "author", busy = false) {
  await v.render(
    <ErpWorkspace
      book={book}
      section={section}
      period={period}
      today={today}
      actor={actor}
      busy={busy}
      showForm={show}
      request={request}
    />
  );
}
function built(values: Record<string, string>) {
  return show.mock.calls.at(-1)![0].build(formData(values));
}
async function edit(section: number) {
  await act(async () =>
    v.container
      .querySelectorAll("section")
      [section].querySelector<HTMLButtonElement>("tbody button,div.border-t button")!
      .click()
  );
}
describe("ERP operator commands", () => {
  it("builds a new party with explicit activation and trimmed fields", async () => {
    await render();
    await v.click("Novo cadastro");
    expect(
      built({
        name: "  Pessoa teste ",
        document: "ABC",
        role: "both",
        email: "",
        phone: "",
        active: "true",
        reason: " Fonte ",
      })
    ).toEqual({
      action: "erpParty",
      id: null,
      data: {
        name: "Pessoa teste",
        document: "ABC",
        role: "both",
        email: "",
        phone: "",
        active: true,
      },
      reason: "Fonte",
    });
  });
  it("retains party identity when editing and filters by document", async () => {
    await render();
    await v.input('input[aria-label="Buscar cadastro financeiro"]', "TEST-001");
    await edit(0);
    expect(built({ name: "Atualizado", active: "false" })).toMatchObject({
      id: book.erp.parties[0].id,
      data: { active: false },
    });
    await v.input('input[aria-label="Buscar cadastro financeiro"]', "missing");
    expect(v.container.textContent).not.toContain("Empresa sintética");
  });
  it.each([
    [
      "Nova conta",
      "erpCategory",
      { code: "2", name: "Conta teste", kind: "expense", active: "true", reason: "Conferido" },
    ],
    [
      "Novo centro",
      "erpCenter",
      { code: "CT", name: "Centro", active: "false", reason: "Conferido" },
    ],
  ])("builds %s with the selected nature and active flag", async (label, action, fields) => {
    await render();
    await v.click(label as string);
    expect(built(fields as Record<string, string>)).toMatchObject({
      action,
      id: null,
      data: { name: fields.name },
      reason: "Conferido",
    });
  });
  it("preserves category and center identities on edit", async () => {
    await render();
    await edit(1);
    expect(built({})).toMatchObject({ action: "erpCategory", id: book.erp.categories[0].id });
    await edit(2);
    expect(built({})).toMatchObject({ action: "erpCenter", id: book.erp.centers[0].id });
  });
  it("requires another administrator to approve their own order", async () => {
    book = withOrder(book, "submitted");
    await render("orders");
    expect(v.button("Aprovar").disabled).toBe(true);
    expect(v.button("Devolver").disabled).toBe(true);
    await render("orders", "reviewer");
    await v.click("Aprovar");
    expect(built({ reason: "Evidência" })).toMatchObject({
      action: "erpReviewOrder",
      status: "approved",
      id: book.erp.orders[0].id,
    });
    await v.click("Devolver");
    expect(built({ reason: "Ajustar" })).toMatchObject({ status: "rejected" });
  });
  it("submits a draft for review and requires evidence before cancellation", async () => {
    book = withOrder(book);
    await render("orders");
    await v.click("Enviar para aprovação");
    expect(built({ reason: "Conferido" })).toMatchObject({
      status: "submitted",
      action: "erpReviewOrder",
    });
    await v.click("Cancelar");
    expect(built({ reason: "Cancelado" })).toMatchObject({ status: "cancelled" });
  });
  it("converts only approved orders that are not already linked to a contract", async () => {
    book = withOrder(book, "approved");
    await render("orders");
    await v.click("Gerar título em rascunho");
    expect(built({ reason: "Fonte" })).toMatchObject({
      action: "erpConvertOrder",
      id: book.erp.orders[0].id,
    });
    book.contractFlows.push({ orderId: book.erp.orders[0].id } as any);
    await render("orders");
    expect(
      [...v.container.querySelectorAll("button")].some(
        (b) => b.textContent === "Gerar título em rascunho"
      )
    ).toBe(false);
  });
  it("uses exact cents in the order editor and closes only on a confirmed save", async () => {
    await render("orders");
    await v.click("Novo pedido");
    await v.input('input[name="number"]', "PED-2");
    await v.input('select[name="partyId"]', book.erp.parties[0].id);
    await v.input(
      'select[name="categoryId"]',
      book.erp.categories.find((c) => c.kind === "revenue")!.id
    );
    await v.input('select[name="centerId"]', book.erp.centers[0].id);
    await v.input('input[aria-label="Descrição 1"]', " Serviço ");
    await v.input('input[aria-label="Quantidade inteira 1"]', "3");
    await v.input('input[aria-label="Valor unitário (R$) 1"]', "33,33");
    await v.input('textarea[name="evidence"]', "Documento");
    await v.input('textarea[name="reason"]', "Conferido");
    await v.submit();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "erpOrder",
        id: null,
        data: expect.objectContaining({
          items: [{ description: "Serviço", quantity: 3, unitCents: 3333 }],
          discountCents: 0,
        }),
      })
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("preserves a rejected save and validates malformed prices before transmission", async () => {
    book = withOrder(book);
    await render("orders");
    await v.click("Editar pedido");
    request.mockResolvedValue(false);
    await v.submit();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Pedido não confirmado"
    );
    await v.input('input[aria-label="Valor unitário (R$) 1"]', "invalid");
    await v.submit();
    expect(request).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("Confira os valores");
  });
  it("adds and removes items without allowing an empty order", async () => {
    await render("orders");
    await v.click("Novo pedido");
    expect(v.button("Remover item 1").disabled).toBe(true);
    await v.click("Adicionar item");
    await v.input('input[aria-label="Descrição 2"]', "Segundo");
    await v.click("Remover item 1");
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Descrição 1"]')?.value).toBe(
      "Segundo"
    );
  });
  it("switching purchase resets party/category choices and excludes inactive masters", async () => {
    book.erp.parties[0].active = false;
    book.erp.parties.push({
      ...book.erp.parties[0],
      id: "supplier",
      name: "Fornecedor teste",
      role: "supplier",
      active: true,
    });
    await render("orders");
    await v.click("Novo pedido");
    expect(document.querySelector('select[name="partyId"]')?.textContent).not.toContain(
      "Fornecedor teste"
    );
    await v.input("form select:not([name])", "purchase");
    expect(document.querySelector('select[name="partyId"]')?.textContent).toContain(
      "Fornecedor teste"
    );
    expect(document.querySelector('select[name="categoryId"]')?.textContent).toContain(
      "Despesa teste"
    );
  });
  it("records collection follow-up with optional next date and no payment command", async () => {
    book = withTitle(book, "approved");
    await render("collections");
    expect(v.container.textContent).toContain("123,45");
    await v.click("Registrar contato");
    expect(
      built({ date: today, outcome: "promise", nextDate: "2026-10-20", note: "Conversa teste" })
    ).toEqual({
      action: "erpFollowUp",
      data: {
        titleId: book.titles[0].id,
        date: today,
        nextDate: "2026-10-20",
        outcome: "promise",
        note: "Conversa teste",
      },
    });
    expect(built({ date: today, outcome: "attempt", note: "Teste" }).data.nextDate).toBeNull();
  });
  it("renders follow-up history without pretending the residual is settled", async () => {
    book = withTitle(book, "approved");
    book = command(book, {
      action: "erpFollowUp",
      data: {
        titleId: book.titles[0].id,
        date: today,
        nextDate: "2026-10-20",
        outcome: "promise",
        note: "Promessa sintética",
      },
    });
    await render("collections");
    expect(v.container.textContent).toContain("Promessa sintética");
    expect(v.container.textContent).toContain("123,45");
  });
  it("exports scoped CSV reports and revokes each temporary URL", async () => {
    book = withTitle(book, "approved");
    const create = vi.fn().mockReturnValue("blob:csv"),
      revoke = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: create },
      revokeObjectURL: { configurable: true, value: revoke },
    });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this.download);
    });
    await render("reports");
    await v.click("Exportar vencimentos");
    await v.click("Exportar resultado");
    await v.click("Exportar caixa");
    expect(clicked).toEqual([
      `vencimentos-${today}.csv`,
      `resultado-${period}.csv`,
      `caixa-${period}.csv`,
    ]);
    expect(revoke).toHaveBeenCalledTimes(3);
    expect(create.mock.calls.every(([blob]) => blob.type === "text/csv;charset=utf-8")).toBe(true);
  });
  it("disables master mutations while the parent request is pending", async () => {
    await render("masters", "author", true);
    await v.click("Novo cadastro");
    expect(show).not.toHaveBeenCalled();
  });
});
