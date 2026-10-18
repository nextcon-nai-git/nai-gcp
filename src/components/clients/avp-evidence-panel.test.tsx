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
  amountCents: 12000,
  unitCents: 6000,
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
    (p) => p.textContent === "Exames acima de R$ 40"
  )!.parentElement!;
  expect(metric.querySelector("strong")?.textContent).toBe("2");
  expect(metric.textContent).toContain("1 pagamentos acima de R$ 40 com quantidade desconhecida");
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
