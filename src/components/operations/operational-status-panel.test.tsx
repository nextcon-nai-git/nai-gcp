import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, ui } from "../../../tests/ui/harness";
import { OPERATIONS, type OperationalStatus } from "@/lib/operational-status";

const m = vi.hoisted(() => ({ user: vi.fn(), token: vi.fn(), fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: m.user }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
import { OperationalStatusPanel } from "./operational-status-panel";

let view: ReturnType<typeof ui>;
const admin = {
  user: { uid: "admin-one" },
  role: "SUPER_ADMIN",
  tenantId: null,
  companyId: null,
  isUserLoading: false,
};
const report = (): OperationalStatus => ({
  generatedAt: "2026-11-01T16:00:00.000Z",
  controls: { esocialTransmissionBlocked: true, clientEmailBlocked: true },
  operations: OPERATIONS.map((operation) => ({
    ...operation,
    configuration: { present: true, missing: [] },
    evidence: { state: "unobserved", latest: null, lastFailure: null },
  })),
});
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  vi.resetAllMocks();
  view = ui();
  m.user.mockReturnValue(admin);
  m.token.mockResolvedValue("synthetic-token");
  m.fetch.mockResolvedValue(response(report()));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await view.cleanup();
  vi.unstubAllGlobals();
});

describe("operational status panel", () => {
  it.each([
    { role: "OPERATIONS" },
    { role: "CLIENT_ADMIN", companyId: "company" },
    { role: "ADMIN", tenantId: "company" },
    { role: "HR", companyId: "company" },
    { user: null },
  ])("does not request evidence outside global administration: %j", async (change) => {
    m.user.mockReturnValue({ ...admin, ...change });
    await view.render(<OperationalStatusPanel />);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.token).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("administração global");
  });
  it("distinguishes configured invocation from evidence and displays the send blocks", async () => {
    await view.render(<OperationalStatusPanel />);
    expect(view.container.textContent).toContain("Configuração de invocação presente");
    expect(view.container.textContent).toContain("Sem execução registrada");
    expect(view.container.textContent).not.toContain("Execução registrada");
    expect(view.container.textContent).toContain("eSocial: envio bloqueado");
    expect(view.container.textContent).toContain("E-mail ao cliente: envio bloqueado");
    expect(m.fetch).toHaveBeenCalledWith(
      "/api/admin/operations",
      expect.objectContaining({
        headers: { Authorization: "Bearer synthetic-token" },
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });
  it("allows an existing global SUPER_ADMIN with the legacy internal company marker", async () => {
    m.user.mockReturnValue({ ...admin, companyId: "nextcon", tenantId: "nextcon" });
    await view.render(<OperationalStatusPanel />);
    expect(m.fetch).toHaveBeenCalledOnce();
    expect(view.container.textContent).toContain("Consultas eSocial");
  });
  it("clears old evidence when refreshing fails without exposing the server response", async () => {
    await view.render(<OperationalStatusPanel />);
    m.fetch.mockResolvedValueOnce(response({ error: "private credential" }, false));
    await view.click("Atualizar registros");
    expect(view.container.textContent).toContain("Não foi possível consultar os registros");
    expect(view.container.textContent).not.toContain("Configuração de invocação presente");
    expect(view.container.textContent).not.toContain("private credential");
  });
  it("never displays a late response belonging to a previous session", async () => {
    const first = deferred<ReturnType<typeof response>>();
    m.fetch.mockReturnValueOnce(first.promise);
    await view.render(<OperationalStatusPanel />);
    const firstSignal = m.fetch.mock.calls[0][1].signal as AbortSignal;
    m.user.mockReturnValue({ ...admin, user: { uid: "admin-two" } });
    m.fetch.mockResolvedValueOnce(response(report()));
    await view.render(<OperationalStatusPanel />);
    const old = report();
    old.operations[0].label = "Previous session marker";
    await act(async () => first.resolve(response(old)));
    expect(firstSignal.aborted).toBe(true);
    expect(view.container.textContent).not.toContain("Previous session marker");
    expect(view.container.textContent).toContain("Consultas eSocial");
  });
  it("does not issue a request after authorization disappears during token retrieval", async () => {
    const token = deferred<string>();
    m.token.mockReturnValueOnce(token.promise);
    await view.render(<OperationalStatusPanel />);
    m.user.mockReturnValue({ ...admin, role: "GUEST" });
    await view.render(<OperationalStatusPanel />);
    await act(async () => token.resolve("late-token"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("shows incomplete configuration and stale evidence without a success claim", async () => {
    const data = report();
    data.operations[0].configuration = { present: false, missing: ["Destino autenticado"] };
    data.operations[0].evidence.state = "stale";
    m.fetch.mockResolvedValueOnce(response(data));
    await view.render(<OperationalStatusPanel />);
    expect(view.container.textContent).toContain("Configuração pendente: Destino autenticado");
    expect(view.container.textContent).toContain("Registro desatualizado");
  });
  it.each([
    { checked: 1, waiting: 1, unavailable: 0 },
    { checked: 1, waiting: 0, unavailable: 1 },
    { checked: 0, waiting: 0, unavailable: 1 },
  ])("presents pending eSocial evidence without claiming a drained queue: %j", async (counters) => {
    const data = report();
    const latest = {
      schemaVersion: 1 as const,
      operation: "esocial-query" as const,
      runId: "b1111111-2222-4333-a444-555555555555",
      startedAt: "2026-11-01T15:59:59.000Z",
      finishedAt: "2026-11-01T16:00:00.000Z",
      durationMs: 1000,
      outcome: "partial" as const,
      counters,
    };
    data.operations[0].evidence = { state: "partial", latest, lastFailure: latest };
    m.fetch.mockResolvedValueOnce(response(data));
    await view.render(<OperationalStatusPanel />);
    expect(view.container.textContent).toContain("Pendências registradas");
    expect(view.container.textContent).toContain("Tentativas de consulta");
    expect(view.container.textContent).toContain("Ainda pendentes");
    expect(view.container.textContent).toContain("Indisponíveis ou incertos");
    expect(view.container.textContent).toContain("não devem ser somados");
    expect(view.container.textContent).toContain("não representam a fila inteira");
    expect(view.container.textContent).not.toContain("Execução registrada");
  });
  it("keeps the last failure visible when its evidence is stale and has no counters", async () => {
    const data = report();
    const latest = {
      schemaVersion: 1 as const,
      operation: "esocial-query" as const,
      runId: "b1111111-2222-4333-a444-555555555555",
      startedAt: "2026-11-01T14:59:59.000Z",
      finishedAt: "2026-11-01T15:00:00.000Z",
      durationMs: 1000,
      outcome: "failed" as const,
      counters: {},
    };
    data.operations[0].evidence = { state: "stale", latest, lastFailure: latest };
    m.fetch.mockResolvedValueOnce(response(data));
    await view.render(<OperationalStatusPanel />);
    expect(view.container.textContent).toContain("Registro desatualizado");
    expect(view.container.textContent).toContain("Sem registro recente nos últimos 20 minutos");
    expect(view.container.textContent).toContain("Último resultado: Falha registrada.");
    expect(view.container.textContent).not.toContain("Execução registrada");
  });
});
