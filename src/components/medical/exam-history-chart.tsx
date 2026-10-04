"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EXAM_REFERENCES } from "@/lib/exams-reference";
import { Badge } from "@/components/ui/badge";

interface ExamHistoryChartProps {
  examCode: string;
  data: any[];
}

export function ExamHistoryChart({ examCode, data }: ExamHistoryChartProps) {
  const reference = EXAM_REFERENCES[examCode];

  if (!reference || !data.length) return null;

  const chartData = [...data]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d) => ({
      date: format(new Date(d.date), "dd/MM/yy", { locale: ptBR }),
      value: d.value,
      fullDate: d.date,
    }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">
          {reference.name} ({reference.unit})
        </h4>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[8px] border-slate-200 text-slate-400">
            Ref: {reference.min} - {reference.max}
          </Badge>
        </div>
      </div>

      <div className="h-64 w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100 shadow-inner">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }}
              domain={[
                (dataMin: number) => Math.min(dataMin, reference.min) * 0.8,
                (dataMax: number) => Math.max(dataMax, reference.max) * 1.2,
              ]}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                border: "none",
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
              }}
              labelStyle={{
                fontSize: "10px",
                fontWeight: 900,
                color: "#001F3F",
                marginBottom: "4px",
              }}
            />

            {/* Faixa de Referência (Mín/Máx) */}
            <ReferenceArea
              y1={reference.min}
              y2={reference.max}
              fill="#10b981"
              fillOpacity={0.05}
            />
            <ReferenceLine y={reference.min} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />
            <ReferenceLine y={reference.max} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />

            <Line
              type="monotone"
              dataKey="value"
              stroke="#001F3F"
              strokeWidth={3}
              dot={{ r: 4, fill: "#001F3F", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6, fill: "#00f2ff", strokeWidth: 0 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
