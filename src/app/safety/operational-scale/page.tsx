"use client";

import * as React from "react";
import {
  HardHat,
  Clock,
  Building2,
  ShieldAlert,
  Zap,
  FileCheck,
  Plus,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

/**
 * @fileOverview Gerenciador de Equipes TST
 * Módulo para controle de alocações e escalas em unidades operacionais.
 */

export default function SafetyOperationalScale() {
  const scale = [
    {
      week: "1",
      role: "TST A",
      seg: "Trabalha",
      ter: "Folga",
      qua: "Trabalha",
      qui: "Folga",
      sex: "Trabalha",
      sab: "Folga",
    },
    {
      week: "1",
      role: "TST B",
      seg: "Folga",
      ter: "Trabalha",
      qua: "Folga",
      qui: "Trabalha",
      sex: "Folga",
      sab: "Trabalha",
    },
    {
      week: "2",
      role: "TST A",
      seg: "Folga",
      ter: "Trabalha",
      qua: "Folga",
      qui: "Trabalha",
      sex: "Folga",
      sab: "Trabalha",
    },
    {
      week: "2",
      role: "TST B",
      seg: "Trabalha",
      ter: "Folga",
      qua: "Trabalha",
      qui: "Folga",
      sex: "Trabalha",
      sab: "Folga",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Badge className="bg-primary text-white font-black uppercase text-[8px] tracking-[0.3em] mb-3">
            GESTÃO DE EQUIPE TST
          </Badge>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Gerenciador Equipes Operacionais
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
            <Building2 className="size-3" /> Unidade Selecionada | Segurança Ativa de Campo
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2"
          >
            <FileCheck className="size-4" /> Relatório de Vistoria
          </Button>
          <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
            <Plus className="size-4" /> Abrir PET/APR
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-shadow border-none bg-white rounded-[2rem] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl w-fit text-blue-600">
              <Clock className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-primary uppercase">Regime Operacional</h3>
              <p className="text-xs text-slate-400 font-medium">Seg a Sex: 07h-19h (12x36h)</p>
              <p className="text-xs text-slate-400 font-medium">
                Sábado: 07h-13h (Checklist Geral)
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="mt-4 border-emerald-100 text-emerald-700 bg-emerald-50 text-[8px] font-black uppercase w-fit px-2"
          >
            Escala Homologada
          </Badge>
        </Card>

        <Card className="card-shadow border-none bg-white rounded-[2rem] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="p-3 bg-orange-50 rounded-xl w-fit text-orange-600">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-primary uppercase">Foco de Campo</h3>
              <p className="text-xs text-slate-400 font-medium">Liberações de Trabalho em Altura</p>
              <p className="text-xs text-slate-400 font-medium">Inspeção de EPCs e Gruas</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="mt-4 border-blue-100 text-blue-700 bg-blue-50 text-[8px] font-black uppercase w-fit px-2"
          >
            NR-18 Full
          </Badge>
        </Card>

        <Card className="bg-[#090e24] text-white border-none rounded-[2rem] p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Zap className="size-20" />
          </div>
          <div className="space-y-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-xl w-fit text-accent">
              <Sparkles className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase">Diferenciais NAI</h3>
              <p className="text-xs text-white/60 font-medium italic">
                "Evidências Fotográficas via Mobile e GPS ativo."
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black text-primary uppercase">
                Escala Quinzenal de Times
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                Alternância para monitoramento ininterrupto da unidade.
              </CardDescription>
            </div>
            <Badge className="bg-primary text-white font-black uppercase text-[10px] h-8 px-4">
              Equipe Técnica Alocada
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-8 text-[9px] font-black uppercase">Semana</TableHead>
                <TableHead className="text-[9px] font-black uppercase">Profissional TST</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center">Seg</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center">Ter</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center">Qua</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center">Qui</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center">Sex</TableHead>
                <TableHead className="text-[9px] font-black uppercase text-center pr-8">
                  Sáb (Rodízio)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scale.map((item, i) => (
                <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="pl-8 py-5">
                    <Badge variant="secondary" className="font-black text-[10px]">
                      {item.week}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-black text-[10px]">
                        <HardHat className="size-4" />
                      </div>
                      <span className="font-bold text-primary text-xs uppercase">{item.role}</span>
                    </div>
                  </TableCell>
                  <StatusCell status={item.seg} />
                  <StatusCell status={item.ter} />
                  <StatusCell status={item.qua} />
                  <StatusCell status={item.qui} />
                  <StatusCell status={item.sex} />
                  <StatusCell status={item.sab} isSpecial />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 bg-blue-50 rounded-[2rem] border border-blue-100 flex gap-6 items-start">
          <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
            <ClipboardCheck className="size-6" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-black text-primary uppercase">
              Nota Operacional de Equipe
            </h4>
            <p className="text-xs text-primary/70 leading-relaxed font-medium italic">
              "O TST escalado para o sábado deve realizar a inspeção periférica e o checklist de
              geradores para a liberação das atividades de segunda-feira."
            </p>
          </div>
        </div>
        <div className="p-8 bg-orange-50 rounded-[2rem] border border-orange-100 flex gap-6 items-start">
          <div className="p-4 bg-orange-600 text-white rounded-2xl shadow-xl shadow-orange-600/20">
            <ShieldAlert className="size-6" />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-black text-orange-900 uppercase">Segurança Ativa</h4>
            <p className="text-xs text-orange-700/70 leading-relaxed font-medium">
              Liberações de PT (Permissão de Trabalho) para solda e altura são bloqueadas
              automaticamente pelo sistema caso o TST responsável não realize o check-in GPS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCell({ status, isSpecial }: { status: string; isSpecial?: boolean }) {
  const isWork = status === "Trabalha";
  return (
    <TableCell className={cn("text-center py-5", isSpecial && "pr-8")}>
      <Badge
        className={cn(
          "text-[8px] font-black uppercase border-none px-2 h-5",
          isWork ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
        )}
      >
        {status}
      </Badge>
    </TableCell>
  );
}
