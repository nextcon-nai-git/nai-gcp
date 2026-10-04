"use client";

import * as React from "react";
import {
  Database,
  Binary,
  Loader2,
  UploadCloud,
  ShieldCheck,
  Sparkles,
  FileSearch,
  Code,
  Zap,
  Brain,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Cpu,
  Fingerprint,
  Info,
  Camera,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  processDataIntelligence,
  type DataIntelligenceOutput,
} from "@/ai/flows/data-intelligence-agent-flow";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * @fileOverview NAI Data Lab - O Terminal do Agente de Dados.
 * Interface para processamento multimodal e visualização de payload JSON.
 */

export default function DataLabPage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [result, setResult] = React.useState<DataIntelligenceOutput | null>(null);
  const [context, setContext] = React.useState<"DOCUMENT" | "FIELD_PHOTO">("DOCUMENT");
  const [fileName, setFileName] = React.useState("");

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Falha na leitura do arquivo."));
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setResult(null);

    try {
      const base64 = await readFileAsDataURL(file);
      const analysis = await processDataIntelligence({
        mediaDataUri: base64,
        contextType: context === "DOCUMENT" ? "DOCUMENT" : "FIELD_PHOTO",
      });

      if (!analysis) throw new Error("A NAI não retornou dados para este arquivo.");

      setResult(analysis);
      toast({
        title: "Processamento Concluído",
        description: "Dados estruturados em JSON para o Backend.",
      });
    } catch (error: any) {
      console.error("Data Lab Error:", error);
      const isForbidden = error.message?.includes("403") || error.message?.includes("API key");
      toast({
        variant: "destructive",
        title: isForbidden ? "Erro de Credencial (IA)" : "Erro no Agente de Dados",
        description: isForbidden
          ? "Sua chave Gemini foi invalidada. Por favor, atualize o GEMINI_API_KEY no .env."
          : error.message,
      });
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-8">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5 uppercase">
            DATA INTELLIGENCE ENGINE v4.0
          </Badge>
          <h1 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter leading-none">
            NAI Data Lab
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.3em] mt-2 flex items-center gap-2">
            <Binary className="size-4 text-accent animate-pulse" /> OCR Avançado & Visão
            Computacional de Campo.
          </p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setContext("DOCUMENT")}
            className={cn(
              "h-10 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest",
              context === "DOCUMENT" ? "bg-white text-primary shadow-sm" : "text-slate-400"
            )}
          >
            Modo Documento
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setContext("FIELD_PHOTO")}
            className={cn(
              "h-10 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2",
              context === "FIELD_PHOTO" ? "bg-white text-primary shadow-sm" : "text-slate-400"
            )}
          >
            <Camera className="size-3" /> Modo Visão Campo
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* INPUT DE MÍDIA */}
        <div className="lg:col-span-5 space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden group">
            <div className="p-10 bg-primary text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Fingerprint className="size-32 text-accent" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-accent shadow-2xl transition-transform group-hover:rotate-6">
                  <UploadCloud size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-headline font-black uppercase tracking-tight">
                    Ingestão Multimodal
                  </h3>
                  <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.3em] mt-1">
                    Upload p/ /processamento-pendente
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="p-10">
              <div
                className={cn(
                  "h-64 border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-center p-8 transition-all cursor-pointer",
                  isProcessing
                    ? "border-accent bg-accent/5"
                    : "border-slate-100 hover:border-primary/20 bg-slate-50"
                )}
                onClick={() => document.getElementById("lab-upload")?.click()}
              >
                <input id="lab-upload" type="file" className="hidden" onChange={handleFile} />

                {isProcessing ? (
                  <div className="space-y-4">
                    <Loader2 className="size-12 animate-spin text-primary opacity-20 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">
                      Injetando no Cérebro NAI...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="size-16 rounded-[1.5rem] bg-white shadow-xl flex items-center justify-center mx-auto text-primary transition-transform group-hover:scale-110">
                      <FileSearch size={28} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-primary uppercase">
                        Arraste a Evidência
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        PNG, JPG ou PDF de Auditoria
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                  <Info className="size-4 text-primary shrink-0" />
                  <p className="text-[9px] text-primary/70 font-medium italic leading-relaxed">
                    "O agente processará o OCR e extrairá entidades para persistência direta no
                    Firestore via payload JSON rigoroso."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {result?.criticalAlert && (
            <div className="p-8 bg-red-600 text-white rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 border-b-8 border-red-800">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-2 bg-white/20 rounded-xl">
                  <AlertTriangle className="size-6 text-accent" />
                </div>
                <h4 className="text-lg font-black uppercase font-headline">
                  Risco Crítico Detectado
                </h4>
              </div>
              <p className="text-sm font-bold leading-relaxed">"{result.criticalAlert}"</p>
            </div>
          )}
        </div>

        {/* TERMINAL JSON OUTPUT */}
        <div className="lg:col-span-7 h-full">
          <Card className="card-shadow border-none bg-slate-900 text-white rounded-[3rem] overflow-hidden flex flex-col h-full min-h-[600px] border-2 border-white/5">
            <CardHeader className="bg-slate-950/80 p-8 border-b border-white/5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Terminal className="size-4 text-emerald-400" />
                <CardTitle className="text-xs font-mono font-black uppercase tracking-[0.4em] text-emerald-400">
                  JSON Payload Monitor
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-mono border-white/10 text-white/40"
              >
                v4.0.0-PROD
              </Badge>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-8 font-mono text-[11px]">
                {result ? (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center gap-2 text-emerald-400/60 mb-2">
                      <CheckCircle2 size={12} />
                      <span>Processamento validado - Score: {result.aiConfidence}%</span>
                    </div>
                    <pre className="text-blue-300 leading-relaxed overflow-x-auto p-6 bg-black/30 rounded-2xl border border-white/5">
                      {JSON.stringify(result.jsonPayload, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 text-center gap-6 py-32">
                    <Code size={80} />
                    <p className="text-sm font-black uppercase tracking-[0.5em]">
                      Listening... awaiting payload
                    </p>
                  </div>
                )}
              </ScrollArea>

              {result && (
                <div className="p-8 bg-slate-950/50 border-t border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-white/40">
                      Status: Sincronizado p/ Backend
                    </span>
                  </div>
                  <Button className="h-10 bg-white text-primary font-black uppercase text-[10px] rounded-xl hover:bg-slate-100 gap-2">
                    <Zap size={14} className="text-accent" /> Executar POST Real
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
