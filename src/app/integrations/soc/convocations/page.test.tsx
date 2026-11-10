import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  role: "ADMIN",
  user: { uid: "admin", getIdToken: async () => "token" },
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: mocks.user, role: mocks.role, tenantId: null }),
}));
import ConvocationsPage from "./page";
import {
  convocationFields,
  summarizeConvocations,
  type ConvocationRow,
} from "@/lib/integrations/soc-convocations";
const demoRow = Object.fromEntries(convocationFields.map((field) => [field, ""])) as ConvocationRow;
demoRow.Nome = "Pessoa da base anterior";
const snapshot = {
  rows: [demoRow],
  summary: summarizeConvocations([demoRow], "2026-11-10"),
  importedAt: "2026-11-10T12:00:00Z",
  group: "GRUPO_AVP",
};
const published = { ok: true, json: async () => ({ snapshot }) };
const reload = () => host.querySelector("button")!.click();

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.role = "ADMIN";
  mocks.user = { uid: "admin", getIdToken: async () => "token" };
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ snapshot: null }) });
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
it("offers read-only operations reload without import controls", async () => {
  mocks.role = "OPERATIONS";
  await act(async () => root.render(<ConvocationsPage />));
  expect(host.querySelector('input[type="file"]')).toBeNull();
  expect(host.textContent).toContain("Recarregar base salva");
});
it("retains confirmed import success when the subsequent refresh fails", async () => {
  await act(async () => root.render(<ConvocationsPage />));
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ imported: true, summary: { rows: 42 } }),
    })
    .mockRejectedValueOnce(Error("offline"));
  const input = host.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File(["csv"], "base.csv")] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(host.textContent).toContain("Importação salva: 42 linhas");
  expect(host.textContent).toContain(
    "A importação foi salva, mas não foi possível atualizar a consulta"
  );
  expect(mocks.fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(
    1
  );
});

it("mostra ausência de base somente depois de uma leitura vazia confirmada", async () => {
  let finish!: (result: unknown) => void;
  mocks.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await act(async () => root.render(<ConvocationsPage />));
  expect(host.textContent).not.toContain("Nenhuma base importada");
  await act(async () =>
    finish({ ok: false, status: 503, json: async () => ({ error: "Indisponível" }) })
  );
  expect(host.textContent).toContain("Indisponível");
  expect(host.textContent).not.toContain("Nenhuma base importada");
  await act(async () => reload());
  expect(host.textContent).toContain("Nenhuma base importada");
});

it("remove a base anterior da tela quando a releitura perde acesso", async () => {
  mocks.fetch.mockResolvedValueOnce(published);
  await act(async () => root.render(<ConvocationsPage />));
  expect(host.textContent).toContain(demoRow.Nome);
  mocks.fetch.mockResolvedValueOnce({
    ok: false,
    status: 403,
    json: async () => ({ error: "Acesso revogado" }),
  });
  await act(async () => reload());
  expect(host.textContent).toContain("Acesso revogado");
  expect(host.textContent).not.toContain(demoRow.Nome);
  expect(host.textContent).not.toContain("Nenhuma base importada");
});

it("descarta a resposta da sessão anterior quando outra conta abre o painel", async () => {
  let finish!: (result: unknown) => void;
  mocks.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  await act(async () => root.render(<ConvocationsPage />));
  mocks.user = { uid: "other", getIdToken: async () => "other-token" };
  await act(async () => root.render(<ConvocationsPage />));
  await act(async () => finish(published));
  expect(host.textContent).toContain("Nenhuma base importada");
  expect(host.textContent).not.toContain(demoRow.Nome);
});

it("avisa se outra importação ficou ativa antes da releitura", async () => {
  await act(async () => root.render(<ConvocationsPage />));
  mocks.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ imported: true, importId: "first", summary: { rows: 42 } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshot: { ...snapshot, importId: "second" } }),
    });
  const input = host.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new File(["csv"], "teste.csv")] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  expect(host.textContent).toContain("A versão ativa mudou durante a releitura");
  expect(host.textContent).toContain(demoRow.Nome);
});
