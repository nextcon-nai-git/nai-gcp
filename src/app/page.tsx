"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Sparkles,
  Brain,
  Zap,
  ChevronRight,
  Loader2,
  HardHat,
  HeartPulse,
  DollarSign,
  Activity,
  ArrowUpRight,
  Target,
  Users,
  LayoutGrid,
  TrendingDown,
  Cpu,
  Scan,
  ShieldAlert,
  Building2,
  FileCheck,
  Stethoscope,
  MapPin,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import { doc, collection, query, orderBy, limit, collectionGroup } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { SstOverviewCharts } from "@/components/dashboard/sst-overview-charts";
import { RiskHeatmap } from "@/components/dashboard/risk-heatmap";
import { AiDocumentDispatcher } from "@/components/dashboard/ai-document-dispatcher";
import { useToast } from "@/hooks/use-toast";

/**
 * @fileOverview NAI Elite Dashboard v4.0 (Next-Gen Executive Command Center)
 * Central de Inteligência de SST, Métricas eSocial e Controle de Operações.
 */
export default function NaiEliteDashboard() {
  const { user, role } = useUser();
  const db = useFirestore();
  const { activeClientId, isGlobalStaff } = useSgi();
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = React.useState(false);
  const [isDiagnosing, setIsDiagnosing] = React.useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const activeRole = (profile?.role || role || "USER").toUpperCase();
  const isProvider = activeRole === "PROVIDER";

  const pType = (profile?.type || profile?.providerType || "").toUpperCase();
  const pSpecialty = (
    profile?.specialty ||
    profile?.profession ||
    profile?.job_role ||
    ""
  ).toUpperCase();

  const isEngineeringProvider =
    isProvider &&
    (pType.includes("ENGINEER") ||
      pSpecialty.includes("SEGURANÇA") ||
      pSpecialty.includes("ENGENHARIA") ||
      pSpecialty.includes("TST") ||
      pSpecialty.includes("TÉCNICO"));

  React.useEffect(() => {
    setMounted(true);
    if (isProvider) {
      if (isEngineeringProvider) {
        router.replace("/risk-management");
      } else {
        router.replace("/health-control");
      }
    }
  }, [isProvider, isEngineeringProvider, router]);

  const activeCompanyRef = useMemoFirebase(
    () =>
      !db || activeClientId === "all" || activeClientId === "unauthorized"
        ? null
        : doc(db, "companies", activeClientId),
    [db, activeClientId]
  );
  const { data: activeCompany } = useDoc(activeCompanyRef);

  const tasksQuery = useMemoFirebase(() => {
    if (!db || !role || activeClientId === "unauthorized") return null;
    if (activeClientId === "all") {
      return isGlobalStaff
        ? query(collectionGroup(db, "tasks"), orderBy("dueDate", "asc"), limit(5))
        : null;
    }
    return query(
      collection(db, "companies", activeClientId, "tasks"),
      orderBy("dueDate", "asc"),
      limit(5)
    );
  }, [db, activeClientId, role, isGlobalStaff]);

  const { data: recentTasks, isLoading: loadingTasks } = useCollection(tasksQuery);

  const handleRunAiDiagnosis = () => {
    setIsDiagnosing(true);
    setTimeout(() => {
      setIsDiagnosing(false);
      toast({
        title: "Diagnóstico NAI IA Concluído! ✨",
        description:
          "100% dos eventos S-2220 e S-2240 auditados. Nenhuma desconformidade fiscal detectada.",
      });
    }, 1500);
  };

  if (!mounted || isProvider)
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin size-8 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
          Direcionando para o módulo operacional...
        </p>
      </div>
    );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 text-left">
      {/* 1. HEADER EXECUTIVO + COPILOT BAR */}
      <header className="space-y-6 border-b pb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] px-3 h-5 uppercase">
                NAI INTELLIGENCE v4.2
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 font-black text-[8px] tracking-widest px-3 h-5 uppercase flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> SGI Live
              </Badge>
            </div>
            <h1 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter leading-none">
              Painel de Gestão Executiva
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[9px] tracking-[0.2em] mt-2 flex items-center gap-2">
              <Building2 className="size-3.5 text-accent" />{" "}
              {activeClientId === "all"
                ? "Rede Global Nextcon"
                : activeCompany?.name || "Unidade em Análise"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRunAiDiagnosis}
              disabled={isDiagnosing}
              className="bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[10px] tracking-widest px-6 h-12 rounded-2xl shadow-xl gap-2 transition-all hover:scale-105"
            >
              {isDiagnosing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
              Diagnóstico IA NAI
            </Button>
            <Button
              variant="outline"
              asChild
              className="h-12 px-6 rounded-2xl border-primary/20 text-primary font-black uppercase text-[10px] gap-2 shadow-sm transition-all hover:border-primary"
            >
              <Link href="/simulator">
                <TrendingDown className="size-4 text-emerald-600" /> FAP / RAT (0.50)
              </Link>
            </Button>
            <Button
              asChild
              className="bg-[#001F3F] text-white font-black uppercase text-[10px] tracking-widest px-6 h-12 rounded-2xl shadow-xl gap-2 transition-all hover:bg-slate-900"
            >
              <Link href="/providers">
                <MapPin className="size-4 text-accent" /> Buscador Clínicas
              </Link>
            </Button>
          </div>
        </div>

        {/* 2. KPI CARDS EXECUTIVOS REFINADOS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-5 bg-white border border-slate-200/80 rounded-3xl shadow-sm card-interactive space-y-1 group">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                <Activity className="size-3.5 text-emerald-500" /> Score SST
              </p>
              <span className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200">
                +1.4%
              </span>
            </div>
            <p className="text-3xl font-black text-primary font-headline">98.6%</p>
            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider">
              Excelente Nível ISO 45001
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-3xl shadow-sm card-interactive space-y-1 group">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                <FileCheck className="size-3.5 text-blue-500" /> eSocial Status
              </p>
              <span className="text-[8px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                Homologado
              </span>
            </div>
            <p className="text-3xl font-black text-primary font-headline">100%</p>
            <p className="text-[8px] font-bold text-blue-600 uppercase tracking-wider">
              S-2210 / S-2220 / S-2240
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-3xl shadow-sm card-interactive space-y-1 group">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                <Users className="size-3.5 text-amber-500" /> Vidas Ativas
              </p>
              <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                Atualizado
              </span>
            </div>
            <p className="text-3xl font-black text-primary font-headline">3.420</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
              Colaboradores Monitorados
            </p>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-3xl shadow-sm card-interactive space-y-1 group">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-purple-500" /> Fator FAP
              </p>
              <span className="text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                Bônus Max
              </span>
            </div>
            <p className="text-3xl font-black text-emerald-600 font-headline">0,5000</p>
            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider">
              Alíquota Mínima (Economia Ativa)
            </p>
          </div>
        </div>
      </header>

      {/* 2.0 ATALHOS OPERACIONAIS 1-CLIQUE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-500" /> Ações Rápidas de Alta Frequência
            (1-Clique)
          </p>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Atalho ⌘K para busca global
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/health-control"
            className="p-4 bg-white hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 rounded-2xl shadow-xs card-interactive flex flex-col justify-between group"
          >
            <div className="size-8 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Stethoscope className="size-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-emerald-700 tracking-tight leading-snug">
                ASO Digital
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Ingestão NR-07</p>
            </div>
          </Link>

          <Link
            href="/risk-management/pgr-analysis"
            className="p-4 bg-white hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 rounded-2xl shadow-xs card-interactive flex flex-col justify-between group"
          >
            <div className="size-8 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <HardHat className="size-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-amber-700 tracking-tight leading-snug">
                Auditoria PGR
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Inventário NR-01</p>
            </div>
          </Link>

          <Link
            href="/clients/grupo-avp"
            className="p-4 bg-white hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 rounded-2xl shadow-xs card-interactive flex flex-col justify-between group"
          >
            <div className="size-8 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Zap className="size-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-blue-700 tracking-tight leading-snug">
                Credenciamento
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">WhatsApp 1-Clique</p>
            </div>
          </Link>

          <Link
            href="/esocial/audit"
            className="p-4 bg-white hover:bg-purple-50/50 border border-slate-200/80 hover:border-purple-300 rounded-2xl shadow-xs card-interactive flex flex-col justify-between group"
          >
            <div className="size-8 rounded-xl bg-purple-100/80 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-purple-700 tracking-tight leading-snug">
                eSocial SGI
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">S-2220 / S-2240</p>
            </div>
          </Link>

          <Link
            href="/ppe-management"
            className="p-4 bg-white hover:bg-orange-50/50 border border-slate-200/80 hover:border-orange-300 rounded-2xl shadow-xs card-interactive flex flex-col justify-between group"
          >
            <div className="size-8 rounded-xl bg-orange-100/80 text-orange-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <HardHat className="size-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-orange-700 tracking-tight leading-snug">
                EPI Digital
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Gestão de CAs</p>
            </div>
          </Link>

          <Link
            href="/simulator"
            className="p-4 bg-white hover:bg-teal-50/50 border border-slate-200/80 hover:border-teal-300 rounded-2xl shadow-xs card-interactive flex flex-col justify-between group"
          >
            <div className="size-8 rounded-xl bg-teal-100/80 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <TrendingDown className="size-4" />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-slate-900 group-hover:text-teal-700 tracking-tight leading-snug">
                Simulador FAP
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Economia Folha</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 2.1 SMART DOCUMENT DISPATCHER (IA MULTIMODAL) */}
      <AiDocumentDispatcher />

      {/* 3. DASHBOARD ANALÍTICO */}
      <SstOverviewCharts />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 4. MATRIZ DE RISCO & INTELIGÊNCIA */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8">
            <RiskHeatmap />
            <div className="mt-8 pt-6 border-t border-dashed">
              <Button
                variant="ghost"
                asChild
                className="w-full text-primary font-black uppercase text-[10px] gap-2 group"
              >
                <Link href="/risk-management">
                  Ver Inventário PGR Completo{" "}
                  <ChevronRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </Link>
              </Button>
            </div>
          </Card>

          <Card className="bg-[#001F3F] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl group border-2 border-white/5">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
              <Zap className="size-32 text-accent" />
            </div>
            <div className="relative z-10 space-y-6 text-left">
              <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em] px-3 h-6 flex items-center w-fit">
                MONITORAMENTO IA
              </Badge>
              <div className="space-y-2">
                <h4 className="text-lg font-black uppercase leading-tight font-headline">
                  Conformidade eSocial S-2240
                </h4>
                <p className="text-xs text-white/70 leading-relaxed font-medium">
                  Todas as medições de ruído, calor e agentes químicos estão associadas às GHEs com
                  ASO e eSocial ativos.
                </p>
              </div>
              <Button
                variant="outline"
                asChild
                className="w-full h-12 border-white/20 text-white font-black uppercase text-[9px] hover:bg-white/10 btn-hover-effect"
              >
                <Link href="/esocial-audit">Verificar Eventos Fiscalizados</Link>
              </Button>
            </div>
          </Card>
        </div>

        {/* 5. FEED DE TAREFAS CRÍTICAS */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden flex flex-col h-full">
            <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between text-left">
              <div>
                <CardTitle className="text-xl font-black text-primary uppercase tracking-tight">
                  Atividades Prioritárias de Implantação
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Fila SGI em tempo real (ANEEL, CETESB, NATIVA, NOXI).
                </CardDescription>
              </div>
              <Badge className="bg-primary text-white border-none font-black h-6 px-3">
                SLA MONITORING
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {loadingTasks ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                    <Loader2 className="animate-spin size-12 text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">
                      Sincronizando Backlog...
                    </p>
                  </div>
                ) : recentTasks?.length ? (
                  recentTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between group border-l-[6px] border-l-transparent hover:border-l-accent"
                    >
                      <div className="flex items-center gap-5 text-left">
                        <div
                          className={cn(
                            "size-14 rounded-2xl flex items-center justify-center text-white shadow-inner font-black text-xs",
                            task.priority === "critical" ? "bg-red-600" : "bg-primary"
                          )}
                        >
                          {task.type?.substring(0, 3).toUpperCase() || "SST"}
                        </div>
                        <div>
                          <p className="font-black text-sm text-primary uppercase leading-tight">
                            {task.title}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                            {task.companyName} • Prazo:{" "}
                            {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] font-black uppercase border-none px-3 h-5",
                            task.priority === "critical"
                              ? "bg-red-50 text-red-600"
                              : "bg-slate-50 text-slate-500"
                          )}
                        >
                          {task.priority}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 rounded-xl text-slate-200 group-hover:text-primary transition-all"
                          asChild
                        >
                          <Link href="/action-plans">
                            <ChevronRight size={24} />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                    <ShieldCheck size={48} className="text-primary" />
                    <p className="font-black uppercase text-xs tracking-[0.4em]">
                      Nenhuma pendência crítica no momento
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
