import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  toast: vi.fn(),
  role: "NURSE",
  employeesLoading: false,
  employeeCompany: "company-a",
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mock.toast }) }));
vi.mock("@/hooks/use-company-directory", () => ({
  useCompanyDirectory: () => ({
    data: [
      { id: "company-a", name: "Empresa A" },
      { id: "company-b", name: "Empresa B" },
    ],
    isLoading: false,
    error: null,
  }),
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ isGlobalStaff: false, authorizedCompanies: ["company-a", "company-b"] }),
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  query: (ref: unknown) => ref,
  orderBy: vi.fn(),
  where: vi.fn(),
  addDoc: mock.save,
  serverTimestamp: () => "SERVER_TIME",
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({
    user: { uid: "nurse", displayName: "Profissional de teste" },
    role: mock.role,
  }),
  useFirestore: () => "db",
  useMemoFirebase: (fn: () => unknown) => fn(),
  useCollection: (ref: { path: string } | null) =>
    ref?.path === "companies"
      ? {
          data: [
            { id: "company-a", name: "Empresa A" },
            { id: "company-b", name: "Empresa B" },
          ],
        }
      : {
          data: ref
            ? [{ id: "patient", name: "Paciente de teste", companyId: mock.employeeCompany }]
            : null,
          isLoading: mock.employeesLoading,
        },
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DialogTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: React.PropsWithChildren<{
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
  }>) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Selecione</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
import { NewAttendanceModal } from "./NewAttendanceModal";
let host: HTMLDivElement, root: Root;
async function fill(selector: string, value: string) {
  const el = (
    selector === "patient-select"
      ? host.querySelectorAll("select")[1]
      : host.querySelector(selector)
  ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  await act(async () => {
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(
      new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })
    );
  });
}
const submit = () =>
  act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
async function validForm() {
  await fill("select", "company-a");
  await fill("patient-select", "patient");
  await fill("textarea", "Queixa informada");
  await fill('input[name="coren"]', "REGISTRO-SP");
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.clearAllMocks();
  mock.role = "NURSE";
  mock.employeesLoading = false;
  mock.employeeCompany = "company-a";
  mock.save.mockResolvedValue({ id: "record" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<NewAttendanceModal />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("nursing attendance form", () => {
  it("toggles care lines once from both label and input and saves their actual selection", async () => {
    await validForm();
    const label = [...host.querySelectorAll("label")].find((node) =>
      node.textContent?.includes("Pausa Ativa")
    )!;
    const input = label.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => label.click());
    expect(input.checked).toBe(true);
    await act(async () => input.click());
    expect(input.checked).toBe(false);
    await act(async () => label.click());
    await submit();
    expect(mock.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ care_lines: ["pausa_ativa"] })
    );
  });
  it("starts without a fabricated credential and validates it before writing", async () => {
    expect((host.querySelector('input[name="coren"]') as HTMLInputElement).value).toBe("");
    await validForm();
    await fill('input[name="coren"]', "");
    await submit();
    expect(mock.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Informe seu COREN");
  });
  it("waits for persistence before reporting success and attributes the actor", async () => {
    let resolve!: (value: unknown) => void;
    mock.save.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    );
    await validForm();
    await submit();
    expect(mock.toast).not.toHaveBeenCalled();
    expect(mock.save).toHaveBeenCalledWith(
      { path: "nursing_attendances" },
      expect.objectContaining({
        createdBy: "nurse",
        coren: "REGISTRO-SP",
        employeeId: "patient",
        status_esocial: "Não transmitido",
        timestamp: "SERVER_TIME",
      })
    );
    await act(async () => resolve({ id: "saved" }));
    expect(mock.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Atendimento salvo" })
    );
  });
  it("keeps entered data and reports a failed write without success", async () => {
    mock.save.mockRejectedValueOnce(new Error("Falha de conexão"));
    await validForm();
    await submit();
    expect(mock.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Atendimento não salvo", variant: "destructive" })
    );
    expect((host.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Queixa informada");
  });
  it("clears patient selection when switching company", async () => {
    await validForm();
    await fill("select", "company-b");
    await submit();
    expect(mock.save).not.toHaveBeenCalled();
    expect((host.querySelectorAll("select")[1] as HTMLSelectElement).value).toBe("");
  });
  it("rejects stale employee data from another company", async () => {
    await validForm();
    mock.employeeCompany = "company-b";
    await act(async () => root.render(<NewAttendanceModal />));
    await submit();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Atendimento não salvo" })
    );
  });
});
