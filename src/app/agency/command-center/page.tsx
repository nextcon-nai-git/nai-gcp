"use client";

import * as React from "react";
import {
  ShieldAlert,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LayoutDashboard,
  MoreVertical,
  Plus,
  Building2,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface KanbanAction {
  id: number;
  title: string;
  client: string;
  category: string;
  status: string;
}

const initialActions: KanbanAction[] = [
  {
    id: 1,
    title: "Atualizar Inventário GES 01",
    client: "UNIDADE ALFA",
    category: "PGR",
    status: "Para Fazer",
  },
  {
    id: 2,
    title: "Treinamento Direção Defensiva",
    client: "UNIDADE BETA",
    category: "Treinamento",
    status: "Em Andamento",
  },
  {
    id: 3,
    title: "Renovação de PCMSO",
    client: "UNIDADE GAMA",
    category: "Saúde",
    status: "Para Fazer",
  },
  {
    id: 4,
    title: "Ata da CIPA Outubro",
    client: "UNIDADE DELTA",
    category: "Gestão",
    status: "Concluído",
  },
  {
    id: 5,
    title: "Laudo de Insalubridade",
    client: "UNIDADE EPSILON",
    category: "LTCAT",
    status: "Bloqueado",
  },
];

const redFlags = [
  {
    id: 1,
    type: "PGR Vencendo",
    client: "UNIDADE ALFA",
    item: "Setor Operacional",
    deadline: "13/08/2026",
    status: "Monitorar",
  },
  {
    id: 2,
    type: "Exame Atrasado",
    client: "UNIDADE BETA",
    item: "Audiometria - Colaborador X",
    deadline: "Há 12 dias",
    status: "Alerta",
  },
  {
    id: 3,
    type: "Treinamento NR-35",
    client: "UNIDADE ETA",
    item: "Trabalho em Altura",
    deadline: "Amanhã",
    status: "Crítico",
  },
];

export default function AgencyCommandCenter() {
  const { toast } = useToast();
  const [actions, setActions] = React.useState<KanbanAction[]>(initialActions);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);

  const columns = ["Para Fazer", "Em Andamento", "Bloqueado", "Concluído"];

  const onDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id.toString());
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const onDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));

    setActions((prev) =>
      prev.map((action) => (action.id === id ? { ...action, status: newStatus } : action))
    );

    const actionTitle = actions.find((a) => a.id === id)?.title;
    toast({
      title: "Status Atualizado",
      description: `"${actionTitle}" movido para ${newStatus}.`,
    });
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight uppercase">
            Centro de Comando NEXTCON
          </h1>
          <p className="text-muted-foreground">
            Visão unificada da empresa para gestão de múltiplos clientes.
          </p>
        </div>
        <div className="flex gap-3">
          <Badge
            variant="outline"
            className="text-primary border-primary px-4 py-1.5 font-bold bg-white shadow-sm"
          >
            REDER NEXTCON: GESTÃO ESTRATÉGICA
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 card-shadow border-none bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <CalendarDays className="size-4" /> Alertas de Vigência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {redFlags.map((flag) => (
              <div
                key={flag.id}
                className="p-3 bg-white rounded-xl border border-blue-100 shadow-sm space-y-1 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-black text-primary uppercase tracking-tighter">
                    {flag.client}
                  </p>
                  <Badge
                    className={`text-[8px] px-1.5 h-4 font-black ${flag.status === "Crítico" ? "bg-red-600" : "bg-primary"}`}
                  >
                    {flag.status}
                  </Badge>
                </div>
                <p className="text-xs font-bold text-primary leading-tight">{flag.type}</p>
                <p className="text-[10px] text-muted-foreground">{flag.item}</p>
                <div className="flex items-center gap-1 text-[10px] text-primary font-black pt-1">
                  <Clock className="size-3" /> {flag.deadline}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 card-shadow border-none overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
            <div>
              <CardTitle className="text-lg font-headline font-bold text-primary">
                Kanban Unificado de Ações
              </CardTitle>
              <CardDescription>Tarefas operacionais da empresa e dos clientes.</CardDescription>
            </div>
            <button className="p-2 hover:bg-muted rounded-full transition-colors bg-white shadow-sm border">
              <Plus className="size-5 text-primary" />
            </button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[500px]">
              {columns.map((col) => (
                <div
                  key={col}
                  className="flex flex-col gap-3"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, col)}
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black uppercase text-primary/60 tracking-widest">
                      {col}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold bg-primary/5 text-primary"
                    >
                      {actions.filter((a) => a.status === col).length}
                    </Badge>
                  </div>

                  <div
                    className={`flex-1 rounded-2xl p-2 border-2 border-dashed transition-all duration-200 flex flex-col gap-3 ${draggedId !== null ? "border-primary/20 bg-primary/5 scale-[0.98]" : "border-muted bg-muted/20"}`}
                  >
                    {actions
                      .filter((a) => a.status === col)
                      .map((action) => (
                        <div
                          key={action.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, action.id)}
                          onDragEnd={onDragEnd}
                          className="p-4 bg-white rounded-xl shadow-sm border border-muted space-y-3 cursor-grab active:cursor-grabbing hover:ring-2 ring-primary/10 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <Badge className="text-[8px] font-black bg-primary text-white border-none uppercase">
                              {action.category}
                            </Badge>
                            <MoreVertical className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <p className="text-xs font-bold leading-snug text-primary">
                            {action.title}
                          </p>
                          <div className="pt-2 border-t flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase">
                            <Building2 className="size-3" /> {action.client}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
