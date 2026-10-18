import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
vi.mock("./soc-dashboard", () => ({ SocDashboard: () => null }));
import Page from "./page";
let v: ReturnType<typeof ui>;
const config = {
  companyIds: ["1", "2"],
  resources: {
    employees: { configured: true, format: "json" },
    companies: { configured: true, format: "json" },
    asos: { configured: true, format: "json" },
  },
};
const res = (body: unknown, ok = true) => ({ ok, json: async () => body });
const data = {
  data: [
    { id: "one", name: "Pessoa sintética A", unitId: "u1", unit: "Unidade A" },
    { id: "two", name: "Pessoa sintética B", unitId: "u2", unit: "Unidade B" },
  ],
  checkedAt: "2026-10-18T12:00:00Z",
  recorded: true,
};
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.fetch.mockReset().mockImplementation(async (u: string) => res(u.includes("?") ? data : config));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
describe("SOC direct consultation", () => {
  it("does not query before login", async () => {
    m.user = null;
    await v.render(<Page />);
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("distinguishes configured from verified and filters units", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).toContain("consulta real pendente");
    await v.click("Consultar SOC");
    expect(m.fetch.mock.lastCall![0]).toContain("companyId=1");
    expect(v.container.textContent).toContain("Resposta recebida neste acesso");
    await v.input("select:nth-of-type(1)", "2");
    expect(v.container.textContent).not.toContain("Pessoa sintética A");
    await v.click("Consultar SOC");
    const selectors = [...v.container.querySelectorAll("select")];
    expect(selectors).toHaveLength(2);
    await act(async () => {
      selectors[1].value = "u1";
      selectors[1].dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(v.container.textContent).toContain("Pessoa sintética A");
    expect(v.container.textContent).not.toContain("Pessoa sintética B");
  });
  it("keeps query disabled for unconfigured reports", async () => {
    m.fetch.mockResolvedValue(res({ ...config, resources: { employees: { configured: false } } }));
    await v.render(<Page />);
    expect(v.button("Consultar SOC").disabled).toBe(true);
    expect(v.container.textContent).toContain("Configuração pendente");
  });
  it("surfaces API code and supports retry", async () => {
    await v.render(<Page />);
    m.fetch.mockResolvedValueOnce(res({ code: "UNAVAILABLE", error: "Falha sintética" }, false));
    await v.click("Consultar SOC");
    expect(v.container.textContent).toContain("UNAVAILABLE: Falha sintética");
    await v.click("Consultar SOC");
    expect(v.container.textContent).toContain("Pessoa sintética A");
  });
  it("supports emitted ASOs and monitoring with accurate persistence notice", async () => {
    await v.render(<Page />);
    await v.click("ASOs emitidos");
    await v.input('input[placeholder="Códigos separados por vírgula"]', "12,13");
    m.fetch.mockResolvedValueOnce(res({ ...data, recorded: false }));
    await v.click("Consultar SOC");
    expect(m.fetch.mock.lastCall![0]).toContain("employeeIds=12%2C13");
    expect(v.container.textContent).toContain("resumo não pôde ser registrado");
    await v.click("Monitoramento");
    await v.click("Atualizar monitoramento");
    expect(m.fetch.mock.lastCall![0]).toContain("resource=runs");
    expect(v.container.textContent).toContain("Últimas 50 consultas");
  });
  it("paginates without discarding fetched records", async () => {
    await v.render(<Page />);
    m.fetch.mockResolvedValueOnce(
      res({
        ...data,
        data: Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: `Pessoa ${i}` })),
      })
    );
    await v.click("Consultar SOC");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(50);
    await v.click("Próxima");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(v.container.textContent).toContain("Pessoa 50");
    await v.click("Anterior");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(50);
  });
  it("ignores an old query and resets filters on session change", async () => {
    await v.render(<Page />);
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Consultar SOC");
    m.user = { uid: "b", getIdToken: vi.fn().mockResolvedValue("token-b") };
    await v.render(<Page />);
    await act(async () => p.resolve(res(data)));
    expect(v.container.textContent).not.toContain("Pessoa sintética A");
    expect(v.button("Consultar SOC").disabled).toBe(false);
  });
  it("does not send a read after delayed credentials resolve on logout", async () => {
    const p = deferred<string>();
    m.user!.getIdToken.mockReturnValueOnce(p.promise);
    await v.render(<Page />);
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
