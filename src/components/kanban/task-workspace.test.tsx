import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { OpsTask } from "@/types/schema";
vi.mock("./kanban-board", () => ({
  KanbanBoard: ({ tasks }: { tasks: OpsTask[] }) => (
    <div data-testid="board">
      {tasks.map((t) => (
        <span key={t.companyId + t.id}>{t.title}</span>
      ))}
    </div>
  ),
}));
vi.mock("./task-edit-dialog", () => ({
  TaskEditDialog: ({ task }: { task: OpsTask }) => <div data-testid="editor">{task.title}</div>,
}));
import { TaskWorkspace } from "./task-workspace";
const tasks = [
  {
    id: "a",
    companyId: "a",
    companyName: "Time Now",
    title: "Avaliar Juruti",
    status: "todo",
    priority: "high",
    dueDate: "",
    location: "Juruti/PA",
    responsibleName: "Felipe",
  },
  {
    id: "b",
    companyId: "b",
    companyName: "Outra",
    title: "Revisar laudo",
    status: "done",
    priority: "medium",
    dueDate: "2026-10-27",
    responsibleName: "Ana",
  },
] as OpsTask[];
let root: Root, host: HTMLDivElement;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<TaskWorkspace tasks={tasks} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === text);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
it("keeps undated cards visible in calendar and opens their existing record", async () => {
  await click("Calendário");
  expect(host.textContent).toContain("Sem prazo (1)");
  const button = Array.from(host.querySelectorAll("button")).find((b) =>
    b.textContent?.startsWith("Avaliar Juruti")
  );
  await act(async () => button!.click());
  expect(host.querySelector('[data-testid="editor"]')?.textContent).toBe("Avaliar Juruti");
});
it("filters the same authorized dataset in list and people views", async () => {
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Filtrar responsável"]')!;
  await act(async () => {
    select.value = "Felipe";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("Lista");
  expect(host.querySelector("tbody")?.textContent).toContain("Avaliar Juruti");
  expect(host.querySelector("tbody")?.textContent).not.toContain("Revisar laudo");
  await click("Pessoas");
  expect(host.textContent).toContain("1 em aberto");
});
it("never fabricates coordinates from a place name", async () => {
  await click("Mapa");
  const place = Array.from(host.querySelectorAll("button")).find((b) =>
    b.textContent?.startsWith("Juruti/PA")
  )!;
  await act(async () => place.click());
  expect(host.textContent).toContain("Cadastre latitude e longitude");
  expect(host.querySelector("iframe")).toBeNull();
  expect(host.querySelector('a[target="_blank"]')?.getAttribute("href")).toContain("Juruti%2FPA");
});
