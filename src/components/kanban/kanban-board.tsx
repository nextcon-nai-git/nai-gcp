"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { OpsTask, TaskStatus } from "@/types/schema";
import { KANBAN_COLUMNS as DEFAULT_COLUMNS } from "@/types/kanban";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { createPortal } from "react-dom";
import { useFirestore, useUser } from "@/firebase";
import { taskKey } from "@/lib/task-workspace";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { updatePgrTask } from "@/hooks/use-pgr-workspace";

interface KanbanBoardProps {
  tasks: OpsTask[];
  columns?: { id: any; title: string; color: string }[];
  boardType?: "commercial" | "operational";
}

function SpecialDropZone({
  id,
  label,
  icon: Icon,
  activeColor,
}: {
  id: string;
  label: string;
  icon: any;
  activeColor: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-2 p-6 rounded-3xl border-2 border-dashed transition-all duration-300",
        isOver
          ? cn("scale-105 border-transparent text-white shadow-2xl", activeColor)
          : "border-slate-200 bg-slate-50 text-slate-400 opacity-60"
      )}
    >
      <Icon className={cn("size-6", isOver ? "animate-bounce" : "")} />
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function KanbanBoard({ tasks: initialTasks, columns = DEFAULT_COLUMNS }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<OpsTask[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<OpsTask | null>(null);
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks.find((t) => taskKey(t) === active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const dropTargetId = over.id as string;

    const currentTask = tasks.find((t) => taskKey(t) === taskId);
    if (!currentTask || !currentTask.companyId) return;
    if (!["trash", "archive", ...columns.map((c) => c.id)].includes(dropTargetId)) return;
    if (currentTask.sourceType === "pgr") {
      if (!user) return;
      if (dropTargetId === "trash") {
        toast({
          title: "Arquive o card do PGR",
          description: "O arquivamento preserva o vínculo e o histórico do documento.",
        });
        return;
      }
      const nextStatus = dropTargetId === "archive" ? "archived" : dropTargetId;
      if (nextStatus === currentTask.status) return;
      try {
        await updatePgrTask(user, currentTask.companyId, currentTask.id, { status: nextStatus });
        setTasks((prev) =>
          nextStatus === "archived"
            ? prev.filter((t) => taskKey(t) !== taskId)
            : prev.map((t) =>
                taskKey(t) === taskId ? { ...t, status: nextStatus as TaskStatus } : t
              )
        );
        toast({
          title: "Card do PGR atualizado",
          description:
            "Alteração confirmada no cliente. Nenhum documento ou obrigação foi transmitido.",
        });
      } catch (e) {
        toast({
          variant: "destructive",
          title: "O card não foi atualizado",
          description: e instanceof Error ? e.message : "Tente novamente.",
        });
      }
      return;
    }
    if (!db) return;

    const taskRef = doc(db, "companies", currentTask.companyId, "tasks", currentTask.id);

    if (dropTargetId === "trash" && !confirm(`Excluir permanentemente "${currentTask.title}"?`))
      return;
    const newStatus = dropTargetId === "archive" ? "archived" : (dropTargetId as TaskStatus);
    if (newStatus === currentTask.status) return;
    try {
      if (dropTargetId === "trash") await deleteDoc(taskRef);
      else await updateDoc(taskRef, { status: newStatus });
      setTasks((prev) =>
        dropTargetId === "trash" || newStatus === "archived"
          ? prev.filter((t) => taskKey(t) !== taskId)
          : prev.map((t) => (taskKey(t) === taskId ? { ...t, status: newStatus as TaskStatus } : t))
      );
      toast({
        title: "Quadro atualizado",
        description: "Alteração salva. Nenhuma mensagem foi enviada.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível salvar",
        description: "O card permanece na etapa anterior. Tente novamente.",
      });
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-3 overflow-x-auto pb-4 scrollbar-thin flex-1">
          {columns.map((col) => (
            <div key={col.id} className="h-full shrink-0">
              <KanbanColumn
                id={col.id as TaskStatus}
                title={col.title}
                color={col.color}
                tasks={tasks.filter((t) => t.status === col.id)}
              />
            </div>
          ))}
        </div>

        {/* Zonas Especiais de Drop - Aparecem apenas durante o arraste */}
        {activeTask && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 flex gap-4 animate-in slide-in-from-bottom-10 duration-500 z-50">
            <SpecialDropZone
              id="archive"
              label="Arquivar"
              icon={Archive}
              activeColor="bg-amber-600"
            />
            <SpecialDropZone
              id="trash"
              label="Lixo (Excluir)"
              icon={Trash2}
              activeColor="bg-red-600"
            />
          </div>
        )}

        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay adjustScale={true}>
              {activeTask ? (
                <div className="rotate-3 scale-105 opacity-90 cursor-grabbing drop-shadow-2xl">
                  <TaskCard task={activeTask} preview />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}
