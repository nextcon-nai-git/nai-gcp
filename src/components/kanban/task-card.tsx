"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { OpsTask } from "@/types/schema";
import {
  Clock,
  Building2,
  Sparkles,
  ListTodo,
  ShieldAlert,
  Hash,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskEditDialog } from "./task-edit-dialog";

const priorityStyles = {
  low: "border-l-slate-300",
  medium: "border-l-blue-400",
  high: "border-l-orange-500",
  critical: "border-l-red-600 shadow-lg shadow-red-500/10",
};

const priorityColors = {
  low: "text-slate-400 bg-slate-100 border-slate-200",
  medium: "text-blue-600 bg-blue-50 border-blue-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  critical: "text-red-600 bg-red-50 border-red-200",
};

function safeFormat(date: any, formatStr: string) {
  if (!date) return "";
  const d = new Date(date);
  if (!isValid(d)) return "";
  return format(d, formatStr, { locale: ptBR });
}

export function TaskCard({ task }: { task: OpsTask }) {
  const [isShaking, setIsShaking] = React.useState(false);
  const [isEditDialogOpen, setIsEditOpen] = React.useState(false);
  const prevTaskRef = React.useRef(task);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  React.useEffect(() => {
    if (
      prevTaskRef.current.lastComment !== task.lastComment ||
      prevTaskRef.current.progress !== task.progress ||
      prevTaskRef.current.status !== task.status ||
      prevTaskRef.current.title !== task.title ||
      prevTaskRef.current.responsibleId !== task.responsibleId
    ) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 800);
      prevTaskRef.current = task;
      return () => clearTimeout(timer);
    }
  }, [task]);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  const progress = task.progress !== undefined ? task.progress : task.status === "done" ? 100 : 0;
  const totalItems = task.checklist?.length || 0;
  const checkedItems = task.checklist?.filter((item) => item.checked).length || 0;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          if (transform) return;
          setIsEditOpen(true);
        }}
        className={cn(
          "relative p-6 mb-4 rounded-[1.75rem] cursor-grab active:cursor-grabbing transition-all",
          "bg-white border border-slate-200 hover:shadow-2xl hover:border-primary/10 hover:ring-4 ring-primary/5",
          "border-l-[8px]",
          priorityStyles[task.priority],
          isDragging ? "opacity-50 rotate-3 scale-105 shadow-2xl z-50" : "shadow-sm",
          isShaking ? "animate-shake ring-2 ring-accent border-accent" : ""
        )}
      >
        {/* 1. Header: Status Butler e Prioridade */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex flex-wrap gap-1.5">
            <Badge
              className={cn(
                "text-[8px] font-black uppercase h-5 px-3 rounded-lg border shadow-sm",
                priorityColors[task.priority]
              )}
            >
              {task.priority === "critical" ? "⚡ GARGALO" : task.priority.toUpperCase()}
            </Badge>
            {task.agentEnabled && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black text-[8px] h-5 px-2.5 rounded-lg flex items-center gap-1">
                <div className="size-1.5 bg-emerald-500 rounded-full animate-pulse" /> NAI BOT
              </Badge>
            )}
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "size-9 rounded-2xl flex items-center justify-center transition-all",
                    task.agentEnabled
                      ? "bg-accent text-primary shadow-lg scale-110"
                      : "bg-slate-50 text-slate-300 border border-slate-100"
                  )}
                >
                  {task.agentEnabled ? (
                    <Sparkles className="size-4 animate-pulse" />
                  ) : (
                    <ShieldAlert className="size-4" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-none rounded-xl p-3 shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {task.agentEnabled ? "Butler NAI Ativo" : "Monitoramento Manual"}
                </p>
                <p className="text-[9px] opacity-70 mt-1">
                  {task.agentEnabled
                    ? "Sincronização WhatsApp automática."
                    : "Aguardando atualização técnica."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 2. Título e Unidade Técnica */}
        <div className="space-y-2 mb-5 text-left">
          <h4 className="text-[14px] font-black text-primary leading-tight uppercase font-headline group-hover:text-accent transition-colors">
            {task.title}
          </h4>
          <div className="flex items-center gap-2">
            <Building2 className="size-3 text-slate-400 shrink-0" />
            <p className="text-[10px] font-black uppercase text-slate-600 truncate tracking-tight">
              {task.companyName}
            </p>
          </div>
        </div>

        {/* 3. CAMPOS CUSTOMIZADOS (Custom Fields) */}
        <div className="grid grid-cols-2 gap-2 mb-6 p-4 bg-slate-50/80 rounded-[1.25rem] border border-slate-100 shadow-inner group/fields">
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 tracking-widest">
              <Hash className="size-2.5" /> CNAE
            </p>
            <p className="text-[10px] font-bold text-primary font-mono">{task.cnae || "---"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 tracking-widest">
              <ShieldAlert className="size-2.5" /> Risco
            </p>
            <p className="text-[10px] font-black text-red-600 uppercase">
              Grau {task.riskDegree || "N/I"}
            </p>
          </div>
          {task.responsibleName && (
            <div className="space-y-1 col-span-2 border-t border-slate-200 pt-3 mt-1 flex justify-between items-center">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 tracking-widest">
                  <UserCheck className="size-2.5" /> Responsável
                </p>
                <p className="text-[10px] font-black text-accent truncate uppercase leading-none mt-1">
                  {task.responsibleName}
                </p>
              </div>
              <ChevronRight className="size-4 text-slate-300 group-hover/fields:translate-x-1 transition-transform" />
            </div>
          )}
        </div>

        {/* 4. Checklist Progress - Agile Standardization */}
        {totalItems > 0 && (
          <div className="space-y-2 mb-6">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
              <div className="flex items-center gap-2">
                <ListTodo className="size-3 text-accent" />
                <span className="text-slate-500">
                  Compliance: {checkedItems}/{totalItems}
                </span>
              </div>
              <span className={cn(progress === 100 ? "text-emerald-600" : "text-primary")}>
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-100 rounded-full" />
          </div>
        )}

        {/* 5. Footer: Datas e Equipe */}
        <div className="flex items-center justify-between pt-4 border-t border-dashed border-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Clock className="size-3 text-slate-400" />
            <span className="tracking-tighter uppercase">
              SLA: {safeFormat(task.dueDate, "dd/MM/yy")}
            </span>
          </div>

          <div className="flex items-center -space-x-3">
            <div className="size-9 rounded-2xl border-2 border-white bg-primary text-white flex items-center justify-center text-[9px] font-black uppercase shadow-lg group-hover:scale-110 transition-transform">
              NX
            </div>
            <div className="size-9 rounded-2xl border-2 border-white bg-slate-200 flex items-center justify-center text-[9px] font-black uppercase text-slate-400 shadow-md">
              {task.companyName.substring(0, 2)}
            </div>
          </div>
        </div>
      </div>

      <TaskEditDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditOpen} task={task} />
    </>
  );
}
