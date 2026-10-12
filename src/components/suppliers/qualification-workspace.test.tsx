import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: null as null | { uid: string; getIdToken: () => Promise<string> },
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { SupplierQualificationWorkspace } from "./qualification-workspace";
import { OmieConnectorsWorkspace } from "../financial/omie-connectors-workspace";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  m.user = { uid: "admin", getIdToken: async () => "synthetic" };
  m.fetch.mockReset();
  vi.stubGlobal("fetch", m.fetch);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
describe.each([
  {
    Component: SupplierQualificationWorkspace,
    label: "Atualizar processos",
    data: { admin: true, applications: [], audit: [] },
  },
  {
    Component: OmieConnectorsWorkspace,
    label: "Atualizar painel",
    data: { suppliers: [], titles: [], exports: [] },
  },
])("authenticated new workspaces", ({ Component, label, data }) => {
  it("does not write data on open or read", async () => {
    await act(async () => root.render(<Component />));
    expect(m.fetch).not.toHaveBeenCalled();
    m.fetch.mockResolvedValue(new Response(JSON.stringify(data)));
    await act(async () => button(label).click());
    expect(m.fetch).toHaveBeenCalledOnce();
    expect(m.fetch.mock.calls[0][1].method || "GET").toBe("GET");
  });
  it("shows errors and does not invent successful results", async () => {
    m.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403 })
    );
    await act(async () => root.render(<Component />));
    await act(async () => button(label).click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Acesso negado");
  });
  it("discards an old session response", async () => {
    let resolve!: (r: Response) => void;
    m.fetch.mockReturnValue(
      new Promise<Response>((r) => {
        resolve = r;
      })
    );
    await act(async () => root.render(<Component />));
    await act(async () => button(label).click());
    m.user = null;
    await act(async () => root.render(<Component />));
    await act(async () =>
      resolve(new Response(JSON.stringify({ ...data, error: "old-session-secret" })))
    );
    expect(container.textContent).not.toContain("old-session-secret");
    expect(button(label).disabled).toBe(true);
  });
});
