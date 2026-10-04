"use client";

import * as React from "react";
import {
  Brain,
  Activity,
  Sparkles,
  AlertTriangle,
  Loader2,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function PsychosocialTab() {
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = React.useState(false);

  const sectors = [
    {
      name: "Unidade Operacional",
      stress: 85,
      mood: "Crítico",
      trend: "+12%",
      color: "bg-red-500",
      lives: 42,
      ai_absenteeism_risk: 74,
    },
    {
      name: "Setor Administrativo",
      stress: 42,
      mood: "Estável",
      trend: "-5%",
      color: "bg-green-500",
      lives: 18,
      ai_absenteeism_risk: 15,
    },
    {
      name: "Logística",
      stress: 68,
      mood: "Alerta",
      trend: "+2%",
      color: "bg-orange-500",
      lives: 25,
      ai_absenteeism_risk: 48,
    },
  ];

  const handleRequestBlitz = async () => {
    setIsRequesting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: "Blitz Solicitada",
        description: "O setor de Engenharia e Fisioterapia foi notificado para inspeção imediata.",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] p-10">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary text-accent rounded-2xl shadow-xl">
                  <Brain className="size-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-primary uppercase font-headline leading-tight">
                    Mapa de Stress Ocupacional
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Indicadores Preditivos de Burnout e Clima.
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase text-[8px]">
                NAI Preditiva Live
              </Badge>
            </div>
            <div className="space-y-10">
              {sectors.map((s) => (
                <div key={s.name} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-sm font-black text-primary uppercase tracking-tight">
                        {s.name} ({s.lives} Vidas)
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <TrendingUp className="size-3 text-red-500" />
                        <span className="text-[9px] font-bold uppercase text-red-500">
                          {s.ai_absenteeism_risk}% Risco de Afastamento (30 dias)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-primary">{s.stress}%</span>
                      <span
                        className={cn(
                          "block text-[9px] font-black uppercase",
                          s.trend.includes("+") ? "text-red-500" : "text-green-500"
                        )}
                      >
                        {s.trend} Stress Acumulado
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={cn("h-full transition-all duration-1000", s.color)}
                      style={{ width: `${s.stress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Sparkles className="size-32 text-accent" />
            </div>
            <CardHeader className="p-0 mb-6 text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Activity className="size-4 text-accent" />
                </div>
                <CardTitle className="text-xs font-black uppercase text-accent tracking-widest leading-none">
                  Diagnóstico Preditivo
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 space-y-6 text-left">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                <p className="text-sm italic text-white/80 leading-relaxed font-medium">
                  &quot;Detectada correlação de 0.82 entre stress e absenteísmo na unidade
                  principal.&quot;
                </p>
              </div>
              <Button
                onClick={handleRequestBlitz}
                disabled={isRequesting}
                className="w-full h-12 bg-accent text-primary font-black uppercase text-[10px] rounded-xl shadow-lg gap-2 hover:scale-[1.02] transition-transform"
              >
                {isRequesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
                Gatilhar Intervenção Prescritiva
              </Button>
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8 border-2 border-slate-50 overflow-hidden">
            <CardHeader className="p-0 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl shadow-inner">
                  <AlertTriangle className="size-4" />
                </div>
                <CardTitle className="text-xs font-black uppercase text-primary tracking-[0.2em]">
                  Escalas PHQ-9 & GAD-7
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 space-y-8 text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white text-[8px] font-black uppercase px-2 h-5">
                    PHQ-9
                  </Badge>
                  <h4 className="text-[10px] font-bold text-primary uppercase">
                    Rastreamento de Depressão
                  </h4>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                  <table className="w-full text-[9px] text-slate-600 font-bold">
                    <tbody>
                      <tr>
                        <td className="py-1">0 a 4</td>
                        <td className="text-right text-emerald-600">Mínima</td>
                      </tr>
                      <tr className="bg-amber-50/50">
                        <td className="py-1">10 a 14</td>
                        <td className="text-right text-amber-600">Moderada</td>
                      </tr>
                      <tr className="bg-red-50/50">
                        <td className="py-1">20 a 27</td>
                        <td className="text-right text-red-600">Grave</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
