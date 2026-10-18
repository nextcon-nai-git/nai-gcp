import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "user" } as { uid: string } | null,
  company: "a",
  fetch: vi.fn(),
  token: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
}));
const db = {},
  profile = { companyId: "a" };
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user, role: "ADMIN", companyId: "a" }),
  useFirestore: () => db,
  useMemoFirebase: (f: () => unknown) => f(),
  useDoc: () => ({ data: profile }),
  useCollection: () => ({ data: [{ id: "a", name: "Empresa sintética" }], isLoading: false }),
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ activeClientId: m.company, isGlobalStaff: false }),
}));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: m.token }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...v: string[]) => v.join("/"),
  doc: (_db: unknown, ...v: string[]) => v.join("/"),
  query: (base: unknown) => base,
  where: vi.fn(),
  orderBy: vi.fn(),
  collectionGroup: vi.fn(),
  addDoc: m.add,
  updateDoc: m.update,
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
const row = {
  id: "audit",
  companyId: "a",
  companyName: "Empresa sintética",
  scope: "ISO 45001:2018",
  date: "2026-10-18",
  auditorName: "Auditor sintético",
  status: "planned",
  results: {},
};
const res = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  v = ui();
  m.user = { uid: "user" };
  m.company = "a";
  m.fetch.mockReset().mockResolvedValue(res({ audits: [row], truncated: false }));
  m.token.mockReset().mockResolvedValue("token-a");
  m.add.mockReset().mockResolvedValue({ id: "new" });
  m.update.mockReset().mockResolvedValue(undefined);
  m.toast.mockReset();
  vi.stubGlobal("fetch", m.fetch);
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
  vi.restoreAllMocks();
});
async function openAudit() {
  await act(async () => v.container.querySelector<HTMLTableRowElement>("tbody tr")!.click());
}
describe("audit persistence workflows", () => {
  it("loads only the selected scope and exports the queried records", async () => {
    const make = vi.fn().mockReturnValue("blob:audit"),
      revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: make, revokeObjectURL: revoke }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await v.render(<Page />);
    expect(m.fetch.mock.calls[0][0]).toContain("company=a");
    expect(v.container.textContent).toContain("Auditor sintético");
    await v.click("Exportar auditorias CSV");
    expect(make).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:audit");
  });
  it("reports failure and retries without treating failure as compliance", async () => {
    m.fetch.mockResolvedValueOnce(res({}, false));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Não foi possível carregar");
    expect(v.button("Exportar auditorias CSV").disabled).toBe(true);
    await v.click("Tentar novamente");
    expect(v.container.textContent).toContain("Auditor sintético");
  });
  it("keeps checklist open until finished write completes", async () => {
    await v.render(<Page />);
    await openAudit();
    const boxes = [...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')];
    expect(boxes.length).toBeGreaterThan(0);
    await act(async () => boxes[0].click());
    const p = deferred<void>();
    m.update.mockReturnValueOnce(p.promise);
    await v.click("Encerrar e Protocolar");
    expect(m.toast).not.toHaveBeenCalled();
    expect(m.update.mock.lastCall![0]).toBe("companies/a/audits/audit");
    expect(Object.values(m.update.mock.lastCall![1].results)).toContain(true);
    await act(async () => p.resolve());
    expect(m.toast).toHaveBeenCalledWith({ title: "Auditoria Finalizada" });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("preserves checklist answers on failed finalization", async () => {
    await v.render(<Page />);
    await openAudit();
    await act(async () => document.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click());
    m.update.mockRejectedValueOnce(Error("denied"));
    await v.click("Encerrar e Protocolar");
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Não foi possível salvar a auditoria" })
    );
    expect(document.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
  });
  it("ignores a delayed previous-company response", async () => {
    const p = deferred<unknown>();
    m.fetch.mockReturnValueOnce(p.promise);
    await v.render(<Page />);
    m.company = "b";
    m.fetch.mockResolvedValueOnce(res({ audits: [], truncated: false }));
    await v.render(<Page />);
    await act(async () => p.resolve(res({ audits: [row], truncated: false })));
    expect(v.container.textContent).not.toContain("Auditor sintético");
  });
});
