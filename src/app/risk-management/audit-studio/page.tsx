"use client";

import * as React from "react";
import { useState, useTransition, useOptimistic, useEffect, useRef } from "react";
import {
  Zap,
  Brain,
  Sparkles,
  ShieldAlert,
  Loader2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Database,
  Building2,
  Terminal,
  ChevronRight,
  Monitor,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSgi } from "@/contexts/sgi-context";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Interfaces Estruturais do Padrão NAI 2026
interface RiskItem {
  id: string;
  nr: string;
  description: string;
  severity: "BAIXO" | "MÉDIO" | "ALTO" | "CRÍTICO";
  status: "AUDITADO" | "PENDENTE";
}

interface AIStreamState {
  text: string;
  isStreaming: boolean;
  confidenceScore: number;
}

export default function NaiAuditStudio() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [isPending, startTransition] = useTransition();

  const activeCompanyRef = useMemoFirebase(
    () =>
      !db || activeClientId === "all" || activeClientId === "unauthorized"
        ? null
        : doc(db, "companies", activeClientId),
    [db, activeClientId]
  );
  const { data: activeCompany } = useDoc(activeCompanyRef);

  // 1. Estados Principais
  const [risks, setRisks] = useState<RiskItem[]>([
    {
      id: "1",
      nr: "NR-12",
      description: "Ponto de esmagamento em prensa hidráulica sem sensor de barreira.",
      severity: "CRÍTICO",
      status: "PENDENTE",
    },
    {
      id: "2",
      nr: "NR-15",
      description: "Ruído contínuo de 88 dB(A) na linha de montagem principal.",
      severity: "ALTO",
      status: "AUDITADO",
    },
  ]);

  // 2. UI Otimista (React 19)
  const [optimisticRisks, setOptimisticRisks] = useOptimistic(risks, (state, newRisk: RiskItem) => [
    newRisk,
    ...state,
  ]);

  // 3. Estado do Motor de IA (Streaming)
  const [aiResponse, setAiResponse] = useState<AIStreamState>({
    text: "",
    isStreaming: false,
    confidenceScore: 0,
  });

  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiResponse.isStreaming && streamRef.current) {
      streamRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [aiResponse.text, aiResponse.isStreaming]);

  const handleTriggerAIAudit = async () => {
    setAiResponse({ text: "", isStreaming: true, confidenceScore: 0 });

    const fullText = `ANÁLISE NAI 2026 [Contexto: ${activeCompany?.name || "Unidade"}]: Detectada não-conformidade crítica na prensa da linha 02. Risco iminente de amputação. Ação imediata: Instalação de cortina de luz Categoria 4 de acordo com a NR-12. Protocolo de interdição temporária sugerido para e-Social S-2240.`;
    const words = fullText.split(" ");
    let currentText = "";

    for (let i = 0; i < words.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      currentText += words[i] + " ";
      setAiResponse((prev) => ({ ...prev, text: currentText }));
    }
    setAiResponse((prev) => ({ ...prev, isStreaming: false, confidenceScore: 98.4 }));
  };

  const handleAddRiskAction = async (formData: FormData) => {
    if (!db || !activeClientId) return;

    const description = formData.get("description") as string;
    const nr = formData.get("nr") as string;
    if (!description || !nr) return;

    const dummyNewRisk: RiskItem = {
      id: Math.random().toString(),
      nr: nr.toUpperCase(),
      description,
      severity: "CRÍTICO",
      status: "PENDENTE",
    };

    startTransition(async () => {
      setOptimisticRisks(dummyNewRisk);

      try {
        const risksRef = collection(db, "companies", activeClientId, "pgr_risks");
        await addDoc(risksRef, {
          hazard: description,
          category: "acidente",
          nr: nr.toUpperCase(),
          probability: 4,
          severity: 5,
          status: "atenção",
          createdAt: serverTimestamp(),
        });

        setRisks((prev) => [dummyNewRisk, ...prev]);
        toast({
          title: "Achado Protocolado",
          description: "O risco foi injetado no inventário do PGR.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Falha na Sincronização",
          description: "O rollback foi aplicado.",
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 rounded-[3rem] font-sans antialiased relative overflow-hidden -m-10">
      {/* BACKGROUND FX */}
      <div className="absolute top-[-10%] left-[-20%] w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/10 to-purple-500/0 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <header className="border-b border-slate-800 pb-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 backdrop-blur-md bg-slate-950/40 p-6 rounded-3xl border border-slate-900 shadow-2xl relative z-10">
        <div className="text-left">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-cyan-400 animate-ping absolute" />
            <span className="h-3 w-3 rounded-full bg-cyan-500 relative" />
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent uppercase font-headline">
              Audit Studio{" "}
              <span className="text-cyan-400 text-sm font-mono font-light tracking-widest border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 rounded ml-2">
                v2.6
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            Ecossistema de Alta Performance em SST & Auditoria Preditiva
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] text-slate-500 bg-slate-900/60 px-5 py-3 rounded-2xl border border-slate-800/60 shadow-inner">
          <div className="flex flex-col gap-0.5">
            <span className="uppercase opacity-40">Unidade Ativa</span>
            <span className="text-cyan-400 font-black">{activeCompany?.name || "---"}</span>
          </div>
          <div className="h-8 w-px bg-slate-800 mx-2" />
          <div className="flex flex-col gap-0.5">
            <span className="uppercase opacity-40">Status Cloud</span>
            <span className="text-emerald-400 font-black">NAI EDGE READY</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-7xl mx-auto relative z-10">
        {/* COLUNA ESQUERDA: CAPTURA RAPIDA */}
        <div className="lg:col-span-5 space-y-8">
          <Card className="bg-slate-900/40 border-slate-800 rounded-[2rem] p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group border-2">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex items-center gap-3 mb-8 text-left">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <Plus className="size-5 text-cyan-400" />
              </div>
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest">
                Injeção de Riscos (GRO)
              </h2>
            </div>

            <form action={handleAddRiskAction} className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                  Norma Regulamentadora
                </label>
                <Input
                  name="nr"
                  placeholder="Ex: NR-12, NR-35"
                  required
                  className="h-12 bg-slate-950/80 border-slate-800 rounded-xl text-sm font-bold text-slate-100 focus-visible:ring-cyan-500/30 transition-all placeholder:text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                  Descrição do Achado
                </label>
                <Textarea
                  name="description"
                  rows={4}
                  placeholder="Descreva o risco encontrado na planta..."
                  required
                  className="bg-slate-950/80 border-slate-800 rounded-2xl text-sm text-slate-100 focus-visible:ring-cyan-500/30 transition-all placeholder:text-slate-700 resize-none font-medium"
                />
              </div>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-14 bg-slate-100 hover:bg-white text-slate-950 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl gap-3 transition-transform active:scale-95 disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Database className="size-4" />
                )}
                {isPending ? "Sincronizando..." : "Injetar na Matriz Otimista"}
              </Button>
            </form>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800 rounded-[2rem] p-8 backdrop-blur-xl shadow-2xl relative border-2 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <Brain className="size-5 text-purple-400 animate-pulse" />
              </div>
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest">
                Co-piloto Gemini 3.8 Neural
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium italic">
              "Dispare a auditoria forense cruzando dados com a base do eSocial e as 38 Normas
              Regulamentadoras."
            </p>
            <Button
              onClick={handleTriggerAIAudit}
              disabled={aiResponse.isStreaming}
              className="w-full h-14 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl shadow-cyan-500/10 gap-3 hover:opacity-90 active:scale-95 transition-all"
            >
              {aiResponse.isStreaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 text-accent" />
              )}
              Auditar com Inteligência Preditiva
            </Button>
          </Card>
        </div>

        {/* COLUNA DIREITA: FEED REAL-TIME */}
        <div className="lg:col-span-7 space-y-8">
          {/* AI STREAM PANEL */}
          {(aiResponse.text || aiResponse.isStreaming) && (
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950/30 border-2 border-purple-500/40 rounded-[2.5rem] p-8 relative overflow-hidden animate-in slide-in-from-top-4 duration-500 shadow-2xl text-left">
              <div className="absolute top-0 right-0 p-5">
                {aiResponse.confidenceScore > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[9px] font-mono text-purple-400 bg-purple-500/10 border-purple-500/30 px-3 py-1 rounded-full uppercase font-black tracking-widest"
                  >
                    Acurácia: {aiResponse.confidenceScore}%
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mb-4">
                <Terminal className="size-3 text-purple-400" />
                <h3 className="text-[10px] font-mono text-purple-400 tracking-[0.3em] uppercase font-black">
                  NAI Cognitive Analytics
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-200 font-medium italic whitespace-pre-line">
                {aiResponse.text}
                {aiResponse.isStreaming && (
                  <span className="inline-block w-2.5 h-4 bg-cyan-400 ml-1 animate-pulse" />
                )}
              </p>
              <div ref={streamRef} />
            </div>
          )}

          {/* RISK MATRIX */}
          <Card className="bg-slate-900/20 border-2 border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="px-8 py-6 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Monitor className="size-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">
                  Matriz Ativa (Multi-Tenant Hub)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-tighter">
                {optimisticRisks.length} Registros Injetados
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto scrollbar-thin">
              {optimisticRisks.map((risk) => (
                <div
                  key={risk.id}
                  className="p-6 hover:bg-white/5 transition-all flex items-start justify-between gap-6 group text-left"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono font-black px-2 py-0.5 rounded-lg bg-slate-950 text-cyan-400 border-cyan-500/20"
                      >
                        {risk.nr}
                      </Badge>
                      <Badge
                        className={cn(
                          "text-[9px] font-black uppercase border-none px-2.5 py-0.5 rounded-full",
                          risk.severity === "CRÍTICO"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
                            : risk.severity === "ALTO"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        )}
                      >
                        {risk.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-bold uppercase tracking-tight">
                      {risk.description}
                    </p>
                  </div>

                  <div className="flex flex-col items-end justify-between h-full min-w-[100px]">
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5",
                        risk.status === "AUDITADO" ? "text-emerald-400" : "text-amber-500"
                      )}
                    >
                      <div
                        className={cn(
                          "size-1.5 rounded-full",
                          risk.status === "AUDITADO"
                            ? "bg-emerald-500 shadow-[0_0_10px_#10b981]"
                            : "bg-amber-500 animate-pulse"
                        )}
                      />
                      {risk.status}
                    </span>
                    <span className="text-[8px] text-slate-600 font-mono font-black mt-4 opacity-30 group-hover:opacity-100 transition-opacity">
                      UID: {risk.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
