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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
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

const sicknessData = [
  { name: "Coluna (M54)", value: 45, color: "#003366" },
  { name: "Ombro (M75)", value: 30, color: "#0055A4" },
  { name: "Estresse (F33)", value: 15, color: "#00f2ff" },
  { name: "Outros", value: 10, color: "#94a3b8" },
];

export default function AnalyticsDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tight font-headline">
            Business Intelligence SST
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Brain className="size-4 text-accent" /> Análise de performance tributária e
            epidemiológica em tempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-accent/10 text-accent border-accent/20 px-4 h-10 flex items-center gap-2 font-black uppercase text-[10px]">
            <ShieldCheck className="size-4" /> 100% Conforme eSocial
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Economia RAT/FAP Est."
          value="R$ 142.500"
          sub="Projeção Anual"
          icon={DollarSign}
          trend="down"
          color="text-accent"
        />
        <StatCard
          label="Índice de Absenteísmo"
          value="2.4%"
          sub="Meta: < 1.5%"
          icon={Activity}
          trend="up"
          color="text-amber-600"
        />
        <StatCard
          label="Vidas sob Gestão"
          value="1.402"
          sub="Ativos na Plataforma"
          icon={ShieldCheck}
          trend="up"
          color="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-panel border-none p-6">
          <CardHeader className="px-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingDown className="size-5 text-accent" /> Curva de Redução FAP
            </CardTitle>
            <CardDescription>
              Comparativo entre FAP real vs. FAP projetado com ações preventivas NAI.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 px-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fapData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="atual" fill="#003366" radius={[4, 4, 0, 0]} name="FAP Atual" />
                <Bar dataKey="projetado" fill="#00f2ff" radius={[4, 4, 0, 0]} name="FAP Alvo" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-panel border-none p-6">
          <CardHeader className="px-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="size-5 text-primary" /> Top Causas de Afastamento
            </CardTitle>
            <CardDescription>Distribuição de CIDs críticos que impactam o FAP.</CardDescription>
          </CardHeader>
          <CardContent className="h-80 px-0 flex flex-col md:flex-row items-center">
            <div className="flex-1 h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sicknessData}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sicknessData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-48 space-y-3">
              {sicknessData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-[10px] font-bold uppercase"
                >
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-500">{item.name}</span>
                  </div>
                  <span className="text-primary">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, trend, color }: any) {
  return (
    <Card className="glass-panel border-none p-6 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
            {label}
          </p>
          <h3 className="text-3xl font-black text-primary font-headline tracking-tighter">
            {value}
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
        </div>
        <div
          className={cn(
            "p-4 rounded-2xl bg-slate-50 group-hover:scale-110 transition-transform",
            color
          )}
        >
          <Icon className="size-6" />
        </div>
      </div>
    </Card>
  );
}
