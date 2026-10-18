import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a", getIdToken: vi.fn() } as {
    uid: string;
    getIdToken: ReturnType<typeof vi.fn>;
  } | null,
  scope: { activeClientId: "all", isGlobalStaff: true, isAuthorizedProvider: false },
  fetch: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
  extract: vi.fn(),
  draft: null as unknown,
}));
const db = {};
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user, role: "ADMIN", companyId: null, servedCompanies: [] }),
  useFirestore: () => db,
  useMemoFirebase: (f: () => unknown) => f(),
  useCollection: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/contexts/sgi-context", () => ({ useSgi: () => m.scope }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/lib/auth/action-token", () => ({ getActionIdToken: async () => "token" }));
vi.mock("@/ai/flows/document-autofill-flow", () => ({ extractDocumentAutofillData: m.extract }));
vi.mock("@/components/employees/employee-create-dialog", () => ({
  EmployeeCreateDialog: (p: { open: boolean; initialValues: unknown }) => {
    m.draft = p.initialValues;
    return p.open ? <p>Revisar antes de salvar</p> : null;
  },
}));
vi.mock("@/components/medical/exam-history-chart", () => ({ ExamHistoryChart: () => null }));
vi.mock("@/components/documents/document-upload-field", () => ({
  DocumentUploadField: () => null,
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...v: string[]) => v.join("/"),
  doc: (_db: unknown, ...v: string[]) => v.join("/"),
  query: (base: unknown) => base,
  orderBy: vi.fn(),
  where: vi.fn(),
  serverTimestamp: () => "server-time",
  addDoc: vi.fn(),
  updateDoc: m.update,
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
const rows = [
  {
    id: "shared",
    companyId: "a",
    name: "Pessoa sintética A",
    cpf: "sintético",
    job_role: { title: "Assistente" },
    nextAsoDate: "2020-01-01",
  },
  {
    id: "shared",
    companyId: "b",
    name: "Pessoa sintética B",
    job_role: { title: "Analista" },
    nextAsoDate: "2099-01-01",
  },
  { id: "archived", companyId: "a", name: "Pessoa arquivada", isArchived: true },
];
const res = (body: unknown, ok = true) => ({ ok, json: async () => body });
beforeEach(() => {
  v = ui();
  m.user = { uid: "a", getIdToken: vi.fn().mockResolvedValue("token-a") };
  m.scope = { activeClientId: "all", isGlobalStaff: true, isAuthorizedProvider: false };
  m.fetch.mockReset().mockResolvedValue(res({ employees: rows, truncated: false }));
  m.update.mockReset().mockResolvedValue(undefined);
  m.toast.mockReset();
  m.extract.mockReset();
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
async function archive() {
  await act(async () =>
    v.container.querySelector<HTMLButtonElement>('button[title="Arquivar Colaborador"]')!.click()
  );
}
describe("employee directory", () => {
  it("displays queried dates and hides archived rows", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Pessoa sintética A");
    expect(v.container.textContent).toContain("Vencido");
    expect(v.container.textContent).toContain("Regular");
    expect(v.container.textContent).not.toContain("Pessoa arquivada");
    await v.input('input[placeholder^="Pesquisar"]', "Pessoa sintética B");
    expect(v.container.textContent).not.toContain("Pessoa sintética A");
  });
  it("shows query failure and retries", async () => {
    m.fetch.mockResolvedValueOnce(res({}, false));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("Não foi possível consultar");
    await v.click("Tentar novamente");
    expect(v.container.textContent).toContain("Pessoa sintética A");
  });
  it("discloses partial results", async () => {
    m.fetch.mockResolvedValueOnce(res({ employees: rows, truncated: true }));
    await v.render(<Page />);
    expect(v.container.textContent).toContain("até 1.000 colaboradores");
  });
  it("does not archive without confirmation", async () => {
    await v.render(<Page />);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await archive();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("keeps records when archiving fails", async () => {
    await v.render(<Page />);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    m.update.mockRejectedValueOnce(Error("denied"));
    await archive();
    expect(v.container.textContent).toContain("Pessoa sintética A");
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Erro ao arquivar" }));
  });
  it("archives only the selected company when employee IDs repeat", async () => {
    await v.render(<Page />);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await archive();
    expect(m.update).toHaveBeenCalledWith("companies/a/employees/shared", {
      isArchived: true,
      archivedAt: "server-time",
    });
    expect(v.container.textContent).not.toContain("Pessoa sintética A");
    expect(v.container.textContent).toContain("Pessoa sintética B");
  });
  it("starts a manual draft without persisting", async () => {
    await v.render(<Page />);
    await v.click("Novo Colaborador");
    expect(v.container.textContent).toContain("Revisar antes de salvar");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("clears data on logout and cancels pending credential reads", async () => {
    const p = deferred<string>();
    m.user!.getIdToken.mockReturnValueOnce(p.promise);
    await v.render(<Page />);
    m.user = null;
    await v.render(<Page />);
    await act(async () => p.resolve("stale"));
    expect(m.fetch).not.toHaveBeenCalled();
    expect(v.container.textContent).toBe("");
  });
});
