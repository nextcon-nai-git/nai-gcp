import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
import Page from "./page";
let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
});
afterEach(async () => view.cleanup());
it("does not turn sample beneficiaries or nonexisting attachments into an exportable guide", async () => {
  await view.render(<Page />);
  expect(view.container.textContent).not.toContain("MARCOS AURÉLIO DA SILVA");
  expect(view.container.textContent).not.toContain("laudo_medico_ocupacional.pdf");
  for (const label of ["Baixar TISS XML", "Copiar Script RPA", "Copiar Bookmarklet"])
    expect(view.button(label).disabled).toBe(true);
});
