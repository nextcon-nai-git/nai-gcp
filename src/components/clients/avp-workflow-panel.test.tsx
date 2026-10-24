import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyWorkflow } from "@/lib/avp-workflow";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: { uid: "operator", getIdToken: async () => "synthetic-token" } }),
}));
import { AvpWorkflowPanel } from "./avp-workflow-panel";
let container: HTMLDivElement, root: Root;
const person = {
  id: "campaign-1",
  name: "Pessoa Teste",
  unit: "Unidade Teste",
  admission: "2025-01-01",
  city: "Marabá",
};
const a = "a".repeat(64),
  b = "b".repeat(64);
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
function control<T extends Element>(text: string, selector: string): T {
  const label = [...container.querySelectorAll("label")].find((l) =>
    l.textContent?.trim().startsWith(text)
  );
  return label!.querySelector<T>(selector)!;
}
it.each(["ready", "delivered"] as const)(
  "invalida revisão, entrega e rascunho ao trocar ou remover PDF de caso %s",
  async (stage) => {
    const record = {
      ...emptyWorkflow(person),
      id: "case-1",
      version: 1,
      updatedAt: "2026-10-20T12:00:00Z",
      updatedBy: "operator",
      stage,
      evidenceId: a,
      documentChecked: true,
      deliveryReference: "envio antigo",
      identityChecked: true,
      socCheck: "existing-order",
      socReference: "consulta sintética",
      socOrder: "123",
      clinic: "Clínica Teste",
      clinicEmail: "clinica@example.test",
      owner: "operator",
      scheduledDate: "2026-10-20",
      attendedDate: "2026-10-20",
      dueDate: "2026-10-23",
      coordinator: "Teste",
      coordinatorEmail: "coord@example.test",
    };
    mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({ record: { ...payload.record, id: "case-1", version: 2 } })
        );
      }
      const payload = url.endsWith("periodic-control")
        ? { people: [person] }
        : url.endsWith("workflow")
          ? { records: [record] }
          : {
              records: [a, b].map((id) => ({
                id,
                kind: "aso",
                uploaded: true,
                review: "Recebido",
                employee: person.name,
                fileName: `${id}.pdf`,
              })),
            };
      return new Response(JSON.stringify(payload));
    });
    await act(async () => root.render(<AvpWorkflowPanel />));
    expect(mocks.fetch).not.toHaveBeenCalled();
    await click("Carregar campanha e acompanhamento");
    await click("Abrir caso");
    await click("Preparar entrega ao coordenador");
    expect(container.querySelector("textarea")).not.toBeNull();
    const select = control<HTMLSelectElement>("ASO recebido", "select");
    await act(async () => {
      select.value = b;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(control<HTMLInputElement>("Conferi no PDF", "input").checked).toBe(false);
    expect(control<HTMLInputElement>("Referência do envio realizado", "input").value).toBe("");
    expect(control<HTMLSelectElement>("Etapa", "select").value).toBe("review");
    expect(container.querySelector("textarea")).toBeNull();
    await click("Preparar entrega ao coordenador");
    expect(container.textContent).toContain("Salve a conferência antes de preparar a mensagem.");
    await click("Salvar acompanhamento");
    const posts = mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe("/api/clients/grupo-avp/workflow");
    expect(JSON.parse(posts[0][1].body).record).toMatchObject({
      evidenceId: b,
      stage: "review",
      documentChecked: false,
      deliveryReference: "",
    });
    await act(async () => {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(control<HTMLSelectElement>("Etapa", "select").value).toBe("waiting");
    expect(control<HTMLInputElement>("Conferi no PDF", "input").checked).toBe(false);
    expect(control<HTMLInputElement>("Referência do envio realizado", "input").value).toBe("");
    expect(mocks.fetch.mock.calls.every(([url]) => url.startsWith("/api/clients/grupo-avp/"))).toBe(
      true
    );
  }
);
