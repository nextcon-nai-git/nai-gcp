import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import {
  financeFixture,
  withOrder,
  command,
  formData,
  period,
  today,
} from "../../../tests/ui/finance-fixture";
import { ContractFlowWorkspace } from "./contract-flow-workspace";
let v: ReturnType<typeof ui>, book: ReturnType<typeof financeFixture>;
const show = vi.fn(),
  navigate = vi.fn();
const checklist = { clientData: true, scope: true, network: true, schedule: true };
beforeEach(() => {
  v = ui();
  book = financeFixture();
  show.mockReset();
  navigate.mockReset();
});
afterEach(async () => v.cleanup());
async function render(actor = "author", busy = false) {
  await v.render(
    <ContractFlowWorkspace
      book={book}
      period={period}
      today={today}
      actor={actor}
      busy={busy}
      showForm={show}
      navigate={navigate}
    />
  );
}
function build(values: Record<string, string> = {}) {
  return show.mock.calls.at(-1)![0].build(formData(values));
}
function integrated() {
  book = withOrder(book, "approved");
  book = command(book, {
    action: "contractFromOrder",
    orderId: book.erp.orders[0].id,
    owner: "Operação teste",
    acceptedOn: "2026-10-01",
    implementationDue: "2026-10-10",
    dueDay: 20,
    billingRequiresReadiness: true,
    monthlyPriceConfirmed: true,
    acceptanceEvidence: "Aceite sintético",
  });
  book.contracts.shift();
  return book.contracts[0].id;
}
describe("contract-to-cash forms", () => {
  it("navigates to orders, production and receivables without mutating a book", async () => {
    await render();
    await v.click("Orçamentos e aprovação");
    await v.click("Registrar produção SST");
    await v.click("Aprovar cobranças");
    expect(navigate.mock.calls.map((c) => c[0])).toEqual(["orders", "services", "titles"]);
    expect(show).not.toHaveBeenCalled();
  });
  it("requires an approved unconverted sale before creating a monthly contract", async () => {
    await render();
    expect(v.button("Criar contrato de pedido aprovado").disabled).toBe(true);
    book = withOrder(book, "approved");
    await render();
    await v.click("Criar contrato de pedido aprovado");
    const data = build({
      orderId: book.erp.orders[0].id,
      monthlyPriceConfirmed: "true",
      owner: "Responsável",
      acceptedOn: today,
      implementationDue: today,
      dueDay: "24",
      billingRequiresReadiness: "true",
      acceptanceEvidence: "Aceite",
      sellerCnpj: "111",
      buyerCnpj: "222",
      serviceCode: "TEST",
      setupAmount: "10,25",
      pendingDocuments: " Documento A \n\n Documento B ",
    });
    expect(data).toMatchObject({
      action: "contractFromOrder",
      monthlyPriceConfirmed: true,
      dueDay: 24,
      billingRequiresReadiness: true,
      commercialTerms: {
        setupCents: 1025,
        pendingDocuments: ["Documento A", "Documento B"],
        certificates: [],
      },
    });
  });
  it("enrolls an existing contract only with explicit customer and prior-billing confirmations", async () => {
    await render();
    await v.click("Incluir contrato existente no fluxo");
    expect(
      build({
        partyId: book.erp.parties[0].id,
        monthlyPriceConfirmed: "true",
        owner: "Responsável",
        acceptedOn: today,
        implementationDue: today,
        billingStartMonth: period,
        billingRequiresReadiness: "true",
        existingBillingReviewed: "true",
        acceptanceEvidence: "Contrato",
        billingEvidence: "Consulta",
      })
    ).toMatchObject({
      action: "enrollExistingContract",
      contractId: book.contracts[0].id,
      monthlyPriceConfirmed: true,
      existingBillingReviewed: true,
    });
  });
  it("preserves certificates when changing commercial terms", async () => {
    book.contracts[0].commercialTerms.certificates = [
      {
        name: "Certidão teste",
        printedValidThrough: null,
        issuerStatus: "not_checked",
        issuerEvidence: "",
        checkedAt: "2026-10-18T12:00:00Z",
        checkedBy: "author",
      },
    ] as any;
    await render();
    await v.click("Registrar condições por aditivo");
    expect(build({ setupAmount: "1,01", amendmentEvidence: "Aditivo" })).toMatchObject({
      action: "contractTerms",
      commercialTerms: {
        setupCents: 101,
        certificates: book.contracts[0].commercialTerms.certificates,
      },
      amendmentEvidence: "Aditivo",
    });
  });
  it("separates printed validity from independent issuer verification", async () => {
    await render();
    await v.click("Conferir certidão");
    expect(build({ name: "Certidão teste" })).toMatchObject({
      action: "contractCertificate",
      printedValidThrough: null,
      issuerStatus: "not_checked",
    });
    expect(
      build({
        name: "Certidão teste",
        printedValidThrough: "2026-12-31",
        issuerStatus: "confirmed",
        issuerEvidence: "Consulta sintética",
      })
    ).toMatchObject({
      printedValidThrough: "2026-12-31",
      issuerStatus: "confirmed",
      issuerEvidence: "Consulta sintética",
    });
  });
  it("keeps monthly billing blocked until each implementation item is reviewed", async () => {
    const id = integrated();
    await render();
    expect(v.button("Gerar rascunho da mensalidade").disabled).toBe(true);
    await v.click("Conferir implantação");
    const payload = build({
      clientData: "true",
      scope: "true",
      network: "true",
      schedule: "true",
      reason: "Conferido",
    });
    expect(payload).toMatchObject({ action: "flowChecklist", contractId: id, checklist });
    book = command(book, payload);
    await render();
    expect(v.button("Gerar rascunho da mensalidade").disabled).toBe(false);
    await v.click("Gerar rascunho da mensalidade");
    expect(build({ dueDate: "2026-10-24", reason: "Exceção" })).toEqual({
      action: "recurring",
      contractId: id,
      month: period,
      dueDate: "2026-10-24",
      reason: "Exceção",
    });
  });
  it("requires another person to review production before billing", async () => {
    const id = integrated();
    book = command(book, {
      action: "flowChecklist",
      contractId: id,
      checklist,
      reason: "Conferido",
    });
    book = command(book, {
      action: "service",
      data: {
        contractId: id,
        date: today,
        description: "Serviço sintético",
        supplier: "Prestador teste",
        city: "Cidade teste",
        quantity: 2,
        unitRevenueCents: 5000,
        unitCostCents: 2000,
        evidence: "Medição",
        billingMode: "separate",
      },
    });
    await render();
    expect(v.button("Conferir serviço").disabled).toBe(true);
    expect(v.button("Gerar rascunho do serviço").disabled).toBe(true);
    await render("reviewer");
    await v.click("Conferir serviço");
    const payload = build({ evidence: "Conferência independente" });
    book = command(book, payload, "reviewer");
    await render("reviewer");
    await v.click("Gerar rascunho do serviço");
    expect(build({ dueDate: "2026-10-24" })).toMatchObject({
      action: "billService",
      id: book.services[0].id,
      dueDate: "2026-10-24",
    });
  });
  it("disables writes for inactive contracts and while a request is pending", async () => {
    book.contracts[0].active = false;
    await render();
    expect(v.button("Conferir certidão").disabled).toBe(true);
    book.contracts[0].active = true;
    await render("author", true);
    expect(v.button("Incluir contrato existente no fluxo").disabled).toBe(true);
  });
});
