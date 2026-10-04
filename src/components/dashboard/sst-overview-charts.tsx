"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const data = [
  { name: "Jan", acidentes: 4, exames: 45 },
  { name: "Fev", acidentes: 3, exames: 52 },
  { name: "Mar", acidentes: 5, exames: 38 },
  { name: "Abr", acidentes: 2, exames: 65 },
  { name: "Mai", acidentes: 1, exames: 48 },
  { name: "Jun", acidentes: 0, exames: 70 },
];

export function SstOverviewCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="p-6 border-b bg-slate-50/50">
          <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">
            Evolução de Acidentes (CAT)
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase">
            Meta: Zero Acidentes
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="acidentes"
                stroke="#EF4444"
                fillOpacity={1}
                fill="url(#colorAcc)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="p-6 border-b bg-slate-50/50">
          <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">
            Produtividade Ambulatorial (ASOs)
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase">
            Volume de exames realizados
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                }}
              />
              <Bar dataKey="exames" fill="#001F3F" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
