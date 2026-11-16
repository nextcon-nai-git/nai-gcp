import React, { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferred, ui } from "../../../tests/ui/harness";
import Page from "./page";

const state = vi.hoisted(() => ({
  auth: { uid: "operator" },
  profile: { role: "ADMIN", tenantId: "current", companyId: "previous" },
  quote: vi.fn(),
  write: vi.fn(),
  tasks: vi.fn(),
  toast: vi.fn(),
}));
const db = {};
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: state.auth, ...state.profile }),
  useFirestore: () => db,
  useStorage: () => null,
  useMemoFirebase: (make: () => unknown) => make(),
  useDoc: () => ({ data: state.profile }),
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => path.join("/"),
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  addDoc: state.write,
}));
vi.mock("@/hooks/use-pgr-workspace", () => ({
  useOperationalTaskList: (...args: unknown[]) => {
    state.tasks(...args);
    return { data: [], loading: false, error: "" };
  },
}));
vi.mock("@/components/commercial/nai-sales-pitch", () => ({ NaiSalesPitch: () => null }));
vi.mock("@/components/kanban/kanban-board", () => ({ KanbanBoard: () => null }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: async () => "test-token" }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/actions/nai-quote", () => ({ gerarOrcamentoComNai: state.quote }));

const result = {
  sucesso: true,
  orcamento: {
    propostaExecutiva: { apresentacao: "Proposta sintética" },
    roiEstimado: { valorEconomiaAnual: 0 },
    pacotes: [],
    cronograma: [],
    dicaEstrategica: "Revisar",
  },
};
let view: ReturnType<typeof ui>;
beforeEach(() => {
  vi.clearAllMocks();
  view = ui();
  state.quote.mockResolvedValue(result);
});
afterEach(async () => {
  await view.cleanup();
});
async function tab(label: string) {
  const item = [...view.container.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) =>
    el.textContent?.includes(label)
  )!;
  await act(async () =>
    item.dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }))
  );
}
it("transfers catalog quantities to the quotation without losing data entered in the form", async () => {
  await view.render(<Page />);
  await view.input('input[placeholder="Ex: Construção Civil"]', "Indústria");
  await tab("Gerador de Escopo");
  const trigger = [...view.container.querySelectorAll<HTMLButtonElement>("button")].find((el) =>
    el.textContent?.includes("Programas de Gestão")
  )!;
  if (trigger.getAttribute("aria-expanded") !== "true") await act(async () => trigger.click());
  const add = view.container.querySelector<HTMLButtonElement>(
    'button[aria-label="Aumentar quantidade de PGR (NR-01)"]'
  )!;
  await act(async () => {
    add.click();
    add.click();
  });
  await view.click("Configurar Proposta Final");
  expect(view.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
    "Consultoria NAI"
  );
  expect(
    view.container.querySelector<HTMLInputElement>('input[placeholder="Ex: Construção Civil"]')
      ?.value
  ).toBe("Indústria");
  const pending = deferred<unknown>();
  state.write.mockReturnValueOnce(pending.promise);
  await view.submit();
  await view.submit();
  expect(state.quote).toHaveBeenCalledTimes(1);
  expect(state.quote.mock.calls[0][0]).toMatchObject({
    setor: "Indústria",
    servicosDesejados: "PGR (NR-01) — 2 (unidade)",
  });
  expect(state.quote.mock.calls[0][0]).not.toHaveProperty("email");
  expect(state.write).toHaveBeenCalledWith(
    "companies/current/tasks",
    expect.objectContaining({ companyId: "current" })
  );
  expect(state.toast).not.toHaveBeenCalled();
  await act(async () => pending.reject(new Error("denied")));
  expect(state.toast).toHaveBeenCalledWith(
    expect.objectContaining({ description: expect.stringContaining("card não foi salvo") })
  );
  expect(view.container.textContent).toContain("Proposta sintética");
});
it("loads the authorized sales funnel only when opened", async () => {
  await view.render(<Page />);
  expect(state.tasks).not.toHaveBeenCalledWith("current", true, "commercial");
  await tab("Funil de Vendas");
  expect(state.tasks).toHaveBeenCalledWith("current", true, "commercial");
});
