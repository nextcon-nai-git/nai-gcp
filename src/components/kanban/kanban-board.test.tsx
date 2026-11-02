import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { OpsTask } from "@/types/schema";
const state = vi.hoisted(() => ({
  drag: null as null | ((event: unknown) => Promise<void>),
  update: vi.fn(),
  toast: vi.fn(),
  doc: vi.fn(),
  pgr: vi.fn(),
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    state.drag = onDragEnd;
    return <div>{children}</div>;
  },
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  PointerSensor: {},
  KeyboardSensor: {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  closestCorners: vi.fn(),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));
vi.mock("./kanban-column", () => ({
  KanbanColumn: ({ title, tasks }: any) => (
    <section aria-label={title}>
      {tasks.map((t: OpsTask) => (
        <span key={t.companyId + t.id}>{t.title}</span>
      ))}
    </section>
  ),
}));
vi.mock("./task-card", () => ({ TaskCard: () => null }));
vi.mock("@/firebase", () => ({
  useFirestore: () => ({}),
  useUser: () => ({ user: { uid: "admin" } }),
}));
vi.mock("firebase/firestore", () => ({
  doc: state.doc,
  updateDoc: state.update,
  deleteDoc: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/hooks/use-pgr-workspace", () => ({ updatePgrTask: state.pgr }));
import { KanbanBoard } from "./kanban-board";
let root: Root, host: HTMLDivElement;
const task = { id: "duplicate", companyId: "a", title: "Cliente A", status: "todo" } as OpsTask;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.update.mockReset().mockResolvedValue(undefined);
  state.toast.mockClear();
  state.doc.mockClear();
  state.pgr.mockReset().mockResolvedValue(undefined);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () =>
    root.render(<KanbanBoard tasks={[task, { ...task, companyId: "b", title: "Cliente B" }]} />)
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it("updates only the matching company and confirms persistence before success", async () => {
  await act(async () => state.drag!({ active: { id: "b/duplicate" }, over: { id: "doing" } }));
  expect(state.doc).toHaveBeenCalledWith(expect.anything(), "companies", "b", "tasks", "duplicate");
  expect(host.querySelector('[aria-label="Planejamento"]')?.textContent).toContain("Cliente A");
  expect(host.querySelector('[aria-label="Em Execução"]')?.textContent).toContain("Cliente B");
});
it("retains the original column on rejected write", async () => {
  state.update.mockRejectedValue(new Error("permission-denied"));
  await act(async () => state.drag!({ active: { id: "a/duplicate" }, over: { id: "doing" } }));
  expect(host.querySelector('[aria-label="Planejamento"]')?.textContent).toContain("Cliente A");
  expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
});
it("does not persist an arbitrary drop target as status", async () => {
  await act(async () =>
    state.drag!({ active: { id: "a/duplicate" }, over: { id: "b/duplicate" } })
  );
  expect(state.update).not.toHaveBeenCalled();
});
it("sends the original PGR id through the authorized endpoint", async () => {
  await act(async () => root.render(<KanbanBoard tasks={[{ ...task, sourceType: "pgr" }]} />));
  await act(async () => state.drag!({ active: { id: "a/duplicate" }, over: { id: "doing" } }));
  expect(state.pgr).toHaveBeenCalledWith({ uid: "admin" }, "a", "duplicate", { status: "doing" });
  expect(state.update).not.toHaveBeenCalled();
});
