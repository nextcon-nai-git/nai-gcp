"use client";

import * as React from "react";
import { Activity, AlertTriangle, Timer, Users, Search, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatCard } from "../stat-card";

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

  const todayAttendances = attendances.filter(
    (a) => new Date(a.createdAt).toDateString() === new Date().toDateString()
  );
  const criticalCount = attendances.filter((a) => Number(a.bp_sys) >= 160).length;

  const filteredAttendances = React.useMemo(() => {
    if (!searchTerm) return attendances;
    const lowerSearch = searchTerm.toLowerCase();
    return attendances.filter((a) => a.employeeName.toLowerCase().includes(lowerSearch));
  }, [attendances, searchTerm]);

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
          <Table>
            <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black">
              <TableRow>
                <TableHead className="pl-8">Colaborador / Horário</TableHead>
                <TableHead>Sinais Vitais (PA / FC)</TableHead>
                <TableHead>Queixa Principal</TableHead>
                <TableHead className="pr-8 text-right">Conduta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-20 text-center">
                    <Loader2 className="size-10 animate-spin mx-auto opacity-20" />
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendances.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <TableCell className="pl-8 py-5">
                      <div>
                        <p className="font-black text-xs text-primary uppercase">
                          {item.employeeName}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                          {new Date(item.createdAt).toLocaleTimeString("pt-BR")} •{" "}
                          {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
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
                    </TableCell>
                    <TableCell>
                      <p className="text-[11px] text-slate-600 italic line-clamp-1 max-w-[250px]">
                        "{item.complaint}"
                      </p>
                    </TableCell>
                    <TableCell className="pr-8 text-right">
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
