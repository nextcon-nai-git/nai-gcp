import React, { act } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ui } from "../../../../tests/ui/harness";
const m = vi.hoisted(() => ({ toast: vi.fn(), copy: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/cassi-contract-data", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/cassi-contract-data")>();
  return {
    ...original,
    CASSI_OFFICIAL_CONTRACT: {
      ...original.CASSI_OFFICIAL_CONTRACT,
      bbKitAmbulatorial: {
        ...original.CASSI_OFFICIAL_CONTRACT.bbKitAmbulatorial,
        mandatoryItems: ["Equipamento sintético sujeito a conferência"],
      },
    },
    HEALTH_OPERATION_CARDS: [
      {
        id: "synthetic-service",
        serviceType: "Modalidade sintética",
        category: "RETORNO",
        tissCode: "synthetic-code",
        contractPrice: 1,
        slaLimit: "Prazo contratual de teste",
        priority: "NORMAL",
        description: "Referência de serviço usada somente no teste.",
        requirements: ["Conferir evidência sintética"],
      },
    ],
  };
});
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabsTrigger: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
import Page from "./page";
let view: ReturnType<typeof ui>;
let clipboard: PropertyDescriptor | undefined;
beforeEach(() => {
  m.toast.mockReset();
  m.copy.mockReset().mockResolvedValue(undefined);
  clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: m.copy },
  });
  view = ui();
});
afterEach(async () => {
  await view.cleanup();
  if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});
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
it("blocks unsupported order actions without inventing an order, delivery or SLA", async () => {
  await view.render(<Page />);
  const actions = [...view.container.querySelectorAll<HTMLButtonElement>("button")].filter(
    (button) => /Nova Ordem de Atendimento|Registrar Atendimento/.test(button.textContent || "")
  );
  expect(actions.length).toBeGreaterThan(1);
  for (const button of actions) expect(button.disabled).toBe(true);
  await act(async () => {
    for (const button of actions) button.click();
  });
  expect(m.toast).not.toHaveBeenCalled();
  expect(view.container.querySelector('input[placeholder="Nome completo do bancário"]')).toBeNull();
  expect(view.container.textContent).toContain("Operação CASSI não integrada nesta página");
  expect(view.container.textContent).toContain("SLA não apurado");
  for (const unsupported of [
    "Concluir D0",
    "Ordem de Atendimento Criada!",
    "Devolutiva enviada à CASSI",
    "SLA D0 Cumprido!",
    "0 devolutivas no mesmo dia",
    "0 Casos Acolhidos",
    "Calibrado / OK",
  ])
    expect(view.container.textContent).not.toContain(unsupported);
});
it("preserves contractual references, the CAT draft and implemented navigation", async () => {
  await view.render(<Page />);
  expect(view.container.textContent).toContain("Tabela de Preços & Faturamento TISS");
  expect(view.container.textContent).toContain("Rascunho — emissão indisponível");
  expect(view.container.textContent).toContain("Equipamento sintético sujeito a conferência");
  expect(view.container.textContent).toContain("Exigência contratual");
  expect(view.container.querySelector('a[href="/aso-scheduler"]')?.textContent).toContain(
    "Abrir agendador interno de ASOs"
  );
  expect(view.container.querySelector('a[href="/cassi-billing"]')).not.toBeNull();
  expect(view.button("Imprimir / Exportar CAT").disabled).toBe(true);
});
it("confirms copying bank details only after the clipboard acknowledges", async () => {
  let resolveCopy!: () => void;
  m.copy.mockReturnValue(new Promise<void>((resolve) => (resolveCopy = resolve)));
  await view.render(<Page />);
  await view.click("Conta BB (Ag 3722 / CC 13005630-6)");
  expect(m.copy).toHaveBeenCalledOnce();
  expect(m.toast).not.toHaveBeenCalled();
  await act(async () => resolveCopy());
  expect(m.toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Dados bancários copiados" })
  );
});
it("does not announce copied bank details when the clipboard rejects", async () => {
  m.copy.mockRejectedValue(new Error("permission denied"));
  await view.render(<Page />);
  await view.click("Conta BB (Ag 3722 / CC 13005630-6)");
  expect(m.toast).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Não foi possível copiar", variant: "destructive" })
  );
  expect(m.toast).not.toHaveBeenCalledWith(
    expect.objectContaining({ title: "Dados bancários copiados" })
  );
});
