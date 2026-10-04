"use client";

import * as React from "react";
import {
  Search,
  Loader2,
  Trash2,
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
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

interface AttendanceTabProps {
  attendances: any[];
  loading: boolean;
}

export function AttendanceTab({ attendances, loading }: AttendanceTabProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleDelete = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!db) return;
    if (confirm(`Deseja excluir permanentemente o prontuário de ${item.employeeName}?`)) {
      if (item.id.startsWith("real_")) {
        toast({
          variant: "destructive",
          title: "Acesso Negado",
          description: "Dados históricos e de auditoria são protegidos.",
        });
        return;
      }
      deleteDocumentNonBlocking(doc(db, "nursing_attendances", item.id));
      toast({ title: "Prontuário Excluído", description: "O registro foi removido com sucesso." });
    }
  };

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
      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
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
                              Data: {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-left text-xs font-medium text-slate-600 truncate max-w-[300px]">
                          &quot;{item.complaint}&quot;
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px] font-black uppercase h-5">
                            {item.status_esocial || "PENDENTE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-slate-300 hover:text-red-600"
                              onClick={(e) => handleDelete(e, item)}
                              title="Excluir Prontuário"
                            >
                              <Trash2 size={16} />
                            </Button>
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
                            Protocolo HIPAA Ativo
                          </Badge>
                          <SheetTitle className="text-2xl font-headline font-black uppercase text-white">
                            {item.employeeName}
                          </SheetTitle>
                          <SheetDescription className="text-white/60 font-bold uppercase text-[10px]">
                            ID: {item.employeeId || "COL_CET_X"}
                          </SheetDescription>
                        </div>
                      </SheetHeader>
                      <ScrollArea className="flex-1 p-10 text-left">
                        <div className="space-y-10 pb-20">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                              <ClipboardList className="size-4 text-accent" /> Relato Clínico
                            </h4>
                            <div className="p-6 bg-slate-50 rounded-[2rem] border italic text-sm text-slate-700 leading-relaxed shadow-inner">
                              &quot;{item.complaint}&quot;
                            </div>
                          </div>
                          {item.care_lines?.length > 0 && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                                <Brain className="size-4 text-accent" /> Linhas de Cuidado Aplicadas
                              </h4>
                              <div className="grid grid-cols-1 gap-2">
                                {item.care_lines.map((line: string, i: number) => (
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
                      <SheetFooter className="p-10 bg-slate-50 border-t shrink-0">
                        <Button className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2 hover:scale-[1.02] transition-transform">
                          <CheckCircle2 className="size-4 text-accent" /> Validar e Assinar Evolução
                        </Button>
                      </SheetFooter>
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
