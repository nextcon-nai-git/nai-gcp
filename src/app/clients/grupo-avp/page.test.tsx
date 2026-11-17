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
vi.mock("@/components/clients/avp-scheduling-request-form", () => ({
  AvpSchedulingRequestForm: () => null,
}));
vi.mock("@/components/clients/grupo-avp-credenciamento-hub", () => ({
  GrupoAvpCredenciamentoHub: () => null,
}));
vi.mock("@/components/clients/avp-evidence-panel", () => ({
  AvpEvidencePanel: () => <div data-evidence="true" />,
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

describe("hub AVP: evidências e conferência de entregas", () => {
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
      ...Array(1500).fill({ tipoExame: "PERIÓDICO" }),
      ...Array(350).fill({ tipoExame: "Admissional" }),
      ...Array(150).fill({ tipoExame: "Demissional" }),
      { tipoExame: "Mudança de função" },
    ];
    const summary = { available: true, total: rows.length, urgentes: 0, cidades: 1, concluidos: 0 };
    await act(async () => update({ ...summary, exams: countAvpQueueExams(rows) }));
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

    await act(async () =>
      update({
        ...summary,
        total: 1,
        exams: countAvpQueueExams([{ tipoExame: "Retorno do Trabalho" }]),
      })
    );
    expect(card.querySelector("strong")?.textContent).toBe("1 ASO");
    expect(details.lastElementChild?.lastChild?.textContent).toBe("1");
    expect(card.textContent).not.toContain("fora do total");
  });
  it("inicia sem entregas presumidas e identifica marcações como conferência local", async () => {
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    expect(host.textContent).toContain("0 de 9 conferidos nesta sessão");
    expect(host.textContent).toContain("as marcações não são salvas nem comprovam entregas");
    expect(host.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    const task = host.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!;
    await act(async () => task.click());
    expect(task.getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("1 de 9 conferidos nesta sessão");
    expect(host.textContent).not.toContain("Ações Concluídas");
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
  it("exibe evidências para a operação interna da carteira AVP", async () => {
    session.role = "OPERATIONS";
    session.servedCompanies = ["GRUPO_AVP"];
    await act(async () => root.render(<GrupoAvpClientHubPage />));
    expect(host.querySelectorAll("[data-evidence]")).toHaveLength(2);
    expect(host.textContent).toContain("Pagamentos às clínicas");
  });
});
