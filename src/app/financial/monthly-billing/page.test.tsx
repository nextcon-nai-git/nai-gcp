import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  role: "SUPER_ADMIN",
  fetch: vi.fn(),
  group: "test-group",
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user, role: m.role, isUserLoading: false }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ group: m.group }),
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
const record = {
  cnpj: "11222333000181",
  name: "Empresa sintética",
  valueCents: 123456,
  companyId: "one",
  sourceName: "Planilha teste",
};
const data = (records: unknown[] = []) => ({
  groups: [{ id: m.group, name: "Grupo sintético" }],
  group: { id: m.group, name: "Grupo sintético" },
  revision: "a".repeat(64),
  records,
  totalCents: records.length ? 123456 : 0,
});
const res = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.role = "SUPER_ADMIN";
  m.group = "test-group";
  m.fetch.mockReset().mockResolvedValue(res(data()));
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function review() {
  await v.input("#billing-source", "Planilha teste");
  await v.input("#billing-paste", "11.222.333/0001-81\tEmpresa sintética\t1.234,56");
  await v.click("Revisar lote");
}
describe("monthly group billing", () => {
  it.each(["ADMIN", "CLIENT_ADMIN", ""])("does not read for unauthorized role %s", async (role) => {
    m.role = role;
    await v.render(<Page />);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("administrador global");
  });
  it("requires authentication", async () => {
    m.user = null;
    await v.render(<Page />);
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("shows existing amounts and formats CNPJ without changing the value", async () => {
    m.fetch.mockResolvedValue(res(data([record])));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("11.222.333/0001-81");
    expect(v.container.textContent).toContain("1.234,56");
  });
  it("rejects invalid paste without sending mutations", async () => {
    await v.render(<Page />);
    await v.input("#billing-source", "Planilha teste");
    await v.input("#billing-paste", "não é uma tabela");
    await v.click("Revisar lote");
    expect(v.container.querySelector('[role="alert"]')?.textContent).toContain("três colunas");
    expect(m.fetch.mock.calls.some((c) => c[1].method === "POST")).toBe(false);
  });
  it("requires review and confirms persisted values with a readback", async () => {
    await v.render(<Page />);
    await review();
    expect(m.fetch).toHaveBeenCalledTimes(1);
    m.fetch.mockResolvedValueOnce(res({ saved: true })).mockResolvedValueOnce(res(data([record])));
    await v.click("Confirmar cadastro e mensalidades");
    const post = m.fetch.mock.calls.find((c) => c[1].method === "POST")!;
    expect(JSON.parse(post[1].body)).toMatchObject({
      confirmed: true,
      groupCompanyId: "test-group",
      revision: "a".repeat(64),
      rows: [{ cnpj: record.cnpj, name: record.name, valueCents: 123456 }],
    });
    expect(v.container.textContent).toContain("1 CNPJs conferidos no banco");
    expect(document.querySelector<HTMLTextAreaElement>("#billing-paste")?.value).toBe("");
  });
  it("does not claim saved when readback mismatches", async () => {
    await v.render(<Page />);
    await review();
    m.fetch.mockResolvedValueOnce(res({ saved: true })).mockResolvedValueOnce(res(data()));
    await v.click("Confirmar cadastro e mensalidades");
    expect(v.container.textContent).toContain("conferência não foi concluída");
    expect(v.container.textContent).not.toContain("CNPJs conferidos no banco");
    expect(document.querySelector<HTMLTextAreaElement>("#billing-paste")?.value).toContain(
      "Empresa sintética"
    );
  });
  it("preserves review on conflict and refresh clears it", async () => {
    await v.render(<Page />);
    await review();
    m.fetch.mockResolvedValueOnce(res({ error: "Revisão concorrente" }, false));
    await v.click("Confirmar cadastro e mensalidades");
    expect(v.container.textContent).toContain("Revisão concorrente");
    expect(v.button("Confirmar cadastro e mensalidades").disabled).toBe(false);
    await v.click("Atualizar dados");
    expect(v.container.textContent).not.toContain("Confirmar cadastro e mensalidades");
  });
  it("cancels post when a delayed token completes after logout", async () => {
    await v.render(<Page />);
    await review();
    const p = deferred<string>();
    m.user!.getIdToken.mockReturnValueOnce(p.promise);
    await v.click("Confirmar cadastro e mensalidades");
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old"));
    expect(m.fetch.mock.calls.some((c) => c[1].method === "POST")).toBe(false);
  });
  it("does not repeat verification reads after leaving during save", async () => {
    await v.render(<Page />);
    await review();
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.click("Confirmar cadastro e mensalidades");
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve(res({ saved: true })));
    expect(m.fetch).toHaveBeenCalledTimes(2);
  });
  it("keeps the AVP import instructions out of its monthly overview", async () => {
    m.group = "GRUPO_AVP";
    m.fetch.mockResolvedValue(res(data()));
    await v.render(<Page />);
    expect(v.container.querySelector("#billing-source")).toBeNull();
  });
});
