import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

interface QueueTarget {
  mode: "scheduled" | "active";
  companyId: string;
  day: string;
  visibleLimit: number;
}
const state = vi.hoisted(() => ({ companyId: "company-a", targets: [] as QueueTarget[] }));
vi.mock("@/firebase", async () => {
  const React = await import("react");
  const db = {};
  return {
    useUser: () => ({ role: "ADMIN", companyId: state.companyId }),
    useFirestore: () => db,
    useMemoFirebase: React.useMemo,
    useCollection: (target: QueueTarget | null) => ({
      data: target?.mode
        ? Array.from({ length: Math.min(target.visibleLimit + 1, 75) }, (_, index) => ({
            id: `${target.mode}-${index}`,
            companyId: target.companyId,
            colaborador_id: `employee-${index}`,
            colaborador_nome: `${target.companyId} ${target.mode} ${index}`,
            status: target.mode === "active" ? "Em Atendimento" : "Agendado",
            data_hora: `${target.mode === "active" ? "2025-01-01" : target.day}T08:00:00`,
            tipo: "Periódico",
          }))
        : null,
      isLoading: false,
      error: null,
    }),
  };
});
vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
}));
vi.mock("@/services/clinical-scheduling", () => ({
  createClinicalAppointment: vi.fn(),
  advanceClinicalAppointment: vi.fn(),
}));
vi.mock("@/services/clinical-queue", async (original) => ({
  ...(await original<typeof import("@/services/clinical-queue")>()),
  clinicalQueueToday: () => "2026-10-13",
  clinicalQueueQuery: (
    _db: unknown,
    companyId: string,
    mode: QueueTarget["mode"],
    day: string,
    visibleLimit: number
  ) => {
    if (["all", "unauthorized"].includes(companyId)) return null;
    const target = { companyId, mode, day, visibleLimit };
    state.targets.push(target);
    return target;
  },
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({
    activeClientId: state.companyId,
    isGlobalStaff: false,
    authorizedCompanies: [],
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/GoogleCalendarSyncWidget", () => ({ GoogleCalendarSyncWidget: () => null }));
import HealthControl from "./page";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  state.companyId = "company-a";
  state.targets.length = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const section = (mode: QueueTarget["mode"]) =>
  container.querySelector<HTMLElement>(
    `[aria-label="${mode === "active" ? "Em espera e em atendimento" : "Agendados na data selecionada"}"]`
  )!;
const more = (mode: QueueTarget["mode"]) =>
  [...section(mode).querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Carregar mais")
  )!;
const rows = (mode: QueueTarget["mode"]) => section(mode).querySelectorAll("tbody tr").length;

describe("fila clínica: data e expansão disponíveis na interface", () => {
  it("sinaliza outros registros e expande cada fila além de 50", async () => {
    await act(async () => root.render(<HealthControl />));
    expect(rows("active")).toBe(50);
    expect(rows("scheduled")).toBe(50);
    expect(section("active").textContent).toContain("há mais");
    await act(async () => more("active").click());
    expect(rows("active")).toBe(75);
    expect(rows("scheduled")).toBe(50);
    expect(more("active")).toBeUndefined();
    await act(async () => more("scheduled").click());
    expect(rows("scheduled")).toBe(75);
    expect(more("scheduled")).toBeUndefined();
  });
  it("mudar a data reinicia somente a agenda e preserva os atendimentos abertos já carregados", async () => {
    await act(async () => root.render(<HealthControl />));
    await act(async () => {
      more("active").click();
      more("scheduled").click();
    });
    const date = container.querySelector<HTMLInputElement>("#clinical-queue-date")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        date,
        "2026-10-14"
      );
      date.dispatchEvent(new Event("input", { bubbles: true }));
      date.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(rows("active")).toBe(75);
    expect(rows("scheduled")).toBe(50);
    expect(state.targets.filter((target) => target.mode === "scheduled").at(-1)).toMatchObject({
      day: "2026-10-14",
      visibleLimit: 50,
    });
  });
  it("trocar de empresa reinicia as duas filas e remove registros da empresa anterior", async () => {
    await act(async () => root.render(<HealthControl />));
    await act(async () => more("active").click());
    state.companyId = "company-b";
    await act(async () => root.render(<HealthControl />));
    expect(rows("active")).toBe(50);
    expect(rows("scheduled")).toBe(50);
    expect(container.textContent).not.toContain("company-a active");
    expect(section("active").textContent).toContain("company-b active");
  });
  it("não apresenta busca parcial vazia como ausência total quando ainda há registros para carregar", async () => {
    await act(async () => root.render(<HealthControl />));
    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Pesquisar nos atendimentos carregados..."]'
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        search,
        "active 70"
      );
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(section("active").textContent).toContain(
      "Nenhum resultado entre os atendimentos carregados"
    );
    expect(more("active")).toBeDefined();
    await act(async () => more("active").click());
    expect(section("active").textContent).toContain("company-a active 70");
    expect(rows("active")).toBe(1);
  });
});
