import React from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ui } from "../../../../tests/ui/harness";
import Page from "./page";

let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
});
afterEach(async () => view.cleanup());

it("does not generate client findings or confidence through the disabled audit button", async () => {
  await view.render(<Page />);
  expect(view.button("Auditar automaticamente").disabled).toBe(true);
  await view.click("Auditar automaticamente");
  expect(view.container.textContent).toContain("Auditoria automática indisponível");
  for (const invented of [
    "prensa hidráulica",
    "88 dB(A)",
    "linha 02",
    "98.4",
    "Acurácia",
    "Gemini 3.8",
    "AUDITADO",
    "Achado Protocolado",
  ])
    expect(view.container.textContent).not.toContain(invented);
  expect(view.container.querySelector("form")).toBeNull();
});
it("links to the actual inventory and document import without asserting completion", async () => {
  await view.render(<Page />);
  expect(view.container.querySelector('a[href="/risk-management"]')?.textContent).toContain(
    "Abrir inventário de riscos"
  );
  expect(view.container.querySelector('a[href="/nai-importa"]')?.textContent).toContain(
    "Abrir NAI importa"
  );
  expect(view.container.textContent).toContain("revisão pelo profissional responsável");
  expect(view.container.textContent).toContain("Nenhum achado");
});
