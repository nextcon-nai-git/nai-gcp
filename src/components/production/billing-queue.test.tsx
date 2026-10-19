import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  billingQueueSummary,
  type BillingQueueItem,
  type BillingQueueSnapshot,
} from "@/lib/production/billing-queue";
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
import { BillingQueue } from "./billing-queue";

let host: HTMLDivElement, root: Root;
const load =
  vi.fn<(signal: AbortSignal, expectedVersion: number) => Promise<BillingQueueSnapshot>>();
const open = vi.fn();
function item(overrides: Partial<BillingQueueItem> = {}): BillingQueueItem {
  return {
    key: "r1:c1",
    recordId: "r1",
    cycleId: "c1",
    company: "Saúde Exemplo",
    cnpj: "11222333000181",
    contract: "Contrato A",
    service: "PGR",
    period: "2026-10",
    competence: "2026-10",
    revision: 0,
    owner: "José",
    due: "2026-10-20",
    origin: "delivery",
    status: "invoice",
    issues: [],
    nextAction: "Conferir a medição e registrar NF e cobrança pelo fluxo existente.",
    delivered: true,
    recurring: false,
    obligations: { total: 2, completed: 2, waived: 0 },
    measuredCents: 30000,
    invoicedCents: 10000,
    balanceCents: 20000,
    measurementApproved: true,
    financeTitleId: "",
    linkedTitle: null,
    candidateCount: 0,
    candidates: [],
    ...overrides,
  };
}
function snapshot(version = 1, items = [item()]): BillingQueueSnapshot {
  return {
    centralVersion: version,
    financeVersion: 8,
    generatedAt: "2026-10-19T12:00:00Z",
    items,
    summary: billingQueueSummary(items),
  };
}
async function render(version = 1) {
  await act(async () =>
    root.render(<BillingQueue centralVersion={version} loadSnapshot={load} onOpen={open} />)
  );
}
async function click(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(label)
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  load.mockReset().mockResolvedValue(snapshot());
  open.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("billing handoff view", () => {
  it("shows the measurement balance, evidence counts and query versions, and opens the exact cycle", async () => {
    await render();
    expect(load).toHaveBeenCalledWith(expect.any(AbortSignal), 1);
    expect(host.textContent).toContain("Saldo medido para conferência");
    expect(host.textContent?.replace(/\s/g, " ")).toContain("R$ 200,00");
    expect(host.textContent).toContain("2 obrigação(ões) concluída(s)");
    expect(host.textContent).toContain("Central v1 · ERP v8");
    expect(host.querySelector('a[href="/financial/operacoes"]')).not.toBeNull();
    await click("Conferir ciclo");
    expect(open).toHaveBeenCalledExactlyOnceWith("r1", "c1");
  });
  it("shows reasons and existing title details without presenting a new billing action", async () => {
    load.mockResolvedValue(
      snapshot(1, [
        item({
          status: "review",
          issues: ["Confira a cobertura da mensalidade."],
          recurring: true,
          candidateCount: 2,
          candidates: [
            {
              id: "t1",
              status: "submitted",
              competence: "2026-10",
              amountCents: 10000,
              source: "recurring",
            },
          ],
          financeTitleId: "linked",
          linkedTitle: {
            id: "linked",
            status: "approved",
            competence: "2026-09",
            amountCents: 10000,
            source: "manual",
          },
        }),
      ])
    );
    await render();
    expect(host.textContent).toContain("Confira a cobertura da mensalidade.");
    expect(host.textContent).toContain("Em aprovação · Recorrência · 2026-10");
    expect(host.textContent).toContain("Exibindo 1 de 2");
    expect(host.textContent).toContain("Título vinculado: linked · Aprovado · competência 2026-09");
    expect(host.textContent).toContain("Fora do saldo do indicador.");
    expect(Array.from(host.querySelectorAll("button")).map((button) => button.textContent)).toEqual(
      ["Atualizar fila", "Conferir ciclo"]
    );
  });
  it("filters by status and formatted customer document while retaining the correct record target", async () => {
    load.mockResolvedValue(
      snapshot(1, [
        item(),
        item({
          key: "r2:c2",
          recordId: "r2",
          cycleId: "c2",
          company: "Outro Cliente",
          cnpj: "12ABC34501DE35",
          status: "review",
          issues: ["Conferir contrato"],
        }),
      ])
    );
    await render();
    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = "review";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelector("tbody")!.textContent).not.toContain("Saúde Exemplo");
    const input = host.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "12.ABC.345/01DE-35"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector("tbody")!.textContent).toContain("Outro Cliente");
    await click("Conferir ciclo");
    expect(open).toHaveBeenCalledWith("r2", "c2");
    await act(async () => {
      select.value = "advance";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.textContent).toContain("Nenhum ciclo corresponde a este filtro.");
  });
  it("renders twenty rows at a time and resets the visible limit when the filter changes", async () => {
    load.mockResolvedValue(
      snapshot(
        1,
        Array.from({ length: 23 }, (_, index) =>
          item({ key: `r1:c${index}`, cycleId: `c${index}` })
        )
      )
    );
    await render();
    expect(host.querySelectorAll("tbody tr")).toHaveLength(20);
    await click("Mostrar mais 20");
    expect(host.querySelectorAll("tbody tr")).toHaveLength(23);
    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = "invoice";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelectorAll("tbody tr")).toHaveLength(20);
  });
  it("distinguishes an empty successful query from a failed query", async () => {
    load
      .mockResolvedValueOnce(snapshot(1, []))
      .mockRejectedValueOnce(new Error("ERP indisponível"));
    await render();
    expect(host.textContent).toContain(
      "Nenhum ciclo pendente de conferência de faturamento nesta consulta."
    );
    await click("Atualizar fila");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("ERP indisponível");
    expect(host.textContent).not.toContain("Nenhum ciclo pendente");
    expect(host.textContent).not.toContain("Saldo medido para conferência");
  });
  it("clears a previously successful query on refresh failure and supports retry", async () => {
    load
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new Error("Consulta interrompida"))
      .mockResolvedValueOnce(snapshot());
    await render();
    await click("Atualizar fila");
    expect(host.textContent).not.toContain("Saúde Exemplo");
    expect(host.textContent).toContain("Consulta interrompida");
    await click("Atualizar fila");
    expect(host.textContent).toContain("Saúde Exemplo");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it("hides an already displayed snapshot as soon as the workspace version changes", async () => {
    load.mockResolvedValueOnce(snapshot()).mockImplementationOnce(() => new Promise(() => {}));
    await render();
    const firstSignal = load.mock.calls[0][0];
    expect(host.textContent).toContain("Saúde Exemplo");
    await render(2);
    expect(firstSignal.aborted).toBe(true);
    expect(host.textContent).not.toContain("Saúde Exemplo");
    expect(host.textContent).not.toContain("Saldo medido para conferência");
    expect(host.textContent).toContain("Consultando a Central e o ERP");
    expect(load).toHaveBeenLastCalledWith(expect.any(AbortSignal), 2);
  });
  it("ignores an older response that arrives after the current version has loaded", async () => {
    let oldReply!: (value: BillingQueueSnapshot) => void,
      newReply!: (value: BillingQueueSnapshot) => void;
    load
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldReply = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            newReply = resolve;
          })
      );
    await render(1);
    await render(2);
    expect(load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => newReply(snapshot(2, [item({ company: "Versão atual" })])));
    await act(async () => oldReply(snapshot(1, [item({ company: "Versão antiga" })])));
    expect(host.textContent).toContain("Versão atual");
    expect(host.textContent).not.toContain("Versão antiga");
    expect(host.textContent).toContain("Central v2");
  });
  it("rejects a response containing a different Central version", async () => {
    load.mockResolvedValue(snapshot(2));
    await render(1);
    expect(host.textContent).toContain("A Central mudou. Atualize a Central");
    expect(host.textContent).not.toContain("Saúde Exemplo");
    expect(host.querySelector("table")).toBeNull();
  });
  it("aborts the request when leaving the view and does not restore late data on a new mount", async () => {
    let resolve!: (value: BillingQueueSnapshot) => void;
    load.mockImplementationOnce(
      () =>
        new Promise((reply) => {
          resolve = reply;
        })
    );
    await render();
    const signal = load.mock.calls[0][0];
    await act(async () => root.render(<p>Outra tela</p>));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(snapshot()));
    expect(host.textContent).toBe("Outra tela");
    load.mockResolvedValue(snapshot(1, []));
    await render();
    expect(host.textContent).not.toContain("Saúde Exemplo");
  });
});
