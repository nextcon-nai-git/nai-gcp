import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvpSchedulingRequestForm } from "./avp-scheduling-request-form";
const mocks = vi.hoisted(() => ({ toast: vi.fn(), copy: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.copy },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<AvpSchedulingRequestForm />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function fill(values?: Record<string, string>) {
  const defaults = {
    fullName: "Pessoa fictícia",
    birthDate: "2000-01-02",
    cpf: "cpf-de-teste",
    rg: "rg-de-teste",
    phone: "telefone-de-teste",
    email: "pessoa@example.test",
    admissionDate: "2026-10-05",
    role: "Função de teste",
    unitName: "Imperatriz / MA",
    cnpj: "cnpj-de-teste",
  };
  await act(async () => {
    for (const [name, value] of Object.entries(values ?? defaults)) {
      const input = container.querySelector<HTMLInputElement>('input[name="' + name + '"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
const click = async (text: string) => {
  const button = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === text
  )!;
  await act(async () => button.click());
};

describe("Solicitação AVP com revisão antes do envio", () => {
  it("oferece dez campos identificados e exige dados completos", async () => {
    expect(container.querySelectorAll("input")).toHaveLength(10);
    expect(container.querySelectorAll("label[for]")).toHaveLength(10);
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      true
    );
    await fill();
    await fill({ fullName: "   " });
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
      true
    );
    expect(container.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it("prepara a mensagem, mantém os dados e não simula confirmação", async () => {
    await fill();
    await click("Preparar solicitação");
    const preview = container.querySelector<HTMLTextAreaElement>("textarea")!.value;
    expect(preview).toContain("Data de nascimento: 02/01/2000");
    expect(preview).toContain("Data prevista de admissão: 05/10/2026");
    expect(preview).toContain("CPF: cpf-de-teste");
    const link = container.querySelector<HTMLAnchorElement>('a[href*="wa.me"]')!;
    expect(new URL(link.href).pathname).toBe("/5541987168938");
    expect(new URL(link.href).searchParams.get("text")).toBe(preview);
    expect(container.querySelector<HTMLInputElement>('input[name="fullName"]')!.value).toBe(
      "Pessoa fictícia"
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Solicitação preparada" })
    );
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it("usa a revisão atual ao editar os dados e ao copiar", async () => {
    await fill();
    await click("Preparar solicitação");
    await fill({ fullName: "Pessoa fictícia corrigida" });
    await click("Copiar mensagem");
    const preview = container.querySelector<HTMLTextAreaElement>("textarea")!.value;
    expect(mocks.copy).toHaveBeenCalledWith(preview);
    expect(preview).toContain("Pessoa fictícia corrigida");
    expect(
      new URL(
        container.querySelector<HTMLAnchorElement>('a[href*="wa.me"]')!.href
      ).searchParams.get("text")
    ).toBe(preview);
  });

  it("orienta cópia manual se o navegador negar o clipboard", async () => {
    mocks.copy.mockRejectedValue(new Error("Bloqueado"));
    await fill();
    await click("Preparar solicitação");
    await click("Copiar mensagem");
    expect(mocks.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Copie pelo campo de revisão" })
    );
    expect(container.querySelector("textarea")).not.toBeNull();
  });
});
