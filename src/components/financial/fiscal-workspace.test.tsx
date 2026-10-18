import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({ user: null as any, fetch: vi.fn() }));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import { FiscalWorkspace } from "./fiscal-workspace";
const result = {
  company: "Empresa sintética",
  cnpj: "11222333000181",
  environment: "P",
  total: 2,
  page: 1,
  pages: 2,
  invoices: [
    {
      id: "one",
      number: "NF-10",
      orderNumber: "OS-1",
      customer: "Cliente sintético",
      issuedOn: "2026-10-01",
      amountCents: 123456,
      status: "billed",
    },
  ],
};
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.fetch.mockReset().mockResolvedValue(response(result));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function query() {
  await v.input('[name="start"]', "2026-10-01");
  await v.input('[name="end"]', "2026-10-18");
  await v.submit();
}
describe("read-only fiscal consultation", () => {
  it("does not query without authentication and makes issuance limits explicit", async () => {
    m.user = null;
    await v.render(<FiscalWorkspace />);
    expect(v.button("Consultar notas").disabled).toBe(true);
    await query();
    expect(m.fetch).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("esta tela apenas consulta notas");
  });
  it("sends the chosen period and environment and formats money in cents", async () => {
    await v.render(<FiscalWorkspace />);
    await v.input('[name="environment"]', "H");
    await query();
    expect(JSON.parse(m.fetch.mock.calls[0][1].body)).toEqual({
      provider: "omie",
      page: 1,
      start: "2026-10-01",
      end: "2026-10-18",
      environment: "H",
    });
    expect(v.container.textContent).toContain("1.234,56");
    expect(v.container.textContent).toContain("01/10/2026");
    expect(v.container.textContent).toContain("Município não informado");
  });
  it("paginates without losing the selected query", async () => {
    await v.render(<FiscalWorkspace />);
    await query();
    expect(v.button("Anterior").disabled).toBe(true);
    m.fetch.mockResolvedValueOnce(response({ ...result, page: 2 }));
    await v.click("Próxima");
    expect(JSON.parse(m.fetch.mock.calls[1][1].body).page).toBe(2);
    expect(v.button("Próxima").disabled).toBe(true);
    await v.click("Anterior");
    expect(JSON.parse(m.fetch.mock.calls[2][1].body).page).toBe(1);
  });
  it("distinguishes no results from a service failure and supports retry", async () => {
    await v.render(<FiscalWorkspace />);
    m.fetch.mockResolvedValueOnce(response({ error: "Omie indisponível" }, false));
    await query();
    expect(v.container.textContent).toContain("Omie indisponível");
    expect(v.container.textContent).not.toContain("Nenhuma nota encontrada");
    m.fetch.mockResolvedValueOnce(response({ ...result, invoices: [], total: 0, pages: 0 }));
    await query();
    expect(v.container.textContent).toContain("Nenhuma nota encontrada");
    expect(v.container.textContent).toContain("Página 1 de 1");
  });
  it("blocks repeated requests while pending", async () => {
    await v.render(<FiscalWorkspace />);
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await query();
    await v.submit();
    expect(m.fetch).toHaveBeenCalledOnce();
    await act(async () => p.resolve(response(result)));
  });
  it("clears old invoices on logout and ignores late results", async () => {
    await v.render(<FiscalWorkspace />);
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await query();
    m.user = null;
    await v.render(<FiscalWorkspace />);
    await act(async () => p.resolve(response(result)));
    expect(v.container.textContent).not.toContain("NF-10");
  });
  it("does not send a token resolved after logout", async () => {
    await v.render(<FiscalWorkspace />);
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValueOnce(p.promise);
    await query();
    m.user = null;
    await v.render(<FiscalWorkspace />);
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("surfaces network failures and unlocks a new attempt", async () => {
    await v.render(<FiscalWorkspace />);
    m.fetch.mockRejectedValueOnce(Error("Conexão falhou"));
    await query();
    expect(v.container.textContent).toContain("Conexão falhou");
    expect(v.button("Consultar notas").disabled).toBe(false);
  });
});
