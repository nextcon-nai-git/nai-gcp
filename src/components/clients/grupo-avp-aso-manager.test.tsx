import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { GrupoAvpAsoManager } from "./grupo-avp-aso-manager";
const mocks = vi.hoisted(() => ({
  uid: "account-a",
  imported: [] as GrupoAvpAso[],
  toast: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: { uid: mocks.uid } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("./grupo-avp-queue-map", () => ({ GrupoAvpQueueMap: () => null }));
vi.mock("./grupo-avp-redundancy-modal", () => ({ GrupoAvpRedundancyModal: () => null }));
vi.mock("./grupo-avp-sheet-sync-modal", () => ({
  GrupoAvpSheetSyncModal: ({ onApplyUpdate }: { onApplyUpdate: (rows: GrupoAvpAso[]) => void }) => (
    <button onClick={() => onApplyUpdate(mocks.imported)}>Importar fila de teste</button>
  ),
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  mocks.uid = "account-a";
  mocks.imported = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = async () => {
  await act(async () => root.render(<GrupoAvpAsoManager />));
};
const importRows = async (rows: GrupoAvpAso[]) => {
  mocks.imported = rows;
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Importar fila de teste")!
      .click()
  );
};
const row = (name: string): GrupoAvpAso => ({ ...AVP_TEST_ASOS[0], id: name, colaborador: name });

describe("Fila visível após atualizações", () => {
  it("atualiza as linhas e a exportação quando a importação substitui a fila", async () => {
    await render();
    await importRows([row("Pessoa fictícia nova")]);
    expect(container.querySelector("table")!.textContent).toContain("Pessoa fictícia nova");
    await importRows([row("Pessoa fictícia corrigida")]);
    expect(container.querySelector("table")!.textContent).toContain("Pessoa fictícia corrigida");
    expect(container.querySelector("table")!.textContent).not.toContain("Pessoa fictícia nova");
  });
  it("troca o cache junto com a conta e ignora cache malformado", async () => {
    localStorage.setItem(
      "nai_grupo_avp_asos_cache:account-a",
      JSON.stringify([row("Pessoa fictícia A")])
    );
    localStorage.setItem(
      "nai_grupo_avp_asos_cache:account-b",
      JSON.stringify([row("Pessoa fictícia B")])
    );
    await render();
    expect(container.querySelector("table")!.textContent).toContain("Pessoa fictícia A");
    mocks.uid = "account-b";
    await render();
    expect(container.querySelector("table")!.textContent).toContain("Pessoa fictícia B");
    expect(container.textContent).not.toContain("Pessoa fictícia A");
    mocks.uid = "account-invalid";
    localStorage.setItem(
      "nai_grupo_avp_asos_cache:account-invalid",
      JSON.stringify([{ id: "incompleto" }])
    );
    await render();
    expect(container.textContent).not.toContain("Pessoa fictícia B");
  });
});
