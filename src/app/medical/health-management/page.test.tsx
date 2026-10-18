import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  role: "SUPER_ADMIN",
  global: true,
  client: "all",
  error: null as Error | null,
  loading: false,
  userLoading: false,
  query: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  lastTarget: undefined as unknown,
}));
vi.mock("@/firebase", () => ({
  useFirestore: () => "db",
  useUser: () => ({ role: mock.role, isUserLoading: mock.userLoading }),
  useMemoFirebase: (factory: () => unknown) => factory(),
  useCollection: (target: unknown) => {
    mock.lastTarget = target;
    return { data: mock.rows, error: mock.error, isLoading: mock.loading };
  },
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ activeClientId: mock.client, isGlobalStaff: mock.global }),
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => path,
  query: mock.query,
  orderBy: (field: string, direction: string) => ({ field, direction }),
  where: (field: string, operator: string, value: string) => ({ field, operator, value }),
  limit: (count: number) => ({ limit: count }),
}));
vi.mock("@/components/medical/modals/NewAttendanceModal", () => ({
  NewAttendanceModal: () => <button>Novo Atendimento</button>,
}));
vi.mock("@/components/medical/tabs/AttendanceTab", () => ({
  AttendanceTab: ({
    attendances,
    loading,
  }: {
    attendances: Array<{ employeeName: string }>;
    loading: boolean;
  }) => (
    <div>
      {loading
        ? "Carregando lista"
        : attendances.map((row, i) => <p key={i}>{row.employeeName}</p>)}
    </div>
  ),
}));
import Page from "./page";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mock.role = "SUPER_ADMIN";
  mock.global = true;
  mock.client = "all";
  mock.error = null;
  mock.loading = false;
  mock.userLoading = false;
  mock.rows = [];
  mock.query.mockImplementation((...parts) => parts);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = () => act(async () => root.render(<Page />));
describe("health management source and access states", () => {
  it.each(["OPERATIONS", "HR", "ENGINEER"])(
    "does not query clinical records for %s",
    async (role) => {
      mock.role = role;
      await render();
      expect(mock.query).not.toHaveBeenCalled();
      expect(mock.lastTarget).toBeNull();
      expect(host.textContent).toContain("Seu perfil não pode consultar dados clínicos");
    }
  );
  it("does not issue a global query for a scoped professional", async () => {
    mock.role = "NURSE";
    mock.global = false;
    await render();
    expect(mock.query).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Selecione uma empresa autorizada");
  });
  it("scopes the query by company and discloses its result limit", async () => {
    mock.role = "NURSE";
    mock.global = false;
    mock.client = "company-a";
    await render();
    expect(mock.query).toHaveBeenCalledWith(
      "nursing_attendances",
      { field: "companyId", operator: "==", value: "company-a" },
      { field: "createdAt", direction: "desc" },
      { limit: 200 }
    );
    expect(host.textContent).toContain("até 200 registros recentes");
  });
  it("shows query failure without concluding that there are no records", async () => {
    mock.error = new Error("permission denied");
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "não significa ausência de registros"
    );
    expect(host.textContent).not.toContain("0 atendimentos");
  });
  it("starts in the current local month without invented health or compliance metrics", async () => {
    const now = new Date();
    mock.rows = [
      { employeeName: "Atual", createdAt: now.toISOString() },
      { employeeName: "Inválido", createdAt: "bad-date" },
      { employeeName: "Antigo", createdAt: "2020-01-01T12:00:00Z" },
    ];
    await render();
    expect((host.querySelector('input[type="month"]') as HTMLInputElement).value).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
    expect(host.textContent).toContain("Atual");
    expect(host.textContent).not.toContain("Antigo");
    expect(host.textContent).not.toContain("Inválido");
    expect(host.textContent).not.toContain("94%");
    expect(host.textContent).not.toContain("HIPAA");
    expect(host.textContent).not.toContain("Synced");
  });
});
