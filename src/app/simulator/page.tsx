"use client";

import * as React from "react";
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ShieldCheck,
  Brain,
  Zap,
  LayoutGrid,
  Scale,
  Calculator,
  AlertTriangle,
  MoveUp,
  FileWarning,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

const FIXED_PAYROLL = 50000000; // 50M de Folha Anual para simulação de impacto
const FAP_OPTIONS = [0.5, 1.0, 1.5, 2.0];

export default function FapRatSimulator() {
  const [fapValue, setFapValue] = React.useState([1.2137]);
  const [ratValue, setRatValue] = React.useState([3]); // 1%, 2% ou 3%
  const [payrollAnual, setPayrollAnual] = React.useState(FIXED_PAYROLL);

  const currentFap = fapValue[0];
  const currentRat = ratValue[0] / 100;

  const annualCost = payrollAnual * currentRat * currentFap;
  const bestCaseCost = payrollAnual * currentRat * 0.5; // FAP Mínimo
  const potentialSaving = annualCost - bestCaseCost;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-2">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5 uppercase">
            C-LEVEL FINANCIAL ENGINEERING
          </Badge>
          <h1 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter leading-none">
            Simulador FAP & ROI
          </h1>
          <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] mt-2 flex items-center gap-2">
            <Calculator className="size-3 text-accent" /> Transformando SST em Geração de Caixa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 px-6 rounded-2xl border-primary text-primary font-black uppercase text-[10px] gap-2 shadow-sm btn-hover-effect"
          >
            <FileWarning className="size-4" /> Relatório FAP
          </Button>
          <Button
            asChild
            className="gradient-nextcon text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-2xl shadow-xl gap-2 btn-hover-effect"
          >
            <Link href="/comercial">
              <DollarSign className="size-4 text-accent" /> Solicitar Proposta ROI
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* CONFIGURAÇÃO DE CENÁRIO */}
        <div className="lg:col-span-7 space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-10">
              <CardTitle className="text-xl font-black text-primary uppercase font-headline">
                Configuração de Cenário
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Ajuste os parâmetros da sua folha e índices atuais.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-12">
              <div className="space-y-6">
                <div className="flex justify-between items-end mb-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                    Folha Salarial Anual (R$)
                  </label>
                  <span className="text-2xl font-black text-primary tabular-nums">
                    R$ {(payrollAnual / 1000000).toFixed(1)}M
                  </span>
                </div>
                <Slider
                  value={[payrollAnual]}
                  onValueChange={([v]) => setPayrollAnual(v)}
                  max={200000000}
                  step={1000000}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      Alíquota RAT (%)
                    </label>
                    <span className="text-xl font-black text-blue-600">{ratValue[0]}%</span>
                  </div>
                  <Slider value={ratValue} onValueChange={setRatValue} min={1} max={3} step={1} />
                  <p className="text-[9px] text-slate-400 italic">Grau de Risco 1, 2 ou 3.</p>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                      Fator FAP Atual
                    </label>
                    <span
                      className={cn(
                        "text-xl font-black px-4 py-1 rounded-xl shadow-inner",
                        currentFap <= 1
                          ? "text-emerald-600 bg-emerald-50"
                          : "text-red-600 bg-red-50"
                      )}
                    >
                      {currentFap.toFixed(4)}
                    </span>
                  </div>
                  <Slider
                    value={fapValue}
                    onValueChange={setFapValue}
                    min={0.5}
                    max={2.0}
                    step={0.0001}
                  />
                  <p className="text-[9px] text-slate-400 italic">Mín: 0.50 | Máx: 2.00</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-blue-50/50 rounded-[2.5rem] p-10 flex gap-8 items-start shadow-inner border border-blue-100">
            <div className="size-16 rounded-[1.5rem] bg-primary text-white flex items-center justify-center shrink-0 shadow-2xl">
              <Brain size={32} className="text-accent" />
            </div>
            <div className="space-y-3">
              <h4 className="text-lg font-black text-primary uppercase font-headline leading-none">
                Análise NAI Strategy
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                "Sua empresa está operando com um FAP de <strong>{currentFap.toFixed(2)}</strong>.
                Ao reduzir o índice para o bônus máximo (0.50) através da nossa gestão preventiva, o
                impacto financeiro positivo será equivalente a um aporte de capital de{" "}
                <strong>{(potentialSaving / 1000).toFixed(0)}k</strong> no EBITDA anual."
              </p>
            </div>
          </Card>
        </div>

        {/* RESULTADO ROI */}
        <div className="lg:col-span-5 space-y-8">
          <Card className="border-none bg-[#090e24] text-white rounded-[3.5rem] p-12 relative overflow-hidden shadow-2xl h-full flex flex-col justify-between group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <TrendingDown className="size-64 text-accent" />
            </div>

            <div className="relative z-10 space-y-10">
              <Badge className="bg-accent text-primary border-none font-black text-[9px] tracking-[0.4em] h-7 px-4 rounded-lg shadow-xl">
                SAVING ANUAL ESTIMADO
              </Badge>

              <div className="space-y-2">
                <h2 className="text-6xl font-black font-headline tracking-tighter text-emerald-400 leading-none tabular-nums">
                  R$ {(potentialSaving / 1000).toFixed(0)}k
                </h2>
                <p className="text-white/40 font-bold uppercase text-[11px] tracking-[0.2em]">
                  Otimização via Performance SST
                </p>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40 mb-3">
                    <span>Custo Atual (RAT x FAP)</span>
                    <span className="text-red-400">R$ {(annualCost / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: "100%" }} />
                  </div>
                </div>

                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/40 mb-3">
                    <span>Cenário NAI (Meta 0.50)</span>
                    <span className="text-emerald-400">R$ {(bestCaseCost / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(bestCaseCost / annualCost) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-10 border-t border-white/5 space-y-6">
              <div className="flex items-center gap-4 text-left">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <ShieldCheck size={24} className="text-emerald-400" />
                </div>
                <p className="text-[11px] text-white/60 font-medium leading-relaxed italic">
                  "Este valor representa o potencial de geração de caixa direta na sua folha de
                  pagamento."
                </p>
              </div>
              <Button className="w-full h-18 bg-accent text-primary font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
                Gerar Dossiê Financeiro (PDF)
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
