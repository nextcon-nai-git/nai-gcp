import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
import type { SavedLedger } from "@/lib/financial/ledger";
const m = vi.hoisted(() => ({ user: null as any, loading: false, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user, isUserLoading: m.loading }) }));
vi.mock("recharts", () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    BarChart: Box,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: Box,
    Legend: () => null,
  };
});
import { LedgerWorkspace } from "./ledger-workspace";
const row = (id: string, entry: string, side: "D" | "C", amountCents: number) => ({
  id,
  date: "2026-01-02",
  account: side === "D" ? "2.1.03.1" : "1.1.01.1",
  accountName: side === "D" ? "Fornecedores" : "Banco sintético",
  costCenter: "TEST",
  history: "Pagamento teste",
  entry,
  amountCents,
  side,
  page: 1,
  endPage: 2,
});
function fixture(): SavedLedger {
  return {
    id: "book",
    schemaVersion: 1,
    company: "Empresa sintética",
    cnpj: "00.000.000/0001-00",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    bookNumber: "1",
    sourceName: "synthetic.pdf",
    sourceSha256: "a".repeat(64),
    pageCount: 2,
    importedAt: "2026-10-18T00:00:00Z",
    importedBy: "author",
    rows: [
      row("1", "1", "D", 12345),
      row("2", "1", "C", 12345),
      {
        ...row("3", "2", "D", 90000),
        date: "2026-02-02",
        account: "1.1.01.1",
        accountName: "Banco sintético",
        history: "Recebimento teste",
      },
      {
        ...row("4", "2", "C", 90000),
        date: "2026-02-02",
        account: "1.1.02.1",
        accountName: "Clientes",
        history: "Recebimento teste",
      },
    ],
  };
}
const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status });
let v: ReturnType<typeof ui>, book: SavedLedger;
beforeEach(() => {
  v = ui();
  book = fixture();
  m.user = { uid: "author", getIdToken: vi.fn().mockResolvedValue("token") };
  m.loading = false;
  m.fetch
    .mockReset()
    .mockImplementation(async (url: string, options: any) =>
      options?.method === "POST"
        ? json({ book, alreadySaved: false })
        : url.includes("source=1")
          ? new Response("pdf")
          : url === "/api/financial/ledger"
            ? json({ books: [book] })
            : json(book)
    );
  vi.stubGlobal("fetch", m.fetch);
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn().mockReturnValue("blob:test") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render() {
  await v.render(<LedgerWorkspace />);
}
async function tab(label: string) {
  await act(async () =>
    v.button(label).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }))
  );
}
async function field(label: string, value: string) {
  const l = [...v.container.querySelectorAll("label")].find((el) =>
    el.textContent?.startsWith(label)
  );
  expect(l, label).toBeDefined();
  const el = l!.querySelector("select,input")!;
  el.setAttribute("data-test-field", "yes");
  await v.input('[data-test-field="yes"]', value);
  el.removeAttribute("data-test-field");
}
async function file(index: number, name: string, type: string) {
  const el = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[index];
  Object.defineProperty(el, "files", {
    configurable: true,
    value: [new File(["synthetic"], name, { type })],
  });
  await act(async () => el.dispatchEvent(new Event("change", { bubbles: true })));
}
describe("Ledger review interactions", () => {
  it("requires a resolved authorized user before any request", async () => {
    m.loading = true;
    await render();
    expect(m.fetch).not.toHaveBeenCalled();
    m.loading = false;
    m.user = null;
    await render();
    expect(v.container.textContent).toContain("Entre no NAI");
  });
  it("does not fetch with a token returned after logout", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValue(p.promise);
    await render();
    m.user = null;
    await render();
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("filters exact monetary amounts, dates, side, account and group", async () => {
    await render();
    await tab("Lançamentos");
    await v.click("Mais filtros");
    await field("Natureza da partida", "D");
    await field("Grupo contábil", "1");
    await field("Valor mínimo", "899.99");
    await field("Data inicial", "2026-02-01");
    await field("Data final", "2026-02-28");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(v.container.querySelector("tbody")?.textContent).toContain("Recebimento teste");
    await field("Valor mínimo", "900.01");
    expect(v.container.textContent).toContain("Nenhuma partida encontrada");
    await v.click("Limpar filtros");
    await field("Conta contábil", "2.1.03.1");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(1);
    await field("Mês", "2026-02");
    expect(v.container.textContent).toContain("Nenhuma partida encontrada");
  });
  it("searches histories and exports only the visible recorte with URL cleanup", async () => {
    await render();
    await v.input('input[placeholder^="Histórico"]', "Recebimento");
    expect(v.container.textContent).toContain("2 de 4 partidas");
    vi.useFakeTimers();
    await v.click("Exportar recorte");
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.size).toBeGreaterThan(100);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
  it("sorts and paginates records and resets the page when filters change", async () => {
    book.rows = Array.from({ length: 45 }, (_, i) => ({
      ...row("r" + i, String(i), "D", 100 + i),
      date: i < 20 ? "2026-01-01" : "2026-02-01",
    }));
    await render();
    await tab("Lançamentos");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(40);
    await v.click("Próxima página");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(5);
    await v.click("Página anterior");
    await field("Ordenação", "amount-desc");
    expect(v.container.querySelector("tbody tr")?.textContent).toContain("#44");
    await field("Ordenação", "date-asc");
    expect(v.container.querySelector("tbody tr")?.textContent).toContain("#0");
    await v.click("Próxima página");
    await field("Mês", "2026-01");
    expect(v.container.textContent).toContain("Página 1 de 1");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(20);
  });
  it("opens complete counterparties and the correct source page, then revokes the PDF", async () => {
    await render();
    await tab("Lançamentos");
    await v.click("Detalhes");
    expect(document.body.textContent).toContain("composição completa do lançamento");
    expect(document.querySelectorAll('[role="dialog"] article')).toHaveLength(2);
    await v.click("Ver página 1 (continua na 2)");
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe("blob:test#page=1");
    expect(m.fetch).toHaveBeenLastCalledWith(
      "/api/financial/ledger/book?source=1",
      expect.objectContaining({ headers: { Authorization: "Bearer token" } })
    );
    await v.cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    v = ui();
  });
  it("shows source errors without a fabricated PDF and clears the notice", async () => {
    await render();
    await tab("Conferência");
    m.fetch.mockResolvedValueOnce(json({ error: "Fonte indisponível" }, 404));
    await v.click("Consultar PDF original");
    expect(v.container.textContent).toContain("Fonte indisponível");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await v.click("Fechar aviso");
    expect(v.container.textContent).not.toContain("Fonte indisponível");
  });
  it("explores an account and checks whole entries independently of filters", async () => {
    await render();
    await tab("Razão por conta");
    await v.click("Explorar");
    expect(v.container.textContent).toContain("Diário de lançamentos");
    expect(v.container.textContent).toContain("partidas neste recorte");
    await tab("Conferência");
    expect(v.container.textContent).toContain("Todos os lançamentos fecham");
    expect(v.container.textContent).toContain("Classificação, competência");
  });
  it("lets a reviewer open an unbalanced entry", async () => {
    book.rows[0].amountCents += 1;
    await render();
    await tab("Conferência");
    await v.click("#1 · 02/01/2026");
    expect(document.body.textContent).toContain("Lançamento #1");
  });
  it("imports original source and structured data without claiming a duplicate insertion", async () => {
    await render();
    await v.click("Importar livro");
    expect(v.button("Conferir e salvar no NAI").disabled).toBe(true);
    await file(0, "synthetic.nai.json", "application/json");
    await file(1, "synthetic.pdf", "application/pdf");
    m.fetch.mockResolvedValueOnce(json({ book, alreadySaved: true }));
    await v.click("Conferir e salvar no NAI");
    const call = m.fetch.mock.calls.find(([, o]) => o?.method === "POST")!;
    expect((call[1].body as FormData).get("data")).toBeInstanceOf(File);
    expect((call[1].body as FormData).get("source")).toBeInstanceOf(File);
    expect(v.container.textContent).toContain("não gerou duplicidades");
  });
  it("preserves selected import files after a rejected upload", async () => {
    await render();
    await v.click("Importar livro");
    await file(0, "synthetic.nai.json", "application/json");
    await file(1, "synthetic.pdf", "application/pdf");
    m.fetch.mockResolvedValueOnce(json({ error: "Arquivo divergente" }, 400));
    await v.click("Conferir e salvar no NAI");
    expect(document.body.textContent).toContain("Arquivo divergente");
    expect(v.button("Conferir e salvar no NAI").disabled).toBe(false);
    await v.click("Conferir e salvar no NAI");
    expect(v.container.textContent).toContain("Livro e PDF original salvos");
  });
  it("shows and retries a read failure rather than a misleading empty ledger", async () => {
    m.fetch.mockResolvedValueOnce(new Response("bad", { status: 503 }));
    await render();
    expect(v.container.textContent).toContain("Não foi possível concluir");
    await v.click("Tentar novamente");
    expect(v.container.textContent).toContain("Empresa sintética");
    await v.click("Atualizar livro");
    expect(v.container.textContent).toContain("Empresa sintética");
  });
  it("changes the selected book and discards previous filters", async () => {
    const second = { ...book, id: "second", company: "Segunda sintética" };
    m.fetch.mockImplementation(async (url: string) =>
      url === "/api/financial/ledger"
        ? json({ books: [book, second] })
        : json(url.endsWith("second") ? second : book)
    );
    await render();
    await v.input('input[placeholder^="Histórico"]', "absent");
    await v.input("#book", "second");
    expect(v.container.textContent).toContain("Segunda sintética");
    expect(
      (v.container.querySelector('input[placeholder^="Histórico"]') as HTMLInputElement).value
    ).toBe("");
  });
  it("can filter provider payments and inspect a ranked cash movement", async () => {
    await render();
    expect(v.container.textContent).toContain("Maiores movimentações de caixa");
    await act(async () =>
      v.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    );
    expect(v.container.textContent).toContain("10 maiores pagamentos a prestadores");
    const ranked = v.container.querySelector<HTMLButtonElement>("ol button");
    expect(ranked).not.toBeNull();
    await act(async () => ranked!.click());
    expect(document.body.textContent).toContain("composição completa");
  });
});
