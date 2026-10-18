import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", displayName: "Pessoa teste" },
  scope: "a",
  all: false,
  authorized: ["a", "cassi_matriz", "grupo_avp", "unit / test"],
  error: null as any,
  loading: false,
  global: false,
  signOut: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  select: vi.fn(),
  toggle: vi.fn(),
  toast: vi.fn(),
  directory: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/financial",
  useRouter: () => ({ push: m.push, replace: m.replace, refresh: m.refresh }),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user }),
  useAuth: () => ({}),
  useFirestore: () => ({}),
  useMemoFirebase: (f: any) => f(),
  useDoc: () => ({ data: { name: "Pessoa teste" } }),
}));
vi.mock("firebase/auth", () => ({ signOut: m.signOut }));
vi.mock("firebase/firestore", () => ({ doc: (_: any, ...args: any[]) => args }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({
    activeClientId: m.scope,
    setActiveClientId: m.select,
    isGlobalStaff: m.global,
    canBrowseAllCompanies: m.all,
    authorizedCompanies: m.authorized,
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-company-directory", () => ({
  useCompanyDirectory: (...args: any[]) => {
    m.directory(...args);
    return {
      data: [
        ...m.authorized.map((id) => ({ id, name: `Empresa ${id}` })),
        { id: "inactive", name: "Inativa", active: false },
      ],
      isLoading: m.loading,
      error: m.error,
    };
  },
}));
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => ({ toggleSidebar: m.toggle }) }));
vi.mock("@/components/feedback/platform-feedback", () => ({ PlatformFeedback: () => null }));
vi.mock("./offline-sync-badge", () => ({ OfflineSyncBadge: () => null }));
vi.mock("./global-command-palette", () => ({
  GlobalCommandPalette: ({ open, onOpenChange }: any) =>
    open ? <button onClick={() => onOpenChange(false)}>Fechar busca teste</button> : null,
}));
vi.mock("@/components/ui/select", () => import("../../../tests/ui/native-select"));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: () => null,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => null,
}));
vi.mock("next/image", () => ({ default: ({ src, alt }: any) => <img src={src} alt={alt} /> }));
import { TopNav } from "./top-nav";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.scope = "a";
  m.all = false;
  m.global = false;
  m.error = null;
  m.loading = false;
  for (const mock of [
    m.signOut,
    m.push,
    m.replace,
    m.refresh,
    m.select,
    m.toggle,
    m.toast,
    m.directory,
  ])
    mock.mockReset();
  m.signOut.mockResolvedValue(undefined);
  localStorage.clear();
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
});
describe("navigation tenant boundaries", () => {
  it("queries only the current authorized directory and omits inactive/global options", async () => {
    await v.render(<TopNav />);
    expect(m.directory).toHaveBeenCalledWith(expect.anything(), "a", false, m.authorized, true);
    expect(v.container.querySelector("select")?.textContent).not.toContain("Inativa");
    expect(v.container.querySelector('option[value="all"]')).toBeNull();
  });
  it.each([
    ["cassi_matriz", "/clients/cassi"],
    ["grupo_avp", "/clients/grupo-avp"],
    ["unit / test", "/clients/unit%20%2F%20test"],
  ])("routes authorized company %s", async (id, path) => {
    await v.render(<TopNav />);
    await v.input("select", id);
    expect(m.select).toHaveBeenCalledWith(id);
    expect(m.push).toHaveBeenCalledWith(path);
  });
  it("does not change scope to an injected unauthorized option", async () => {
    await v.render(<TopNav />);
    const option = document.createElement("option");
    option.value = "forbidden";
    v.container.querySelector("select")!.append(option);
    await v.input("select", "forbidden");
    expect(m.select).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
  });
  it("allows global overview only with the explicit capability", async () => {
    m.all = true;
    await v.render(<TopNav />);
    await v.input("select", "all");
    expect(m.push).toHaveBeenCalledWith("/");
  });
  it.each(["loading", "error"])("disables company selection when directory is %s", async (mode) => {
    m.loading = mode === "loading";
    m.error = mode === "error" ? Error("failed") : null;
    await v.render(<TopNav />);
    expect(v.container.querySelector("select")!.disabled).toBe(true);
  });
  it("clears only the signed-out account cache after successful logout", async () => {
    localStorage.setItem("nai_grupo_avp_asos_cache:a", "private-a");
    localStorage.setItem("nai_grupo_avp_asos_cache:b", "private-b");
    await v.render(<TopNav />);
    await v.click("Encerrar Sessão");
    expect(localStorage.getItem("nai_grupo_avp_asos_cache:a")).toBeNull();
    expect(localStorage.getItem("nai_grupo_avp_asos_cache:b")).toBe("private-b");
    expect(m.replace).toHaveBeenCalledWith("/login");
    expect(m.refresh).toHaveBeenCalledOnce();
  });
  it("does not announce or navigate away after failed logout", async () => {
    m.signOut.mockRejectedValueOnce(Error("offline"));
    await v.render(<TopNav />);
    await v.click("Encerrar Sessão");
    expect(m.replace).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Não foi possível encerrar a sessão" })
    );
  });
  it("preserves successful logout when cache removal is unavailable", async () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw Error("blocked");
    });
    await v.render(<TopNav />);
    await v.click("Encerrar Sessão");
    expect(m.replace).toHaveBeenCalledWith("/login");
  });
  it("toggles command search from keyboard and releases the listener on unmount", async () => {
    await v.render(<TopNav />);
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
    );
    expect(v.button("Fechar busca teste")).toBeDefined();
    await v.click("Fechar busca teste");
    await v.click("Buscar ações");
    expect(v.button("Fechar busca teste")).toBeDefined();
    await v.click("Abrir ou recolher Menu Lateral");
    expect(m.toggle).toHaveBeenCalledOnce();
    const remove = vi.spyOn(window, "removeEventListener");
    await v.cleanup();
    v = ui();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
  it("updates connectivity status and restricts the audit shortcut", async () => {
    await v.render(<TopNav />);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(v.container.textContent).toContain("Offline");
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(v.container.textContent).not.toContain("Offline");
    expect(v.container.querySelector('a[href="/audit-setup"]')).toBeNull();
    m.global = true;
    await v.render(<TopNav />);
    expect(v.container.querySelector('a[href="/audit-setup"]')).not.toBeNull();
  });
  it.each([
    ["Ingestão de ASO", "/health-control"],
    ["NAI importa", "/nai-importa"],
    ["Triagem PCMSO", "/reports"],
    ["Atestados Médicos", "/medical-certificates"],
    ["Ordem de Serviço", "/work-orders"],
  ])("opens the %s workflow", async (label, path) => {
    await v.render(<TopNav />);
    await v.click(label);
    expect(m.push).toHaveBeenCalledWith(path);
  });
});
