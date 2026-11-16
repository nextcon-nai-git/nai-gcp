import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
import { brasiliaDay, eligibleCltEmployee, employeeCollectionPath } from "@/lib/time-tracking";

const m = vi.hoisted(() => ({
  user: { uid: "staff-a", getIdToken: async () => "token" } as {
    uid: string;
    getIdToken: () => Promise<string>;
  } | null,
  scope: { activeClientId: "all", isGlobalStaff: true },
  employees: [] as Record<string, unknown>[],
  punches: {} as Record<string, Record<string, unknown>[]>,
  paths: [] as string[],
  error: null as Error | null,
  post: vi.fn(),
  toast: vi.fn(),
}));
const db = {};
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user, role: "OPERATIONS", tenantId: null, companyId: null }),
  useFirestore: () => db,
  useDoc: () => ({ data: null, isLoading: false, error: null }),
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: (path: string | null) => {
    if (path) m.paths.push(path);
    return {
      data: path
        ? path.includes("time_clock_entries")
          ? m.punches[path] || []
          : m.employees
        : null,
      isLoading: false,
      error: m.error,
    };
  },
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => m.scope }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...segments: string[]) => segments.join("/"),
  doc: (_db: unknown, ...segments: string[]) => segments.join("/"),
  query: (path: string, constraint: string) => `${path}?${constraint}`,
  where: (_field: string, _op: string, value: string) => value,
}));
vi.mock("@/components/ui/select", () => {
  const Selection = React.createContext<(id: string) => void>(() => {});
  return {
    Select: ({
      onValueChange,
      children,
    }: {
      onValueChange: (id: string) => void;
      children: React.ReactNode;
    }) => <Selection.Provider value={onValueChange}>{children}</Selection.Provider>,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const choose = React.useContext(Selection);
      return <button onClick={() => choose(value)}>{children}</button>;
    },
  };
});
import Page from "./page";
let v: ReturnType<typeof ui>;
const person = {
  id: "internal-6",
  name: "Pessoa interna sintética",
  contractType: "CLT",
  status: "ATIVO",
  role: "Supervisão",
};
beforeEach(() => {
  v = ui();
  m.user = { uid: "staff-a", getIdToken: async () => "token" };
  m.scope = { activeClientId: "all", isGlobalStaff: true };
  m.employees = [person];
  m.punches = {};
  m.paths = [];
  m.error = null;
  m.post
    .mockReset()
    .mockResolvedValue(Response.json({ punch: { time: "08:00:00", reference: "server-ref" } }));
  vi.stubGlobal("fetch", m.post);
  m.toast.mockReset();
});
afterEach(async () => {
  await v.cleanup();
  vi.unstubAllGlobals();
});

describe("ponto do cadastro interno", () => {
  it("consults the NXC roster and requires explicit selection", async () => {
    await v.render(<Page />);
    expect(m.paths).toContain("nxc_employees");
    expect(m.paths.join()).not.toContain("piloto_empresa_demo");
    expect(v.button("1. Entrada").disabled).toBe(true);
    await v.click(person.name);
    expect(v.button("1. Entrada").disabled).toBe(false);
    expect(v.container.textContent).toContain("Supervisão");
  });
  it("excludes dismissed and non-CLT employees", async () => {
    m.employees.push(
      { ...person, id: "fired", name: "Desligada", status: "DEMITIDO" },
      { ...person, id: "intern", name: "Estagiária", contractType: "ESTÁGIO" },
      { ...person, id: "unknown", name: "Sem regime", contractType: "" }
    );
    await v.render(<Page />);
    expect(v.container.textContent).not.toMatch(/Desligada|Estagiária|Sem regime/);
  });
  it("writes to the same internal employee even without CPF or companyId", async () => {
    await v.render(<Page />);
    await v.click(person.name);
    await v.click("1. Entrada");
    expect(m.post).toHaveBeenCalledWith(
      "/api/time-tracking/punch",
      expect.objectContaining({ method: "POST" })
    );
    expect(JSON.parse(m.post.mock.calls[0][1].body)).toEqual({
      companyId: "all",
      employeeId: person.id,
      type: "entrada",
    });
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Entrada Registrada 🌅" })
    );
  });
  it("never overwrites an existing punch or reports a failed write as successful", async () => {
    m.post.mockResolvedValue(Response.json({ error: "Batida já registrada." }, { status: 409 }));
    await v.render(<Page />);
    await v.click(person.name);
    await v.click("1. Entrada");
    expect(m.post).toHaveBeenCalledOnce();
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao registrar ponto" })
    );
  });
  it("clears selection and scopes reads and writes when changing company", async () => {
    await v.render(<Page />);
    await v.click(person.name);
    m.scope.activeClientId = "client-a";
    await v.render(<Page />);
    expect(v.button("1. Entrada").disabled).toBe(true);
    expect(m.paths).toContain("companies/client-a/employees");
    await v.click(person.name);
    await v.click("1. Entrada");
    expect(JSON.parse(m.post.mock.calls[0][1].body)).toMatchObject({
      companyId: "client-a",
      employeeId: person.id,
    });
  });
  it("reads saved punches and separates them on employee changes", async () => {
    m.employees.push({ ...person, id: "second", name: "Outra pessoa" });
    m.punches[`nxc_employees/internal-6/time_clock_entries?${brasiliaDay(new Date())}`] = [
      {
        id: "saved",
        type: "entrada",
        time: "08:15:00",
        timestamp: new Date().toISOString(),
        reference: "saved-ref",
      },
    ];
    await v.render(<Page />);
    await v.click(person.name);
    expect(v.container.textContent).toContain("08:15:00");
    expect(v.button("1. Entrada").disabled).toBe(true);
    await v.click("Outra pessoa");
    expect(v.container.textContent).not.toContain("08:15:00");
    expect(v.button("1. Entrada").disabled).toBe(false);
  });
  it("reports load failures and blocks punching", async () => {
    m.error = Error("offline");
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Não foi possível consultar os colaboradores");
    expect(v.button("1. Entrada").disabled).toBe(true);
  });
  it("does not carry an in-flight success into another account", async () => {
    const save = deferred<Response>();
    m.post.mockReturnValue(save.promise);
    await v.render(<Page />);
    await v.click(person.name);
    await v.click("1. Entrada");
    m.user = { uid: "staff-b", getIdToken: async () => "token-b" };
    await v.render(<Page />);
    await act(async () =>
      save.resolve(Response.json({ punch: { time: "08:00:00", reference: "test" } }))
    );
    expect(m.toast).not.toHaveBeenCalled();
    expect(v.button("1. Entrada").disabled).toBe(true);
  });
});

describe("scope and eligibility", () => {
  it("denies unauthorized global scopes and uses the Brasília calendar day", () => {
    expect(employeeCollectionPath("all", false)).toBeNull();
    expect(employeeCollectionPath("unauthorized", true)).toBeNull();
    expect(employeeCollectionPath("client/other", true)).toBeNull();
    expect(brasiliaDay(new Date("2026-10-21T01:30:00Z"))).toBe("2026-10-20");
    expect(eligibleCltEmployee({ ...person, contractType: " clt ", status: "active" })).toBe(true);
    expect(eligibleCltEmployee({ ...person, active: false })).toBe(false);
    expect(eligibleCltEmployee({ ...person, status: "fired" })).toBe(false);
  });
});
