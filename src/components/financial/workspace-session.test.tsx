import React, { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { SavedLedger } from "@/lib/financial/ledger";
import type { SavedBalance } from "@/lib/financial/balance";
const mock = vi.hoisted(() => ({
  user: null as User | null,
  fetch: vi.fn(),
  createUrl: vi.fn(),
  revokeUrl: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mock.user, isUserLoading: false }) }));
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
vi.mock("./cash-rankings", () => ({ CashRankings: () => null }));
import { LedgerWorkspace } from "./ledger-workspace";
import { BalanceWorkspace } from "./balance-workspace";
const account = (uid: string) =>
  ({ uid, getIdToken: vi.fn().mockResolvedValue(uid) }) as unknown as User;
const ledger = (uid: string): SavedLedger => ({
  id: `ledger-${uid}`,
  schemaVersion: 1,
  company: `Empresa confidencial ${uid}`,
  cnpj: "00.000.000/0001-00",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  bookNumber: "1",
  sourceName: `original-${uid}.pdf`,
  sourceSha256: "a".repeat(64),
  pageCount: 1,
  importedAt: "2026-10-18T05:00:00Z",
  importedBy: uid,
  rows: [
    {
      id: "1",
      date: "2026-01-01",
      account: "1.1",
      accountName: "Caixa",
      costCenter: "",
      history: "Histórico de teste",
      entry: "1",
      amountCents: 10000,
      side: "D",
      page: 1,
      endPage: 1,
    },
    {
      id: "2",
      date: "2026-01-01",
      account: "2.1",
      accountName: "Capital",
      costCenter: "",
      history: "Histórico de teste",
      entry: "1",
      amountCents: 10000,
      side: "C",
      page: 1,
      endPage: 1,
    },
  ],
});
const balance = (uid: string): SavedBalance => ({
  id: `balance-${uid}`,
  company: `Empresa confidencial ${uid}`,
  cnpj: "00.000.000/0001-00",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  sourceName: `original-${uid}.pdf`,
  importedAt: "2026-10-18T05:00:00Z",
  importedBy: uid,
  rows: ["ATIVO", "PASSIVO", "PATRIMONIO LIQUIDO"].map((label) => ({
    label,
    page: 1,
    openingCents: 0,
    closingCents: 10000,
  })),
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
let host: HTMLDivElement, root: Root;
let commits: Array<{ uid: string | undefined; text: string }>;
function Capture({ kind }: { kind: "ledger" | "balance" }) {
  useLayoutEffect(() => {
    commits.push({ uid: mock.user?.uid, text: host.textContent || "" });
  });
  return kind === "ledger" ? <LedgerWorkspace /> : <BalanceWorkspace />;
}
const render = (kind: "ledger" | "balance") =>
  act(async () => root.render(<Capture kind={kind} />));
async function click(text: string) {
  const button = Array.from(document.querySelectorAll("button")).find(
    (el) => el.textContent?.trim() === text
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
async function file(index: number, value: File) {
  const input = document.querySelectorAll('input[type="file"]')[index];
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [value] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.clearAllMocks();
  mock.user = account("A");
  commits = [];
  vi.stubGlobal("fetch", mock.fetch);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: mock.createUrl, revokeObjectURL: mock.revokeUrl })
  );
  mock.createUrl.mockReturnValue("blob:test-private-pdf");
  mock.fetch.mockImplementation(async (url: string, options: RequestInit) => {
    const uid = (options.headers as Record<string, string>).Authorization.replace("Bearer ", "");
    if (url.endsWith("?source=1"))
      return new Response("pdf", { headers: { "Content-Type": "application/pdf" } });
    if (url === "/api/financial/ledger") return json({ books: [ledger(uid)] });
    if (url === "/api/financial/balances") return json({ balances: [balance(uid)] });
    return json(url.includes("balances") ? balance(uid) : ledger(uid));
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe.each(["ledger", "balance"] as const)("%s financial session isolation", (kind) => {
  it("loads the private book through the authenticated API", async () => {
    await render(kind);
    expect(host.textContent).toContain("Empresa confidencial A");
    expect(mock.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer A" } })
    );
  });
  it("never commits the previous account's book while the next account loads", async () => {
    await render(kind);
    expect(host.textContent).toContain("Empresa confidencial A");
    mock.fetch.mockReturnValue(new Promise(() => {}));
    mock.user = account("B");
    await render(kind);
    const nextCommits = commits.filter((commit) => commit.uid === "B");
    expect(nextCommits.length).toBeGreaterThan(0);
    expect(nextCommits.every((commit) => !commit.text.includes("Empresa confidencial A"))).toBe(
      true
    );
  });
  it("ignores a previous account's late detail response", async () => {
    const detail = deferred<Response>();
    mock.fetch
      .mockImplementationOnce(async () =>
        json(kind === "ledger" ? { books: [ledger("A")] } : { balances: [balance("A")] })
      )
      .mockImplementationOnce(() => detail.promise);
    await render(kind);
    mock.user = account("B");
    await render(kind);
    await act(async () => detail.resolve(json(kind === "ledger" ? ledger("A") : balance("A"))));
    expect(host.textContent).toContain("Empresa confidencial B");
    expect(host.textContent).not.toContain("Empresa confidencial A");
  });
  it("ends loading and clears records on sign-out", async () => {
    await render(kind);
    mock.user = null;
    await render(kind);
    expect(host.textContent).not.toContain("Empresa confidencial A");
    expect(host.textContent).toContain("Entre no NAI");
    expect(host.textContent).not.toContain("Carregando");
  });
  it("reports API failures without claiming an empty successful result", async () => {
    mock.fetch.mockResolvedValueOnce(json({ error: "Serviço indisponível" }, 503));
    await render(kind);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Serviço indisponível");
  });
});

describe("pending financial mutations", () => {
  it("does not refresh the old account after a ledger upload resolves following sign-out", async () => {
    await render("ledger");
    await click("Importar livro");
    await file(0, new File(["{}"], "synthetic.nai.json", { type: "application/json" }));
    await file(1, new File(["%PDF"], "synthetic.pdf", { type: "application/pdf" }));
    const pending = deferred<Response>();
    mock.fetch.mockReturnValueOnce(pending.promise);
    await click("Conferir e salvar no NAI");
    const calls = mock.fetch.mock.calls.length;
    mock.user = null;
    await render("ledger");
    await act(async () => pending.resolve(json({ book: ledger("A"), alreadySaved: false })));
    expect(mock.fetch).toHaveBeenCalledTimes(calls);
    expect(host.textContent).not.toContain("salvos no acervo");
  });
  it("revokes the balance PDF when the account changes", async () => {
    await render("balance");
    await click("Ver PDF original");
    expect(host.querySelector("iframe")?.getAttribute("src")).toContain("blob:test-private-pdf");
    mock.user = account("B");
    await render("balance");
    expect(host.querySelector("iframe")).toBeNull();
    expect(mock.revokeUrl).toHaveBeenCalledWith("blob:test-private-pdf");
  });
});
