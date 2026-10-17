import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./clinical-workspace", () => ({
  default: () => <div data-area="clinical">Fila clínica autorizada</div>,
}));
vi.mock("./scheduling-workspace", () => ({
  default: () => <div data-area="scheduling">Solicitações e kits</div>,
}));

import HealthControlPage from "@/app/health-control/page";
import AsoSchedulerPage from "@/app/aso-scheduler/page";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  redirect.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("central de agendamento e clínica", () => {
  it("preserva o acesso clínico antigo e monta somente a área selecionada ao navegar", async () => {
    await act(async () =>
      root.render(await HealthControlPage({ searchParams: Promise.resolve({}) }))
    );
    expect(container.querySelector('[data-area="clinical"]')).not.toBeNull();
    expect(container.querySelector('[data-area="scheduling"]')).toBeNull();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain("Clínica");

    await act(async () =>
      root.render(
        await HealthControlPage({ searchParams: Promise.resolve({ tab: "agendamento" }) })
      )
    );
    expect(container.querySelector('[data-area="clinical"]')).toBeNull();
    expect(container.querySelector('[data-area="scheduling"]')).not.toBeNull();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain("Agendamento");

    await act(async () =>
      root.render(await HealthControlPage({ searchParams: Promise.resolve({ tab: "clinica" }) }))
    );
    expect(container.querySelector('[data-area="clinical"]')).not.toBeNull();
    expect(container.querySelector('[data-area="scheduling"]')).toBeNull();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("mantém os parâmetros existentes nos links entre áreas", async () => {
    await act(async () =>
      root.render(
        await HealthControlPage({
          searchParams: Promise.resolve({ company: "empresa & filial", tab: "agendamento" }),
        })
      )
    );
    const link = container.querySelector<HTMLAnchorElement>("a:not([aria-current])")!;
    const url = new URL(link.href);
    expect(url.pathname).toBe("/health-control");
    expect(url.searchParams.get("company")).toBe("empresa & filial");
    expect(url.searchParams.get("tab")).toBe("clinica");
  });

  it("redireciona favoritos do agendador sem perder parâmetros repetidos", async () => {
    await AsoSchedulerPage({
      searchParams: Promise.resolve({ company: "empresa-a", filter: ["a", "b"], tab: "clinica" }),
    });
    const url = new URL(redirect.mock.calls[0][0], "https://nai.example");
    expect(url.pathname).toBe("/health-control");
    expect(url.searchParams.getAll("tab")).toEqual(["agendamento"]);
    expect(url.searchParams.get("company")).toBe("empresa-a");
    expect(url.searchParams.getAll("filter")).toEqual(["a", "b"]);
  });

  it("usa a clínica para uma aba desconhecida, sem montar as solicitações", async () => {
    await act(async () =>
      root.render(await HealthControlPage({ searchParams: Promise.resolve({ tab: "invalida" }) }))
    );
    expect(container.querySelector('[data-area="clinical"]')).not.toBeNull();
    expect(container.querySelector('[data-area="scheduling"]')).toBeNull();
  });
});
