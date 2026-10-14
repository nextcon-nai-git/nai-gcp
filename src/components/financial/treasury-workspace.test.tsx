import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: null as null | { uid: string; getIdToken: () => Promise<string> },
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
import { TreasuryWorkspace } from "./treasury-workspace";
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.user = { uid: "finance-test", getIdToken: async () => "synthetic-token" };
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => root.render(<TreasuryWorkspace />));
}
async function consult() {
  const button = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Consultar Omie")
  )!;
  await act(async () => {
    button.click();
  });
}
const payload = (rows: unknown[] = []) =>
  new Response(
    JSON.stringify({
      page: 1,
      pages: 1,
      total: rows.length,
      rows,
      queriedAt: "2026-10-11T17:00:00Z",
    }),
    { status: 200 }
  );
describe("central financeira", () => {
  it("não mostra saldo zero ou consulta dados antes da ação do usuário", async () => {
    await render();
    expect(container.textContent).toContain("Consulte o Omie");
    expect(container.textContent).not.toContain("R$");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("mantém uma carteira disponível quando a outra falha", async () => {
    mocks.fetch.mockImplementation(async (url: string) =>
      url.includes("receivable")
        ? payload()
        : new Response(JSON.stringify({ error: "Serviço temporariamente indisponível" }), {
            status: 503,
          })
    );
    await render();
    await consult();
    expect(container.textContent).toContain("Carteira consultada: 0 de 0");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Serviço temporariamente"
    );
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls.every(([url]) => url.includes("status=EMABERTO"))).toBe(true);
  });
  it("exibe títulos sem fingir que o valor original é saldo disponível", async () => {
    mocks.fetch.mockImplementation(async () =>
      payload([
        {
          id: "42",
          document: "NF-TESTE",
          partyName: "CLIENTE SINTÉTICO LTDA",
          partyCode: "77",
          dueDate: "11/10/2026",
          amount: 123.45,
          status: "EMABERTO",
          category: "serviço",
        },
      ])
    );
    await render();
    await consult();
    expect(container.textContent).toContain("NF-TESTE");
    expect(container.textContent).toContain("CLIENTE SINTÉTICO LTDA");
    expect(container.textContent).toContain("Pagamentos parciais podem reduzir o saldo devido");
    expect(container.textContent).toContain("123,45");
  });
  it("descarta respostas que chegam após a troca de usuário", async () => {
    let resolve!: (value: Response) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        })
    );
    await render();
    await consult();
    mocks.user = null;
    await render();
    await act(async () => {
      resolve(
        payload([
          {
            id: "privado",
            document: "NÃO EXIBIR",
            partyCode: "77",
            dueDate: "11/10/2026",
            amount: 123,
            status: "EMABERTO",
            category: "teste",
          },
        ])
      );
    });
    expect(container.textContent).not.toContain("NÃO EXIBIR");
    expect(container.textContent).not.toContain("R$");
  });
});
