"use client";

import * as React from "react";
import { Brain, Activity, Sparkles, Zap, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function PsychosocialTab() {
  const { toast } = useToast();
  const [isBlitzOpen, setIsBlitzOpen] = React.useState(false);

  const sectors = [
    {
      name: "Unidade Operacional",
      stress: 85,
      mood: "Crítico",
      trend: "+12%",
      color: "bg-red-500",
      lives: 42,
    },
    {
      name: "Setor Administrativo",
      stress: 42,
      mood: "Estável",
      trend: "-5%",
      color: "bg-green-500",
      lives: 18,
    },
    {
      name: "Logística",
      stress: 68,
      mood: "Alerta",
      trend: "+2%",
      color: "bg-orange-500",
      lives: 25,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] p-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] transition-opacity duration-700 group-hover:opacity-5">
          <Brain className="size-64 text-primary" />
        </div>
        <div className="space-y-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary text-accent rounded-2xl shadow-xl shadow-primary/20">
              <Brain className="size-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-primary uppercase font-headline leading-tight tracking-tight">
                Mapa de Stress Ocupacional
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Indicadores de Absenteísmo Mental e Clima.
              </p>
            </div>
          </div>
          <div className="space-y-10">
            {sectors.map((s, i) => (
              <div
                key={s.name}
                className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-500 fill-mode-both"
                style={{ animationDelay: `${(i + 1) * 200}ms` }}
              >
                <div className="flex justify-between items-end">
                  <span className="text-sm font-black text-primary uppercase tracking-tight">
                    {s.name} <span className="text-slate-400 ml-2">({s.lives} Vidas)</span>
                  </span>
                  <div className="text-right">
                    <span className="text-xl font-black text-primary">{s.stress}%</span>
                    <span
                      className={cn(
                        "block text-[9px] font-black uppercase mt-1",
                        s.trend.includes("+") ? "text-red-500" : "text-emerald-500"
                      )}
                    >
                      {s.trend} Tendência
                    </span>
                  </div>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={cn("h-full transition-all duration-1000 ease-out", s.color)}
                    style={{ width: `${s.stress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="card-shadow border border-white/10 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617] text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute -top-10 -right-10 p-6 opacity-20 transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110">
            <Sparkles className="size-48 text-accent" />
          </div>
          <div className="relative z-10">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-xs font-black uppercase text-accent tracking-widest flex items-center gap-2">
                <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg">
                  <Activity className="size-4 animate-pulse" />
                </div>
                Insight NAI Mental
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-8">
              <p className="text-[15px] italic text-white/90 leading-relaxed font-medium">
                "Detectada correlação crítica de 0.82 entre stress e absenteísmo na unidade
                principal. Recomendamos Pausa Ativa iminente de 15min."
              </p>
              <Dialog open={isBlitzOpen} onOpenChange={setIsBlitzOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full h-14 bg-white/10 hover:bg-accent text-white hover:text-primary backdrop-blur-md border border-white/20 font-black uppercase text-xs rounded-xl shadow-2xl transition-all duration-300 gap-2">
                    <Zap className="size-4" /> Solicitar Intervenção
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                  <div className="p-6 bg-gradient-to-r from-[#0f172a] to-primary text-white relative">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Brain className="size-16" />
                    </div>
                    <DialogTitle className="text-xl font-headline font-black uppercase flex items-center gap-3 relative z-10">
                      <Zap className="size-6 text-accent" /> Blitz Ergonômica
                    </DialogTitle>
                  </div>
                  <div className="p-8 space-y-6 bg-slate-50">
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                      Você está prestes a acionar a equipe de Especialistas (Ergonomia/Saúde Mental)
                      para uma intervenção na <strong>Unidade Operacional</strong>.
                    </p>
                    <Button
                      className="w-full h-14 bg-primary text-white rounded-xl shadow-lg font-black uppercase tracking-widest text-[10px]"
                      onClick={() => {
                        toast({
                          title: "Intervenção Solicitada",
                          description: "A equipe foi notificada com prioridade e está a caminho.",
                        });
                        setIsBlitzOpen(false);
                      }}
                    >
                      <Check className="size-4 mr-2" /> Confirmar Solicitação
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </div>
        </Card>
      </div>
    </div>
  );
}
