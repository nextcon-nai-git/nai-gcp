"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Zap,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  HeartPulse,
  Calculator,
  DollarSign,
  TrendingDown,
  Brain,
  ArrowUpRight,
  Users as UsersIcon,
  CheckCircle2,
  Bot,
  Shield,
  Building2,
  Activity,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MedicalCopilot from "@/components/medical/medical-copilot";
import { useDebounce } from "@/hooks/useDebounce";

// Dynamic imports para heavy libraries
const RechartsChart = dynamic(
  () => import("./recharts-wrapper"),
  { ssr: false, loading: () => <div className="h-64 bg-slate-100 rounded-lg" /> }
);

function TypewriterText({ text, delay = 10 }: { text: string; delay?: number }) {
  const [displayedText, setDisplayedText] = React.useState("");

  React.useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.substring(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, delay);
    return () => clearInterval(interval);
  }, [text, delay]);

  return <span>{displayedText}</span>;
}

function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  isCurrency = false,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
}) {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 2000;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(easeProgress * value);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value]);

  if (isCurrency) {
    return (
      <span className="tabular-nums">
        {prefix}
        {count.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        {suffix}
      </span>
    );
  }
  return (
    <span className="tabular-nums">
      {prefix}
      {Math.floor(count).toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const [saudacao, setSaudacao] = React.useState("");
  const [isClient, setIsClient] = React.useState(false);

  const [fapValue, setFapValue] = React.useState([0.74]);
  const debouncedFapValue = useDebounce(fapValue, 300); // Debounce slider
  
  const [payroll, setPayroll] = React.useState(150000);
  const debouncedPayroll = useDebounce(payroll, 300); // Debounce input

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile, isLoading: loadingProfile } = useDoc(profileRef);

  const companyRef = useMemoFirebase(() => {
    if (!db || !profile?.companyId) return null;
    return doc(db, "companies", profile.companyId);
  }, [db, profile?.companyId]);
  const { data: company } = useDoc(companyRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (loadingProfile || !profile) return false;
    const role = (profile.role || "").toUpperCase();
    return ["SUPER_ADMIN", "ADMIN"].includes(role);
  }, [profile, loadingProfile]);

  React.useEffect(() => {
    setIsClient(true);
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) setSaudacao("Bom dia");
    else if (hora >= 12 && hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");
  }, []);

  const potentialSavings = React.useMemo(() => {
    return debouncedPayroll * 0.02 * (1 - debouncedFapValue[0]) * 12;
  }, [debouncedPayroll, debouncedFapValue]);

  const mockDataCocel = React.useMemo(
    () => [
      { value: 10000 },
      { value: 10500 },
      { value: 11000 },
      { value: 10800 },
      { value: 11500 },
      { value: 12794.07 },
    ],
    []
  );

  const mockDataVigilancia = React.useMemo(
    () => [
      { value: 700 },
      { value: 720 },
      { value: 750 },
      { value: 740 },
      { value: 790 },
      { value: 806 },
    ],
    []
  );

  const roiData = React.useMemo(() => {
    return [
      { value: potentialSavings * 0.4 },
      { value: potentialSavings * 0.5 },
      { value: potentialSavings * 0.7 },
      { value: potentialSavings * 0.8 },
      { value: potentialSavings * 0.95 },
      { value: potentialSavings },
    ];
  }, [potentialSavings]);

  if (!isClient) return null;

  const displayName = profile?.name || "Gestor";

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full bg-primary" />
            <h1 className="text-2xl font-black text-primary tracking-tight font-headline uppercase leading-none">
              {loadingProfile ? (
                <Skeleton className="h-10 w-48" />
              ) : (
                <div className="flex flex-col gap-1">
                  <span>
                    {saudacao}, <span className="text-slate-500">{displayName}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-400 normal-case tracking-normal">
                    {isGlobalAdmin
                      ? "Gestão Estratégica da Rede"
                      : `Unidade: ${company?.name || "Monitoramento Ativo"}`}
                  </span>
                </div>
              )}
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] ml-4">
            Cérebro NAI • Inteligência Nextcon 2026
          </p>
        </div>
        <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest px-5 h-11 border-none shadow-xl">
          {isGlobalAdmin ? "INTELIGÊNCIA CORPORATIVA" : "CONFORMIDADE DA UNIDADE"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Alerta de Caso Real: Nativa */}
          <Card className="border-none bg-blue-50 ring-2 ring-blue-100 rounded-[2.5rem] overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 fill-mode-both">
            <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-primary text-white rounded-3xl shadow-lg">
                  <FileText className="size-8 text-accent" />
                </div>
                <div>
                  <Badge className="bg-primary text-white text-[8px] font-black uppercase mb-2">
                    Relatório Disponível
                  </Badge>
                  <h3 className="text-lg font-black text-primary uppercase">
                    Nativa Empreendimentos
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Auditoria de Campo Laguna & Mônaco finalizada.
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-primary text-white font-black uppercase text-[10px] h-12 px-8 rounded-xl shadow-lg"
              >
                <Link href="/reports/technical-visit/nativa">Abrir Dossiê</Link>
              </Button>
            </div>
          </Card>

          {/* Resumo Operacional com Gráficos Dinâmicos */}
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both hover:-translate-y-1">
            <CardHeader className="pb-4 px-8 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary text-white rounded-xl shadow-inner">
                    <Brain className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      Resumo Operacional NAI
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-400">
                      Status de Blindagem Técnica e Tributária.
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 border-emerald-100 text-emerald-700 font-black text-[10px] h-8 uppercase"
                >
                  Conforme
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-3xl border shadow-inner flex flex-col justify-center relative overflow-hidden group">
                  <RechartsChart data={mockDataCocel} color="#10b981" isCurrency={true} />
                  <div className="relative z-10 pointer-events-none group-hover:pointer-events-auto">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                      Contrato COCEL Aditivo
                    </p>
                    <h3 className="text-2xl font-black text-primary">
                      <AnimatedCounter value={12794.07} isCurrency />
                    </h3>
                    <div className="flex items-center gap-1 mt-2">
                      <CheckCircle2 className="size-3 text-emerald-500" />
                      <span className="text-[9px] font-bold text-emerald-600 uppercase">
                        Gestão SST & eSocial Ativa
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border shadow-inner flex flex-col justify-center relative overflow-hidden group">
                  <RechartsChart data={mockDataVigilancia} color="#3b82f6" />
                  <div className="relative z-10 pointer-events-none group-hover:pointer-events-auto">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                      Vigilância Total
                    </p>
                    <h3 className="text-2xl font-black text-primary">
                      <AnimatedCounter value={806} suffix=" Vidas" />
                    </h3>
                    <div className="flex items-center gap-1 mt-2">
                      <Activity className="size-3 text-blue-500" />
                      <span className="text-[9px] font-bold text-blue-600 uppercase">
                        Sincronização 100% OK
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] text-white relative overflow-hidden group shadow-[0_0_40px_rgba(30,136,229,0.15)] ring-1 ring-white/5">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                  <Shield className="size-32 text-white" />
                </div>
                <div className="relative z-10 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 flex items-center gap-2">
                    <Zap className="size-3 fill-current text-primary" /> Insight Preditivo NAI
                  </p>
                  <p className="text-sm italic font-medium leading-relaxed text-slate-300 min-h-[60px]">
                    <TypewriterText
                      text='"O aditivo contratual da COCEL e a auditoria da Nativa demonstram a maturidade da rede. Mantenha os protocolos do eSocial S-2240 sincronizados para sustentar o bônus FAP."'
                      delay={15}
                    />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Simulador ROI com Debouncing */}
        <div className="space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both hover:-translate-y-1">
            <CardHeader className="bg-primary/5 pb-6 p-8 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary text-white rounded-xl shadow-lg">
                  <Calculator className="size-5" />
                </div>
                <CardTitle className="text-sm font-black text-primary uppercase tracking-tight">
                  Simulador ROI NAI
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                    Fator FAP Alvo
                  </label>
                  <span className="text-xl font-black text-primary tracking-tighter">
                    {debouncedFapValue[0].toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={fapValue}
                  onValueChange={setFapValue}
                  max={2}
                  min={0.5}
                  step={0.01}
                  className="py-4"
                />
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner relative overflow-hidden group">
                <RechartsChart
                  data={roiData}
                  color={potentialSavings > 0 ? "#10b981" : "#ef4444"}
                  isCurrency={true}
                />
                <div className="relative z-10 pointer-events-none group-hover:pointer-events-auto">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
                    Economia Anual Est.
                  </p>
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        "text-2xl font-black font-headline tracking-tighter transition-all",
                        potentialSavings > 0
                          ? "text-emerald-600 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                          : "text-red-500"
                      )}
                    >
                      <AnimatedCounter value={Math.abs(potentialSavings)} isCurrency />
                    </h3>
                    {potentialSavings > 0 ? (
                      <ArrowUpRight className="size-5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="size-5 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
              <Button
                asChild
                className="w-full h-12 bg-primary text-white font-black uppercase text-[9px] tracking-widest rounded-xl"
              >
                <Link href="/analytics">Análise Completa</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Medical Copilot */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="fixed bottom-8 right-8 h-16 w-16 rounded-full bg-primary shadow-2xl hover:scale-105 transition-transform duration-300 flex items-center justify-center p-0 z-50 ring-4 ring-primary/20">
            <Bot className="size-8 text-white" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 border-l-0 bg-slate-50 flex flex-col"
        >
          <SheetHeader className="p-6 bg-primary text-white rounded-bl-3xl">
            <SheetTitle className="text-white font-black uppercase tracking-widest flex items-center gap-2 text-sm">
              <Brain className="size-5" />
              Assistente NAI
            </SheetTitle>
            <p className="text-primary-foreground/80 text-xs font-medium">
              Suporte clínico e técnico em tempo real.
            </p>
          </SheetHeader>
          <div className="flex-1 p-4 overflow-hidden">
            <MedicalCopilot pacienteId="contexto_geral" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
