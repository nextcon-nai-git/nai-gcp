import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ user: null as any, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { AvpEvidencePanel } from "./avp-evidence-panel";
const payment = {
  kind: "payment",
  sourceHash: "c".repeat(64),
  transactionId: "TEST-TXN",
  id: "a".repeat(64),
  clinic: "Clínica sintética",
  date: "2026-10-18",
  amountCents: 12000,
  unitCents: 6000,
  quantity: 2,
  confirmation: "Comprovante",
  scope: "AVP",
  notes: "",
  source: "Fonte sintética",
  employees: "",
  city: "Vitória",
  uf: "ES",
};
const aso = {
  kind: "aso",
  sourceHash: "d".repeat(64),
  fileHash: "e".repeat(64),
  id: "b".repeat(64),
  employee: "Pessoa sintética",
  company: "Empresa sintética",
  examType: "Admissional",
  examDate: "2026-10-18",
  receivedDate: "2026-10-18",
  fileName: "synthetic.pdf",
  review: "Recebido",
  source: "Fonte sintética",
  notes: "",
  city: "Vitória",
  uf: "ES",
};
const json = (value: any, status = 200) => new Response(JSON.stringify(value), { status });
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token") };
  m.fetch.mockReset().mockResolvedValue(json({ records: [], nextCursor: null }));
  vi.stubGlobal("fetch", m.fetch);
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn().mockReturnValue("blob:pdf") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(kind: "payment" | "aso" = "payment") {
  await v.render(<AvpEvidencePanel kind={kind} />);
}
async function files(index: number, list: File[]) {
  const input = v.container.querySelectorAll<HTMLInputElement>('input[type="file"]')[index];
  Object.defineProperty(input, "files", { configurable: true, value: list });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}
