"use client";

import * as React from "react";
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Users,
  HardHat,
  ShieldAlert,
  ClipboardCheck,
  Zap,
  Monitor,
  Brain,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileWarning,
  Flame,
  ZapOff,
  MoveUp,
  Stethoscope,
  Construction,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SIMULATOR_DATA = [
  {
    phase: "Fase 1: Baixa Complexidade (Canteiro)",
    lives: "200 vidas",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    cipa: "14 Membros",
    sesmt: "2 Técnicos de Seg.",
    status: "Risco Baixo",
    statusCor: "text-emerald-600",
    subStatus: "S-2240 Estável",
    nrs: [
      {
        nr: "NR-18 (A Bíblia da Construção)",
        items: [
          "PGR específico do canteiro emitido e atualizado?",
          "Áreas de vivência limpas e higienizadas?",
          "Proteções coletivas instaladas?",
          "Sinalização de segurança visível?",
        ],
        solution:
          "Checklist digital via App Nextcon com coleta de evidências fotográficas e geolocalização.",
      },
      {
        nr: "NR-35 (Trabalho em Altura)",
        items: [
          "Análise de Risco (APR) preenchida e assinada?",
          "Cinto de segurança paraquedista inspecionado?",
          "Linha de vida instalada e certificada?",
          "Treinamento de 8h realizado?",
        ],
        solution:
          "Bloqueio inteligente: O sistema impede o check-in do colaborador se o treinamento estiver vencido.",
      },
    ],
  },
  {
    phase: "Fase 2: Média Complexidade (EXPANSÃO)",
    lives: "500 vidas",
    color: "text-amber-600",
    bg: "bg-amber-50",
    cipa: "18 Membros (Eleição Digital)",
    sesmt: "Engenheiro e Médico + TSTs",
    status: "Risco Médio",
    statusCor: "text-amber-600",
    subStatus: "Cruzamento eSocial Ativo",
    nrs: [
      {
        nr: "NR-01 (GRO / PGR)",
        items: [
          "Inventário de riscos cruzado com o eSocial?",
          "Plano de ação possui prazos e responsáveis?",
          "Identificação de perigos inclui fatores psicossociais?",
        ],
        solution: "Dashboard de Gestão de Riscos: Visualização em tempo real das ações pendentes.",
      },
      {
        nr: "NR-06 (Controle de EPIs)",
        items: [
          "Fichas de EPI assinadas digitalmente?",
          "Controle de validade do CA (Certificado de Aprovação)?",
          "Reposição periódica baseada na vida útil?",
        ],
        solution:
          "Quiosque Digital EPI: Assinatura biométrica/foto na entrega, gerando validade jurídica total.",
      },
    ],
  },
  {
    phase: "Fase 3: Alta Complexidade (Plena)",
    lives: "800+ vidas",
    color: "text-red-600",
    bg: "bg-red-50",
    cipa: "22 Membros (Gestão Atas)",
    sesmt: "Ambulatório e Enfermagem",
    status: "Risco Crítico",
    statusCor: "text-red-600",
    subStatus: "Responsabilidade Solidária",
    nrs: [
      {
        nr: "Gestão de Terceiros (O Maior Passivo)",
        items: [
          "Empreiteiras enviaram PGR e PCMSO compatíveis?",
          "Terceirizados possuem ASO e treinamentos em dia?",
          "Controle de acesso bloqueia terceiros irregulares?",
        ],
        solution:
          "Portal do Terceiro Nextcon: A subcontratada sobe os documentos e o sistema valida a entrada.",
      },
    ],
  },
];

const FIXED_PAYROLL = 30000000;
const FAP_OPTIONS = [1.0, 1.1, 1.2];

