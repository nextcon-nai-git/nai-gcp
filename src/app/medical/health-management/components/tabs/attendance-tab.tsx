"use client";

import * as React from "react";
import { Activity, AlertTriangle, Timer, Users, Search, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatCard } from "../stat-card";
import { VirtualizedList } from "@/components/VirtualizedList";
import { useDebounce } from "@/hooks/useDebounce";

interface AttendanceItem {
  id: string;
  employeeName: string;
  createdAt: string;
  bp_sys: string;
  bp_dia: string;
  heart_rate: string;
  complaint: string;
  conduct: string;
  [key: string]: unknown;
}

interface AttendanceTabProps {
  attendances: AttendanceItem[];
  isLoading: boolean;
}

export function AttendanceTab({ attendances, isLoading }: AttendanceTabProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);

  const todayAttendances = attendances.filter(
    (a) => new Date(a.createdAt).toDateString() === new Date().toDateString()
  );
  const criticalCount = attendances.filter((a) => Number(a.bp_sys) >= 160).length;

  const filteredAttendances = React.useMemo(() => {
    if (!debouncedSearchTerm) return attendances;
    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return attendances.filter((a) => a.employeeName.toLowerCase().includes(lowerSearch));
  }, [attendances, debouncedSearchTerm]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Triagens Hoje"
          value={todayAttendances.length}
          icon={Activity}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Casos Críticos"
          value={criticalCount}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-50"
        />
        <StatCard
          label="SLA Atendimento"
          value="4.2 min"
          icon={Timer}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          label="Vidas em Vigilância"
          value="806"
          icon={Users}
          color="text-primary"
          bg="bg-slate-100"
        />
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black text-primary uppercase">
              Log de Atendimentos
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
              Registros de enfermagem em tempo real.
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-300" />
            <Input
              placeholder="Buscar na base..."
              className="pl-10 h-10 border-none bg-white shadow-sm text-xs rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div role="table" aria-label="Log de atendimentos">
            <div
              role="row"
              className="grid grid-cols-[1.2fr_1fr_1.2fr_auto] gap-4 bg-slate-50/50 px-8 py-3 text-[10px] uppercase font-black"
            >
              <span role="columnheader">Colaborador / Horário</span>
              <span role="columnheader">Sinais Vitais (PA / FC)</span>
              <span role="columnheader">Queixa Principal</span>
              <span role="columnheader" className="text-right">
                Conduta
              </span>
            </div>
            {isLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="size-10 animate-spin mx-auto opacity-20" />
              </div>
            ) : (
              <VirtualizedList
                items={filteredAttendances}
                height={480}
                itemHeight={80}
                renderItem={(item) => (
                  <div
                    role="row"
                    className="grid h-full grid-cols-[1.2fr_1fr_1.2fr_auto] items-center gap-4 border-b px-8 hover:bg-slate-50/50 transition-colors"
                  >
                    <div role="cell">
                      <p className="font-black text-xs text-primary uppercase">
                        {item.employeeName}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                        {new Date(item.createdAt).toLocaleTimeString("pt-BR")} •{" "}
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div role="cell" className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono border-primary/10",
                          Number(item.bp_sys) >= 140 && "bg-red-50 text-red-600 border-red-200"
                        )}
                      >
                        {item.bp_sys}/{item.bp_dia}
                      </Badge>
                      <span className="text-[10px] font-black text-slate-400">
                        {item.heart_rate} bpm
                      </span>
                    </div>
                    <p
                      role="cell"
                      className="text-[11px] text-slate-600 italic line-clamp-1 max-w-[250px]"
                    >
                      &quot;{item.complaint}&quot;
                    </p>
                    <div role="cell" className="text-right">
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase border-none px-3 h-5",
                          item.conduct === "work"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        )}
                      >
                        {item.conduct === "work" ? "Trabalho" : "Observação"}
                      </Badge>
                    </div>
                  </div>
                )}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
