"use client";

import * as React from "react";
import {
  ShieldPlus,
  Loader2,
  CheckCircle2,
  Sparkles,
  Zap,
  CircleDollarSign,
  TrendingDown,
  Scale,
  Brain,
  Gavel,
  HeartPulse,
  ShieldAlert,
  ChevronRight,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function MedicalAuditingDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState("superjunta");
  const [isAuditing, setIsAuditing] = React.useState(false);

  const auditLogsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "medical_audits"), orderBy("createdAt", "desc"), limit(20));
  }, [db]);
  const { data: audits, isLoading } = useCollection(auditLogsQuery);

  const handleStartAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      setIsAuditing(false);
      toast({
        title: "Auditoria NAI Concluída",
        description: "Detectadas 4 inconsistências em cobranças de OPME.",
      });
    }, 2500);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary text-accent rounded-2xl shadow-xl shadow-primary/20">
              <ShieldPlus className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
                Super-Junta & Glosa Reversa
              </h1>
              <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1 flex items-center gap-2">
                <ShieldAlert className="size-3 text-red-600" /> Blindagem Regulatória e Financeira
                em Saúde.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 border-none font-black uppercase text-[10px] h-10 px-4 flex items-center shadow-sm">
            <CheckCircle2 className="size-4 mr-2" /> RN 424 ANS CONFORME
          </Badge>
          <Button
            onClick={handleStartAudit}
            disabled={isAuditing}
            className="gradient-nextcon text-white h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl gap-2"
          >
            {isAuditing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4 text-accent" />
            )}
            Ativar Motor NAI Forensic
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          label="Sinistralidade Evitada"
          value="R$ 1.2M"
          sub="Jan - Fev 2026"
          icon={CircleDollarSign}
          color="text-blue-600"
          bg="bg-blue-50"
          trend="down"
        />
        <MetricCard
          label="Liminares TEA/Autismo"
          value="12"
          sub="Acompanhamento Ativo"
          icon={ShieldAlert}
          color="text-red-600"
          bg="bg-red-50"
        />
        <MetricCard
          label="Índice de Glosa Reversa"
          value="14.8%"
          sub="Meta: 18%"
          icon={TrendingDown}
          color="text-emerald-600"
          bg="bg-emerald-50"
          trend="up"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[700px] grid-cols-3 bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="superjunta"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
          >
            <Gavel className="size-4" /> Super-Junta
          </TabsTrigger>
          <TabsTrigger
            value="glosa"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 text-accent"
          >
            <CircleDollarSign className="size-4" /> Glosa Reversa
          </TabsTrigger>
          <TabsTrigger
            value="biometria"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
          >
            <HeartPulse className="size-4" /> Vínculo Biométrico
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="superjunta"
          className="mt-8 space-y-8 animate-in slide-in-from-bottom-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-primary/5 border-b p-8 text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-black text-primary uppercase">
                      Pleitos Judiciais em Análise
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Estratégias de defesa técnica fundamentada.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-6 border-red-200 text-red-600 font-black uppercase text-[8px] bg-red-50"
                  >
                    CRÍTICO
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                  {[
                    {
                      id: "PJ-001",
                      patient: "",
                      cause: "Terapias ABA (Custo Elevado)",
                      status: "Em Junta Técnica",
                      risk: "R$ 45.000/mês",
                    },
                    {
                      id: "PJ-042",
                      patient: "",
                      cause: "Tratamento Multidisciplinar Home-Care",
                      status: "Parecer Emitido",
                      risk: "R$ 18.000/mês",
                    },
                    {
                      id: "PJ-109",
                      patient: "",
                      cause: "Cirurgia OPME Robótica",
                      status: "Aguardando Especialista",
                      risk: "R$ 150.000/evento",
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="p-6 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-5">
                        <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner font-black text-xs">
                          {item.id}
                        </div>
                        <div>
                          <p className="font-black text-xs text-primary uppercase">
                            {item.patient}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium italic mt-0.5">
                            "{item.cause}"
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[8px] h-5 mb-1">
                          {item.status}
                        </Badge>
                        <p className="text-xs font-black text-red-600 tabular-nums">{item.risk}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                <Scale className="size-48 text-accent" />
              </div>
              <div className="relative z-10 space-y-8 text-left">
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight text-accent flex items-center gap-2">
                    <Brain className="size-5" /> Fundamentação NAI
                  </h3>
                  <p className="text-sm italic font-medium leading-relaxed text-slate-300">
                    "O motor NAI Forensic cruza jurisprudência do STJ (Tema 1069) com as diretrizes
                    de utilização da ANS para neutralizar liminares sem base técnica."
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <p className="text-[9px] font-black uppercase text-accent mb-1">
                      Taxa de Êxito em Juntas
                    </p>
                    <div className="flex items-end gap-2">
                      <h4 className="text-3xl font-black tabular-nums">92%</h4>
                      <TrendingDown className="size-5 text-emerald-400 mb-1" />
                    </div>
                  </div>
                  <Button className="w-full h-14 bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[10px] rounded-2xl shadow-xl transition-transform active:scale-95">
                    Gerar Dossiê de Defesa
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color, bg, trend }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-[2rem] group hover:ring-2 ring-primary/5 transition-all overflow-hidden relative">
      <CardContent className="p-6 relative z-10 text-left">
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn("p-3 rounded-2xl group-hover:scale-110 transition-transform", bg, color)}
          >
            <Icon className="size-5" />
          </div>
          {trend && (
            <Badge
              variant="outline"
              className={cn(
                "text-[8px] font-black uppercase border-none px-2 h-5",
                trend === "up" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              )}
            >
              Live
            </Badge>
          )}
        </div>
        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
          {label}
        </p>
        <h3
          className={cn("text-3xl font-black font-headline tabular-nums leading-none mb-1", color)}
        >
          {value}
        </h3>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{sub}</p>
      </CardContent>
    </Card>
  );
}
