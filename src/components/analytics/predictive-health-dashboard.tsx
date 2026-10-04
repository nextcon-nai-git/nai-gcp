"use client";

import React from "react";
import { TrendingUp, AlertTriangle, ShieldCheck, HeartPulse, BrainCircuit } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function PredictiveHealthDashboard() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-sky-400" />
          <h3 className="text-lg font-bold text-slate-100">
            Painel Preditivo de Saúde & Absenteísmo (IA Gemini 3.8)
          </h3>
        </div>
        <Badge className="bg-sky-950 text-sky-400 border-sky-800">Projeção Próximo Trimestre</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Risco do Setor Metalúrgico/Manutenção */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 flex justify-between">
              Manutenção & Montagem
              <Badge className="bg-amber-950 text-amber-400 border-amber-800 text-[10px]">
                Risco Moderado
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold text-slate-100">14.2%</span>
              <span className="text-xs text-amber-400 flex items-center gap-1 font-medium">
                <TrendingUp className="h-3.5 w-3.5" /> +2.8% Projetado
              </span>
            </div>
            <Progress value={65} className="h-1.5 bg-slate-800 [&>div]:bg-amber-500" />
            <p className="text-xs text-slate-400">
              Predomínio de CID-10 M54 (Lumbago) cruzado com esforço físico no PGR.
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Risco Operações de Campo */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 flex justify-between">
              Operações de Campo / Obras
              <Badge className="bg-red-950 text-red-400 border-red-800 text-[10px]">
                Risco Elevado
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold text-slate-100">21.8%</span>
              <span className="text-xs text-red-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> +5.4% Projetado
              </span>
            </div>
            <Progress value={82} className="h-1.5 bg-slate-800 [&>div]:bg-red-500" />
            <p className="text-xs text-slate-400">
              Risco ergonômico + fadiga térmica em jornadas estendidas.
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Setor Administrativo */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 flex justify-between">
              Administrativo & Controladoria
              <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px]">
                Risco Baixo
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-2xl font-bold text-slate-100">3.1%</span>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> -1.2% Projetado
              </span>
            </div>
            <Progress value={20} className="h-1.5 bg-slate-800 [&>div]:bg-emerald-500" />
            <p className="text-xs text-slate-400">
              Ações preventivas de ginástica laboral com impacto positivo.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recomendações Preventivas da IA */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 p-4 space-y-2">
        <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
          <HeartPulse className="h-4 w-4" />
          Recomendações Preventivas Recomendadas pelo Agente IA Médico
        </h4>
        <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
          <li>
            <strong>Manutenção:</strong> Iniciar pausas ativas a cada 2h e revisão de auxílio
            mecânico de carga. (Estimativa: -12 dias de afastamento saved)
          </li>
          <li>
            <strong>Obras de Campo:</strong> Reavaliação imediata de EPIs de proteção solar e
            protetor auditivo tipo concha.
          </li>
        </ul>
      </Card>
    </div>
  );
}
