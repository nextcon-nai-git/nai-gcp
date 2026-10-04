"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SEVERITY = ["Insignificante", "Menor", "Moderada", "Maior", "Catastrófica"];
const PROBABILITY = ["Rara", "Improvável", "Possível", "Provável", "Quase Certa"];

export function RiskHeatmap() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
          Matriz de Risco NR-01 (PxS)
        </h4>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-sm bg-emerald-500" />
            <span className="text-[8px] font-black uppercase">Baixo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-sm bg-red-500" />
            <span className="text-[8px] font-black uppercase">Crítico</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1">
        <div className="h-10" />
        {SEVERITY.map((s) => (
          <div
            key={s}
            className="h-10 flex items-center justify-center text-[8px] font-black uppercase text-slate-400 text-center leading-tight"
          >
            {s}
          </div>
        ))}

        {PROBABILITY.slice()
          .reverse()
          .map((p, pIdx) => (
            <React.Fragment key={p}>
              <div className="h-10 flex items-center pr-2 text-[8px] font-black uppercase text-slate-400 text-right leading-tight">
                {p}
              </div>
              {[1, 2, 3, 4, 5].map((sVal) => {
                const pVal = 5 - pIdx;
                const score = pVal * sVal;
                return (
                  <div
                    key={sVal}
                    className={cn(
                      "h-10 rounded-md flex items-center justify-center text-[10px] font-bold text-white transition-all hover:scale-110 cursor-pointer shadow-sm",
                      score >= 15
                        ? "bg-red-600"
                        : score >= 10
                          ? "bg-orange-500"
                          : score >= 6
                            ? "bg-amber-400"
                            : "bg-emerald-500"
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
  );
}
