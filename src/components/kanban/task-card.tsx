"use client";
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { OpsTask } from "@/types/schema";
import {
  CalendarDays,
  CheckSquare,
  GripVertical,
  MapPin,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { displayTaskDate, priorityLabels, taskKey, isOverdue } from "@/lib/task-workspace";
import { TaskEditDialog } from "./task-edit-dialog";

export function TaskCard({ task, preview = false }: { task: OpsTask; preview?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: preview ? `preview:${taskKey(task)}` : taskKey(task),
    disabled: preview,
    data: task,
  });
  const checked = task.checklist?.filter((item) => item.checked).length || 0;
  const total = task.checklist?.length || 0;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );
  const priority = priorityLabels[task.priority];
  return (
    <>
      <article
        ref={setNodeRef}
        style={
          transform
            ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
            : undefined
        }
        className={cn(
          "rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md",
          isDragging && "opacity-40"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              task.priority === "critical"
                ? "bg-red-500/15 text-red-500"
                : task.priority === "high"
                  ? "bg-orange-500/15 text-orange-500"
                  : "bg-blue-500/10 text-blue-500"
            )}
          >
            {priority || "Prioridade pendente"}
          </span>
          <button
            {...listeners}
            {...attributes}
            aria-label={`Mover ${task.title}`}
            className="touch-none rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <GripVertical className="size-4" />
          </button>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
        >
          <h4 className="text-sm font-semibold leading-5 break-words">{task.title}</h4>
          <p className="mt-1 truncate text-xs text-muted-foreground">{task.companyName}</p>
          {task.description && !task.restricted && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          {task.location && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{task.location}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                isOverdue(task, today) && "text-red-500 font-semibold"
              )}
            >
              <CalendarDays className="size-3.5" />
              {displayTaskDate(task.dueDate)}
            </span>
            {!!total && (
              <span className="inline-flex items-center gap-1" title="Etapas concluídas">
                <CheckSquare className="size-3.5" />
                {checked}/{total}
              </span>
            )}
            {task.lastComment && (
              <MessageSquare aria-label="Possui atualização" className="size-3.5" />
            )}
          </div>
          <div className="mt-3 border-t border-border pt-2 flex items-center gap-2 text-xs">
            <UserRound className="size-4 text-muted-foreground" />
            {task.responsibleName || "Sem responsável"}
          </div>
        </button>
      </article>
      {open && <TaskEditDialog task={task} isOpen={open} onOpenChange={setOpen} />}
    </>
  );
}
