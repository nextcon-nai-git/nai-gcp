import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OperatingProcedure } from "./operating-procedure";
let host: HTMLDivElement, root: Root;
const fetchSpy = vi.fn();
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function search(text: string) {
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Buscar no procedimento"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("permite consultar o manual completo e abrir etapas sem gravar nem enviar", async () => {
  await act(async () => root.render(<OperatingProcedure />));
  expect(host.querySelectorAll("details")).toHaveLength(9);
  expect(host.textContent).toContain("salvar os dados no NAI não emite NF");
  expect(host.textContent).toContain("mantenha o contrato ativo");
  expect(host.querySelectorAll("table")).toHaveLength(3);
  const link = host.querySelector<HTMLAnchorElement>('a[href="#pop-asos-avp"]')!;
  await act(async () => {
    link.click();
  });
  expect(host.querySelector<HTMLDetailsElement>("#pop-asos-avp")?.open).toBe(true);
  expect(fetchSpy).not.toHaveBeenCalled();
});
it("busca termos sem acentos e permite recuperar todas as etapas", async () => {
  await act(async () => root.render(<OperatingProcedure />));
  await search("conciliacao");
  expect(host.querySelectorAll("details").length).toBeGreaterThan(0);
  expect(host.querySelectorAll("details").length).toBeLessThan(9);
  expect([...host.querySelectorAll("details")].every((d) => d.open)).toBe(true);
  await search("termo-inexistente-12345");
  expect(host.textContent).toContain("Nenhuma seção encontrada");
  await search("");
  expect(host.querySelectorAll("details")).toHaveLength(9);
  expect(fetchSpy).not.toHaveBeenCalled();
});
