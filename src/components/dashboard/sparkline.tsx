"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

const GlassTooltip = ({ active, payload, isCurrency = false }: any) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const formattedValue = isCurrency
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : Math.floor(value).toLocaleString("pt-BR");

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.1)]">
      <p className="text-white font-bold text-xs">{formattedValue}</p>
    </div>
  );
};

export function Sparkline({
  data,
  color = "#10b981",
  dataKey = "value",
  isCurrency = false,
}: {
  data: { value: number }[];
  color?: string;
  dataKey?: string;
  isCurrency?: boolean;
}) {
  const id = `sparkline-${useId().replace(/:/g, "")}`;
  return (
    <div className="absolute inset-0 z-0 opacity-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={<GlassTooltip isCurrency={isCurrency} />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fillOpacity={1}
            fill={`url(#${id})`}
            strokeWidth={2}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