export default function ScaleSimulator() {
  const [scaleSlider, setScaleSlider] = React.useState([0]);
  const [fapIndex, setFapIndex] = React.useState([2]);

  const currentData = SIMULATOR_DATA[scaleSlider[0]];
  const currentFap = FAP_OPTIONS[fapIndex[0]];

  const ratBase = 0.03;
  const annualRatCost = FIXED_PAYROLL * ratBase * currentFap;
  const bestCaseCost = FIXED_PAYROLL * ratBase * 1.0;
  const potentialSaving = annualRatCost - bestCaseCost;

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Simulador de Impacto Financeiro SST
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
            <Building2 className="size-3" /> Análise de Performance Tributária por Unidade
          </p>
        </div>
        <Badge className="bg-[#090e24] text-[#f59e0b] font-black uppercase text-[10px] tracking-widest h-10 px-4 border border-[#f59e0b]/20 shadow-lg">
          FAP REFERÊNCIA: 1,2137
        </Badge>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-primary text-white p-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <DollarSign className="size-6 text-accent" />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">
                  Impacto Tributário (RAT/FAP)
                </CardTitle>
                <CardDescription className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
                  Simulação baseada em folha anual estimada de R$ 30M.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 space-y-12">
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Fator FAP Alvo
                </label>
                <span
                  className={cn(
                    "text-2xl font-black font-headline px-4 py-1 rounded-xl shadow-inner",
                    currentFap === 1.0
                      ? "text-emerald-600 bg-emerald-50"
                      : currentFap === 1.1
                        ? "text-amber-600 bg-amber-50"
                        : "text-red-600 bg-red-50"
                  )}
                >
                  {currentFap.toFixed(1)}
                </span>
              </div>
              <div className="px-4">
                <Slider
                  value={fapIndex}
                  onValueChange={setFapIndex}
                  max={2}
                  step={1}
                  className="py-4"
                />
                <div className="flex justify-between mt-2 text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                  <span>1.0 (Meta)</span>
                  <span>1.1</span>
                  <span>1.2 (Referência)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow border-none bg-slate-900 text-white rounded-[2.5rem] flex flex-col overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp className="size-48" />
          </div>
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.3em]">
              Custo RAT Projetado
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 flex-1 flex flex-col justify-between space-y-8">
            <div>
              <h2 className="text-4xl font-black font-headline tracking-tighter">
                {annualRatCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </h2>
              <p className="text-[10px] font-bold text-white/40 uppercase mt-2">
                Base RAT 3% x FAP {currentFap.toFixed(1)}
              </p>
            </div>

            {potentialSaving > 0 && (
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-2 animate-in zoom-in-95">
                <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-2">
                  <TrendingDown className="size-3" /> Economia Potencial
                </p>
                <h3 className="text-2xl font-black text-emerald-400">
                  {potentialSaving.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </h3>
                <p className="text-[9px] text-white/40 leading-tight">
                  Saving anual com a implementação da Gestão Ativa NAI.
                </p>
              </div>
            )}

            <Button
              asChild
              className="w-full h-14 bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-2xl mt-auto"
            >
              <Link href="/comercial" className="gap-2">
                Solicitar Diagnóstico ROI <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-10">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="space-y-4">
            <div className="flex justify-between items-end px-4">
              {["200", "500", "800+"].map((label, i) => (
                <span
                  key={label}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    scaleSlider[0] === i ? "text-primary scale-110" : "text-slate-300"
                  )}
                >
                  {label} Vidas
                </span>
              ))}
            </div>
            <Slider
              value={scaleSlider}
              onValueChange={setScaleSlider}
              max={2}
              step={1}
              className="py-4"
            />
          </div>

          <div className="text-center">
            <h2
              className={cn(
                "text-2xl font-black uppercase tracking-tight font-headline transition-colors",
                currentData.color
              )}
            >
              {currentData.phase}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">
              {currentData.lives}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="card-shadow border-none bg-red-50/50 border-l-4 border-red-500 rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-2">
              <FileWarning className="size-3" /> Risco de Acidentalidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-red-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase">CAT Simuladas</span>
              <span className="text-xl font-black text-primary">0</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-red-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Afastamentos B91
              </span>
              <span className="text-xl font-black text-red-600 animate-pulse">1</span>
            </div>
            <div className="p-3 bg-red-600 text-white rounded-xl text-center">
              <p className="text-[8px] font-black uppercase opacity-70">FAP de Referência</p>
              <p className="text-lg font-black tracking-tighter">1,2137</p>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="CIPA (NR-05)"
            value={currentData.cipa}
            icon={Users}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <StatCard
            label="SESMT (NR-04)"
            value={currentData.sesmt}
            icon={HardHat}
            color="text-orange-600"
            bg="bg-orange-50"
          />
          <StatCard
            label="Status eSocial"
            value={currentData.status}
            sub={currentData.subStatus}
            icon={ShieldAlert}
            color={currentData.statusCor}
            bg={currentData.bg}
          />
        </div>
      </div>

      <div className="flex justify-center pt-10">
        <Button
          asChild
          size="lg"
          className="h-16 px-12 bg-primary text-white font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-2xl gap-3"
        >
          <Link href="/comercial" className="gap-2">
            Solicitar Proposta de Blindagem <ArrowRight className="size-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl", bg, color)}>
            <Icon className="size-5" />
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase">
            LIVE
          </Badge>
        </div>
        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
          {label}
        </p>
        <h3 className={cn("text-xl font-black leading-none", color)}>{value}</h3>
        {sub && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{sub}</p>}
      </CardContent>
    </Card>
  );
}
