import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ui } from "../../../tests/ui/harness";

const m = vi.hoisted(() => ({
  select: vi.fn(),
  directory: vi.fn(),
  scope: { activeClientId: "all", isGlobalStaff: true, isLoading: false },
}));
vi.mock("@/firebase", () => ({
  useFirestore: () => null,
  useUser: () => ({ user: { uid: "admin" } }),
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ ...m.scope, setActiveClientId: m.select }),
}));
vi.mock("@/hooks/use-company-directory", () => ({ useCompanyDirectory: m.directory }));
import { KitCompanySelector } from "./kit-company-selector";
let view: ReturnType<typeof ui>;
beforeEach(() => {
  vi.clearAllMocks();
  m.scope = { activeClientId: "all", isGlobalStaff: true, isLoading: false };
  m.directory.mockReturnValue({
    data: [
      { id: "A", name: "Cliente A", active: true, cnpj: "11.111.111/0001-11" },
      { id: "B", name: "Cliente inativo", active: false },
      { id: "C", name: "Cadastro sem situação" },
    ],
    isLoading: false,
    error: null,
  });
  view = ui();
});
afterEach(async () => view.cleanup());
describe("kit company context", () => {
  it("changes the authorized context using the existing directory", async () => {
    await view.render(<KitCompanySelector />);
    await view.input("select", "A");
    expect(m.select).toHaveBeenCalledWith("A");
    expect(view.container.textContent).toContain("11.111.111/0001-11");
    expect(view.container.textContent).not.toContain("Cliente inativo");
    expect(view.container.textContent).not.toContain("Cadastro sem situação");
    expect(m.directory).toHaveBeenCalledWith(null, "admin", true, [], true);
  });
  it("locks client switching during an operation", async () => {
    await view.render(<KitCompanySelector disabled />);
    expect(view.container.querySelector("select")?.disabled).toBe(true);
  });
  it("removes the directory immediately when global admin access is absent", async () => {
    await view.render(<KitCompanySelector />);
    m.scope.isGlobalStaff = false;
    await view.render(<KitCompanySelector />);
    expect(view.container.querySelector("select")).toBeNull();
    expect(view.container.textContent).not.toContain("Cliente A");
    expect(m.directory).toHaveBeenLastCalledWith(null, "admin", false, [], false);
  });
  it("does not imply that a missing current company is still selectable", async () => {
    m.scope.activeClientId = "removed";
    await view.render(<KitCompanySelector />);
    const option = view.container.querySelector<HTMLOptionElement>('option[value="removed"]');
    expect(option?.disabled).toBe(true);
    expect(option?.textContent).toContain("indisponível");
  });
});
