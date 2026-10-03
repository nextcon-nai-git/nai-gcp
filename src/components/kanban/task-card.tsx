"use client";

import { useDraggable } from "@dnd-kit/core";
import { OpsTask, Priority, TaskType } from "@/types/schema";
import {
  AlertCircle,
  Calendar,
  FileText,
  HardHat,
  ShieldCheck,
  Clock,
  Brain,
  CheckSquare,
  Zap,
  Building2,
  Sparkles,
  ArrowRightCircle,
  Briefcase,
  TrendingUp,
  MapPin,
  User,
  Phone,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

const TypeIcon = ({ type }: { type: TaskType }) => {
  switch (type) {
    case "pgr":
      return <FileText className="w-4 h-4 text-blue-600" />;
    case "treinamento":
      return <HardHat className="w-4 h-4 text-orange-600" />;
    case "esocial":
      return <Zap className="w-4 h-4 text-purple-600" />;
    case "pcmso":
      return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    case "ltcat":
      return <FileText className="w-4 h-4 text-indigo-600" />;
    case "iot_check":
      return <Clock className="w-4 h-4 text-amber-600" />;
    case "vistoria":
      return <MapPin className="w-4 h-4 text-blue-500" />;
    case "comercial":
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
};

const priorityStyles = {
  low: "border-l-slate-300",
  medium: "border-l-blue-400",
  high: "border-l-orange-500",
  critical: "border-l-red-600 shadow-lg shadow-red-500/10",
};

function safeFormat(date: any, formatStr: string) {
  if (!date) return "---";
  const d = new Date(date);
  if (!isValid(d)) return "---";
  return format(d, formatStr);
}

export function TaskCard({ task }: { task: OpsTask }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: task,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  const checklist = task.checklist || [];
  const completedChecks = checklist.filter((c) => c.checked).length;
  const totalChecks = checklist.length;
  const progress = totalChecks > 0 ? (completedChecks / totalChecks) * 100 : 0;

  // Visual marker for real data vs mocks - made generic
  const isPriorityCase = task.ai_risk_score !== undefined && task.ai_risk_score > 50;

  const handlePromoteToOps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db || !task.companyId) return;
    const taskRef = doc(db, "companies", task.companyId, "tasks", task.id);
    updateDocumentNonBlocking(taskRef, { status: "started" });
    toast({
      title: "Promovido para Operação",
      description: "O projeto agora está na fase 'Projeto Iniciado' da engenharia.",
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "relative p-5 mb-4 rounded-3xl cursor-grab active:cursor-grabbing group touch-none transition-all",
        "bg-white/80 backdrop-blur-sm border border-slate-100 hover:bg-white hover:scale-[1.02]",
        "border-l-[8px]",
        priorityStyles[task.priority],
        isDragging ? "opacity-50 rotate-2 scale-105 shadow-2xl" : "shadow-sm",
        isPriorityCase && "ring-1 ring-primary/5 bg-gradient-to-br from-white to-blue-50/30"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <TypeIcon type={task.type} />
              {task.type}
            </span>
            {task.origin?.includes("commercial") && (
              <Badge className="bg-blue-50 text-blue-600 text-[7px] font-black border-none uppercase px-1.5 h-4 gap-1">
                <BarChart3 className="size-2" /> Vindo do Comercial
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-black text-primary leading-tight font-headline uppercase tracking-tight">
            {task.title}
          </h4>
        </div>

        {task.ai_risk_score !== undefined && (
          <div
            className={cn(
              "size-10 rounded-2xl flex flex-col items-center justify-center border shadow-inner shrink-0",
              task.ai_risk_score > 70 ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
            )}
          >
            <Brain
              className={cn("size-3.5", task.ai_risk_score > 70 ? "text-red-500" : "text-blue-500")}
            />
            <span className="text-[9px] font-black">{task.ai_risk_score}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="size-6 rounded-lg bg-primary/5 flex items-center justify-center">
          <Building2 className="size-3.5 text-primary/40" />
        </div>
        <span className="text-[10px] font-black text-slate-500 truncate uppercase tracking-tighter">
          {task.companyName || "Unidade Técnica"}
        </span>
      </div>

      {(task as any).metadata?.contato_nome && (
        <div className="mb-5 p-3 bg-white/50 rounded-2xl border border-dashed border-emerald-200 space-y-2">
          <p className="text-[8px] font-black uppercase text-emerald-600 flex items-center gap-1">
            <Sparkles className="size-2.5" /> Lead Externo
          </p>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold text-primary flex items-center gap-1.5 uppercase">
              <User className="size-3 text-slate-400" /> {(task as any).metadata.contato_nome}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 tracking-widest">
          <span className="flex items-center gap-1.5">
            <CheckSquare className="size-3.5 text-accent" />
            Conformidade: {completedChecks}/{totalChecks}
          </span>
          <span className="text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              progress === 100 ? "bg-accent" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {task.status === "implementation" && (
        <Button
          onClick={handlePromoteToOps}
          className="w-full mt-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-widest rounded-xl gap-2 shadow-lg"
        >
          <ArrowRightCircle className="size-3.5" /> Ativar Operação
        </Button>
      )}

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-dashed border-slate-100">
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-50 px-3 py-1.5 rounded-xl">
          <Calendar className="w-3.5 h-3.5" />
          <span>{safeFormat(task.dueDate, "dd/MM/yyyy")}</span>
        </div>

        <div className="flex items-center gap-2">
          {isPriorityCase && (
            <div
              className="size-8 rounded-2xl bg-accent/10 flex items-center justify-center text-accent"
              title="Monitoramento Ativo"
            >
              <Sparkles className="size-4" />
            </div>
          )}
          <div className="size-8 rounded-2xl bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-primary/20">
            NC
          </div>
        </div>
      </div>
    </div>
  );
}
