"use client";

import * as React from "react";
import {
  Search,
  Loader2,
  ChevronRight,
  HeartPulse,
  Brain,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { nursingAttendanceDate } from "@/lib/medical/nursing-attendance";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AttendanceTabProps {
  attendances: Array<{
    id: string;
    employeeName: string;
    employeeId?: string;
    complaint: string;
    createdAt?: unknown;
    timestamp?: unknown;
    status_esocial?: string;
    care_lines?: unknown;
  }>;
  loading: boolean;
}

export function AttendanceTab({ attendances, loading }: AttendanceTabProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredAttendances = React.useMemo(() => {
    let list = [...attendances];
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter((a) => (a.employeeName || "").toLowerCase().includes(lowerSearch));
    }
    return list;
  }, [attendances, searchTerm]);

  return (
    <div className="space-y-6">
      <Card className="card-shadow border-none bg-white rounded-4xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <CardTitle className="text-lg font-black text-primary uppercase">
              Fila de Atendimento Ocupacional
            </CardTitle>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-300" />
            <Input
              placeholder="Buscar colaborador..."
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
                <TableHead className="pl-8">Colaborador</TableHead>
                <TableHead>Queixa Principal</TableHead>
                <TableHead>eSocial</TableHead>
                <TableHead className="pr-8 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-20 text-center">
                    <Loader2 className="size-10 animate-spin opacity-20 text-primary" />
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendances.map((item) => (
                  <Sheet key={item.id}>
                    <SheetTrigger asChild>
                      <TableRow className="hover:bg-slate-50/50 transition-colors cursor-pointer border-b last:border-none">
                        <TableCell className="pl-8 py-5">
                          <div className="text-left">
                            <p className="font-black text-xs text-primary uppercase">
                              {item.employeeName}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                              Recebido em:{" "}
                              {nursingAttendanceDate(item)?.toLocaleDateString("pt-BR") ||
                                "Recebimento não informado"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-left text-xs font-medium text-slate-600 truncate max-w-[300px]">
                          &quot;{item.complaint}&quot;
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] font-black uppercase h-5">
                            {item.status_esocial || "Não informado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex justify-end gap-2">
                            <ChevronRight className="size-5 text-slate-200" />
                          </div>
                        </TableCell>
                      </TableRow>
                    </SheetTrigger>
                    <SheetContent className="sm:max-w-xl p-0 border-none shadow-2xl flex flex-col bg-white">
                      <SheetHeader className="p-10 bg-primary text-white shrink-0 text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                          <HeartPulse className="size-32 text-accent" />
                        </div>
                        <div className="relative z-10 space-y-4">
                          <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em]">
                            Registro de atendimento
                          </Badge>
                          <SheetTitle className="text-2xl font-headline font-black uppercase text-white">
                            {item.employeeName}
                          </SheetTitle>
                          <SheetDescription className="text-white/60 font-bold uppercase text-[10px]">
                            ID: {item.employeeId || "Não informado"}
                          </SheetDescription>
                        </div>
                      </SheetHeader>
                      <ScrollArea className="flex-1 p-10 text-left">
                        <div className="space-y-10 pb-20">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                              <ClipboardList className="size-4 text-accent" /> Relato Clínico
                            </h4>
                            <div className="p-6 bg-slate-50 rounded-4xl border italic text-sm text-slate-700 leading-relaxed shadow-inner">
                              &quot;{item.complaint}&quot;
                            </div>
                          </div>
                          {Array.isArray(item.care_lines) && item.care_lines.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                                <Brain className="size-4 text-accent" /> Linhas de Cuidado Aplicadas
                              </h4>
                              <div className="grid grid-cols-1 gap-2">
                                {item.care_lines
                                  .filter((line): line is string => typeof line === "string")
                                  .map((line, i: number) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm"
                                    >
                                      <CheckCircle2 className="size-4 text-emerald-600" />
                                      <span className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">
                                        {line.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                      <p className="p-6 text-sm text-muted-foreground">
                        Consulta do registro salvo. Assinatura digital e retificação não estão
                        disponíveis nesta tela.
                      </p>
                    </SheetContent>
                  </Sheet>
                ))
              )}
              {filteredAttendances.length === 0 && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest"
                  >
                    Nenhum registro localizado no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
