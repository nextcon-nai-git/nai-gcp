import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OpsTask } from "@/types/schema";
vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));
vi.mock("./task-edit-dialog", () => ({ TaskEditDialog: () => null }));
import { TaskCard } from "./task-card";
const task = {
  id: "task",
  title: "Obrigação do contrato",
  companyId: "company",
  companyName: "Cliente",
  type: "pgr",
  status: "todo",
  dueDate: "",
  checklist: [{ id: "1", text: "Conferir original", checked: false }],
} as OpsTask;
describe("contract task compatibility", () => {
  it("renders imported tasks with pending priority without crashing or inventing urgency", () => {
    const html = renderToStaticMarkup(<TaskCard task={task} />);
    expect(html).toContain("Obrigação do contrato");
    expect(html).toContain("Prioridade pendente");
    expect(html).not.toContain("MEDIUM");
  });
  it("preserves an explicitly assigned priority", () => {
    expect(renderToStaticMarkup(<TaskCard task={{ ...task, priority: "high" }} />)).toContain(
      "HIGH"
    );
  });
});
