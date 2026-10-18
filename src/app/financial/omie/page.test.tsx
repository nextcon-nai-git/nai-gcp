import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ui, deferred } from "../../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  fetch: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useUser: () => ({ user: m.user }) }));
import Page from "./page";
let v: ReturnType<typeof ui>;
const connected = {
  connected: true,
  company: "Empresa sintética",
  cnpj: "sintético",
  verifiedAt: "2026-10-18T12:00:00Z",
};
const titles = {
  page: 1,
  pages: 2,
  total: 2,
  queriedAt: "2026-10-18T12:00:00Z",
  rows: [
    {
      id: "1",
      document: "NF sintética",
      partyName: "Cliente sintético",
      partyCode: "a",
      amount: 123.45,
      dueDate: "2026-10-20",
      status: "ABERTO",
    },
  ],
};
const res = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("a-token") };
  m.fetch
    .mockReset()
    .mockImplementation(async (url: string) =>
      res(url.includes("view=titles") ? titles : connected)
    );
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Omie financial page", () => {
  it("does not read without authentication", async () => {
    m.user = null;
    await v.render(<Page />);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("Entre no NAI");
  });
  it("shows names and amounts, pages and resets pagination when kind changes", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Cliente sintético");
    expect(v.container.textContent).toContain("123,45");
    await v.click("Próxima");
    expect(m.fetch.mock.lastCall![0]).toContain("page=2");
    await v.input("select", "payable");
    expect(m.fetch.mock.lastCall![0]).toContain("kind=payable");
    expect(m.fetch.mock.lastCall![0]).toContain("page=1");
    await v.click("Atualizar");
    expect(m.fetch.mock.lastCall![1].headers.Authorization).toBe("Bearer a-token");
  });
  it("reports API failures without fabricated titles", async () => {
    m.fetch.mockResolvedValueOnce(res({ error: "Credencial indisponível" }, false));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Credencial indisponível");
    expect(v.container.querySelector("table")).toBeNull();
  });
  it("handles empty titles and missing party names", async () => {
    m.fetch.mockImplementation(async (u: string) =>
      res(u.includes("view=titles") ? { ...titles, rows: [] } : connected)
    );
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Nenhum título encontrado");
  });
  it("connects only with consent and clears secrets after submission", async () => {
    m.fetch.mockResolvedValueOnce(res({ connected: false }));
    await v.render(<Page />);
    expect(v.button("Validar e conectar").disabled).toBe(true);
    await v.input('input[autoComplete="off"]', "synthetic-key");
    await v.input('input[autoComplete="new-password"]', "synthetic-secret");
    await act(async () =>
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    );
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.submit();
    expect(document.querySelector<HTMLInputElement>('input[autoComplete="off"]')!.value).toBe("");
    const body = JSON.parse(m.fetch.mock.lastCall![1].body);
    expect(body).toEqual({ appKey: "synthetic-key", appSecret: "synthetic-secret" });
    await act(async () => p.resolve(res(connected)));
    expect(v.container.textContent).toContain("Cliente sintético");
  });
  it("preserves disconnect cancellation and reports delete failure", async () => {
    await v.render(<Page />);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await v.click("Desconectar");
    expect(m.fetch.mock.calls.some((c) => c[1].method === "DELETE")).toBe(false);
    confirm.mockReturnValue(true);
    m.fetch.mockResolvedValueOnce(res({ error: "Falha ao remover conexão" }, false));
    await v.click("Desconectar");
    expect(v.container.textContent).toContain("Falha ao remover conexão");
    expect(v.container.textContent).toContain("Cliente sintético");
  });
  it("removes titles after confirmed disconnect", async () => {
    await v.render(<Page />);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    m.fetch.mockResolvedValueOnce(res({ connected: false }));
    await v.click("Desconectar");
    expect(v.container.textContent).not.toContain("Cliente sintético");
    expect(v.container.textContent).toContain("Conectar aplicativo");
  });
  it("hides old data on account change and ignores late replies", async () => {
    await v.render(<Page />);
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Atualizar");
    m.user = { uid: "b", getIdToken: vi.fn().mockResolvedValue("b-token") };
    m.fetch.mockResolvedValue(res({ connected: false }));
    await v.render(<Page />);
    await act(async () => p.resolve(res(titles)));
    expect(v.container.textContent).not.toContain("Cliente sintético");
  });
  it("does not fetch with credentials resolved after logout", async () => {
    const p = deferred<string>();
    m.user!.getIdToken.mockReturnValue(p.promise);
    await v.render(<Page />);
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("stale"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
