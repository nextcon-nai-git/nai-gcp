import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyFinanceBook } from "@/lib/financial/operations";
const mocks = vi.hoisted(() => ({
  user: null as null | { uid: string; getIdToken: () => Promise<string> },
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
import { FinanceOperationsWorkspace } from "./operations-workspace";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.user = { uid: "admin", getIdToken: async () => "synthetic" };
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => root.render(<FinanceOperationsWorkspace />));
}
function button(text: string) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
}
describe("financial operations UI", () => {
  it("does not invent balances before reading the authenticated book", async () => {
    await render();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("R$");
  });
  it("shows explicit failures instead of an empty successful ledger", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403 })
    );
    await render();
    await act(async () => button("Abrir controle").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Acesso negado");
    expect(container.textContent).not.toContain("Resultado gerencial registrado");
  });
  it("loads real state and exposes the workflows without changing provider data", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify(emptyFinanceBook())));
    await render();
    await act(async () => button("Abrir controle").click());
    expect(container.textContent).toContain("Resultado gerencial registrado");
    expect(container.textContent).toContain("não substitui a DRE");
    await act(async () => button("Pagar e receber").click());
    expect(button("Novo título")).toBeDefined();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][1].method).toBe("GET");
  });
  it("discards finance responses after sign out", async () => {
    let done!: (r: Response) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          done = resolve;
        })
    );
    await render();
    await act(async () => button("Abrir controle").click());
    mocks.user = null;
    await render();
    await act(async () => done(new Response(JSON.stringify(emptyFinanceBook()))));
    expect(container.textContent).toContain("Entre com seu perfil");
    expect(container.textContent).not.toContain("Resultado gerencial");
  });
});
