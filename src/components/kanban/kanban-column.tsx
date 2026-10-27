"use client";

import { useDroppable } from "@dnd-kit/core";
import { OpsTask, TaskStatus } from "@/types/schema";
import { TaskCard } from "./task-card";
import { taskKey } from "@/lib/task-workspace";
import { cn } from "@/lib/utils";

interface ColumnProps {
  id: TaskStatus;
  title: string;
  tasks: OpsTask[];
  color: string;
}

export function KanbanColumn({ id, title, tasks }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div className="flex flex-col h-full w-[290px] shrink-0">
      {/* Cabeçalho da Coluna */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          {title}
          <span className="bg-primary/5 text-primary text-[10px] px-2.5 py-0.5 rounded-full font-mono font-black">
            {tasks.length}
          </span>
        </h3>
      </div>

      {/* Área Droppable */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 rounded-xl transition-colors min-h-[350px] border border-border bg-muted/40",

          isOver
            ? "ring-4 ring-primary/5 bg-primary/10 border-primary/10 scale-[1.01]"
            : "bg-opacity-40"
        )}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={taskKey(task)} task={task} />
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="h-24 flex items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-lg mt-2">
            <span className="tracking-widest">Arraste aqui</span>
          </div>
        )}
      </div>
    </div>
  );
}
