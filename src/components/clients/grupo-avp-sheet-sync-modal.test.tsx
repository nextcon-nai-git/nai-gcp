import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
import type { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { GrupoAvpSheetSyncModal } from "./grupo-avp-sheet-sync-modal";
const mocks = vi.hoisted(() => ({
  uid: "account-a",
  token: vi.fn(),
  apply: vi.fn(),
  toast: vi.fn(),
  activity: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: mocks.uid ? { uid: mocks.uid } : null }),
  useAuth: () => ({ currentUser: mocks.uid ? { uid: mocks.uid, getIdToken: mocks.token } : null }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
const url = "https://docs.google.com/spreadsheets/d/synthetic-test/edit";
const rows = [{ ...AVP_TEST_ASOS[0], numero: "1" }];
const response = () =>
  new Response(
    JSON.stringify({
      success: true,
      mergeResult: {
        success: true,
        totalParsed: 1,
        updatedCount: 1,
        addedCount: 0,
        unchangedCount: 0,
        mergedAsos: [{ ...rows[0], status: "AGENDADO" }],
        diffLog: [],
        errors: [],
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );
let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  localStorage.clear();
  mocks.uid = "account-a";
  mocks.token.mockResolvedValue("synthetic-test-token");
  fetchMock = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function saveConfig(enabled = false, extra = {}) {
  localStorage.setItem(
    "nai_grupo_avp_sheet_sync_config:account-a",
    JSON.stringify({ sheetUrl: url, autoSyncEnabled: enabled, pollInterval: 300, ...extra })
  );
}
async function render(currentAsos: GrupoAvpAso[] = rows, open = true) {
  await act(async () =>
    root.render(
      <GrupoAvpSheetSyncModal
        open={open}
        onOpenChange={() => undefined}
        currentAsos={currentAsos}
        onApplyUpdate={mocks.apply}
        onSyncActivityChange={mocks.activity}
      />
    )
  );
}
async function sync() {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent?.trim() === "Sincronizar Agora"
  )!;
  await act(async () => button.click());
}

describe("Sincronização AVP por consulta", () => {
  it("retoma imediatamente e consulta a cada cinco minutos com a fila atual", async () => {
    saveConfig(true, { lastSyncTime: "2026-10-01T00:00:00Z" });
    await render(rows, false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    const latest = [{ ...rows[0], valorAso: "30,00" }];
    await render(latest, false);
    await act(async () => vi.advanceTimersByTimeAsync(180_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).currentAsos[0].valorAso).toBe("30,00");
  });

  it("pausa em uma aba oculta e consulta ao voltar", async () => {
    saveConfig(true);
    await render(rows, false);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => vi.advanceTimersByTimeAsync(300_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não inicia consultas sobrepostas", async () => {
    saveConfig();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    await render();
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (element) => element.textContent?.trim() === "Sincronizar Agora"
    )!;
    await act(async () => {
      button.click();
      button.click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancela e descarta uma resposta após trocar a conta", async () => {
    saveConfig();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      })
    );
    await render();
    await sync();
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal;
    mocks.uid = "account-b";
    await render();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response()));
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(localStorage.getItem("nai_grupo_avp_sheet_sync_config:account-b")).toBeNull();
    expect(mocks.activity).toHaveBeenLastCalledWith(false);
  });

  it("preserva uma edição feita enquanto a resposta estava pendente", async () => {
    saveConfig();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      })
    );
    await render();
    await sync();
    await render([{ ...rows[0], responsavel: "Atendente fictício novo" }]);
    await act(async () => resolve(response()));
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("A fila foi alterada durante a consulta");
  });

  it("descarta uma resposta do link anterior", async () => {
    saveConfig();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((done) => {
        resolve = done;
      })
    );
    await render();
    await sync();
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>("#avp-sheet-url")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "https://docs.google.com/spreadsheets/d/other-test/edit"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    await act(async () => resolve(response()));
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("permite tentar novamente após expirar a consulta", async () => {
    saveConfig();
    fetchMock.mockImplementationOnce(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () => reject(options.signal!.reason), {
            once: true,
          });
        })
    );
    await render();
    await sync();
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(document.body.textContent).toContain("mais de 30 segundos");
    await sync();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.apply).toHaveBeenCalledTimes(1);
  });
  it("não sincroniza sem conta e não reaproveita configuração de outra conta", async () => {
    saveConfig(true);
    mocks.uid = "";
    await render(rows, false);
    await act(async () => vi.advanceTimersByTimeAsync(300_000));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.activity).toHaveBeenLastCalledWith(false);
  });

  it("recalcula a importação manual sobre a fila atual ao aplicar", async () => {
    await render();
    const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((element) =>
      element.textContent?.includes("Importação de Arquivo")
    )!;
    await act(async () =>
      tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    );
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        textarea,
        "Nº\tStatus\n1\tAGENDADO"
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const process = [...document.querySelectorAll<HTMLButtonElement>("button")].find((element) =>
      element.textContent?.includes("Processar Texto Colado")
    )!;
    await act(async () => process.click());
    const latest = [
      { ...rows[0], chavePix: "pix-corrigido-na-fila" },
      { ...rows[0], id: "row-added", numero: "2", colaborador: "Pessoa fictícia adicionada" },
    ];
    await render(latest);
    const apply = [...document.querySelectorAll<HTMLButtonElement>("button")].find((element) =>
      element.textContent?.includes("Aplicar Alterações na Fila")
    )!;
    await act(async () => apply.click());
    const result = mocks.apply.mock.calls[0][0] as GrupoAvpAso[];
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ status: "AGENDADO", chavePix: "pix-corrigido-na-fila" });
    expect(result[1].id).toBe("row-added");
  });
});
