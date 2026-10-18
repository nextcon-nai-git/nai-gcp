import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: null as any,
  company: "a",
  fetch: vi.fn(),
  toast: vi.fn(),
  copy: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user, companyId: m.company }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
import Page from "./page";
const key = {
  id: "key-1",
  name: "Catraca sintética",
  keyPrefix: "test_",
  createdAt: "2026-10-18T12:00:00Z",
};
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.company = "a";
  m.fetch.mockReset().mockResolvedValue(response({ keys: [key] }));
  m.toast.mockReset();
  m.copy.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", m.fetch);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: m.copy },
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function prepare() {
  await v.click("Gerar Credencial M2M");
  await v.input('input[placeholder="Ex: Catraca Portaria Principal"]', "Equipamento teste");
}
describe("developer credentials interface", () => {
  it("reads only the configured client with authenticated headers", async () => {
    await v.render(<Page />);
    expect(m.fetch.mock.calls[0][0]).toBe("/api/v1/developer/keys?clientId=a");
    expect(m.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token-a");
    expect(v.container.textContent).toContain(key.name);
  });
  it("does not query after a delayed token is resolved following logout", async () => {
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValue(p.promise);
    await v.render(<Page />);
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("shows a query failure and retries through refresh", async () => {
    m.fetch.mockResolvedValueOnce(response({ error: "Consulta negada" }, false));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Consulta negada");
    await v.click("Tentar novamente");
    expect(v.container.textContent).toContain(key.name);
  });
  it("requires a client and a nonblank name before creation", async () => {
    m.company = "";
    await v.render(<Page />);
    await prepare();
    await v.click("Gerar Chave Live");
    expect(m.fetch.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false);
  });
  it("does not display a key until the server confirms creation", async () => {
    await v.render(<Page />);
    await prepare();
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Gerar Chave Live");
    expect(v.button("Gerar Chave Live").disabled).toBe(true);
    expect(m.toast).not.toHaveBeenCalled();
    expect(JSON.parse(m.fetch.mock.calls[1][1].body)).toEqual({
      clientId: "a",
      name: "Equipamento teste",
    });
    await act(async () => p.resolve(response({ ...key, rawKey: "synthetic-private-key" })));
    expect(document.querySelector<HTMLInputElement>("input[readonly]")!.value).toBe(
      "synthetic-private-key"
    );
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Chave Gerada!" }));
  });
  it("retains the form when key creation fails", async () => {
    await v.render(<Page />);
    await prepare();
    m.fetch.mockResolvedValueOnce(response({ error: "Sem permissão" }, false));
    await v.click("Gerar Chave Live");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Erro na geração", description: "Sem permissão" })
    );
    expect(document.querySelector("input[readonly]")).toBeNull();
  });
  it("never reveals a key returned after switching account", async () => {
    await v.render(<Page />);
    await prepare();
    const p = deferred<any>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Gerar Chave Live");
    m.user = { uid: "b", getIdToken: vi.fn().mockResolvedValue("token-b") };
    m.company = "b";
    m.fetch.mockResolvedValue(response({ keys: [] }));
    await v.render(<Page />);
    await act(async () => p.resolve(response({ ...key, rawKey: "old-account-key" })));
    expect(document.body.textContent).not.toContain("Chave Gerada");
    expect(document.querySelector("input[readonly]")).toBeNull();
    expect(m.toast).not.toHaveBeenCalled();
  });
  it("cancels creation before sending when its token completes after logout", async () => {
    await v.render(<Page />);
    await prepare();
    const p = deferred<string>();
    m.user.getIdToken.mockReturnValueOnce(p.promise);
    await v.click("Gerar Chave Live");
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.fetch).toHaveBeenCalledOnce();
  });
  it("awaits clipboard confirmation and reports a copy failure", async () => {
    await v.render(<Page />);
    await prepare();
    m.fetch.mockResolvedValueOnce(response({ ...key, rawKey: "synthetic-private-key" }));
    await v.click("Gerar Chave Live");
    const p = deferred<any>();
    m.copy.mockReturnValueOnce(p.promise);
    await v.click("Copiar chave");
    expect(v.button("Copiar chave")).toBeDefined();
    await act(async () => p.reject(Error("blocked")));
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível copiar a chave" })
    );
    await v.click("Copiar chave");
    expect(v.button("Chave copiada")).toBeDefined();
  });
  it("does not revoke when the operator cancels confirmation", async () => {
    await v.render(<Page />);
    vi.mocked(window.confirm).mockReturnValue(false);
    await v.click("Revogar chave Catraca sintética");
    expect(m.fetch).toHaveBeenCalledOnce();
  });
  it("refreshes only after a confirmed revocation", async () => {
    await v.render(<Page />);
    m.fetch.mockResolvedValueOnce(response({}));
    await v.click("Revogar chave Catraca sintética");
    expect(m.fetch.mock.calls[1][1].method).toBe("DELETE");
    expect(m.fetch.mock.calls[1][0]).toContain("id=key-1");
    expect(m.toast).toHaveBeenCalledWith({ title: "Chave revogada" });
    expect(m.fetch).toHaveBeenCalledTimes(3);
  });
  it("retains the key on revocation failure", async () => {
    await v.render(<Page />);
    m.fetch.mockResolvedValueOnce(response({ error: "Recusado" }, false));
    await v.click("Revogar chave Catraca sintética");
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Falha na revogação", description: "Recusado" })
    );
    expect(v.container.textContent).toContain(key.name);
  });
});
