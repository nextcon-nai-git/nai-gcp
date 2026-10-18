import React from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
import type { ExecutiveDashboard, DashboardClient } from "@/lib/executive-dashboard";
const m = vi.hoisted(() => ({
  data: null as ExecutiveDashboard | null,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(),
  select: vi.fn(),
  role: "ADMIN",
  companyId: null as string | null,
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ role: m.role, companyId: m.companyId }) }));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ activeClientId: "all", setActiveClientId: m.select }),
}));
vi.mock("@/hooks/use-executive-dashboard", () => ({ useExecutiveDashboard: () => m }));
vi.mock("./sst-journey", () => ({ SstJourney: () => null }));
import { ExecutiveDashboardView } from "./executive-dashboard";
const client = (id: string, extra: Partial<DashboardClient> = {}): DashboardClient => ({
  id,
  name: "Empresa " + id,
  location: "Vitória/ES",
  active: true,
  employees: 10,
  pgr: 1,
  risksToReview: 0,
  tasks: {
    total: 3,
    open: 2,
    completed: 1,
    overdue: 0,
    dueSoon: 1,
    undated: 0,
    unknownStatus: 0,
    priorities: [],
    truncated: false,
  },
  ...extra,
});
let v: ReturnType<typeof ui>;
function fixture(): ExecutiveDashboard {
  return {
    generatedAt: "2026-10-18T12:00:00Z",
    scope: "all",
    choices: [{ id: "a", name: "Empresa a" }],
    clients: [client("a"), client("b", { risksToReview: 2 }), client("c", { pgr: 0 })],
    avp: null,
    avpAvailable: false,
    issues: [],
    clientsTruncated: false,
  };
}
beforeEach(() => {
  v = ui();
  m.data = fixture();
  m.loading = false;
  m.error = null;
  m.role = "ADMIN";
  m.companyId = null;
  m.refresh.mockReset();
  m.select.mockReset();
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
describe("executive metrics evidence", () => {
  it("does not display unavailable metrics as confirmed zeroes", async () => {
    m.data = null;
    m.loading = true;
    await v.render(<ExecutiveDashboardView />);
    expect(v.container.querySelector('[aria-label="Carregando indicadores"]')).not.toBeNull();
    expect(v.container.textContent).toContain("—");
  });
  it("shows errors and permits an explicit refresh", async () => {
    m.data = null;
    m.error = "Fonte indisponível";
    await v.render(<ExecutiveDashboardView />);
    expect(v.container.textContent).toContain("Fonte indisponível");
    await v.click("Atualizar indicadores");
    expect(m.refresh).toHaveBeenCalledOnce();
  });
  it("filters attention and searches the client portfolio", async () => {
    await v.render(<ExecutiveDashboardView />);
    expect(v.container.textContent).toContain("Avaliação pendente");
    expect(v.container.textContent).toContain("Sem PGR registrado");
    await v.click("Só prazos vencidos e avaliações");
    expect(v.container.querySelector("tbody")?.textContent).toContain("Empresa b");
    expect(v.container.querySelector("tbody")?.textContent).not.toContain("Empresa a");
    await v.input('input[aria-label="Buscar cliente na carteira"]', "not found");
    expect(v.container.querySelector("tbody")?.textContent || "").not.toContain("Empresa b");
  });
  it("changes the dashboard scope using registered client options", async () => {
    await v.render(<ExecutiveDashboardView />);
    await v.input('select[aria-label="Cliente do painel"]', "a");
    expect(m.select).toHaveBeenCalledWith("a");
  });
  it("marks partial reads and missing task data without invented totals", async () => {
    m.data!.issues = ["Leitura parcial de teste"];
    m.data!.clients[0].tasks = null;
    m.data!.clients[1].tasks!.truncated = true;
    await v.render(<ExecutiveDashboardView />);
    expect(v.container.textContent).toContain("Leitura indisponível");
    expect(v.container.textContent).toContain("Leitura parcial de teste");
  });
  it("links urgent PGR tasks to their own company and source", async () => {
    m.data!.clients[0].tasks!.overdue = 1;
    m.data!.clients[0].tasks!.priorities = [
      {
        id: "task",
        companyId: "a & b",
        companyName: "Empresa teste",
        title: "Tarefa sintética vencida",
        status: "todo",
        priority: "critical",
        dueDate: "2026-10-01",
        owner: "Responsável teste",
        overdue: true,
        sourceType: "pgr",
      },
    ];
    await v.render(<ExecutiveDashboardView />);
    expect(v.container.textContent).toContain("Prazo vencido");
    expect(
      [...v.container.querySelectorAll("a")]
        .find((a) => a.textContent?.includes("Tarefa sintética vencida"))
        ?.getAttribute("href")
    ).toBe("/action-plans?company=a%20%26%20b&source=pgr");
  });
  it("renders AVP chronology with its actual source date and invalid-date caveat", async () => {
    m.data!.avpAvailable = true;
    m.data!.avp = {
      total: 3,
      scheduled: 1,
      waiting: 2,
      completed: 0,
      cancelled: 0,
      urgentWaiting: 1,
      unknownStatus: 0,
      quoted: 2,
      missingCost: 1,
      aboveTarget: 1,
      checkedAt: "2026-10-18T12:00:00Z",
      status: "ok",
      stale: true,
      timeline: [
        { date: "2026-10-17", count: 1 },
        { date: "2026-10-18", count: 2 },
      ],
      invalidDates: 1,
      stages: [
        { label: "Agendados", count: 1, color: "#000" },
        { label: "Aguardando", count: 2, color: "#fff" },
      ],
    };
    await v.render(<ExecutiveDashboardView />);
    expect(v.container.textContent).toContain("Verificar atualização");
    expect(v.container.textContent).toContain("1 registros sem data válida");
    await v.input('select[aria-label="Período do gráfico AVP"]', "7");
    expect(
      v.container.querySelector('[aria-label^="Pedidos registrados nos últimos 7 dias: 3"]')
    ).not.toBeNull();
  });
  it("exports a source snapshot with formula-injection protection and releases its URL", async () => {
    m.data!.clients[0].name = '=HYPERLINK("evil")';
    let csvBlob: Blob | undefined;
    Object.defineProperties(URL, {
      createObjectURL: {
        configurable: true,
        value: vi.fn((b: Blob) => {
          csvBlob = b;
          return "blob:csv";
        }),
      },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    let name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      name = this.download;
    });
    await v.render(<ExecutiveDashboardView />);
    await v.click("Exportar");
    expect(name).toBe("nai-carteira-2026-10-18.csv");
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(csvBlob!);
    });
    expect(text).toContain('"\'=HYPERLINK(""evil"")"');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });
});
