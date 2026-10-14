import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: null as null | { uid: string; getIdToken: () => Promise<string> },
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { SupplierQualificationWorkspace } from "./qualification-workspace";
import { OmieConnectorsWorkspace } from "../financial/omie-connectors-workspace";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  m.user = { uid: "admin", getIdToken: async () => "synthetic" };
  m.fetch.mockReset();
  vi.stubGlobal("fetch", m.fetch);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Omie session revocation and uncertain requests", () => {
  const sourceId = "00000000-0000-4000-8000-000000000001";
  const overview = {
    suppliers: [{ id: sourceId, name: "Dossiê restrito", document: "12345678000190" }],
    titles: [],
    exports: [],
  };
  async function loadPreview() {
    m.fetch.mockResolvedValueOnce(new Response(JSON.stringify(overview)));
    m.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          kind: "catalogParties",
          page: 1,
          pages: 1,
          total: 1,
          rows: [{ code: 12, name: "Cadastro restrito" }],
        })
      )
    );
    m.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          selection: { kind: "supplier", sourceId },
          payload: { razao_social: "Prévia restrita" },
          hash: "snapshot",
          company: "Empresa",
          cnpj: "12345678000190",
        })
      )
    );
    await act(async () => root.render(<OmieConnectorsWorkspace />));
    await act(async () => button("Atualizar painel").click());
    await act(async () => button("Consultar cadastro").click());
    await act(async () =>
      button("Gerar prévia")
        .closest("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
  }
  it.each([
    ["refresh", 401],
    ["refresh", 403],
    ["preview", 401],
    ["preview", 403],
  ])(
    "clears loaded financial, catalog and preview data on %s denial %s",
    async (action, status) => {
      await loadPreview();
      for (const value of ["Dossiê restrito", "Cadastro restrito", "Prévia restrita"])
        expect(container.textContent).toContain(value);
      // A denied response need not contain valid JSON for stale protected data to be cleared.
      m.fetch.mockResolvedValueOnce(new Response("Denied", { status: Number(status) }));
      await act(async () =>
        action === "refresh"
          ? button("Atualizar painel").click()
          : button("Gerar prévia")
              .closest("form")!
              .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      );
      for (const value of ["Dossiê restrito", "Cadastro restrito", "Prévia restrita"])
        expect(container.textContent).not.toContain(value);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(button("Confirmar inclusão no Omie")).toBeUndefined();
    }
  );
  it("bounds a stalled token request and ignores it if the token later arrives", async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    m.user = {
      uid: "admin",
      getIdToken: () =>
        new Promise((done) => {
          resolve = done;
        }),
    };
    await act(async () => root.render(<OmieConnectorsWorkspace />));
    await act(async () => button("Atualizar painel").click());
    await act(async () => vi.advanceTimersByTimeAsync(45001));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Tempo limite");
    expect(button("Atualizar painel").disabled).toBe(false);
    await act(async () => resolve("late-token"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("aborts an uncertain export and only reads its preserved reservation after refresh", async () => {
    await loadPreview();
    vi.useFakeTimers();
    m.fetch.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => button("Confirmar inclusão no Omie").click());
    const executeSignal = m.fetch.mock.calls[3][1].signal as AbortSignal;
    await act(async () => vi.advanceTimersByTimeAsync(45001));
    expect(executeSignal.aborted).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("confira a reserva");
    expect(button("Confirmar inclusão no Omie")).toBeUndefined();
    m.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...overview,
          exports: [
            {
              kind: "supplier",
              sourceId,
              key: "reserved-key",
              status: "pending",
              company: "Empresa",
              at: "2026-10-12T15:00:00.000Z",
              payload: { razao_social: "Prévia preservada" },
            },
          ],
        })
      )
    );
    await act(async () => button("Atualizar painel").click());
    expect(container.textContent).toContain("Sem confirmação");
    expect(container.textContent).toContain("reserved-key");
    expect(
      m.fetch.mock.calls.filter(
        (call) => call[1].body && JSON.parse(call[1].body).action === "execute"
      )
    ).toHaveLength(1);
    expect(button("Consultar resultado")).toBeDefined();
    expect(button("Gerar prévia").disabled).toBe(true);
  });
});
const button = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;
describe("supplier and export input corrections", () => {
  it.each([true, false])(
    "only shows self-registration to supplier views (reviewer=%s)",
    async (admin) => {
      m.fetch.mockResolvedValue(
        new Response(JSON.stringify({ admin, applications: [], audit: [] }))
      );
      await act(async () => root.render(<SupplierQualificationWorkspace />));
      await act(async () => button("Atualizar processos").click());
      expect(Boolean(button("Criar processo"))).toBe(!admin);
    }
  );
  it("includes the visible issue date in a financial export preview without sending it", async () => {
    const id = "00000000-0000-4000-8000-000000000001_0";
    m.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          suppliers: [],
          titles: [
            {
              id,
              kind: "payable",
              party: "Fornecedor",
              description: "Serviço",
              amountCents: 10000,
              dueDate: "2026-10-20",
              competence: "2026-09",
              externalReference: "",
            },
          ],
          exports: [],
        })
      )
    );
    await act(async () => root.render(<OmieConnectorsWorkspace />));
    await act(async () => button("Atualizar painel").click());
    const kind = [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "payable")
    )!;
    await act(async () => {
      kind.value = "payable";
      kind.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const form = button("Gerar prévia").closest("form")!;
    for (const [name, value] of Object.entries({
      sourceId: id,
      issueDate: "2026-09-30",
      partyCode: "123",
      categoryCode: "2.01",
      accountCode: "88",
    })) {
      const field = form.elements.namedItem(name) as HTMLInputElement;
      field.value = value;
    }
    m.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Prévia de teste" }), { status: 400 })
    );
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    const body = JSON.parse(m.fetch.mock.calls[1][1].body);
    expect(body).toMatchObject({
      action: "preview",
      data: { kind: "payable", sourceId: id, issueDate: "2026-09-30" },
    });
    expect(m.fetch).toHaveBeenCalledTimes(2);
  });
  it("collects complete registration fields and required characteristics before supplier preview", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    m.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          suppliers: [{ id, name: "Fornecedor", document: "12345678000190" }],
          titles: [],
          exports: [],
        })
      )
    );
    await act(async () => root.render(<OmieConnectorsWorkspace />));
    await act(async () => button("Atualizar painel").click());
    const form = button("Gerar prévia").closest("form")!;
    for (const [name, value] of Object.entries({
      sourceId: id,
      address: "Rua Sintética",
      number: "1",
      district: "Centro",
      city: "Curitiba",
      state: "pr",
      zipCode: "80000-000",
      characteristics: "Grupo = Clínica\nRegião = Sul",
    })) {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    (form.elements.namedItem("requirementsReviewed") as HTMLInputElement).checked = true;
    m.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Prévia de teste" }), { status: 400 })
    );
    await act(async () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(JSON.parse(m.fetch.mock.calls[1][1].body)).toMatchObject({
      action: "preview",
      data: {
        registration: {
          state: "PR",
          requirementsReviewed: true,
          characteristics: [
            { field: "Grupo ", value: " Clínica" },
            { field: "Região ", value: " Sul" },
          ],
        },
      },
    });
    expect(m.fetch).toHaveBeenCalledTimes(2);
  });
});
describe.each([
  {
    Component: SupplierQualificationWorkspace,
    label: "Atualizar processos",
    data: { admin: true, applications: [], audit: [] },
  },
  {
    Component: OmieConnectorsWorkspace,
    label: "Atualizar painel",
    data: { suppliers: [], titles: [], exports: [] },
  },
])("authenticated new workspaces", ({ Component, label, data }) => {
  it("does not write data on open or read", async () => {
    await act(async () => root.render(<Component />));
    expect(m.fetch).not.toHaveBeenCalled();
    m.fetch.mockResolvedValue(new Response(JSON.stringify(data)));
    await act(async () => button(label).click());
    expect(m.fetch).toHaveBeenCalledOnce();
    expect(m.fetch.mock.calls[0][1].method || "GET").toBe("GET");
  });
  it("shows errors and does not invent successful results", async () => {
    m.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403 })
    );
    await act(async () => root.render(<Component />));
    await act(async () => button(label).click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Acesso negado");
  });
  it("discards an old session response", async () => {
    let resolve!: (r: Response) => void;
    m.fetch.mockReturnValue(
      new Promise<Response>((r) => {
        resolve = r;
      })
    );
    await act(async () => root.render(<Component />));
    await act(async () => button(label).click());
    m.user = null;
    await act(async () => root.render(<Component />));
    await act(async () =>
      resolve(new Response(JSON.stringify({ ...data, error: "old-session-secret" })))
    );
    expect(container.textContent).not.toContain("old-session-secret");
    expect(button(label).disabled).toBe(true);
  });
});