function indexFile(records: any[]) {
  const f = new File(["json"], "index.json", { type: "application/json" });
  Object.defineProperty(f, "text", {
    configurable: true,
    value: () => Promise.resolve(JSON.stringify({ records })),
  });
  return f;
}
describe("AVP evidence import and session boundaries", () => {
  it("previews a valid index and persists only after confirmation", async () => {
    await render();
    await files(0, [indexFile([payment])]);
    expect(m.fetch).toHaveBeenCalledOnce();
    expect(v.container.textContent).toContain("Nenhum registro foi salvo ainda");
    m.fetch
      .mockResolvedValueOnce(json({ added: 1, unchanged: 0 }))
      .mockResolvedValueOnce(json({ records: [payment] }));
    await v.click("Salvar 1 evidências");
    expect(JSON.parse(m.fetch.mock.calls[1][1].body)).toEqual({ records: [payment] });
    expect(v.container.textContent).toContain("Importação confirmada: 1 salvos");
  });
  it("preserves a confirmed write even when readback fails", async () => {
    await render();
    await files(0, [indexFile([payment])]);
    m.fetch
      .mockResolvedValueOnce(json({ added: 1, unchanged: 0 }))
      .mockResolvedValueOnce(json({ error: "offline" }, 503));
    await v.click("Salvar 1 evidências");
    expect(v.container.textContent).toContain("Importação confirmada: 1 salvos");
    expect(v.container.textContent).toContain("Não foi possível atualizar");
  });
  it("reports a failed import without discarding its retryable index", async () => {
    await render();
    await files(0, [indexFile([payment])]);
    m.fetch.mockResolvedValueOnce(json({ error: "Rejected" }, 400));
    await v.click("Salvar 1 evidências");
    expect(v.container.textContent).toContain("0 salvos nesta tentativa. Rejected");
    expect(v.button("Salvar 1 evidências").disabled).toBe(false);
  });
  it("rejects duplicate IDs and oversized index files", async () => {
    await render();
    await files(0, [indexFile([payment, payment])]);
    expect(v.container.textContent).toContain("IDs repetidos");
    const big = indexFile([payment]);
    Object.defineProperty(big, "size", { value: 5000001 });
    await files(0, [big]);
    expect(v.container.textContent).toContain("excede 5 MB");
    expect(m.fetch).toHaveBeenCalledOnce();
  });
  it("does not import one kind into the other panel", async () => {
    await render("aso");
    await files(0, [indexFile([payment, aso])]);
    expect(v.button("Salvar 1 evidências")).toBeDefined();
    expect(v.container.textContent).toContain("Pessoa sintética");
  });
  it("detects repeated pagination cursors instead of looping or showing partial totals", async () => {
    m.fetch.mockImplementation(async () => json({ records: [payment], nextCursor: "same" }));
    await render();
    expect(m.fetch).toHaveBeenCalledTimes(2);
    expect(v.container.textContent).toContain("Paginação inconsistente");
    expect(v.container.querySelector("tbody")?.textContent || "").not.toContain(
      "Clínica sintética"
    );
  });
  it("clears private records when access is revoked", async () => {
    m.fetch.mockResolvedValueOnce(json({ records: [payment] }));
    await render();
    expect(v.container.textContent).toContain("Clínica sintética");
    m.fetch.mockResolvedValueOnce(json({ error: "Revoked" }, 403));
    await v.click("Atualizar evidências");
    expect(v.container.textContent).not.toContain("Clínica sintética");
    expect(v.container.textContent).toContain("Revoked");
  });
  it("does not send a query after token resolution following logout", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValue(p.promise);
    await render();
    m.user = null;
    await render();
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("does not display a late imported index from the previous account", async () => {
    await render();
    const p = deferred<string>(),
      file = indexFile([payment]);
    Object.defineProperty(file, "text", { value: () => p.promise, configurable: true });
    await files(0, [file]);
    m.user = { uid: "b", getIdToken: async () => "b" };
    await render();
    await act(async () => p.resolve(JSON.stringify({ records: [payment] })));
    expect(v.container.textContent).not.toContain("Clínica sintética");
  });
  it("does not refresh or report the old import after account change", async () => {
    await render();
    await files(0, [indexFile([payment])]);
    const p = deferred<Response>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Salvar 1 evidências");
    m.user = null;
    await render();
    const calls = m.fetch.mock.calls.length;
    await act(async () => p.resolve(json({ added: 1, unchanged: 0 })));
    expect(m.fetch).toHaveBeenCalledTimes(calls);
    expect(v.container.textContent).not.toContain("Importação confirmada");
  });
  it("attaches only files with a matching index and reports missing matches", async () => {
    m.fetch.mockResolvedValueOnce(json({ records: [aso] }));
    await render("aso");
    m.fetch
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ records: [aso] }));
    await files(1, [
      new File(["pdf"], "synthetic.pdf", { type: "application/pdf" }),
      new File(["pdf"], "missing.pdf", { type: "application/pdf" }),
    ]);
    const form = m.fetch.mock.calls[1][1].body as FormData;
    expect(form.get("id")).toBe(aso.id);
    expect(v.container.textContent).toContain("1 PDFs anexados com confirmação");
    expect(v.container.textContent).toContain("missing.pdf: sem índice");
  });
  it("reports an attachment failure and never claims success for it", async () => {
    m.fetch.mockResolvedValueOnce(json({ records: [aso] }));
    await render("aso");
    m.fetch
      .mockResolvedValueOnce(json({ error: "Upload denied" }, 403))
      .mockResolvedValueOnce(json({ records: [aso] }));
    await files(1, [new File(["pdf"], "synthetic.pdf", { type: "application/pdf" })]);
    expect(v.container.textContent).toContain("0 PDFs anexados com confirmação");
    expect(v.container.textContent).toContain("Upload denied");
  });
  it("does not create a downloadable PDF after the account changes", async () => {
    m.fetch.mockResolvedValueOnce(json({ records: [{ ...aso, uploaded: true }] }));
    await render("aso");
    const p = deferred<Response>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Abrir ASO");
    m.user = null;
    await render("aso");
    await act(async () => p.resolve(new Response("private")));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("filters accents and compares per-exam price separately from payment total", async () => {
    m.fetch.mockResolvedValueOnce(
      json({
        records: [
          payment,
          { ...payment, id: "c".repeat(64), clinic: "Outra clínica", unitCents: 3000 },
        ],
      })
    );
    await render();
    await v.input('input[aria-label="Buscar evidência"]', "clinica");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(2);
    await act(async () =>
      v.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    );
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(1);
    await v.input('select[aria-label="Base do semáforo"]', "total");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(2);
    await v.click("Exportar pagamentos");
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });
});
