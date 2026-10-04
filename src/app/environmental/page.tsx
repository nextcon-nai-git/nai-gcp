"use client";

import * as React from "react";
import {
  Wind,
  Trash2,
  Droplet,
  Zap,
  Activity,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Plus,
  ArrowRight,
  Brain,
  Sparkles,
  PieChart,
  BarChart3,
  Waves,
  Flame,
  CloudRain,
  Building2,
  Box,
  Truck,
  Leaf,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";

export default function EnvironmentalManagement() {
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [activeTab, setActiveTab] = React.useState("aia");

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Gestão Ambiental (ISO 14001)
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Wind className="size-3 text-emerald-500" /> Matriz AIA e Governança de Impactos 2026.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge
            variant="outline"
            className="h-11 border-primary text-primary font-black uppercase text-[10px] bg-white px-4 flex items-center shadow-sm"
          >
            <Building2 className="size-4 mr-2" />
            {activeClientId === "all" ? "GESTÃO GLOBAL" : "UNIDADE ATIVA"}
          </Badge>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
            <Plus className="size-4 text-white" /> Novo Aspecto (AIA)
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Impactos Críticos"
          value="02"
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-50"
        />
        <KpiCard
          label="Destinação Final"
          value="100%"
          icon={Truck}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Resíduos Desviados"
          value="98%"
          icon={Trash2}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          label="Conformidade LIRA"
          value="Ativa"
          icon={ShieldCheck}
          color="text-primary"
          bg="bg-slate-100"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[800px] grid-cols-4 bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="aia"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Matriz AIA 5x5
          </TabsTrigger>
          <TabsTrigger
            value="waste"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600"
          >
            <Leaf className="size-4" /> Gestão Resíduos (PGRS)
          </TabsTrigger>
          <TabsTrigger
            value="controls"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Controles
          </TabsTrigger>
          <TabsTrigger
            value="monitoring"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-accent"
          >
            <Brain className="size-4" /> Monitoramento IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aia" className="mt-8 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[3rem] p-10">
            <div className="flex flex-col lg:flex-row gap-12">
              <div className="lg:w-1/3 space-y-6">
                <h3 className="text-xl font-black text-primary uppercase font-headline">
                  Significância Ambiental
                </h3>
                <p className="text-sm text-slate-500 font-medium italic">
                  "AIA: Severidade do Impacto x Frequência do Aspecto."
                </p>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                    <span>Aspecto Crítico</span>
                    <Badge className="bg-red-100 text-red-700 h-5 px-2 border-none">
                      VAZAMENTO ÓLEO
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                    <span>Situação Operação</span>
                    <Badge className="bg-blue-100 text-blue-700 h-5 px-2 border-none">
                      EMERGÊNCIA
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <div className="min-w-[600px] grid grid-cols-6 gap-2">
                  <div className="h-16 bg-slate-50 rounded-xl flex items-center justify-center text-[8px] font-black uppercase text-slate-400 border border-dashed">
                    Sev ↓ \ Freq →
                  </div>
                  {[1, 2, 3, 4, 5].map((f) => (
                    <div
                      key={f}
                      className="h-16 bg-slate-50 rounded-xl flex items-center justify-center text-xs font-black text-primary"
                    >
                      F{f}
                    </div>
                  ))}
                  {[5, 4, 3, 2, 1].map((s) => (
                    <React.Fragment key={s}>
                      <div className="h-16 bg-slate-50 rounded-xl flex items-center justify-center text-xs font-black text-primary">
                        S{s}
                      </div>
                      {[1, 2, 3, 4, 5].map((f) => {
                        const score = s * f;
                        return (
                          <div
                            key={`${s}-${f}`}
                            className={cn(
                              "h-16 rounded-xl flex items-center justify-center text-xs font-black transition-all hover:scale-105 cursor-pointer relative",
                              score >= 15
                                ? "bg-red-500 text-white"
                                : score >= 10
                                  ? "bg-orange-400 text-white"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            )}
                          >
                            {score}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="card-shadow border-none bg-white rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                  <Box className="size-6" />
                </div>
                <h4 className="font-black text-primary uppercase text-sm">
                  Resíduos Perigosos (CLASSE I)
                </h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">Estoque Atual</span>
                  <span className="text-red-600">850kg</span>
                </div>
                <Progress value={85} className="h-1.5 bg-slate-100" />
                <p className="text-[10px] text-slate-500 italic">
                  "Gatilho de coleta em 900kg via MTR digital."
                </p>
              </div>
              <Button className="w-full bg-primary h-11 text-[9px] font-black uppercase rounded-xl">
                Solicitar Coleta (MTR)
              </Button>
            </Card>

            <Card className="card-shadow border-none bg-white rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <RefreshCw className="size-6" />
                </div>
                <h4 className="font-black text-primary uppercase text-sm">
                  Recicláveis (CLASSE II-A)
                </h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">Taxa de Desvio</span>
                  <span className="text-blue-600">92%</span>
                </div>
                <Progress value={92} className="h-1.5 bg-slate-100" />
                <p className="text-[10px] text-slate-500 italic">
                  "Meta Lixo Zero: Desviar 100% de aterro."
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full border-blue-200 text-blue-600 h-11 text-[9px] font-black uppercase rounded-xl"
              >
                Ver Romaneio Mensal
              </Button>
            </Card>

            <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2rem] p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <Leaf className="size-32 text-emerald-400" />
              </div>
              <div className="relative z-10 space-y-4">
                <Badge className="bg-emerald-500 text-primary border-none font-black uppercase text-[8px]">
                  Destaque Ambiental
                </Badge>
                <h4 className="text-lg font-black uppercase tracking-tight">Economia Circular</h4>
                <p className="text-xs text-white/60 leading-relaxed italic">
                  "A reutilização de sobras de madeira para pallets internos reduziu o custo de
                  descarte em 14% este mês."
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="controls" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <ControlCard
              aspect="Geração de Óleo Usado"
              impact="Contaminação de Solo"
              control="Bacia de Contenção e Descarte via PGRS"
              icon={Waves}
              color="text-blue-600"
            />
            <ControlCard
              aspect="Emissões Atmosféricas"
              impact="Mudança Climática"
              control="Manutenção Preventiva de Motores e Filtros"
              icon={Flame}
              color="text-orange-600"
            />
            <ControlCard
              aspect="Lavagem de Pátios"
              impact="Esgotamento Hídrico"
              control="Sistema de Reúso de Água de Chuva"
              icon={CloudRain}
              color="text-emerald-600"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl group hover:ring-2 ring-primary/5 transition-all">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl", bg, color)}>
            <Icon className="size-5" />
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-300">
            ISO 14001
          </Badge>
        </div>
        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
          {label}
        </p>
        <h3 className={cn("text-2xl font-black leading-none", color)}>{value}</h3>
      </CardContent>
    </Card>
  );
}

function ControlCard({ aspect, impact, control, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-[2rem] p-6 hover:shadow-xl transition-all group">
      <div className="flex gap-4 items-start mb-4">
        <div
          className={cn(
            "p-3 rounded-2xl bg-slate-50 group-hover:bg-primary group-hover:text-white transition-all",
            color
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            {aspect}
          </p>
          <h4 className="text-xs font-bold text-primary uppercase leading-tight">{impact}</h4>
        </div>
      </div>
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
          Controle Operacional:
        </p>
        <p className="text-[11px] font-medium text-primary/80 italic leading-relaxed">
          "{control}"
        </p>
      </div>
    </Card>
  );
}
