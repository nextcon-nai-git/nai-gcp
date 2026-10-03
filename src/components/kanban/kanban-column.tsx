"use client";

import { useDroppable } from "@dnd-kit/core";
import { OpsTask, TaskStatus } from "@/types/schema";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

interface ColumnProps {
  id: TaskStatus;
  title: string;
  tasks: OpsTask[];
  color: string;
}

export function KanbanColumn({ id, title, tasks, color }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div className="flex flex-col h-full w-full min-w-[300px]">
      {/* Cabeçalho da Coluna */}
      <div className="flex items-center justify-between mb-5 px-3">
        <h3 className="font-black text-primary/60 flex items-center gap-3 uppercase text-[10px] tracking-[0.2em]">
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
          "flex-1 p-3 rounded-[2.5rem] transition-all duration-300 min-h-[500px] border border-transparent shadow-inner",
          color,
          isOver
            ? "ring-4 ring-primary/5 bg-primary/10 border-primary/10 scale-[1.01]"
            : "bg-opacity-40"
        )}
      >
        <div className="space-y-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center text-primary/20 text-[10px] font-black uppercase border-2 border-dashed border-primary/5 rounded-3xl gap-2 mt-4">
            <span className="tracking-widest">Arraste aqui</span>
          </div>
        )}
      </div>
    </div>
  );
}
