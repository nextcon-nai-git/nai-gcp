import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const mocks = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  scope: { activeClientId: "a", isLoading: false },
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: mocks.user }) }));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => mocks.scope }));
import Page from "./page";
let view: ReturnType<typeof ui>;
const data = () => ({
  company: { id: "a", name: "Empresa sintética A" },
  generatedAt: "2026-10-18T12:00:00Z",
  issues: [],
  tasks: {
    open: 1,
    priorities: [
      {
        id: "t",
        title: "Preparar PGR",
        owner: "Operação",
        dueDate: "2026-10-10",
        status: "todo",
        overdue: true,
      },
    ],
  },
  documents: [{ id: "d", name: "Relatório sintético", type: "PGR", status: "review" }],
  requests: [
    {
      id: "p",
      title: "Pedido anterior",
      department: "documents",
      status: "doing",
      createdAt: "2026-10-10",
      priority: "high",
    },
  ],
  periodics: {
    total: 3,
    overdue: 1,
    current: 1,
    soon: 0,
    missing: 1,
    truncated: false,
    items: [
      {
        id: "1",
        name: "Ana sintética",
        department: "RH",
        dueDate: "2026-10-10",
        situation: "overdue",
      },
      {
        id: "2",
        name: "Bruno sintético",
        department: "TI",
        dueDate: "2027-01-01",
        situation: "current",
      },
      { id: "3", name: "Carla sintética", department: "RH", dueDate: null, situation: "missing" },
    ],
  },
});
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  view = ui();
  mocks.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  mocks.scope = { activeClientId: "a", isLoading: false };
  mocks.fetch.mockReset().mockResolvedValue(response(data()));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(async () => {
  await view.cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("client central workflows", () => {
  it.each(["all", "unauthorized", ""])("does not query a non-company scope %s", async (scope) => {
    mocks.scope.activeClientId = scope;
    await view.render(<Page />);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Selecione uma empresa");
  });
  it("waits for access and login", async () => {
    mocks.scope.isLoading = true;
    await view.render(<Page />);
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.scope.isLoading = false;
    mocks.user = null;
    await view.render(<Page />);
    expect(view.container.textContent).toContain("Entre no sistema");
  });
  it("shows real priorities, filters periodics and prepares the proper department", async () => {
    await view.render(<Page />);
    expect(view.container.textContent).toContain("Preparar PGR");
    await view.click("Ver prazos de periódicos");
    expect(view.container.textContent).toContain("Ana sintética");
    expect(view.container.textContent).not.toContain("Bruno sintético");
    await view.input('select[aria-label="Filtrar prazo"]', "all");
    expect(view.container.textContent).toContain("Bruno sintético");
    await view.input('input[aria-label="Buscar colaborador ou setor"]', "Carla");
    await view.click("Solicitar apoio");
    expect(document.querySelector<HTMLInputElement>("#request-title")?.value).toBe(
      "Conferir data: Carla sintética"
    );
    expect(document.querySelector<HTMLSelectElement>("#request-department")?.value).toBe(
      "registration"
    );
    expect(view.container.textContent).toContain("Pedido anterior");
  });
  it("shows documents and prepares a document request", async () => {
    await view.render(<Page />);
    await view.click("Documentos");
    expect(view.container.textContent).toContain("Relatório sintético");
    await view.click("Solicitar documento");
    expect(document.querySelector<HTMLSelectElement>("#request-department")?.value).toBe(
      "documents"
    );
  });
  it("reports partial data without turning unavailable collections into zero", async () => {
    mocks.fetch.mockResolvedValue(
      response({
        ...data(),
        tasks: null,
        periodics: null,
        documents: null,
        requests: null,
        issues: ["Fonte indisponível"],
      })
    );
    await view.render(<Page />);
    expect(view.container.textContent).toContain("Ações indisponíveis");
    await view.click("Documentos");
    expect(view.container.textContent).toContain("Acervo indisponível");
    await view.click("Solicitações");
    expect(view.container.textContent).toContain("Protocolos indisponíveis");
  });
  it("reports empty collections", async () => {
    mocks.fetch.mockResolvedValue(
      response({ ...data(), documents: [], requests: [], tasks: { open: 0, priorities: [] } })
    );
    await view.render(<Page />);
    expect(view.container.textContent).toContain("Nenhuma ação");
    await view.click("Documentos");
    expect(view.container.textContent).toContain("Nenhum relatório");
    await view.click("Solicitações");
    expect(view.container.textContent).toContain("Nenhuma solicitação");
  });
  it("recovers from read errors through refresh", async () => {
    mocks.fetch.mockResolvedValueOnce(response({ error: "Falha sintética" }, false));
    await view.render(<Page />);
    expect(view.container.textContent).toContain("Falha sintética");
    await view.click("Atualizar");
    expect(view.container.textContent).toContain("Empresa sintética A");
  });
  it("preserves request and idempotency key after failure, changes key with content", async () => {
    await view.render(<Page />);
    await view.click("Nova solicitação");
    await view.input("#request-title", "Solicitação sintética");
    await view.input("#request-description", "Descrição sintética para teste");
    await view.input("#request-priority", "high");
    mocks.fetch.mockResolvedValue(response({ error: "Falha de gravação" }, false));
    await view.submit();
    expect(view.container.textContent).toContain("Falha de gravação");
    const first = JSON.parse(mocks.fetch.mock.lastCall![1].body);
    await view.submit();
    expect(JSON.parse(mocks.fetch.mock.lastCall![1].body).requestId).toBe(first.requestId);
    await view.input("#request-description", "Descrição alterada para teste");
    await view.submit();
    expect(JSON.parse(mocks.fetch.mock.lastCall![1].body).requestId).not.toBe(first.requestId);
    expect(first).toMatchObject({ companyId: "a", priority: "high" });
  });
  it("blocks duplicate submits, waits for persistence and refreshes after success", async () => {
    await view.render(<Page />);
    await view.click("Nova solicitação");
    await view.input("#request-title", "Solicitação sintética");
    await view.input("#request-description", "Descrição sintética para teste");
    const p = deferred<unknown>();
    mocks.fetch.mockReturnValueOnce(p.promise);
    await view.submit();
    await view.submit();
    expect(mocks.fetch.mock.calls.filter((c) => c[1].method === "POST")).toHaveLength(1);
    expect(view.container.textContent).not.toContain("Solicitação recebida");
    await act(async () => p.resolve(response({ id: "p-123" })));
    expect(view.container.textContent).toContain("Protocolo: p-123");
    expect(document.querySelector<HTMLInputElement>("#request-title")?.value).toBe("");
  });
  it("does not send a request whose credentials resolve after logout", async () => {
    await view.render(<Page />);
    await view.click("Nova solicitação");
    const p = deferred<string>();
    mocks.user!.getIdToken.mockReturnValue(p.promise);
    await view.submit();
    mocks.user = null;
    await view.render(<Page />);
    await act(async () => p.resolve("old-token"));
    expect(mocks.fetch.mock.calls.filter((c) => c[1].method === "POST")).toHaveLength(0);
  });
  it("discards an old read on company switch", async () => {
    const p = deferred<unknown>();
    mocks.fetch.mockReturnValueOnce(p.promise);
    await view.render(<Page />);
    mocks.scope.activeClientId = "b";
    mocks.fetch.mockResolvedValue(response({ ...data(), company: { id: "b", name: "Empresa B" } }));
    await view.render(<Page />);
    await act(async () => p.resolve(response(data())));
    expect(view.container.textContent).toContain("Empresa B");
    expect(view.container.textContent).not.toContain("Empresa sintética A");
  });
  it("exports only filtered periodics and revokes the object URL", async () => {
    vi.useFakeTimers();
    const make = vi.fn().mockReturnValue("blob:synthetic"),
      revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: make, revokeObjectURL: revoke }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await view.render(<Page />);
    await view.click("Ver prazos de periódicos");
    await view.input('input[aria-label="Buscar colaborador ou setor"]', "Ana");
    await view.click("Exportar CSV");
    expect(make.mock.calls[0][0].size).toBeGreaterThan(50);
    await act(async () => vi.advanceTimersByTime(1000));
    expect(revoke).toHaveBeenCalledWith("blob:synthetic");
    vi.useRealTimers();
  });
});
