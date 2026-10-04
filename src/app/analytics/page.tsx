"use client";

import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  ShieldCheck,
  Brain,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Zap,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { cn } from "@/lib/utils";

const fapData = [
  { name: "Jan", atual: 1.4, projetado: 0.8 },
  { name: "Fev", atual: 1.3, projetado: 0.75 },
  { name: "Mar", atual: 1.25, projetado: 0.7 },
  { name: "Abr", atual: 1.2, projetado: 0.65 },
  { name: "Mai", atual: 1.1, projetado: 0.6 },
  { name: "Jun", atual: 1.0, projetado: 0.5 },
];

const mockTrend = [{ v: 10 }, { v: 25 }, { v: 15 }, { v: 35 }, { v: 30 }, { v: 45 }];

const sicknessData = [
  { name: "Coluna (M54)", value: 45, color: "#003366" },
  { name: "Ombro (M75)", value: 30, color: "#0055A4" },
  { name: "Estresse (F33)", value: 15, color: "#00f2ff" },
  { name: "Outros", value: 10, color: "#94a3b8" },
];

export default function AnalyticsDashboard() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary uppercase tracking-tight font-headline">
            Business Intelligence 4.0
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 uppercase text-[10px] font-bold tracking-widest">
            <Brain className="size-4 text-accent" /> Análise Preditiva de Acidentes e Performance
            Epidemiológica.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-accent text-primary border-none px-5 h-11 flex items-center gap-2 font-black uppercase text-[10px] shadow-xl">
            <ShieldCheck className="size-4" /> ENGINE PREDITIVO ATIVO
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Economia RAT/FAP Est."
          value="R$ 142.500"
          icon={DollarSign}
          trend="down"
          color="text-emerald-600"
          bg="bg-emerald-50"
          data={mockTrend}
        />
        <StatCard
          label="Índice Absenteísmo"
          value="2.4%"
          icon={Activity}
          trend="up"
          color="text-amber-600"
          bg="bg-amber-50"
          data={[...mockTrend].reverse()}
        />
        <StatCard
          label="Vidas sob Gestão"
          value="1.402"
          icon={ShieldCheck}
          trend="up"
          color="text-blue-600"
          bg="bg-blue-50"
          data={mockTrend}
        />
        <StatCard
          label="Score Risco Preditivo"
          value="14%"
          icon={Zap}
          trend="down"
          color="text-primary"
          bg="bg-slate-100"
          data={mockTrend}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* PAINEL PREDITIVO DE ACIDENTES */}
        <Card className="lg:col-span-1 card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] overflow-hidden flex flex-col p-8 relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 group-hover:scale-110 transition-transform">
            <AlertTriangle size={200} />
          </div>
          <CardHeader className="p-0 mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent rounded-xl text-primary shadow-lg">
                <Gauge className="size-5" />
              </div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-accent">
                Score de Risco Diário
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-8 relative z-10 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-black uppercase text-white/40">
                  Probabilidade de Incidente Hoje
                </p>
                <span className="text-3xl font-black text-emerald-400">12% (BAIXO)</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "12%" }} />
              </div>
            </div>

            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
              <p className="text-[9px] font-black text-accent uppercase mb-2">
                Análise NAI Neural:
              </p>
              <p className="text-xs italic text-slate-300 leading-relaxed font-medium">
                "A Linha B apresenta 85% de chance de incidente ergonômico devido ao cansaço
                acumulado por horas extras e calor acima da média histórica hoje."
              </p>
            </div>

            <Button className="w-full h-12 bg-accent text-primary font-black uppercase text-[10px] rounded-xl shadow-xl gap-2 mt-4">
              <ShieldAlert className="size-4" /> Detalhar Zonas de Perigo
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden p-2">
          <CardHeader className="p-8 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-3">
                  <TrendingDown className="size-6 text-accent" /> Curva de Redução FAP
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                  Impacto na folha via Prevenção Ativa.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 border-emerald-100 text-emerald-700 text-[8px] font-black h-5 uppercase"
              >
                Target: 0.50
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="h-80 p-8 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fapData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 900, fill: "#64748b" }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip
                  cursor={{ fill: "rgba(0,31,63,0.03)" }}
                  contentStyle={{
                    borderRadius: "24px",
                    border: "none",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
                    background: "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(10px)",
                  }}
                />
                <Bar dataKey="atual" fill="#001F3F" radius={[6, 6, 0, 0]} name="FAP Real" />
                <Bar dataKey="projetado" fill="#00f2ff" radius={[6, 6, 0, 0]} name="FAP Alvo" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden p-2 text-left">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-3">
              <AlertCircle className="size-6 text-red-600" /> Etiologia de Afastamento
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
              Cruzamento: Risco Ambiental vs CID Previdenciário.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 p-8 pt-0 flex flex-col md:flex-row items-center">
            <div className="flex-1 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sicknessData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {sicknessData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "20px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-56 space-y-4 p-4">
              {sicknessData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between group cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-3 rounded-full shadow-sm group-hover:scale-125 transition-transform"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-xs font-black text-primary tabular-nums">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[3rem] p-10 relative overflow-hidden group text-left">
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-1000">
            <Zap className="size-48 text-accent" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 h-full">
            <div className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-accent text-primary rounded-2xl shadow-xl shadow-accent/20">
                  <Brain className="size-8" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight font-headline">
                  Parecer Neural v2.7
                </h3>
              </div>
              <p className="text-lg italic text-slate-300 leading-relaxed font-medium">
                "A correlação entre o calor extremo de Joinville e os registros de fadiga via
                Wearables na Britânia Fábrica 01 sugere uma janela crítica entre 14h e 16h. Reduza a
                carga horária em 15% neste período para evitar afastamentos B91."
              </p>
            </div>
            <Button className="h-16 px-10 bg-accent text-primary font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all shrink-0">
              Exportar BI Executivo <ArrowUpRight className="size-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, color, bg, data }: any) {
  return (
    <Card className="card-shadow border-none bg-white rounded-[2rem] group hover:ring-2 ring-primary/5 transition-all overflow-hidden relative text-left">
      <div className="absolute inset-0 opacity-10 pointer-events-none -bottom-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <Area
              type="monotone"
              dataKey="v"
              stroke="#001F3F"
              fill="#001F3F"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div
            className={cn("p-3 rounded-xl group-hover:scale-110 transition-transform", bg, color)}
          >
            <Icon className="size-5" />
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[8px] font-black uppercase border-none px-2 h-5 flex items-center gap-1",
              trend === "down" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}
          >
            <TrendingDown className="size-2.5" /> LIVE
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">{label}</p>
          <h3
            className={cn("text-2xl font-black font-headline tracking-tighter tabular-nums", color)}
          >
            {value}
          </h3>
        </div>
      </CardContent>
    </Card>
  );
}
