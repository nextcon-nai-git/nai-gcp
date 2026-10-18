import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: null as any,
  scope: "a",
  global: false,
  upload: vi.fn(),
  add: vi.fn(),
  toast: vi.fn(),
  camera: vi.fn(),
  stop: vi.fn(),
  pdf: vi.fn(),
  pdfText: vi.fn(),
  queries: vi.fn(),
  directory: vi.fn(),
}));
const db = {},
  storage = {};
const companies = [
  { id: "a", name: "Empresa autorizada" },
  { id: "b", name: "Empresa de outra conta" },
];
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user }),
  useFirestore: () => db,
  useStorage: () => storage,
  useMemoFirebase: (f: () => unknown) => f(),
  useCollection: (q: string | null) => ({
    data: !q
      ? null
      : q === "companies"
        ? companies
        : [{ id: "employee", name: "Colaborador sintético", cpf: "00000000000" }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({
    activeClientId: m.scope,
    isGlobalStaff: m.global,
    canBrowseAllCompanies: m.global,
    authorizedCompanies: [m.scope],
  }),
}));
vi.mock("@/hooks/use-company-directory", () => ({
  useCompanyDirectory: (...args: unknown[]) => {
    m.directory(...args);
    return {
      data: m.user ? companies.filter((c) => m.global || c.id === m.scope) : [],
      isLoading: false,
      error: null,
    };
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...v: string[]) => {
    m.queries(v.join("/"));
    return v.join("/");
  },
  query: (q: unknown) => q,
  orderBy: vi.fn(),
  addDoc: m.add,
  serverTimestamp: () => "server-time",
}));
vi.mock("firebase/storage", () => ({ ref: (_s: unknown, p: string) => p, uploadString: m.upload }));
vi.mock("@/components/ui/select", () => import("../../../tests/ui/native-select"));
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFillColor = vi.fn();
    rect = vi.fn();
    setTextColor = vi.fn();
    setFontSize = vi.fn();
    setFont = vi.fn();
    text = m.pdfText;
    addImage = vi.fn();
    save = m.pdf;
  },
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "user-a" };
  m.scope = "a";
  m.global = false;
  for (const fn of [
    m.upload,
    m.add,
    m.toast,
    m.camera,
    m.stop,
    m.pdf,
    m.pdfText,
    m.queries,
    m.directory,
  ])
    fn.mockReset();
  m.upload.mockResolvedValue(undefined);
  m.add.mockResolvedValue({ id: "saved" });
  m.camera.mockResolvedValue({ getTracks: () => [{ stop: m.stop }] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: m.camera },
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn() },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as any);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,dGVzdA=="
  );
  vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(640);
  vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(480);
});
afterEach(async () => {
  await v.cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function fillInput(i: number, value: string) {
  const e = v.container.querySelectorAll("input")[i];
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(e, value);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function ready() {
  await v.render(<Page />);
  await v.input("select:nth-of-type(1)", "a");
  const sel = v.container.querySelectorAll("select")[1];
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(
      sel,
      "employee"
    );
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await fillInput(0, "Luva sintética");
  await fillInput(1, "123");
  await v.click("Prosseguir para Registro Fotográfico");
}
async function capture() {
  const b = Array.from(v.container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("CONFIRMAR")
  )!;
  expect(b).toBeDefined();
  await act(async () => b.click());
}
describe("PPE photographic receipt", () => {
  it("does not load employee data without an authenticated account", async () => {
    m.user = null;
    await v.render(<Page />);
    expect(m.queries.mock.calls.some((c) => String(c[0]).includes("employees"))).toBe(false);
  });
  it("lists only the permitted company", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Empresa autorizada");
    expect(v.container.textContent).not.toContain("Empresa de outra conta");
  });
  it("requires an explicit company choice in the global view", async () => {
    m.scope = "all";
    m.global = true;
    await v.render(<Page />);
    expect(v.container.querySelector("select")!.value).toBe("");
    expect(v.button("Prosseguir para Registro Fotográfico").disabled).toBe(true);
  });
  it("reports camera denial without saving a delivery", async () => {
    m.camera.mockRejectedValue(Error("denied"));
    await ready();
    await capture();
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Acesso à Câmera Negado" })
    );
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("stops the camera when leaving the page", async () => {
    await ready();
    await v.cleanup();
    expect(m.stop).toHaveBeenCalledOnce();
  });
  it("stops a camera grant that arrives after leaving", async () => {
    const p = deferred<any>();
    m.camera.mockReturnValue(p.promise);
    await ready();
    await v.cleanup();
    await act(async () => p.resolve({ getTracks: () => [{ stop: m.stop }] }));
    expect(m.stop).toHaveBeenCalledOnce();
  });
  it("does not save metadata when image storage fails", async () => {
    await ready();
    m.upload.mockRejectedValueOnce(Error("storage unavailable"));
    await capture();
    expect(m.add).not.toHaveBeenCalled();
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "A entrega não foi confirmada",
        description: "storage unavailable",
      })
    );
  });
  it("waits for metadata persistence and can retry a failed write", async () => {
    await ready();
    const p = deferred<any>();
    m.add.mockReturnValueOnce(p.promise);
    await capture();
    expect(v.container.textContent).not.toContain("Entrega registrada e salva");
    expect(m.toast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Entrega de EPI registrada" })
    );
    await act(async () => p.reject(Error("metadata unavailable")));
    await capture();
    expect(m.add).toHaveBeenCalledTimes(2);
    expect(m.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Entrega de EPI registrada" })
    );
  });
  it("records photo evidence as pending CA verification, then exports the stored receipt", async () => {
    await ready();
    await capture();
    expect(m.add).toHaveBeenCalledWith(
      "companies/a/ppe_deliveries",
      expect.objectContaining({
        companyId: "a",
        employeeId: "employee",
        evidenceType: "PHOTO",
        caStatus: "PENDENTE_VERIFICACAO",
        createdBy: "user-a",
        epiNome: "Luva sintética",
        numeroCA: "123",
      })
    );
    await v.click("PDF");
    expect(m.pdf).toHaveBeenCalledWith("Recibo_EPI_Colaborador_sint_tico.pdf");
    expect(m.pdfText.mock.calls.flat().join(" ")).toContain("GPS: Não informado");
  });
  it("does not link an upload completed after logout", async () => {
    await ready();
    const p = deferred<any>();
    m.upload.mockReturnValueOnce(p.promise);
    await capture();
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve(undefined));
    expect(m.add).not.toHaveBeenCalled();
  });
  it("clears selected employee and stops the camera when company scope changes", async () => {
    await ready();
    m.scope = "b";
    await v.render(<Page />);
    expect(v.container.querySelector("video")).toBeNull();
    expect(v.container.querySelectorAll("select")[1].value).toBe("");
    expect(m.stop).toHaveBeenCalled();
  });
  it("does not present photography as biometric authentication", async () => {
    await ready();
    expect(v.container.textContent).not.toMatch(/ASSINAR BIOMETRIA|Assinatura Biométrica/);
  });
});
