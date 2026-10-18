import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  scope: "a",
  params: "",
  profile: { role: "ADMIN", companyId: "a" },
  data: [] as Record<string, unknown>[],
  error: null as Error | null,
  add: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
  imported: { data: [] as Record<string, unknown>[], loading: false, error: null },
  query: vi.fn(),
}));
const db = {};
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: { uid: "user" } }),
  useFirestore: () => db,
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => ({ data: m.profile, isLoading: false }),
  useCollection: (q: unknown) => {
    m.query(q);
    return { data: m.data, isLoading: false, error: m.error };
  },
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => ({ activeClientId: m.scope }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(m.params) }));
vi.mock("@/hooks/use-pgr-workspace", () => ({ usePgrCollection: () => m.imported }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...v: string[]) => v.join("/"),
  doc: (_db: unknown, ...v: string[]) => v.join("/"),
  serverTimestamp: () => "server-time",
  addDoc: m.add,
  deleteDoc: m.remove,
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.scope = "a";
  m.params = "";
  m.profile = { role: "ADMIN", companyId: "a" };
  m.error = null;
  m.data = [
    {
      id: "low",
      hazard: "Perigo menor",
      category: "acidente",
      probability: 1,
      severity: 1,
      status: "controlled",
    },
    {
      id: "high",
      hazard: "Perigo prioritário",
      category: "fisico",
      probability: 5,
      severity: 5,
      status: "identified",
      ghe: "Produção",
      source: "Fonte",
      exposedPeople: 2,
    },
  ];
  m.imported = { data: [], loading: false, error: null };
  m.add.mockReset().mockResolvedValue({ id: "new" });
  m.remove.mockReset().mockResolvedValue(undefined);
  m.toast.mockReset();
  m.query.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});
async function fill() {
  await v.click("Registrar risco");
  await v.input('input[placeholder="Ex.: ruído contínuo"]', "Perigo informado");
  await v.input('input[placeholder="Ex.: serra circular"]', "Fonte informada");
  await v.input('input[placeholder="Ex.: produção A"]', "GHE teste");
  await v.input('input[placeholder="Nome ou função"]', "Responsável");
  await v.input('input[type="date"]', "2026-12-01");
  await v.input("textarea", "Medidas para revisão técnica");
}
describe("risk inventory workflows", () => {
  it("sorts documented risks by score and displays actual exposure", async () => {
    await v.render(<Page />);
    const rows = [...v.container.querySelectorAll("tbody tr")];
    expect(rows[0].textContent).toContain("Perigo prioritário");
    expect(rows[1].textContent).toContain("Perigo menor");
    expect(v.container.textContent).toContain("1 crítico(s)");
    expect(m.query).toHaveBeenCalledWith("companies/a/risks");
  });
  it("distinguishes query failure from an empty inventory", async () => {
    m.error = Error("unavailable");
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Inventário indisponível");
    m.error = null;
    m.data = [];
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Nenhum risco registrado");
  });
  it("uses imported PGR source without querying the legacy collection", async () => {
    m.params = "source=pgr&company=a";
    m.imported.data = [{ id: "pgr", hazard: "Do PGR", category: "fisico", status: "identified" }];
    await v.render(<Page />);
    expect(m.query).toHaveBeenLastCalledWith(null);
    expect(v.container.textContent).toContain("Do PGR");
    expect(v.container.textContent).not.toContain("Perigo menor");
  });
  it("requires responsible, source, group and deadline before saving", async () => {
    await v.render(<Page />);
    await v.click("Registrar risco");
    await v.submit();
    expect(m.add).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Preencha os campos obrigatórios" })
    );
  });
  it("waits for confirmed save and includes actor, scope and controls", async () => {
    await v.render(<Page />);
    await fill();
    const p = deferred<unknown>();
    m.add.mockReturnValueOnce(p.promise);
    await v.submit();
    expect(m.toast).not.toHaveBeenCalled();
    expect(m.add.mock.lastCall).toEqual([
      "companies/a/risks",
      expect.objectContaining({
        companyId: "a",
        createdBy: "user",
        hazard: "Perigo informado",
        controls: "Medidas para revisão técnica",
      }),
    ]);
    await act(async () => p.resolve({ id: "new" }));
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Risco registrado" }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("retains the draft after a failed write", async () => {
    await v.render(<Page />);
    await fill();
    m.add.mockRejectedValueOnce(Error("denied"));
    await v.submit();
    expect(
      document.querySelector<HTMLInputElement>('input[placeholder="Ex.: ruído contínuo"]')?.value
    ).toBe("Perigo informado");
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Não foi possível salvar" })
    );
  });
  it("awaits delete response and preserves errors", async () => {
    await v.render(<Page />);
    m.remove.mockRejectedValueOnce(Error("denied"));
    await v.click("Excluir Perigo menor");
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Não foi possível remover" })
    );
    await v.click("Excluir Perigo menor");
    expect(m.remove).toHaveBeenCalledWith("companies/a/risks/low");
    expect(m.toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Risco removido" }));
  });
  it("does not offer delete controls for a reader", async () => {
    m.profile.role = "AUDITOR";
    await v.render(<Page />);
    expect(v.button("Excluir Perigo menor").disabled).toBe(true);
  });
});
