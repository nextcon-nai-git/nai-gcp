"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Risk, getCategoryConfig } from "../risk-data";
import { cn } from "@/lib/utils";

interface RiskTableProps {
  risks: Risk[];
}

export function RiskTable({ risks }: RiskTableProps) {
  return (
    <div className="border rounded-[2rem] overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black">
          <TableRow>
            <TableHead className="pl-8">Perigo / Agente</TableHead>
            <TableHead>Setor / GHE</TableHead>
            <TableHead>Intensidade</TableHead>
            <TableHead className="pr-8 text-right">Controle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((risk) => {
            const config = getCategoryConfig(risk.category);
            const CategoryIcon = config.icon;

            return (
              <TableRow key={risk.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="pl-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", config.bg, config.text)}>
                      <span className="text-sm">{config.icon}</span>
                    </div>
                    <div>
                      <p className="font-black text-xs text-primary uppercase">{risk.hazard}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px] font-black uppercase border-none px-2 h-4 mt-1",
                          config.bg,
                          config.color
                        )}
                      >
                        {risk.category}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-xs font-bold text-slate-500 uppercase">{risk.ghe}</p>
                </TableCell>
                <TableCell>
                  <p className="text-xs font-black text-primary">{risk.intensity}</p>
                </TableCell>
                <TableCell className="pr-8 text-right">
                  <p className="text-[10px] font-bold text-slate-400 italic">"{risk.control}"</p>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
