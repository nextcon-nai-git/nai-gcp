import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  user: { uid: "admin", getIdToken: async () => "token" },
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
import { AvpEvidencePanel } from "./avp-evidence-panel";
let root: Root, host: HTMLDivElement;
const payment = {
  kind: "payment",
  id: "a".repeat(64),
  clinic: "Clínica teste",
  date: "2026-10-16",
  amountCents: 8000,
  unitCents: 4000,
  quantity: null,
  confirmation: "Comprovante",
  scope: "AVP",
  notes: "",
  source: "Teste",
  employees: "",
  city: "",
  uf: "",
};
const reply = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("loads all pages before computing totals and keeps unknown exam quantities separate", async () => {
  mocks.fetch
    .mockResolvedValueOnce(reply({ records: [payment], nextCursor: "a".repeat(64) }))
    .mockResolvedValueOnce(
      reply({ records: [{ ...payment, id: "b".repeat(64), quantity: 2 }], nextCursor: null })
    );
  await act(async () => root.render(<AvpEvidencePanel kind="payment" />));
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.fetch.mock.calls[1][0]).toContain("?cursor=" + "a".repeat(64));
  const metric = Array.from(host.querySelectorAll("p")).find(
    (p) => p.textContent === "Exames de R$ 40 ou mais"
  )!.parentElement!;
  expect(metric.querySelector("strong")?.textContent).toBe("2");
  expect(metric.textContent).toContain("1 pagamentos de R$ 40 ou mais com quantidade desconhecida");
});
it("downloads an ASO with its indexed human-readable filename", async () => {
  const aso = {
    kind: "aso",
    id: "a".repeat(64),
    employee: "Pessoa teste",
    company: "Empresa teste",
    examType: "Admissional",
    examDate: "2026-10-16",
    receivedDate: "2026-10-17",
    fileName: "ASO João Teste.PDF",
    uploaded: true,
    review: "Recebido",
    source: "Fonte teste",
    notes: "",
    city: "",
    uf: "",
  };
  mocks.fetch
    .mockResolvedValueOnce(reply({ records: [aso], nextCursor: null }))
    .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF-1.7"]) });
  const clicked: string[] = [];
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: () => "blob:test", revokeObjectURL: () => undefined })
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clicked.push(this.download);
  });
  await act(async () => root.render(<AvpEvidencePanel kind="aso" />));
  const download = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === "Abrir ASO"
  )!;
  expect(download).toBeTruthy();
  await act(async () => download.click());
  expect(clicked).toEqual([aso.fileName]);
});

it("compares manually selected ASO evidence across pages without changing records", async () => {
  const first = {
    kind: "aso",
    id: "1".repeat(64),
    employee: "Pessoa Exemplo",
    company: "Empresa A",
    examType: "Admissional",
    examDate: "2026-10-16",
    receivedDate: "2026-10-17",
    city: "Fortaleza",
    uf: "CE",
    fileName: "aso-a.pdf",
    uploaded: true,
    fileHash: "d".repeat(64),
    review: "Conferir retificação",
    source: "Envio inicial",
    notes: "",
  };
  const second = {
    ...first,
    id: "2".repeat(64),
    employee: "PESSOA EXEMPLO",
    company: "Empresa B",
    fileName: "aso-b.pdf",
    examDate: "",
    source: "Retorno da unidade",
    notes: "CNPJ 00000000000100 e CNPJ 00.000.000/0002-00 citados na origem.",
    uploaded: false,
  };
  mocks.fetch
    .mockResolvedValueOnce(reply({ records: [first], nextCursor: first.id }))
    .mockResolvedValueOnce(reply({ records: [second], nextCursor: null }));
  await act(async () => root.render(<AvpEvidencePanel kind="aso" />));
  const trigger = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === "Comparar vias"
  )!;
  await act(async () => trigger.click());
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const select = dialog.querySelector("select")!;
  expect(select.value).toBe("");
  const option = Array.from(select.options).find((o) => o.value !== "")!;
  await act(async () => {
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(dialog.textContent).toContain("Retorno da unidade");
  const companyRow = Array.from(dialog.querySelectorAll("tr")).find((r) =>
    r.textContent?.startsWith("Empregador informado")
  )!;
  expect(companyRow.textContent).toContain("Divergência");
  expect(companyRow.textContent).toContain("Empresa A");
  expect(companyRow.textContent).toContain("Empresa B");
  expect(dialog.textContent).toContain("Sem informação");
  const cnpjRow = Array.from(dialog.querySelectorAll("tr")).find((r) =>
    r.textContent?.startsWith("CNPJs citados")
  )!;
  expect(cnpjRow.textContent).toContain("00.000.000/0001-00, 00.000.000/0002-00");
  expect(cnpjRow.textContent).toContain("Conferir no PDF e no pedido de retificação");
  expect(dialog.textContent).toContain("SHA-256 idêntico");
  expect(dialog.textContent).toContain("Pendente de anexo");
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});
