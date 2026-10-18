import {
  emptyFinanceBook,
  FinanceCommandSchema,
  applyFinanceCommand,
  type FinanceBook,
} from "../../src/lib/financial/operations";
export const period = "2026-10",
  today = "2026-10-18";
export function command(book: FinanceBook, data: object, actor = "author") {
  const parsed = FinanceCommandSchema.parse({
    ...data,
    requestId: crypto.randomUUID(),
    expectedVersion: book.version,
  });
  return applyFinanceCommand(book, parsed, actor, `${today}T12:00:00Z`, JSON.stringify(parsed));
}
export function financeFixture() {
  let b = emptyFinanceBook();
  b = command(b, {
    action: "erpParty",
    id: null,
    data: {
      name: "Empresa sintética",
      document: "TEST-001",
      role: "both",
      email: "",
      phone: "",
      active: true,
    },
    reason: "Teste",
  });
  for (const [code, kind, name] of [
    ["1", "revenue", "Receita teste"],
    ["2", "expense", "Despesa teste"],
  ])
    b = command(b, {
      action: "erpCategory",
      id: null,
      data: { code, kind, name, active: true },
      reason: "Teste",
    });
  b = command(b, {
    action: "erpCenter",
    id: null,
    data: { code: "T", name: "Centro teste", active: true },
    reason: "Teste",
  });
  b = command(b, { action: "account", name: "Conta sintética" });
  b = command(b, {
    action: "contract",
    data: {
      name: "Contrato teste",
      client: "Empresa sintética",
      center: "Centro teste",
      monthlyCents: 10000,
      dueDay: 10,
      active: true,
    },
  });
  return b;
}
export function withOrder(book = financeFixture(), status = "draft") {
  let b = command(book, {
    action: "erpOrder",
    id: null,
    data: {
      kind: "sale",
      number: "PED-TEST",
      partyId: book.erp.parties[0].id,
      categoryId: book.erp.categories.find((c) => c.kind === "revenue")!.id,
      centerId: book.erp.centers[0].id,
      competence: period,
      dueDate: "2026-10-20",
      items: [{ description: "Serviço sintético", quantity: 3, unitCents: 3333 }],
      discountCents: 1,
      evidence: "Documento sintético",
    },
    reason: "Teste",
  });
  const id = b.erp.orders[0].id;
  if (status !== "draft")
    b = command(b, { action: "erpReviewOrder", id, status: "submitted", reason: "Conferido" });
  if (["approved", "converted"].includes(status))
    b = command(
      b,
      { action: "erpReviewOrder", id, status: "approved", reason: "Conferido" },
      "reviewer"
    );
  if (status === "converted")
    b = command(b, { action: "erpConvertOrder", id, reason: "Conferido" });
  return b;
}
export function withTitle(book = financeFixture(), status = "draft") {
  let b = command(book, {
    action: "title",
    data: {
      kind: "receivable",
      party: "Empresa sintética",
      description: "Título sintético",
      amountCents: 12345,
      competence: period,
      dueDate: "2026-10-10",
      category: "Receita teste",
      center: "Centro teste",
      contractId: null,
      sourceKey: "TEST-TITLE",
      externalReference: "",
      evidence: "Documento sintético",
    },
  });
  const id = b.titles[0].id;
  if (status !== "draft")
    b = command(b, { action: "review", id, status: "submitted", reason: "Conferido" });
  if (status === "approved")
    b = command(b, { action: "review", id, status: "approved", reason: "Conferido" }, "reviewer");
  return b;
}
export function formData(data: Record<string, string>) {
  const f = new FormData();
  Object.entries(data).forEach(([k, v]) => f.set(k, v));
  return f;
}
