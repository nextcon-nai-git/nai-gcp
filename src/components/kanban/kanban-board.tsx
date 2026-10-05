"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
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
import { doc } from "firebase/firestore";
import {
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Archive, Sparkles } from "lucide-react";
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

export function KanbanBoard({
  tasks: initialTasks,
  columns = DEFAULT_COLUMNS,
  boardType = "operational",
}: KanbanBoardProps) {
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
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const dropTargetId = over.id as string;

    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || !currentTask.companyId) return;
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
            ? prev.filter((t) => t.id !== taskId)
            : prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus as TaskStatus } : t))
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

    const taskRef = doc(db, "companies", currentTask.companyId, "tasks", taskId);

    // --- LÓGICA DE EXCLUSÃO (LIXO) ---
    if (dropTargetId === "trash") {
      if (confirm(`Deseja excluir permanentemente o card "${currentTask.title}"?`)) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        deleteDocumentNonBlocking(taskRef);
        toast({ title: "Card Excluído", description: "O registro foi removido da base Nextcon." });
      }
      return;
    }

    // --- LÓGICA DE ARQUIVAMENTO ---
    if (dropTargetId === "archive") {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      updateDocumentNonBlocking(taskRef, { status: "archived" });
      toast({
        title: "Card Arquivado",
        description: "O registro será mantido por 1 ano para fins de auditoria.",
      });
      return;
    }

    // --- LÓGICA DE TRANSIÇÃO ENTRE COLUNAS ---
    const newStatus = dropTargetId as TaskStatus;
    if (currentTask.status === newStatus) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    if (boardType === "commercial" && newStatus === "implementation") {
      toast({
        title: "Iniciando Implantação",
        description: "O projeto está sendo preparado para a engenharia.",
      });
    }

    updateDocumentNonBlocking(taskRef, { status: newStatus });

    if (newStatus === "done") {
      toast({
        title: "Tarefa Finalizada",
        description: "Gatilhando automação de documentos e envio eSocial...",
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
        <div className="flex h-full gap-6 overflow-x-auto pb-4 scrollbar-thin flex-1">
          {columns.map((col) => (
            <div key={col.id} className="h-full">
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
              label="Arquivar (1 Ano)"
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
                  <TaskCard task={activeTask} />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </div>
  );
}
