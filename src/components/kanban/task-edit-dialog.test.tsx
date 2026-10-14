import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskEditDialog } from "./task-edit-dialog";
import type { OpsTask } from "@/types/schema";

const state = vi.hoisted(() => ({
  user: { uid: "reviewer" },
  db: {},
  updatePgrTask: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
}));
vi.mock("@/firebase", () => ({
  useUser: () => ({ user: state.user }),
  useFirestore: () => state.db,
  useStorage: () => null,
  useMemoFirebase: (factory: () => unknown) => factory(),
  useCollection: () => ({ data: [] }),
}));
vi.mock("firebase/firestore", () => ({
  doc: () => ({}),
  collection: () => ({}),
  query: () => ({}),
  orderBy: () => ({}),
  where: () => ({}),
}));
vi.mock("@/hooks/use-pgr-workspace", () => ({ updatePgrTask: state.updatePgrTask }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/contexts/sgi-context", () => ({
  useSgi: () => ({ isGlobalStaff: false, authorizedCompanies: [] }),
}));
vi.mock("@/firebase/non-blocking-updates", () => ({
  updateDocumentNonBlocking: vi.fn(),
  deleteDocumentNonBlocking: vi.fn(),
}));
vi.mock("@/components/pgr-agent-review", () => ({ PgrAgentReview: () => null }));
vi.mock("@/components/ui/sheet", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Sheet: Wrapper,
    SheetContent: Wrapper,
    SheetHeader: Wrapper,
    SheetTitle: Wrapper,
    SheetDescription: Wrapper,
    SheetFooter: Wrapper,
  };
});
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let element: HTMLDivElement;
let root: Root;

function fixture(clinical = false): OpsTask {
  return {
    id: "pgr_a_b",
    sourceType: "pgr",
    documentType: clinical ? "ASO" : "PGR",
    restricted: clinical,
    type: clinical ? "aso" : "pgr",
    title: "Revisão do documento",
    status: "todo",
    priority: "medium",
    companyId: "company-a",
    companyName: "Empresa de exemplo",
    dueDate: "2026-11-10",
    checklist: [
      { id: "required", text: "Conferir o documento original", checked: false, mandatory: true },
      { id: "optional", text: "Etapa complementar da equipe", checked: false, mandatory: false },
    ],
    createdAt: "2026-10-10",
    version: "pgr-evidence-v1",
    isDeleted: false,
  };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.updatePgrTask.mockClear();
  state.toast.mockClear();
  element = document.createElement("div");
  document.body.appendChild(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

async function render(task: OpsTask) {
  await act(async () => root.render(<TaskEditDialog task={task} isOpen onOpenChange={() => {}} />));
}
const inputWith = (value: string) =>
  Array.from(element.querySelectorAll("input")).find((input) => input.value === value)!;

describe("Imported operation card editing", () => {
  it("preserves mandatory text and source objects while saving checked status through the API", async () => {
    const task = fixture();
    task.checklist!.forEach(Object.freeze);
    Object.freeze(task.checklist);
    Object.freeze(task);
    await render(task);
    expect(inputWith("Conferir o documento original").readOnly).toBe(true);
    expect(inputWith("Etapa complementar da equipe").readOnly).toBe(false);
    expect(element.querySelectorAll('[aria-label="Remover item do checklist"]')).toHaveLength(1);
    const checkbox = element.querySelector<HTMLButtonElement>('button[role="checkbox"]')!;
    await act(async () => checkbox.click());
    expect(checkbox.getAttribute("data-state")).toBe("checked");
    expect(task.checklist![0].checked).toBe(false);
    const save = Array.from(element.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Protocolar Alterações")
    )!;
    await act(async () => save.click());
    expect(state.updatePgrTask).toHaveBeenCalledWith(
      state.user,
      task.companyId,
      task.id,
      expect.objectContaining({
        checklist: [
          { id: "required", text: "Conferir o documento original", checked: true, mandatory: true },
          {
            id: "optional",
            text: "Etapa complementar da equipe",
            checked: false,
            mandatory: false,
          },
        ],
      })
    );
  });

  it("keeps clinical cards administrative and prevents adding or changing free-form checklist text", async () => {
    await render(fixture(true));
    expect(inputWith("Revisão do documento").readOnly).toBe(true);
    expect(inputWith("Conferir o documento original").readOnly).toBe(true);
    expect(inputWith("Etapa complementar da equipe").readOnly).toBe(true);
    expect(element.querySelector('[aria-label="Remover item do checklist"]')).toBeNull();
    expect(element.querySelector('[placeholder="Adicionar etapa ao processo..."]')).toBeNull();
    expect(element.textContent).toContain("Consulte o conteúdo clínico no registro restrito");
    expect(element.querySelector<HTMLButtonElement>('button[role="checkbox"]')?.disabled).toBe(
      false
    );
  });
});
