import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAvpPeriodicControl,
  CAMPAIGN_HEADERS,
  PROVIDER_HEADERS,
  PRICE_HEADERS,
} from "@/lib/avp-periodic-control";
const session = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: async () => "test-token" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
}));
vi.mock("@/firebase", () => ({ useUser: () => session }));
import { AvpPeriodicControlPanel } from "./avp-periodic-control";
let root: Root, host: HTMLDivElement;
const fixture = (name = "Pessoa autorizada") => {
  const p = Array<string>(31).fill("");
  p[0] = "1";
  p[1] = "Fortaleza";
  p[2] = "CE";
  p[3] = name;
  p[4] = "00000000001";
  p[6] = "Não iniciado";
  p[22] = "01/01/2020";
  p[28] = "OK - vence na campanha";
  p[30] = "5";
  return buildAvpPeriodicControl(
    [CAMPAIGN_HEADERS, p],
    [
      PROVIDER_HEADERS,
      ["Clínica barata", "", "00000000000001", "Fortaleza", "CE", "", "", "", "", "", "Sim", "2"],
      ["Clínica cara", "", "00000000000002", "Recife", "PE", "", "", "", "", "", "Sim", "3"],
    ],
    [
      PRICE_HEADERS,
      [
        "Clínica barata",
        "Fortaleza/CE",
        40,
        "Exame ocupacional / ASO",
        "Preço informado",
        "2026-10-20",
        "",
        "A",
        "00000000000001",
        "",
        "9",
      ],
      [
        "Clínica cara",
        "Recife/PE",
        50,
        "Exame ocupacional / ASO",
        "Preço informado",
        "2026-10-20",
        "",
        "B",
        "00000000000002",
        "",
        "10",
      ],
    ]
  );
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const render = async () => {
  await act(async () => root.render(<AvpPeriodicControlPanel />));
};
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.user = { uid: "a", getIdToken: async () => "test-token" };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(fixture())));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("painel de periódicos AVP", () => {
  it("filtra estritamente acima de 40 e mantém a ressalva de preço histórico", async () => {
    await render();
    await click("Clínicas e valores");
    expect(host.textContent).toContain("Clínica barata");
    expect(host.textContent).toContain("Clínica cara");
    const select = host.querySelector<HTMLSelectElement>(
      '[aria-label="Filtrar valores das clínicas"]'
    )!;
    await act(async () => {
      select.value = "above40";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.textContent).not.toContain("Clínica barata");
    expect(host.textContent).toContain("Clínica cara");
    expect(host.textContent).toContain("confirme o preço específico do periódico");
  });
  it("limpa os dados quando a autorização é revogada", async () => {
    await render();
    await click("Lista de periódicos");
    expect(host.textContent).toContain("Pessoa autorizada");
    vi.mocked(fetch).mockResolvedValueOnce(response({ error: "Acesso revogado" }, 403));
    await click("Atualizar controle");
    expect(host.textContent).toContain("Acesso revogado");
    expect(host.textContent).not.toContain("Pessoa autorizada");
  });
  it("ignora resposta tardia de outra conta e não expõe o cadastro anterior", async () => {
    await render();
    let resolveOld!: (r: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise((r) => {
        resolveOld = r;
      })
    );
    await click("Atualizar controle");
    session.user = { uid: "b", getIdToken: async () => "new-token" };
    vi.mocked(fetch).mockResolvedValueOnce(response(fixture("Pessoa da conta B")));
    await render();
    await click("Lista de periódicos");
    await act(async () => resolveOld(response(fixture("Pessoa anterior privada"))));
    expect(host.textContent).toContain("Pessoa da conta B");
    expect(host.textContent).not.toContain("Pessoa anterior privada");
  });
});

it("atualiza a consulta a cada hora enquanto aberta e interrompe após sair da conta", async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(fetch).mockImplementation(async () => response(fixture()));
    await render();
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59 * 60 * 1000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    session.user = null;
    await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain("Pessoa autorizada");
  } finally {
    vi.useRealTimers();
  }
});
