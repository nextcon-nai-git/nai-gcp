import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVP_TEST_ASOS } from "@/__tests__/avp-test-fixture";
import { AVP_COST_BANDS } from "@/lib/avp-evidence";
import { GrupoAvpQueueMap } from "./grupo-avp-queue-map";
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const totals = () => host.querySelector('[aria-label="Totais da fila no mapa"]')?.textContent;

describe("indicadores reais no mapa AVP", () => {
  it("não mostra contagens fixas quando a fila está vazia", async () => {
    await act(async () => root.render(<GrupoAvpQueueMap asos={[]} />));
    expect(totals()).toBe("0 Agendados0 Não Iniciados0 Urgentes");
  });
  it("recalcula os totais ao receber uma nova fila, incluindo registros sem coordenadas", async () => {
    const items = [
      { ...AVP_TEST_ASOS[0], id: "one", status: "AGENDADO" as const, urgencia: "URGENTE" as const },
      {
        ...AVP_TEST_ASOS[0],
        id: "two",
        status: "NÃO INICIADO" as const,
        urgencia: "NORMAL" as const,
        cidade: "Localidade não mapeada",
        uf: "PR",
      },
      {
        ...AVP_TEST_ASOS[0],
        id: "three",
        status: "EXAME FEITO" as const,
        urgencia: "NORMAL" as const,
      },
    ];
    await act(async () => root.render(<GrupoAvpQueueMap asos={items} />));
    expect(totals()).toBe("1 Agendados1 Não Iniciados1 Urgentes");
    await act(async () => root.render(<GrupoAvpQueueMap asos={items.slice(1)} />));
    expect(totals()).toBe("0 Agendados1 Não Iniciados0 Urgentes");
  });
});

it("exibe clínica nova sem ASOs e aplica seu preço atual ao pin", async () => {
  const clinic = {
    id: "new-clinic",
    cidade: "Salvador",
    uf: "BA",
    nome: "Clínica nova de teste",
    telefone: "",
    cents: 7000,
    status: "Contraproposta",
    notes: "Condição de teste",
    source: "Fonte de teste",
    date: "2026-10-29",
  };
  await act(async () => root.render(<GrupoAvpQueueMap asos={[]} clinics={[clinic]} />));
  expect(host.textContent).toContain(clinic.nome);
  expect(host.textContent).toContain("Contraproposta");
  expect(host.querySelector(`#locality-pins circle[fill="${AVP_COST_BANDS.red.color}"]`)).not.toBeNull();
  expect(totals()).toBe("0 Agendados0 Não Iniciados0 Urgentes");
});
