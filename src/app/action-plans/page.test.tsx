import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { uid: "operator" },
  profile: { role: "ADMIN", companyId: "nextcon", tenantId: null } as Record<string, unknown>,
  query: vi.fn(),
  add: vi.fn(),
  toast: vi.fn(),
  error: null as Error | null,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: state.user, ...state.profile }),
  useFirestore: () => ({}),
  useMemoFirebase: (factory: () => unknown) => factory(),
  useDoc: () => ({ data: state.profile }),
  useCollection: (source: { path?: string } | null) => ({
    data: source?.path === "companies" ? [{ id: "client", name: "Cliente de teste" }] : [],
    isLoading: false,
    error: source?.path === "tasks" ? state.error : null,
  }),
}));
vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/"), group: false }),
  collectionGroup: (_db: unknown, path: string) => ({ path, group: true }),
  query: (source: unknown, ...constraints: unknown[]) => {
    state.query(source, constraints);
    return source;
  },
  where: () => ({}),
  orderBy: () => ({}),
  addDoc: state.add,
  serverTimestamp: () => "server-time",
}));
vi.mock("@/hooks/use-pgr-workspace", () => ({
  usePgrCollection: () => ({ data: [] }),
  usePgrCompanies: () => ({ data: [] }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/components/kanban/kanban-board", () => ({ KanbanBoard: () => <p>Quadro carregado</p> }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Box,
    DialogContent: Box,
    DialogHeader: Box,
    DialogTitle: Box,
    DialogDescription: Box,
    DialogTrigger: Box,
  };
});
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
  }) => (
    <select value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Selecione</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));
import Page from "./page";
let root: Root, host: HTMLDivElement;
const button = () =>
  Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent?.includes("Criar ordem") || b.textContent?.includes("Confirmando gravação")
  )!;
async function render() {
  await act(async () => root.render(<Page />));
}
async function fill() {
  const input = host.querySelector<HTMLInputElement>('input[placeholder^="Ex:"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      "Vistoria revisada"
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const select = host.querySelectorAll("select")[1];
    select.value = "client";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  state.user = { uid: "operator" };
  state.profile = { role: "ADMIN", companyId: "nextcon", tenantId: null };
  state.error = null;
  state.add.mockReset().mockResolvedValue({ id: "task" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
describe("operational handoff", () => {
  it.each(["SUPER_ADMIN", "ADMIN", "OPERATIONS"])(
    "shows global tasks to internal %s even with Nextcon company binding",
    async (role) => {
      state.profile.role = role;
      await render();
      expect(
        state.query.mock.calls.some(([source]) => source.path === "tasks" && source.group)
      ).toBe(true);
    }
  );
  it.each(["ADMIN", "OPERATIONS", "DOCTOR", "ENGINEER"])(
    "never opens global tasks for scoped %s",
    async (role) => {
      state.profile = { role, companyId: "client", tenantId: "tenant" };
      await render();
      expect(
        state.query.mock.calls.some(([source]) => source.path === "tasks" && source.group)
      ).toBe(false);
    }
  );
  it("shows a denied query as an error instead of an empty operation", async () => {
    state.error = new Error("Denied");
    await render();
    expect(host.textContent).toContain("Não foi possível consultar a operação");
    expect(host.textContent).not.toContain("Nenhuma intervenção designada");
  });
  it("waits for server confirmation, prevents duplicate clicks, and leaves deadlines pending", async () => {
    let finish!: (value: unknown) => void;
    state.add.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await fill();
    await act(async () => {
      button().click();
      button().click();
    });
    expect(state.add).toHaveBeenCalledOnce();
    expect(state.toast).not.toHaveBeenCalled();
    const payload = state.add.mock.calls[0][1];
    expect(payload.dueDate).toBe("");
    expect(payload).toMatchObject({ createdAt: "server-time", createdBy: "operator" });
    expect(payload).not.toHaveProperty("ai_risk_score");
    await act(async () => finish({ id: "task" }));
    expect(state.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Atividade Designada" })
    );
  });
  it("keeps form values and reports uncertainty after a failed write", async () => {
    state.add.mockRejectedValueOnce(new Error("Network"));
    await render();
    await fill();
    await act(async () => button().click());
    expect(state.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Gravação não confirmada" })
    );
    expect(host.querySelector<HTMLInputElement>('input[placeholder^="Ex:"]')!.value).toBe(
      "Vistoria revisada"
    );
  });
  it("does not show a late success in the next user's session", async () => {
    let finish!: (value: unknown) => void;
    state.add.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await fill();
    await act(async () => button().click());
    state.user = { uid: "other" };
    await render();
    await act(async () => finish({ id: "task" }));
    expect(state.toast).not.toHaveBeenCalled();
  });
});
