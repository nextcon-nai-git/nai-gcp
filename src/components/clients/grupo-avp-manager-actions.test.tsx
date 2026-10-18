import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
const m = vi.hoisted(() => ({
  rows: [] as GrupoAvpAso[],
  toast: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
  copy: vi.fn(),
  summary: vi.fn(),
  sync: {
    status: "CONNECTED",
    saving: false,
    conflicts: 0,
    error: "",
    checkedAt: "2026-10-18T00:00:00Z",
  },
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: { uid: "synthetic" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/hooks/use-avp-queue", () => ({
  useAvpQueue: () => ({
    asosList: m.rows,
    updateAsos: m.update,
    refresh: m.refresh,
    syncState: m.sync,
    source: { url: "https://example.com/source" },
  }),
}));
vi.mock("@/components/ui/select", async () => await import("../../../tests/ui/native-select"));
vi.mock("./grupo-avp-queue-map", () => ({ GrupoAvpQueueMap: () => null }));
vi.mock("./grupo-avp-redundancy-modal", () => ({ GrupoAvpRedundancyModal: () => null }));
vi.mock("./grupo-avp-sheet-sync-modal", () => ({ GrupoAvpSheetSyncModal: () => null }));
vi.mock("./avp-clinic-alternatives", () => ({ AvpClinicAlternatives: () => null }));
import { GrupoAvpAsoManager } from "./grupo-avp-aso-manager";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.rows = [
    {
      ...AVP_TEST_ASOS[0],
      id: "a",
      colaborador: "Pessoa Ágata",
      cidade: "Vitória",
      uf: "ES",
      valorAso: "50,00",
      responsavel: "Equipe A",
      urgencia: "URGENTE",
      nomeClinica: "Clínica teste",
      chavePix: "pix@example.com",
      telefoneClinica: "11999990000",
      enderecoClinica: "Endereço sintético",
      dataAgendada: "20/10/2026",
      oQueFazer: "Conferir",
      pixRealizado: "SIM",
    },
    {
      ...AVP_TEST_ASOS[0],
      id: "b",
      colaborador: "Pessoa Beta",
      cidade: "Curitiba",
      uf: "PR",
      status: "EXAME FEITO",
      valorAso: "30,00",
      urgencia: "NORMAL",
    },
    {
      ...AVP_TEST_ASOS[0],
      id: "c",
      colaborador: "Pessoa Gama",
      cidade: "Curitiba",
      uf: "PR",
      status: "AGENDADO",
      valorAso: "",
      urgencia: "E-MAIL",
      responsavel: "Equipe A",
    },
  ];
  m.toast.mockReset();
  m.update.mockReset().mockReturnValue(true);
  m.refresh.mockReset();
  m.summary.mockReset();
  m.copy.mockReset().mockResolvedValue(undefined);
  m.sync = {
    status: "CONNECTED",
    saving: false,
    conflicts: 0,
    error: "",
    checkedAt: "2026-10-18T00:00:00Z",
  };
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: m.copy },
  });
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn().mockReturnValue("blob:csv") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function render() {
  await v.render(<GrupoAvpAsoManager onQueueSummaryChange={m.summary} />);
}
async function select(index: number, value: string, scope: ParentNode = v.container) {
  const el = scope.querySelectorAll("select")[index];
  el.setAttribute("data-select", "current");
  await v.input('[data-select="current"]', value);
  el.removeAttribute("data-select");
}
async function title(text: string) {
  await act(async () =>
    document.querySelector<HTMLButtonElement>(`button[title="${text}"]`)!.click()
  );
}
const table = () => v.container.querySelector("tbody")!.textContent;
describe("AVP queue action review", () => {
  it("reports full metrics and filters high or unknown unit costs", async () => {
    await render();
    expect(m.summary).toHaveBeenLastCalledWith({
      total: 3,
      urgentes: 1,
      cidades: 2,
      concluidos: 1,
    });
    await v.click("Acima de R$40");
    expect(table()).toContain("Pessoa Ágata");
    expect(table()).not.toContain("Pessoa Beta");
    await v.click("Acima de R$40");
    await v.click("Sem preço único");
    expect(table()).toContain("Pessoa Gama");
    expect(table()).not.toContain("Pessoa Ágata");
  });
  it("normalizes text searches and combines status, assignee, state and priority", async () => {
    await render();
    await v.input('input[placeholder^="Buscar por colaborador"]', "agata");
    expect(table()).toContain("Pessoa Ágata");
    expect(table()).not.toContain("Pessoa Beta");
    await v.click("Limpar");
    await select(0, "URGENTES");
    expect(table()).not.toContain("Pessoa Beta");
    await select(0, "ALL");
    await select(1, "SEM_RESPONSAVEL");
    expect(table()).toContain("Pessoa Beta");
    await select(1, "Equipe A");
    await select(2, "PR");
    await select(3, "E-MAIL");
    expect(table()).toContain("Pessoa Gama");
    expect(table()).not.toContain("Pessoa Ágata");
  });
  it("paginates and resets after a filter reduces the result", async () => {
    m.rows = Array.from({ length: 27 }, (_, i) => ({
      ...m.rows[i % 3],
      id: String(i),
      colaborador: "Pessoa " + i,
    }));
    await render();
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(25);
    await v.click("Próxima");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(2);
    await v.click("Anterior");
    await select(4, "15");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(15);
    await v.click("Próxima");
    await v.input('input[placeholder^="Buscar por colaborador"]', "Pessoa 26");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(table()).toContain("Pessoa 26");
  });
  it("exports the filtered selection and revokes its download URL", async () => {
    await render();
    await v.input('input[placeholder^="Buscar por colaborador"]', "Beta");
    vi.useFakeTimers();
    await v.click("Exportar CSV (1)");
    expect(m.toast).toHaveBeenLastCalledWith({
      title: "Planilha preparada",
      description: "1 registros na seleção exportada.",
    });
    await act(async () => vi.advanceTimersByTime(1000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });
  it("reports CSV generation failure", async () => {
    await render();
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    await v.click("Exportar CSV");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível exportar", variant: "destructive" })
    );
  });
  it("waits for clipboard confirmation and reports a rejected copy", async () => {
    await render();
    const p = deferred<void>();
    m.copy.mockReturnValueOnce(p.promise);
    await title("Copiar dados para WhatsApp");
    expect(m.toast).not.toHaveBeenCalled();
    expect(m.copy).toHaveBeenCalledWith(expect.stringContaining("Pessoa Ágata"));
    await act(async () => p.resolve());
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Copiado com Sucesso! 📋" })
    );
    m.copy.mockRejectedValueOnce(new Error("denied"));
    await title("Copiar dados para WhatsApp");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível copiar", variant: "destructive" })
    );
  });
  it("uses the selected entry for its PIX copy and only acknowledges an accepted status change", async () => {
    await render();
    await title("Ver detalhes completos");
    await v.click("Copiar");
    expect(m.copy).toHaveBeenLastCalledWith("pix@example.com");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Chave PIX copiada!" })
    );
    await select(0, "EXAME FEITO", document.querySelector('[role="dialog"]')!);
    expect(m.update).toHaveBeenCalledOnce();
    expect(m.update.mock.calls[0][0](m.rows)[0].status).toBe("EXAME FEITO");
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "ASO atualizado" }));
    m.update.mockReturnValueOnce(false);
    await select(0, "REAGENDAMENTO", document.querySelector('[role="dialog"]')!);
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Alteração disponível nesta aba" })
    );
  });
  it("exposes synchronization conflicts and performs an explicit refresh", async () => {
    m.sync.error = "Fonte indisponível";
    m.sync.conflicts = 2;
    await render();
    expect(v.container.textContent).toContain("Fonte indisponível");
    expect(v.container.textContent).toContain("2 campo(s) mudaram");
    await v.click("Atualizar agora");
    expect(m.refresh).toHaveBeenCalledWith(true);
  });
});
