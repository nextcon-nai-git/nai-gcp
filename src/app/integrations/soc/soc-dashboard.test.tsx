import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  user: { uid: "admin", getIdToken: async () => "token" },
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
import { SocDashboard } from "./soc-dashboard";
const snapshot = {
  schemaVersion: 1,
  source: "SOC · consulta manual",
  observedAt: "2026-01-15T12:00:00Z",
  dueSoonEnd: "2026-02-14",
  inactiveExcluded: 0,
  activeCompanies: [
    { id: "101", name: "Empresa A" },
    { id: "102", name: "Empresa B" },
  ],
  reports: [],
  administrativeTasks: [],
  limitation: "Aguardando leitura.",
};
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.fetch.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ snapshot, canPublish: true, version: null }),
  });
  vi.stubGlobal("fetch", mocks.fetch);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("retains two companies prepared consecutively before the shared publication", async () => {
  await act(async () => root.render(<SocDashboard />));
  for (const [id, name] of [
    ["101", "Empresa A"],
    ["102", "Empresa B"],
  ]) {
    const select = Array.from(host.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.value === id)
    )!;
    await act(async () => {
      select.value = id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const file = new File([], "convocacao.csv");
    Object.defineProperty(file, "arrayBuffer", {
      value: async () =>
        new TextEncoder().encode(
          `CNPJ DA UNIDADE,Apelido da Empresa,UNIDADE,Exame,Refazer em,Código Funcionario,Situação\n001,${name},Matriz,Clínico,01/01/2026,1,Ativo`
        ).buffer,
    });
    const input = host.querySelector('input[type="file"][accept=".csv,text/csv"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const check = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => check.click());
    const prepare = Array.from(host.querySelectorAll("button")).find(
      (b) => b.textContent === "Preparar publicação deste resumo"
    )!;
    expect(prepare.disabled).toBe(false);
    await act(async () => prepare.click());
  }
  expect(host.textContent).toContain("Convocação: 2 empresas com resumo de exames");
  expect(host.textContent).toContain("Prévia não publicada");
  expect(mocks.fetch.mock.calls.filter(([, o]) => o?.method === "PUT")).toHaveLength(0);
});
