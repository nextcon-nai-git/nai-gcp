import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GrupoAvpAsoManager } from "@/components/clients/grupo-avp-aso-manager";
import { countAvpQueueExams } from "@/lib/avp-queue-exam-counts";
const manager = vi.hoisted(() =>
  vi.fn<(props: NonNullable<ComponentProps<typeof GrupoAvpAsoManager>>) => null>(() => null)
);
const session = vi.hoisted(() => ({
  user: { uid: "reviewer" },
  role: "SUPER_ADMIN",
  tenantId: undefined as string | undefined,
  servedCompanies: [] as string[],
}));
vi.mock("@/firebase", () => ({ useUser: () => session }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/clients/grupo-avp-aso-manager", () => ({ GrupoAvpAsoManager: manager }));
vi.mock("@/components/clients/grupo-avp-credenciamento-hub", () => ({
  GrupoAvpCredenciamentoHub: () => null,
}));
vi.mock("@/components/clients/avp-evidence-panel", () => ({
  AvpEvidencePanel: ({ kind }: { kind: string }) => <div data-evidence={kind} />,
}));
vi.mock("@/components/clients/avp-workflow-panel", () => ({
  AvpWorkflowPanel: () => <div data-workflow="true" />,
}));
vi.mock("@/components/clients/avp-periodic-control", () => ({
  AvpPeriodicControlPanel: () => <div data-periodic="true" />,
}));
vi.mock("@/components/ui/tabs", () => {
  const View = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs: View, TabsContent: View, TabsList: View, TabsTrigger: View };
});
import GrupoAvpClientHubPage from "./page";
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  session.role = "SUPER_ADMIN";
  session.tenantId = undefined;
  session.servedCompanies = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("hub AVP: navegação e evidências", () => {
  it("mostra o total dos quatro tipos e os atualiza com a fila", async () => {
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    const details = host.querySelector('dl[aria-label="ASOs por tipo de exame"]')!;
    const card = details.parentElement!;
    expect(card.querySelector("strong")?.textContent).toBe("— ASOs");
    expect([...details.querySelectorAll("dd")].map((node) => node.textContent)).toEqual(
      Array(4).fill("—")
    );

    const update = manager.mock.lastCall![0].onQueueSummaryChange!;
    const rows = [
      ...Array(350).fill({ tipoExame: "Admissional" }),
      ...Array(150).fill({ tipoExame: "Demissional" }),
      { tipoExame: "Mudança de função" },
    ];
    const summary = {
      campaign: { additional: 1500, pending: 0 },
      available: true,
      total: rows.length,
      urgentes: 0,
      cidades: 1,
      concluidos: 0,
    };
    await act(async () =>
      update({ ...summary, exams: countAvpQueueExams(rows, summary.campaign) })
    );
    expect(card.querySelector("strong")?.textContent).toBe("2.000 ASOs");
    expect(
      [...details.children].map((node) => [
        node.firstChild?.textContent,
        node.lastChild?.textContent,
      ])
    ).toEqual([
      ["Periódicos", "1.500"],
      ["Admissionais", "350"],
      ["Demissionais", "150"],
      ["Retorno ao trabalho", "0"],
    ]);
    expect(card.textContent).toContain("1 fora do total");
    expect(card.textContent).toContain("Fila e campanha de periódicos");

    await act(async () =>
      update({
        ...summary,
        campaign: null,
        total: 1,
        exams: countAvpQueueExams([{ tipoExame: "Retorno do Trabalho" }]),
      })
    );
    expect(card.querySelector("strong")?.textContent).toBe("1 ASO");
    expect(card.textContent).toContain("Parcial da fila");
    expect(details.lastElementChild?.lastChild?.textContent).toBe("1");
    expect(card.textContent).not.toContain("fora do total");
  });
  it("retira as abas de nova solicitação e workshop", async () => {
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    expect(host.textContent).not.toContain("Nova Solicitação (10 Campos)");
    expect(host.textContent).not.toContain("Alinhamento & Workshop");
    expect(host.textContent).not.toContain("Solicitação Rápida de Agendamento");
    expect(host.textContent).not.toContain("Roteiro de Conferência do Workshop");
  });
  it("não oferece evidências financeiras e ASOs ao administrador do tenant", async () => {
    session.role = "ADMIN";
    session.tenantId = "GRUPO_AVP";
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    expect(host.querySelectorAll("[data-evidence]")).toHaveLength(0);
    expect(host.textContent).not.toContain("Pagamentos às clínicas");
    expect(host.textContent).not.toContain("ASOs recebidos");
    expect(host.querySelectorAll("[data-periodic]")).toHaveLength(0);
  });
  it("abre as atividades de ASOs pelo seletor da operação interna", async () => {
    session.role = "OPERATIONS";
    session.servedCompanies = ["GRUPO_AVP"];
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    const select = host.querySelector("select")!;
    expect(Array.from(select.options, (option) => option.value)).toEqual([
      "fila",
      "periodicos",
      "workflow",
      "payments",
      "documents",
    ]);
    for (const [value, selector] of [
      ["periodicos", "[data-periodic]"],
      ["workflow", "[data-workflow]"],
      ["payments", '[data-evidence="payment"]'],
      ["documents", '[data-evidence="aso"]'],
    ]) {
      await act(async () => {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(host.querySelector(selector)).not.toBeNull();
    }
    session.role = "ADMIN";
    session.tenantId = "GRUPO_AVP";
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    expect(host.querySelector("[data-evidence]")).toBeNull();
    expect(host.querySelector("select")).toBeNull();
  });
});
