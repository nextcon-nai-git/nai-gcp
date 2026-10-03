"use client";

import * as React from "react";
import {
  HeartPulse,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Brain,
  Search,
  Scale,
  Baby,
  Bone,
  User,
  UserPlus,
  Thermometer,
  ClipboardList,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REAL_PATIENTS } from "@/lib/real-data";
import { evaluateAllCareLines, type ClinicalData } from "@/lib/clinical-protocols";

interface StructuredRecordTabProps {
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export function StructuredRecordTab({
  selectedPatientId,
  onSelectPatient,
}: StructuredRecordTabProps) {
  const iconMap: Record<string, any> = {
    Brain,
    Activity,
    HeartPulse,
    Thermometer,
    ClipboardList,
    ShieldCheck,
    Scale,
    Search,
    UserPlus,
    AlertTriangle,
    Baby,
    User,
    Bone,
  };

  const patient = REAL_PATIENTS.find((p) => p.id === selectedPatientId);
  const activeLines = patient ? evaluateAllCareLines(patient.clinicalData as ClinicalData) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-4">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2 mb-2">
          Selecione a Paciente
        </p>
        {REAL_PATIENTS.map((p, i) => (
          <Card
            key={p.id}
            className={cn(
              "cursor-pointer border-none shadow-sm transition-all duration-500 rounded-[2rem] overflow-hidden group",
              selectedPatientId === p.id
                ? "ring-2 ring-primary bg-gradient-to-br from-white to-slate-50 scale-[1.02] shadow-xl"
                : "bg-white/50 hover:bg-white opacity-70 hover:opacity-100 hover:scale-[1.01]"
            )}
            style={{ animationDelay: `${i * 100}ms` }}
            onClick={() => onSelectPatient(p.id)}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className={cn(
                  "flex items-center justify-center size-12 rounded-2xl font-black text-lg transition-colors duration-500",
                  selectedPatientId === p.id
                    ? "bg-primary text-accent shadow-lg shadow-primary/20"
                    : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
                )}
              >
                {p.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-black uppercase truncate leading-none transition-colors duration-300",
                    selectedPatientId === p.id ? "text-primary" : "text-slate-600"
                  )}
                >
                  {p.name}
                </p>
                <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-1.5 uppercase">
                  CPF {p.cpf}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="lg:col-span-3 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <FileCheck className="size-48 text-primary" />
        </div>
        <CardHeader className="bg-gradient-to-r from-primary to-slate-900 text-white p-8 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between relative z-10 gap-4">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                <Activity className="size-8 text-accent animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">
                  Timeline Clínica
                </CardTitle>
                <CardDescription className="text-accent/90 font-bold uppercase text-[10px] tracking-widest mt-1.5">
                  Protocolos Automáticos • IA Nextcon
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-white/20 bg-white/10 backdrop-blur-md text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-full"
            >
              Sincronizado
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-8 sm:p-12 space-y-6 bg-slate-50/50 min-h-[400px]">
          <div className="relative border-l-4 border-slate-200 ml-4 pl-10 space-y-12 py-4">
            {activeLines.map((line, idx) => {
              const Icon = iconMap[line.iconType] || Activity;
              const condutaL = line.conduta.toLowerCase();
              const isWarning =
                condutaL.includes("sever") ||
                condutaL.includes("alta") ||
                condutaL.includes("grave");
              const isSuccess =
                condutaL.includes("adequado") ||
                condutaL.includes("normal") ||
                condutaL.includes("negativo") ||
                condutaL.includes("baixa");

              return (
                <div
                  key={line.id}
                  className="relative group animate-in slide-in-from-right-8 fade-in duration-700 fill-mode-both"
                  style={{ animationDelay: `${idx * 150}ms` }}
                >
                  <div
                    className={cn(
                      "absolute -left-[60px] top-4 p-3 rounded-full border-4 transition-all duration-500 z-10",
                      isWarning
                        ? "bg-red-50 border-red-500 text-red-600 group-hover:bg-red-500 group-hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : isSuccess
                          ? "bg-emerald-50 border-emerald-500 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white"
                          : "bg-white border-primary text-primary group-hover:bg-primary group-hover:text-white"
                    )}
                  >
                    <Icon className={cn("size-5", isWarning && "animate-pulse")} />
                  </div>

                  <div
                    className={cn(
                      "bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border transition-all duration-300",
                      isWarning
                        ? "border-red-100 hover:border-red-300 hover:shadow-red-500/10 hover:shadow-xl"
                        : isSuccess
                          ? "border-emerald-100 hover:border-emerald-300 hover:shadow-xl"
                          : "border-slate-100 hover:border-primary/30 hover:shadow-xl hover:-translate-y-1"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <h3
                        className={cn(
                          "text-lg font-black uppercase tracking-tight flex items-center gap-2",
                          isWarning
                            ? "text-red-700"
                            : isSuccess
                              ? "text-emerald-700"
                              : "text-primary"
                        )}
                      >
                        {line.title}
                        {isWarning && <AlertTriangle className="size-4 text-red-500" />}
                      </h3>
                      <Badge
                        className={cn(
                          "text-[10px] font-black uppercase px-3 py-1 border-none shadow-sm",
                          isWarning
                            ? "bg-red-100 text-red-700"
                            : isSuccess
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-primary/10 text-primary"
                        )}
                      >
                        {line.escore}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                      {line.conduta}
                    </p>
                  </div>
                </div>
              );
            })}
            {activeLines.length === 0 && (
              <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] p-12 text-center animate-in zoom-in duration-500">
                <CheckCircle2 className="size-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  Nenhuma linha de cuidado ativa.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Os dados clínicos da paciente estão dentro da normalidade.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
