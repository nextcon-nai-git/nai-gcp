"use client";

import * as React from "react";
import {
  Stethoscope,
  Activity,
  HeartPulse,
  CheckCircle2,
  Save,
  type LucideIcon,
  Loader2,
  Play,
  Square,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import { CETESB_SESMT_TEAM } from "@/lib/real-data";

interface ChecklistItem {
  id: string;
  label: string;
  ref: string;
}

const CHECKLISTS: Record<string, ChecklistItem[]> = {
  DOCTOR: [
    { id: "m1", label: "Validar ASOs pendentes e emitir pareceres de aptidão.", ref: "NR-07" },
    { id: "m2", label: "Coordenar investigação de nexo causal em afastamentos B91.", ref: "NR-01" },
    {
      id: "m3",
      label: "Realizar busca ativa de doenças ocupacionais via indicadores.",
      ref: "Epidemiologia",
    },
  ],
  ENGINEER: [
    { id: "f1", label: "Realizar Blitz Postural nos postos de armação/carpintaria.", ref: "NR-17" },
    { id: "f2", label: "Atualizar Análise Ergonômica Preliminar (AEP) do setor A.", ref: "GRO" },
    {
      id: "f3",
      label: "Treinar equipe sobre levantamento e transporte de cargas.",
      ref: "Treinamento",
    },
  ],
  PROVIDER: [
    { id: "e1", label: "Implementar SAE (Sistematização da Assistência de Enf.).", ref: "COFEN" },
    {
      id: "e2",
      label: "Gerenciar estoque de medicamentos e validade de insumos.",
      ref: "Logística",
    },
    { id: "e3", label: "Promover campanha mensal de saúde preventiva (SIPAT).", ref: "Educação" },
  ],
};

export function ProfessionalEvolutionTab() {
  const { toast } = useToast();
  const db = useFirestore();
  const [activeProfId, setActiveProfId] = React.useState(CETESB_SESMT_TEAM[0].id);
  const [checklistProgress, setChecklistProgress] = React.useState<Record<string, boolean>>({});
  const [timerActive, setTimerActive] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  const activeProf = React.useMemo(
    () => CETESB_SESMT_TEAM.find((p) => p.id === activeProfId) || CETESB_SESMT_TEAM[0],
    [activeProfId]
  );

  const activeChecklist = CHECKLISTS[activeProf.role] || CHECKLISTS.DOCTOR;

  React.useEffect(() => {
    let interval: any;
    if (timerActive) {
      interval = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const currentPercent = Math.round(
    (activeChecklist.filter((i) => checklistProgress[`${activeProf.id}_${i.id}`]).length /
      activeChecklist.length) *
      100
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-1 space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4 mb-4 text-left">
          Time SESMT alocado
        </p>
        {CETESB_SESMT_TEAM.map((prof) => {
          const isActive = activeProfId === prof.id;
          return (
            <Card
              key={prof.id}
              className={cn(
                "cursor-pointer border-none shadow-sm transition-all rounded-2xl",
                isActive
                  ? "ring-2 ring-primary bg-white scale-[1.02] shadow-lg"
                  : "bg-slate-50 opacity-60 hover:opacity-100"
              )}
              onClick={() => setActiveProfId(prof.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={cn(
                    "p-2.5 rounded-xl",
                    isActive ? "bg-primary text-white" : "bg-white text-primary shadow-inner"
                  )}
                >
                  {prof.role === "DOCTOR" ? (
                    <Stethoscope size={20} />
                  ) : prof.role === "ENGINEER" ? (
                    <Activity size={20} />
                  ) : (
                    <HeartPulse size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-black text-primary uppercase truncate leading-none">
                    {prof.name.split(" ")[0]}
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                    {prof.specialty}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="lg:col-span-3 space-y-6 text-left">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm bg-white rounded-3xl p-6">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
              Tempo em Atividade
            </p>
            <h3 className="text-2xl font-black text-primary font-headline">
              {formatTime(elapsedSeconds)}
            </h3>
            <Button
              size="sm"
              onClick={() => setTimerActive(!timerActive)}
              className={cn(
                "mt-4 w-full rounded-xl font-black uppercase text-[9px] gap-2 h-9",
                timerActive
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              {timerActive ? <Square className="size-3" /> : <Play className="size-3" />}{" "}
              {timerActive ? "Encerrar Registro" : "Iniciar Plantão"}
            </Button>
          </Card>
          <Card className="border-none shadow-sm bg-white rounded-3xl p-6 flex flex-col justify-center">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
              Conformidade Plantão
            </p>
            <h3 className="text-2xl font-black text-emerald-600">{currentPercent}%</h3>
            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${currentPercent}%` }}
              />
            </div>
          </Card>
        </div>

        <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-primary text-white p-8">
            <CardTitle className="text-2xl font-headline font-black uppercase">
              {activeProf.name}
            </CardTitle>
            <CardDescription className="text-white/60 font-bold uppercase text-[10px] mt-1">
              {activeProf.specialty} | Checklist Operacional Diário
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              {activeChecklist.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group",
                    checklistProgress[`${activeProf.id}_${item.id}`]
                      ? "bg-emerald-50 border-emerald-100"
                      : "bg-white border-slate-50 shadow-sm"
                  )}
                  onClick={() =>
                    setChecklistProgress((prev) => ({
                      ...prev,
                      [`${activeProf.id}_${item.id}`]: !prev[`${activeProf.id}_${item.id}`],
                    }))
                  }
                >
                  <Checkbox
                    checked={!!checklistProgress[`${activeProf.id}_${item.id}`]}
                    className="size-5 rounded-md border-slate-300"
                  />
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        checklistProgress[`${activeProf.id}_${item.id}`]
                          ? "text-emerald-800"
                          : "text-primary"
                      )}
                    >
                      {item.label}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[8px] font-black border-none bg-slate-100 text-slate-400 mt-1"
                    >
                      Ref: {item.ref}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t border-dashed flex justify-between items-center">
              <p className="text-[10px] text-slate-400 italic">
                "Registro auditável para medição do contrato CETESB."
              </p>
              <Button
                disabled={currentPercent < 100}
                className="h-14 px-10 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2"
              >
                <ClipboardList className="size-4 text-accent" /> Protocolar Atividade
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
