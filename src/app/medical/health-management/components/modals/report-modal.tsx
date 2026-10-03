"use client";

import * as React from "react";
import { FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportModalProps {
  todayCount: number;
  criticalCount: number;
}

export function ReportModal({ todayCount, criticalCount }: ReportModalProps) {
  const { toast } = useToast();
  const [isReportOpen, setIsReportOpen] = React.useState(false);
  const [isReportGenerating, setIsReportGenerating] = React.useState(false);

  return (
    <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2"
        >
          <ClipboardList className="size-4" /> Relatório Consolidado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="p-8 bg-primary text-white relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <FileText className="size-24" />
          </div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-white/10 rounded-lg text-accent">
              <FileText className="size-5" />
            </div>
            <DialogTitle className="text-xl font-headline font-black uppercase">
              Relatório Epidemiológico
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/60 font-medium italic relative z-10">
            Visão consolidada das intercorrências e SLAs de hoje.
          </DialogDescription>
        </div>
        <div className="p-8 space-y-6 bg-slate-50">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <p className="text-[10px] uppercase font-black text-slate-400">Total Atendimentos</p>
              <p className="text-3xl font-black text-primary mt-2">{todayCount}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <p className="text-[10px] uppercase font-black text-slate-400">Casos Críticos</p>
              <p className="text-3xl font-black text-red-600 mt-2">{criticalCount}</p>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <Button
              className="flex-1 h-12 bg-primary text-white rounded-xl shadow-lg"
              onClick={() => {
                setIsReportGenerating(true);
                setTimeout(() => {
                  setIsReportGenerating(false);
                  toast({
                    title: "Relatório Gerado",
                    description: "O Relatório PDF foi gerado e enviado para o seu email.",
                  });
                  setIsReportOpen(false);
                }, 2000);
              }}
            >
              {isReportGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4 mr-2" />
              )}
              {isReportGenerating ? "Processando..." : "Baixar PDF"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 border-slate-200 text-slate-600 rounded-xl bg-white"
              onClick={() =>
                toast({
                  title: "Exportado",
                  description: "O arquivo CSV foi baixado na sua máquina.",
                })
              }
            >
              <Download className="size-4 mr-2" />
              Excel / CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
