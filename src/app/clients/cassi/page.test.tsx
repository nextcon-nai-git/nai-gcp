import React from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ui } from "../../../../tests/ui/harness";
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsTrigger: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
import Page from "./page";
let view: ReturnType<typeof ui>;
beforeEach(() => {
  view = ui();
});
afterEach(async () => view.cleanup());
it("starts clinical fields empty and cannot issue or imply a verified certificate", async () => {
  await view.render(<Page />);
  for (const field of [
    "date",
    "time",
    "descricaoLesao",
    "diagnosticoProvavel",
    "cid",
    "provavelDuracaoDias",
  ])
    expect(view.container.querySelector<HTMLInputElement>(`#cat-${field}`)?.value).toBe("");
  expect(view.button("Imprimir / Exportar CAT").disabled).toBe(true);
  expect(view.container.textContent).not.toContain("Certificado Digital ICP-Brasil A1 Ativo");
  expect(view.container.textContent).not.toContain("Pronto para Envio à CASSI");
  await view.input("#cat-provavelDuracaoDias", "-1");
  expect(
    view.container.querySelector<HTMLInputElement>("#cat-provavelDuracaoDias")?.validity
      .rangeUnderflow
  ).toBe(true);
  await view.input("#cat-internacao", "TALVEZ");
  expect(
    view.container.querySelector<HTMLInputElement>("#cat-internacao")?.validity.patternMismatch
  ).toBe(true);
  expect(view.button("Imprimir / Exportar CAT").disabled).toBe(true);
});
