/**
 * @fileOverview Botão Inteligente para protocolo de auditoria neural.
 */

"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import { useState } from "react";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { processarRelatorioSST, type AnaliseRiscoOutput } from "@/actions/sst-report-processor";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TechnicalReportData } from "@/types/schema";

interface BotaoSalvarRelatorioProps {
  relatorioDados: { relatorio_visita_tecnica: TechnicalReportData };
  onSuccess?: (id: string, analise: AnaliseRiscoOutput) => void;
}

export function BotaoSalvarRelatorio({ relatorioDados, onSuccess }: BotaoSalvarRelatorioProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleProcessar = async () => {
    if (!relatorioDados?.relatorio_visita_tecnica) return;

    setIsProcessing(true);
    setIsSuccess(false);

    try {
      const result = await processarRelatorioSST(
        relatorioDados.relatorio_visita_tecnica,
        await getActionIdToken()
      );

      if (result.sucesso && result.relatorioId && result.analise) {
        setIsSuccess(true);
        toast({
          title: "Auditoria Concluída!",
          description: "Relatório analisado pela NAI e protocolado no Firestore.",
        });

        if (onSuccess) {
          onSuccess(result.relatorioId, result.analise);
        }

        setTimeout(() => setIsSuccess(false), 5000);
      } else {
        throw new Error(result.erro || "Falha desconhecida");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro na NAI";
      console.error("NAI Action Error:", errorMessage);
      toast({
        variant: "destructive",
        title: "Erro no Processamento",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleProcessar}
      disabled={isProcessing || isSuccess}
      className={cn(
        "w-full flex items-center justify-center gap-3 px-8 h-16 rounded-2xl font-black uppercase text-xs tracking-widest text-white shadow-2xl transition-all duration-500 active:scale-95",
        isSuccess
          ? "bg-emerald-600 shadow-emerald-600/20"
          : "bg-primary hover:bg-primary/90 shadow-primary/20",
        (isProcessing || isSuccess) && "opacity-90 cursor-default"
      )}
    >
      {isProcessing ? (
        <>
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
          NAI Neural Processing...
        </>
      ) : isSuccess ? (
        <>
          <CheckCircle2 className="w-6 h-6 text-accent animate-in zoom-in" />
          Protocolo Realizado com Sucesso
        </>
      ) : (
        <>
          <Sparkles className="w-6 h-6 text-accent" />
          Finalizar Auditoria via NAI
        </>
      )}
    </button>
  );
}
