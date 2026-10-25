import React, { act } from "react";
import { beforeEach, afterEach, expect, it } from "vitest";
import { ui } from "../../../../tests/ui/harness";
import Page from "./page";
let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
});
afterEach(async () => view.cleanup());
it("keeps manual observations separate from clinical scores and can reset them", async () => {
  await view.render(<Page />);
  expect(view.container.textContent).toContain("Avaliação não realizada");
  expect(view.container.textContent).not.toContain("NR-17 OK");
  await view.click("Nível 10");
  for (const input of view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    await act(async () => input.click());
  expect(view.container.textContent).toContain("Agravos selecionados: 4");
  expect(view.container.textContent).toContain("Esforço informado: 10");
  expect(view.button("Protocolar Laudo").disabled).toBe(true);
  await view.click("Limpar observações");
  expect(view.container.textContent).toContain("Agravos selecionados: 0");
  expect(view.container.textContent).toContain("Esforço informado: não informado");
});
