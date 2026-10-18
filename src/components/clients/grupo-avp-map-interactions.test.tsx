import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
const m = vi.hoisted(() => ({ toast: vi.fn(), copy: vi.fn(), select: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("./avp-clinic-alternatives", () => ({
  AvpClinicAlternatives: () => <div>Alternativas para conferência</div>,
}));
import { GrupoAvpQueueMap } from "./grupo-avp-queue-map";
let v: ReturnType<typeof ui>;
const unique = [
  ...new Map(AVP_TEST_ASOS.filter((a) => a.uf === "CE").map((a) => [a.cidade, a])).values(),
];
const rows = [
  ...Array.from({ length: 20 }, (_, i) => ({
    ...unique[0],
    id: `ce-${i}`,
    colaborador: `Pessoa sintética ${i}`,
    nomeClinica: "Clínica teste A; Clínica teste B",
    telefoneClinica: "(85) 99999-9999",
    valorAso: "50,00",
    status: i === 0 ? "AGENDADO" : "NÃO INICIADO",
    urgencia: i === 0 ? "URGENTE" : "NORMAL",
  })),
  {
    ...(unique[1] || AVP_TEST_ASOS.find((a) => a.uf === "MG")!),
    id: "other",
    nomeClinica: "Clínica única",
    valorAso: "35,00",
  },
  { ...AVP_TEST_ASOS.find((a) => a.uf === "MG")!, id: "mg", nomeClinica: "", valorAso: "" },
  { ...AVP_TEST_ASOS[0], id: "unmapped", cidade: "Localidade sintética desconhecida" },
] as any[];
beforeEach(() => {
  v = ui();
  m.toast.mockReset();
  m.copy.mockReset().mockResolvedValue(undefined);
  m.select.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: m.copy },
  });
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn().mockReturnValue("blob:kml") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function render(selectedCityFilter?: string) {
  await v.render(
    <GrupoAvpQueueMap
      asos={rows}
      selectedCityFilter={selectedCityFilter}
      onSelectCityFilter={m.select}
    />
  );
}
const svg = () => v.container.querySelector<SVGSVGElement>("svg[viewBox]:not(.lucide)")!;
const box = () => svg().getAttribute("viewBox")!.split(" ").map(Number);
async function title(text: string) {
  await act(async () =>
    v.container.querySelector<HTMLButtonElement>(`button[title="${text}"]`)!.click()
  );
}
describe("AVP geographic operator interactions", () => {
  it("focuses the externally selected city and emits the selected city filter", async () => {
    await render(unique[0].cidade);
    expect(box()[2]).toBe(95);
    await v.click("Filtrar na Fila Abaixo");
    expect(m.select).toHaveBeenCalledWith(unique[0].cidade);
  });
  it("focuses a state and resets its view to the full country", async () => {
    await render();
    await v.input("select", "CE");
    expect(box()[2]).toBeLessThan(800);
    expect(v.container.textContent).toContain("Estado: CE");
    await v.input("select", "");
    expect(box()).toEqual([0, 0, 800, 800]);
  });
  it("selects and navigates cities without mixing state filters", async () => {
    await render(unique[0].cidade);
    await v.click("Focar nesta Cidade");
    expect(box()[2]).toBe(90);
    if (unique.length > 1) {
      await title("Próxima cidade deste estado");
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: expect.stringContaining(unique[1].cidade) })
      );
      await title("Cidade anterior deste estado");
      expect(m.toast).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: expect.stringContaining(unique[0].cidade) })
      );
    }
    await v.click("Ver Estado");
    expect(box()[2]).toBeGreaterThan(90);
  });
  it("filters region, search and status then clears the search", async () => {
    await render();
    await v.click("Nordeste");
    await v.input(
      'input[placeholder="Buscar Município, UF, Colaborador ou Clínica..."]',
      "does not exist"
    );
    expect(v.container.textContent).toContain("0 Polos Visíveis");
    await v.click("✕");
    expect(v.container.textContent).not.toContain("0 Polos Visíveis");
    await v.click("Fila de ASOs");
    await v.click("Urgente");
    expect(v.container.textContent).toContain("1 Polos Visíveis");
  });
  it("searches employee and clinic names in the current queue", async () => {
    await render();
    for (const search of ["Pessoa sintética 1", "Clínica teste A"]) {
      await v.input('input[placeholder="Buscar Município, UF, Colaborador ou Clínica..."]', search);
      expect(v.container.textContent).toContain("1 Polos Visíveis");
    }
  });
  it("switches cost and redundancy views without changing the real queue totals", async () => {
    await render();
    const totals = v.container.querySelector('[aria-label="Totais da fila no mapa"]')!.textContent;
    await v.click("Radar Clínicas (2+)");
    expect(v.container.textContent).toContain("Clínica");
    await v.click("Cores por custo");
    expect(v.container.querySelector('[aria-label="Totais da fila no mapa"]')!.textContent).toBe(
      totals
    );
    await v.click("Arcos Ativos");
    expect(v.button("Arcos Ocultos")).toBeDefined();
    await v.click("Arcos Ocultos");
    expect(v.button("Arcos Ativos")).toBeDefined();
  });
  it("clamps button zoom and restores a bounded country viewport", async () => {
    await render();
    for (let i = 0; i < 10; i++) await title("Aproximar Zoom (+)");
    expect(box()[2]).toBe(45);
    for (let i = 0; i < 10; i++) await title("Afastar Zoom (-)");
    expect(box()[2]).toBe(800);
    await title("Centralizar na Cidade Selecionada");
    expect(box()[2]).toBe(90);
    await title("Resetar Zoom para Brasil Completo");
    expect(box()).toEqual([0, 0, 800, 800]);
  });
  it("supports anchored wheel zoom, double-click and bounded drag", async () => {
    await render();
    vi.spyOn(svg(), "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 800,
    } as DOMRect);
    await act(async () =>
      svg().dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, clientX: 400, clientY: 400, deltaY: -100 })
      )
    );
    expect(box()[2]).toBe(656);
    await act(async () =>
      svg().dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, clientX: 400, clientY: 400, deltaY: 100 })
      )
    );
    expect(box()[2]).toBe(800);
    await act(async () =>
      svg().dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: 400, clientY: 400 }))
    );
    expect(box()[2]).toBe(440);
    await act(async () =>
      svg().dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 400, clientY: 400 })
      )
    );
    await act(async () =>
      svg().dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 500, clientY: 500 })
      )
    );
    expect(box()[0]).toBe(125);
    await act(async () => svg().dispatchEvent(new MouseEvent("mouseup", { bubbles: true })));
    await act(async () =>
      svg().dispatchEvent(
        new MouseEvent("mousemove", { bubbles: true, clientX: 700, clientY: 700 })
      )
    );
    expect(box()[0]).toBe(125);
  });
  it("lets a map state path select its state", async () => {
    await render();
    const path = [...svg().querySelectorAll("path")].find((p) =>
      p.querySelector("title")?.textContent?.includes("(CE)")
    )!;
    await act(async () => path.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    await act(async () => path.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(v.container.textContent).toContain("Estado: CE");
    await act(async () => path.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
  });
  it("copies only after clipboard success and preserves failure feedback", async () => {
    await render(unique[0].cidade);
    m.copy.mockRejectedValueOnce(Error("denied"));
    await v.click("Copiar");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível copiar" })
    );
    expect(v.button("Copiar")).toBeDefined();
    await v.click("Copiar");
    expect(m.copy).toHaveBeenLastCalledWith(expect.stringContaining("Pessoa sintética 0"));
    expect(v.button("Copiado!")).toBeDefined();
  });
  it("prepares a clinic proposal without sending a message", async () => {
    await render();
    await v.click("Proposta B2B");
    expect(m.copy).toHaveBeenCalledOnce();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Proposta B2B Copiada!" })
    );
    m.copy.mockRejectedValueOnce(Error("denied"));
    await v.click("Proposta B2B");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível copiar" })
    );
  });
  it("exports KML from the queue and revokes its temporary object URL", async () => {
    await render();
    vi.useFakeTimers();
    await v.click("Baixar KML");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    await act(async () => vi.advanceTimersByTime(1000));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:kml");
  });
});
