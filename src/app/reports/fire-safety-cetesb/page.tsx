"use client";

import * as React from "react";
import {
  ArrowLeft,
  Flame,
  ShieldCheck,
  Zap,
  FileText,
  Printer,
  Download,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Target,
  Thermometer,
  HardHat,
  ShieldAlert,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * @fileOverview Relatório de Auditoria Técnica de Incêndio e Pânico (IT-16/2025 CBPMESP)
 * Unidade: CETESB - Complexo Administrativo e Laboratorial
 */

export default function FireSafetyCetesbPage() {
  const data = {
    client: "Companhia Ambiental do Estado de São Paulo – CETESB",
    cnpj: "43.776.491/0001-70",
    enterprise: "Complexo Administrativo e Laboratorial (14 Edificações)",
    address: "Av. Prof. Frederico Hermann Junior, 345 – Alto de Pinheiros – SP",
    avcb: "708888",
    expiry: "2027-05-24",
    area: "32.329,75 m²",
    auditDate: "Agosto de 2026",
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 p-6 antialiased rounded-[3rem] -m-10">
      {/* CONTROLES (NO-PRINT) */}
      <div className="max-w-[1400px] mx-auto mb-6 flex justify-between items-center print:hidden">
        <Button
          asChild
          variant="ghost"
          className="text-slate-400 hover:text-white gap-2 transition-all"
        >
          <Link href="/reports">
            <ArrowLeft className="size-4" /> Voltar ao Hub
          </Link>
        </Button>
        <div className="flex gap-3">
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 font-black uppercase text-[8px] tracking-[0.2em] hidden md:flex items-center gap-2 h-10 px-4">
            <div className="size-1.5 bg-red-500 rounded-full animate-pulse" /> Protocolo IT-16/2025
            Ativo
          </Badge>
          <Button
            onClick={() => window.print()}
            className="bg-white text-primary hover:bg-slate-100 font-black uppercase text-[10px] tracking-widest px-6 h-11 rounded-xl shadow-xl active:scale-95 transition-all gap-2"
          >
            <Printer className="size-4" /> Exportar Parecer Técnico
          </Button>
        </div>
      </div>

      {/* PAINEL EXECUTIVO PAISAGEM */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/40 border border-slate-800/60 rounded-[3.5rem] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden flex flex-col min-h-[750px] text-left">
        {/* GLOW EFFECTS */}
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-red-500/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-orange-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

        {/* HEADER */}
        <header className="border-b border-white/5 pb-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
          <div className="space-y-4">
            <Badge className="bg-red-600 text-white border-none font-black uppercase text-[9px] tracking-[0.3em] px-3 h-6">
              Auditoria de Engenharia de Incêndio
            </Badge>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase font-headline">
              Parecer Técnico de Segurança <span className="text-red-500">IT-16</span>
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase">
                <Building2 className="size-4 text-red-500" /> {data.client}
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono uppercase">
                CNPJ: {data.cnpj}
              </div>
            </div>
          </div>
          <div className="text-right space-y-2">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">
              Status da Licença
            </p>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 h-8 rounded-full font-black text-[10px] uppercase">
              AVCB VIGENTE ATÉ 2027
            </Badge>
          </div>
        </header>

        {/* GRID OPERACIONAL */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 items-stretch my-auto relative z-10">
          {/* CARD 1: IDENTIFICAÇÃO DO COMPLEXO */}
          <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between transition-all hover:border-red-500/30 group">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">
                  01. Empreendimento
                </h2>
                <Target size={14} className="text-slate-600" />
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-500 block">
                    Complexo de Edificações
                  </span>
                  <span className="text-sm font-bold text-slate-200 uppercase leading-snug">
                    {data.enterprise}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase text-slate-500 block">
                    Área Construída Auditada
                  </span>
                  <span className="text-sm font-bold text-slate-200 font-mono tracking-tighter">
                    {data.area}
                  </span>
                </div>
                <div className="pt-4 flex items-start gap-2">
                  <MapPin className="size-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 font-medium italic">{data.address}</p>
                </div>
              </div>
            </div>
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-t border-white/5 pt-4">
              Ref: CBPMESP / SP
            </div>
          </div>

          {/* CARD 2: CONFORMIDADE DE EQUIPAMENTOS */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between transition-all hover:border-orange-500/30 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <ShieldCheck size={160} />
            </div>
            <div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-8">
                <h2 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">
                  02. Status dos Sistemas Fixos
                </h2>
                <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 h-5 font-black text-[8px]">
                  VISTORIA LIVE
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SystemCheckItem
                  label="Rede de Hidrantes"
                  status="Conforme"
                  icon={Waves}
                  color="text-blue-400"
                />
                <SystemCheckItem
                  label="Alarmes & Detecção"
                  status="Auditado"
                  icon={Zap}
                  color="text-yellow-400"
                />
                <SystemCheckItem
                  label="Iluminação Emergência"
                  status="Conforme"
                  icon={Thermometer}
                  color="text-orange-400"
                />
                <SystemCheckItem
                  label="Brigada de Incêndio"
                  status="Treinada"
                  icon={HardHat}
                  color="text-red-400"
                />
              </div>

              <div className="mt-8 p-6 bg-orange-500/5 border border-orange-500/10 rounded-3xl">
                <p className="text-[9px] font-black uppercase text-orange-400 mb-3 flex items-center gap-2">
                  <ShieldAlert size={12} /> Diagnóstico NAI Forensic:
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium italic">
                  "A unidade apresenta 100% de conformidade com a IT-16. O AVCB nº {data.avcb} está
                  plenamente assegurado. Recomenda-se apenas a substituição preventiva das
                  sinalizações fotoluminescentes no Bloco 4."
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-4">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                Sincronizado com eSocial S-2240
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[8px] font-black px-3 h-5">
                SAFE ZONE
              </Badge>
            </div>
          </div>

          {/* CARD 3: VIGÊNCIA E AGENDA */}
          <div className="lg:col-span-1 bg-[#090e24] border border-white/5 rounded-[2.5rem] p-8 flex flex-col justify-between transition-all hover:border-cyan-500/30 group">
            <div className="space-y-8">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">
                  03. Agenda Regulatória
                </h2>
                <Calendar size={14} className="text-cyan-400 animate-pulse" />
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-center">
                  <p className="text-[9px] font-black uppercase text-white/40 mb-2">
                    Vencimento AVCB
                  </p>
                  <h4 className="text-2xl font-black text-white font-headline tracking-tighter">
                    24 / MAI / 2027
                  </h4>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Próximo Simulado
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[8px] font-mono border-cyan-500/20 text-cyan-400"
                    >
                      OUT/2026
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Recarga Extintores
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[8px] font-mono border-slate-700 text-slate-500"
                    >
                      JAN/2027
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <Button className="w-full h-14 bg-cyan-500 text-slate-950 font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all gap-2">
              <Zap size={14} /> Abrir Plano de Ação
            </Button>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="mt-10 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <ShieldCheck className="size-6 text-emerald-500" />
            </div>
            <p className="text-[10px] font-mono text-slate-500 max-w-sm leading-relaxed uppercase">
              Este parecer foi elaborado pela{" "}
              <strong className="text-slate-300">Divisão de Perícias Nextcon</strong> em
              conformidade estrita com o Regulamento de Segurança contra Incêndio do Estado de São
              Paulo.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-1">
              Assinado Digitalmente
            </p>
            <p className="text-sm font-black text-white font-headline uppercase tracking-tight leading-none">
              Nextcon SST Forensic v3.2
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SystemCheckItem({ label, status, icon: Icon, color }: any) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-950/40 rounded-2xl border border-white/5 hover:bg-slate-950 transition-colors cursor-default">
      <div className={cn("p-2.5 rounded-xl bg-white/5 shadow-inner", color)}>
        <Icon size={18} />
      </div>
      <div className="text-left">
        <p className="text-[10px] font-black text-slate-300 uppercase leading-none mb-1.5">
          {label}
        </p>
        <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black h-4 px-2 uppercase">
          {status}
        </Badge>
      </div>
    </div>
  );
}

function Waves({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}
