import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  profile: {
    user: { uid: "a" },
    role: "ADMIN",
    companyId: null,
    tenantId: null,
    isUserLoading: false,
    userError: null,
  } as {
    user: { uid: string } | null;
    role: string | null;
    companyId: string | null;
    tenantId: string | null;
    isUserLoading: boolean;
    userError: Error | null;
  },
  scope: { activeClientId: "a", isGlobalStaff: true, setActiveClientId: vi.fn() },
  data: [] as Record<string, unknown>[],
  error: null as Error | null,
  loading: false,
  query: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  fetch: vi.fn(),
  enrich: vi.fn(),
  toast: vi.fn(),
  push: vi.fn(),
  token: vi.fn(),
}));
const db = {};
vi.mock("@/firebase", () => ({
  useUser: () => m.profile,
  useFirestore: () => db,
  useMemoFirebase: (f: () => unknown) => f(),
  useCollection: (q: unknown) => {
    m.query(q);
    return { data: m.data, isLoading: m.loading, error: m.error };
  },
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => m.scope }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/actions/company-enrichment", () => ({ enriquecerDadosEmpresa: m.enrich }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => path.join("/"),
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  query: (base: unknown, ...constraints: unknown[]) => ({ base, constraints }),
  orderBy: (...v: unknown[]) => v,
  where: (...v: unknown[]) => v,
  serverTimestamp: () => "server-time",
  deleteDoc: m.remove,
  updateDoc: m.update,
  runTransaction: m.transaction,
  setDoc: vi.fn(),
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
const a = {
  id: "a",
  name: "Empresa sintética A",
  cnpj: "11222333000181",
  active: true,
  segment: "Serviços",
  risk_degree: 2,
  city: "Curitiba",
  state: "PR",
  email: "teste@example.com",
  phone: "41999999999",
};
beforeEach(() => {
  v = ui();
  m.profile = {
    user: { uid: "a" },
    role: "ADMIN",
    companyId: null,
    tenantId: null,
    isUserLoading: false,
    userError: null,
  };
  m.scope = { activeClientId: "a", isGlobalStaff: true, setActiveClientId: vi.fn() };
  m.data = [a, { ...a, id: "b", name: "Empresa sintética inativa", active: false }];
  m.error = null;
  m.loading = false;
  for (const mock of [
    m.query,
    m.remove,
    m.update,
    m.transaction,
    m.fetch,
    m.enrich,
    m.toast,
    m.push,
    m.token,
  ])
    mock.mockReset();
  m.remove.mockResolvedValue(undefined);
  m.update.mockResolvedValue(undefined);
  m.fetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
  m.token.mockResolvedValue("token-a");
  vi.stubGlobal("fetch", m.fetch);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  localStorage.clear();
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function edit() {
  await v.click("Editar Empresa sintética A");
}
describe("persisted client directory", () => {
  it("does not show browser caches as saved clients", async () => {
    localStorage.setItem(
      "nai_custom_companies",
      JSON.stringify([{ ...a, id: "cached", name: "Cliente de outra sessão" }])
    );
    await v.render(<Page />);
    expect(v.container.textContent).not.toContain("Cliente de outra sessão");
    expect(v.container.textContent).toContain("Empresa sintética A");
  });
  it("filters inactive records and searches by city", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).not.toContain("Empresa sintética inativa");
    await act(async () =>
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    );
    expect(v.container.textContent).toContain("Empresa sintética inativa");
    await v.input('input[placeholder^="Pesquisar"]', "Inexistente");
    expect(v.container.textContent).toContain("Nenhum cliente cadastrado");
    await v.input('input[placeholder^="Pesquisar"]', "Curitiba");
    expect(v.container.textContent).toContain("Empresa sintética A");
  });
  it("shows load failure instead of local stale rows", async () => {
    m.data = [];
    m.error = Error("synthetic");
    await v.render(<Page />);
    expect(v.container.querySelector('[role="alert"]')?.textContent).toContain(
      "clientes autorizados"
    );
  });
  it.each(["loading", "logout", "error"])("blocks unauthorized initial state %s", async (state) => {
    if (state === "loading") m.profile.isUserLoading = true;
    if (state === "logout") m.profile.user = null;
    if (state === "error") m.profile.userError = Error("synthetic");
    await v.render(<Page />);
    expect(m.query).not.toHaveBeenCalled();
  });
  it("limits a scoped admin to its own company and preserves edit capability", async () => {
    m.profile.companyId = "a";
    m.scope.isGlobalStaff = false;
    await v.render(<Page />);
    expect(m.query.mock.lastCall![0].constraints).toContainEqual(["__name__", "==", "a"]);
    expect(v.container.textContent).not.toContain("Empresa sintética inativa");
    expect(v.button("Nova Unidade").disabled).toBe(true);
    expect(v.button("Sincronizar Clientes").disabled).toBe(true);
    expect(v.button("Editar Empresa sintética A").disabled).toBe(false);
  });
  it("does not allow writes from a clinical role", async () => {
    m.profile.role = "DOCTOR";
    m.profile.companyId = "a";
    m.scope.isGlobalStaff = false;
    await v.render(<Page />);
    expect(v.button("Nova Unidade").disabled).toBe(true);
    expect(v.button("Editar Empresa sintética A").disabled).toBe(true);
    await v.click("INATIVAR");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("selects a company before navigating to the cockpit", async () => {
    await v.render(<Page />);
    await v.click("Cockpit");
    expect(m.scope.setActiveClientId).toHaveBeenCalledWith("a");
    expect(m.push).toHaveBeenCalledWith("/clients/a");
  });
  it("waits for delete confirmation and does not reset company on failure", async () => {
    await v.render(<Page />);
    const p = deferred<void>();
    m.remove.mockReturnValueOnce(p.promise);
    await v.click("SIM");
    expect(m.toast).not.toHaveBeenCalled();
    await act(async () => p.reject(Error("denied")));
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Alteração não confirmada" })
    );
    expect(m.scope.setActiveClientId).not.toHaveBeenCalled();
    expect(v.container.textContent).toContain("Empresa sintética A");
  });
  it("confirms deletion only after persistence and blocks duplicates", async () => {
    await v.render(<Page />);
    const p = deferred<void>();
    m.remove.mockReturnValueOnce(p.promise);
    await v.click("SIM");
    await v.click("SIM");
    expect(m.remove).toHaveBeenCalledTimes(1);
    await act(async () => p.resolve());
    expect(m.toast).toHaveBeenCalledWith({ title: "Cliente Excluído" });
    expect(m.scope.setActiveClientId).toHaveBeenCalledWith("all");
  });
  it("uses update, never merge-create, to inactivate and handles rejected updates", async () => {
    await v.render(<Page />);
    m.update.mockRejectedValueOnce(Error("deleted"));
    await v.click("INATIVAR");
    expect(m.update).toHaveBeenCalledWith("companies/a", {
      active: false,
      updatedAt: "server-time",
    });
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Alteração não confirmada" })
    );
    await v.click("INATIVAR");
    expect(m.toast).toHaveBeenLastCalledWith({ title: "Cliente Inativado" });
  });
  it("preserves edit fields and keeps dialog open on failed save", async () => {
    await v.render(<Page />);
    await edit();
    await v.input('input[name="name"]', "Empresa revisada");
    m.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Não salvo" }) });
    await v.submit();
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "Empresa revisada"
    );
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Erro ao Salvar" }));
  });
  it("saves through the audited API without caching a fabricated compliance score", async () => {
    await v.render(<Page />);
    await edit();
    await v.input('input[name="name"]', "Empresa revisada");
    await v.submit();
    expect(m.fetch).toHaveBeenCalledWith(
      "/api/admin/company-master",
      expect.objectContaining({ method: "POST" })
    );
    expect(JSON.parse(m.fetch.mock.lastCall![1].body)).toMatchObject({
      id: "a",
      name: "Empresa revisada",
    });
    expect(m.fetch.mock.lastCall![1].body).not.toContain("compliance_score");
    expect(localStorage.getItem("nai_custom_companies")).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("rejects stale token completion after logout", async () => {
    await v.render(<Page />);
    await edit();
    const p = deferred<string>();
    m.token.mockReturnValueOnce(p.promise);
    await v.submit();
    m.profile.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("old-token"));
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("clears open forms when the account changes", async () => {
    await v.render(<Page />);
    await edit();
    m.profile.user = { uid: "b" };
    await v.render(<Page />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("keeps typed company data when enrichment is unavailable", async () => {
    await v.render(<Page />);
    await edit();
    m.enrich.mockResolvedValue({ sucesso: false, mensagem: "Consulta indisponível" });
    await v.click("Buscar na Receita Federal");
    expect(m.enrich).toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(a.name);
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Erro na Consulta" }));
  });
});

const brdeRecords = () => [
  { ...a, id: "CLI_BRDE", name: "BRDE", cnpj: "00.000.000/0001-01", portfolioClientId: "brde" },
  {
    ...a,
    id: "92816560000137",
    name: "BANCO REGIONAL DE DESENVOLVIMENTO DO EXTREMO SUL",
    cnpj: "92816560000137",
    portfolioClientId: "brde",
  },
];
it("shows one BRDE client with its real CNPJ and preserves both authorized histories", async () => {
  m.data = brdeRecords();
  await v.render(<Page />);
  const headings = [...v.container.querySelectorAll("h3")].filter((h) =>
    h.textContent?.includes("BRDE")
  );
  expect(headings).toHaveLength(1);
  expect(headings[0].textContent).toContain("Banco Regional");
  expect(v.container.textContent).toContain("CNPJ: 92816560000137");
  expect(v.container.textContent).not.toContain("CNPJ: 00.000.000/0001-01");
  await v.click("Cockpit");
  expect(m.scope.setActiveClientId).toHaveBeenLastCalledWith("92816560000137");
  await v.click("Ver contratos e tarefas vinculados ao BRDE");
  expect(m.scope.setActiveClientId).toHaveBeenLastCalledWith("CLI_BRDE");
  expect(m.push).toHaveBeenLastCalledWith("/clients/CLI_BRDE");
  expect(m.update).not.toHaveBeenCalled();
  expect(m.remove).not.toHaveBeenCalled();
  for (const term of ["BRDE", "Banco Regional", "92816560000137", "00000000000101"]) {
    await v.input('input[placeholder^="Pesquisar"]', term);
    expect(v.container.textContent).toContain("Ver contratos e tarefas vinculados ao BRDE");
  }
});
it("does not expose the other BRDE record to a company-scoped login", async () => {
  m.data = brdeRecords();
  m.scope.isGlobalStaff = false;
  m.profile.companyId = "CLI_BRDE";
  await v.render(<Page />);
  expect(v.container.textContent).not.toContain("Banco Regional");
  expect(v.container.textContent).not.toContain("92816560000137");
  expect(v.container.textContent).not.toContain("Ver contratos e tarefas vinculados ao BRDE");
  await v.click("Cockpit");
  expect(m.push).toHaveBeenLastCalledWith("/clients/CLI_BRDE");
});
it.each(["different-cnpj", "different-group", "inactive", "deleted"])(
  "keeps BRDE records separate when identity or lifecycle differs: %s",
  async (reason) => {
    const records = brdeRecords();
    if (reason === "different-cnpj") records[0].cnpj = "11222333000181";
    if (reason === "different-group") records[0].portfolioClientId = "other";
    if (reason === "inactive") records[0].active = false;
    m.data = records.map((record, index) => ({
      ...record,
      isDeleted: reason === "deleted" && index === 0,
    }));
    await v.render(<Page />);
    expect(v.container.textContent).not.toContain("Ver contratos e tarefas vinculados ao BRDE");
    expect(v.container.textContent).toContain("BANCO REGIONAL DE DESENVOLVIMENTO DO EXTREMO SUL");
  }
);
