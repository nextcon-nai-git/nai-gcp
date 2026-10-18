import React, { act } from "react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { ui, deferred } from "../../../tests/ui/harness";
const m = vi.hoisted(() => ({
  user: { uid: "a" } as { uid: string } | null,
  data: [] as Record<string, unknown>[],
  error: null as Error | null,
  add: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
}));
const db = {};
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: m.user }),
  useFirestore: () => db,
  useCollection: () => ({ data: m.data, isLoading: false, error: m.error }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock("@/components/documents/document-upload-field", () => ({
  DocumentUploadField: () => <p>Anexos</p>,
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...v: string[]) => v.join("/"),
  doc: (_db: unknown, ...v: string[]) => v.join("/"),
  query: (base: unknown) => base,
  orderBy: vi.fn(),
  serverTimestamp: () => "server-time",
  addDoc: m.add,
  updateDoc: m.update,
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
}));
import Page from "./page";
let v: ReturnType<typeof ui>;
beforeEach(() => {
  v = ui();
  m.user = { uid: "a" };
  m.error = null;
  m.data = [
    {
      id: "one",
      name: "Pessoa sintética",
      role: "Administrativo",
      contractType: "CLT",
      unit: "Matriz",
      status: "ATIVO",
    },
    {
      id: "two",
      name: "Prestador sintético",
      role: "Consultor",
      contractType: "PJ / PRESTADOR",
      asoStatus: "APTO",
    },
  ];
  m.add.mockReset().mockResolvedValue({ id: "created" });
  m.update.mockReset();
  m.toast.mockReset();
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
async function form() {
  await v.click("Cadastrar Colaborador");
  await v.input('input[name="name"]', "Pessoa nova sintética");
  await v.input('input[name="role"]', "Administrativo");
}
describe("internal employee page", () => {
  it("uses registered counts and never asserts blanket eSocial compliance", async () => {
    await v.render(<Page />);
    expect(v.container.textContent).not.toContain("100%");
    expect(v.container.textContent).toContain("Sem situação de ASO confirmada");
    expect(v.container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(v.container.querySelector("tbody tr")?.textContent).toContain("PENDENTE");
    expect(v.container.querySelector("tbody tr")?.textContent).not.toContain("APTO");
    const pending = [...v.container.querySelectorAll("tbody tr:first-child td div")].find(
      (el) => el.textContent?.trim() === "PENDENTE"
    );
    expect(pending?.className).toContain("text-amber-400");
    expect(pending?.className).not.toContain("emerald");
    await v.input('input[placeholder^="Buscar por nome"]', "Consultor");
    expect(v.container.textContent).not.toContain("Pessoa sintética");
    expect(v.container.textContent).toContain("Prestador sintético");
  });
  it("reports load errors", async () => {
    m.data = [];
    m.error = Error("denied");
    await v.render(<Page />);
    expect(v.container.querySelector('[role="alert"]')?.textContent).toContain(
      "consultar a equipe"
    );
  });
  it("starts new ASO status as pending and saves only after confirmation", async () => {
    await v.render(<Page />);
    await form();
    const p = deferred<unknown>();
    m.add.mockReturnValueOnce(p.promise);
    await v.submit();
    await v.submit();
    expect(m.add).toHaveBeenCalledTimes(1);
    expect(m.add.mock.calls[0][1]).toMatchObject({
      name: "Pessoa nova sintética",
      asoStatus: "PENDENTE",
      documents: [],
    });
    expect(m.toast).not.toHaveBeenCalled();
    await act(async () => p.resolve({ id: "created" }));
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Colaborador salvo" }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("keeps form data after failure", async () => {
    await v.render(<Page />);
    await form();
    m.add.mockRejectedValueOnce(Error("denied"));
    await v.submit();
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Ficha não salva" }));
    expect(document.querySelector<HTMLInputElement>('input[name="name"]')?.value).toBe(
      "Pessoa nova sintética"
    );
    await v.submit();
    expect(m.add).toHaveBeenCalledTimes(2);
  });
  it("does not show success for an old account's late save", async () => {
    await v.render(<Page />);
    await form();
    const p = deferred<unknown>();
    m.add.mockReturnValueOnce(p.promise);
    await v.submit();
    m.user = { uid: "b" };
    await v.render(<Page />);
    await act(async () => p.resolve({ id: "created" }));
    expect(m.toast).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("hides data after logout", async () => {
    await v.render(<Page />);
    m.user = null;
    await v.render(<Page />);
    expect(v.container.textContent).toBe("");
  });
});
