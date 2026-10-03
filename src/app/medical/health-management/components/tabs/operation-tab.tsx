"use client";

import * as React from "react";
import { Clock, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function OperationTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="card-shadow border-none bg-white rounded-[2rem] p-8 flex gap-6 items-start">
        <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 shadow-inner">
          <Clock className="size-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-primary uppercase">
            Regime Operacional da Unidade
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed font-medium">
            Segunda a Sexta: 07h às 19h (12x36h).
            <br />
            Sábado: 07h às 13h (Checklist Geral).
          </p>
          <Badge
            variant="outline"
            className="border-emerald-100 text-emerald-700 bg-emerald-50 text-[8px] font-black uppercase mt-2"
          >
            Operação Ativa
          </Badge>
        </div>
      </Card>
      <Card className="card-shadow border-none bg-white rounded-[2rem] p-8 flex gap-6 items-start">
        <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
          <ClipboardList className="size-8" />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-black text-primary uppercase">Fechamento de Insumos</h4>
          <p className="text-xs text-primary/70 leading-relaxed font-medium italic">
            "O técnico do sábado é responsável pela reposição de DEA e Oxigênio para a
            segunda-feira."
          </p>
        </div>
      </Card>
    </div>
  );
}
