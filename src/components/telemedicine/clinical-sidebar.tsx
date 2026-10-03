"use client";

import * as React from "react";
import {
  User,
  Activity,
  AlertCircle,
  Pill,
  FileText,
  HeartPulse,
  Zap,
  ChevronRight,
  ChevronLeft,
  Brain,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip as ChartTooltip,
} from "recharts";

interface PatientData {
  name?: string;
}

interface Telemetry {
  heartRate?: number;
  spo2?: number;
}

interface SoapSummary {
  subjective?: string;
  cid10?: Array<{ code: string }>;
}

interface ClinicalSidebarProps {
  patientData: PatientData;
  telemetry: Telemetry[];
  transcript: string;
  soapSummary?: SoapSummary;
  isOpen: boolean;
  onToggle: () => void;
}

export function ClinicalSidebar({
  patientData,
  telemetry,
  transcript,
  soapSummary,
  isOpen,
  onToggle,
}: ClinicalSidebarProps) {
  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full bg-white border-l shadow-2xl transition-all duration-500 z-50 flex flex-col",
        isOpen ? "w-[450px]" : "w-0"
      )}
    >
      <button
        onClick={onToggle}
        className="absolute -left-10 top-1/2 -translate-y-1/2 size-10 bg-primary text-white rounded-l-2xl flex items-center justify-center shadow-lg"
      >
        {isOpen ? <ChevronRight /> : <ChevronLeft />}
      </button>

      {isOpen && (
        <div className="flex flex-col h-full overflow-hidden">
          <CardHeader className="bg-primary text-white p-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black border border-white/20">
                {(patientData.name || "").substring(0, 2).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-xl font-headline font-black uppercase">
                  {patientData.name}
                </CardTitle>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                  Prontuário Unificado NAI
                </p>
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-6 bg-slate-50/50">
            <div className="space-y-6">
              {/* Seção de Alertas Críticos */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <AlertCircle className="size-3 text-red-500" /> Alertas de Risco
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <Badge className="bg-red-100 text-red-700 border-none p-3 rounded-xl flex items-center gap-3">
                    <Zap className="size-4 animate-pulse" />
                    <span className="text-[10px] font-black uppercase">
                      ALERGIA: PENICILINA / DIPIRONA
                    </span>
                  </Badge>
                  <Badge className="bg-orange-100 text-orange-700 border-none p-3 rounded-xl flex items-center gap-3">
                    <Pill className="size-4" />
                    <span className="text-[10px] font-black uppercase">
                      MEDICAÇÃO: GLIFAGE 500mg
                    </span>
                  </Badge>
                </div>
              </div>

              {/* Telemetria Real-time */}
              <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardHeader className="p-4 border-b">
                  <CardTitle className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                    <HeartPulse className="size-4 text-accent" /> Monitoramento IoT
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={telemetry}>
                        <Line
                          type="monotone"
                          dataKey="heartRate"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <ChartTooltip />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between mt-4">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Frequência</p>
                      <p className="text-xl font-black text-red-600">
                        {telemetry[telemetry.length - 1]?.heartRate || "--"}{" "}
                        <span className="text-[10px]">bpm</span>
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Saturação</p>
                      <p className="text-xl font-black text-blue-600">
                        {telemetry[telemetry.length - 1]?.spo2 || "--"}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SOAP Preview Inteligente */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Brain className="size-3 text-primary" /> Auto-SOAP Gemini
                </h4>
                <div className="bg-primary/5 border border-primary/10 p-5 rounded-[2rem] space-y-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-primary uppercase">Subjetivo (IA)</p>
                    <p className="text-[11px] text-slate-600 italic leading-relaxed">
                      " {soapSummary?.subjective || "IA processando diálogo..."}"
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-primary uppercase">Sugestão CID-10</p>
                    <div className="flex flex-wrap gap-1">
                      {(soapSummary?.cid10 || []).map((c: any) => (
                        <Badge
                          key={c.code}
                          variant="outline"
                          className="text-[8px] font-black border-primary/20"
                        >
                          {c.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transcrição em tempo real */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <FileText className="size-3" /> Transcrição Live
                </h4>
                <div className="bg-white rounded-2xl p-4 border text-[10px] font-medium text-slate-500 leading-relaxed max-h-40 overflow-y-auto">
                  {transcript || "Aguardando início do áudio..."}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="p-6 bg-white border-t shrink-0">
            <Button className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-2">
              <History className="size-4" /> Finalizar & Gerar Prontuário
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
