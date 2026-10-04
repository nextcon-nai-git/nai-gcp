"use client";

import * as React from "react";
import { ArrowLeft, ShieldCheck, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * @fileOverview Infográfico Integrado GHE -> PGR -> PCMSO
 * Documento estratégico para a unidade Edifício Mônaco (Nativa Empreendimentos).
 */
export default function NativaInfographicPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-10 font-sans antialiased selection:bg-cyan-500 selection:text-slate-900 rounded-[3rem] -m-10">
      {/* BOTÃO DE VOLTAR E IMPRESSÃO */}
      <div className="max-w-6xl mx-auto mb-8 flex justify-between items-center print:hidden">
        <Button asChild variant="ghost" className="text-slate-400 hover:text-white gap-2">
          <Link href="/reports">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
        <Button
          onClick={() => window.print()}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase text-[10px] tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          💾 Baixar / Salvar em PDF
        </Button>
      </div>

      {/* CONTAINER DO INFOGRÁFICO */}
      <div className="max-w-6xl mx-auto bg-slate-900/40 border border-slate-800/80 rounded-[3rem] p-8 md:p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden text-left">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* HEADER */}
        <header className="border-b border-slate-800 pb-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-4">
            <span className="text-cyan-400 font-mono text-[10px] font-black tracking-[0.3em] uppercase border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 rounded-lg">
              NAI Intelligence 2026
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent uppercase font-headline">
              Infográfico Integrado: GHE ➔ PGR ➔ PCMSO
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              Planejamento Estratégico Ocupacional — Edifício Mônaco (Nativa Empreendimentos Ltda)
            </p>
          </div>
          <div className="text-right font-mono text-[10px] text-slate-500 leading-relaxed uppercase">
            Doc Ref: <span className="text-slate-200">PGR-OBRA-MONACO</span>
            <br />
            Responsável: <span className="text-cyan-400">Felipe C. D. Bianca (Eng. SST)</span>
          </div>
        </header>

        {/* INFOGRAPHIC GRID */}
        <div className="space-y-6 relative z-10">
          {/* CARD GHE 1 & 2 */}
          <InfographicCard
            ghe="GHE 01 & 02"
            roles="Servente 1 & Servente 2"
            desc="Limpeza, organização e transporte de cargas gerais."
            riskLevel="RISCO BAIXO (C:2)"
            riskColor="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            riskDetail="Foco em ruído intermitente e postura ergonômica."
            protocol="Clínico Ocupacional, Audiometria Tonal, Hemograma Completo"
          />

          {/* CARD GHE 3 & 4 */}
          <InfographicCard
            ghe="GHE 03 & 04"
            roles="Meio Oficial 1 & Meio Oficial 2"
            desc="Preparo de massas, cortes guiados e apoio sob supervisão técnico-operacional."
            riskLevel="MODERADO (C:4)"
            riskColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
            riskDetail="Poeiras minerais/vegetais e riscos de queda em altura (NR-35)."
            protocol="Clínico, Audiometria, Espirometria, Bateria NR-35 (ECG, EEG, Glicemia, Visão)"
          />

          {/* CARD GHE 5 a 8 */}
          <InfographicCard
            ghe="GHE 05, 06, 07 & 08"
            roles="Profissionais, Oficiais Sênior & Master"
            desc="Pedreiros, carpinteiros e eletricistas executando atividades em lajes abertas."
            riskLevel="RISCO ALTO (C:6)"
            riskColor="text-orange-400 bg-orange-500/10 border-orange-500/20"
            riskDetail="Ruído de impacto (até 117.2dB), vibrações mecânicas e quedas."
            protocol="Clínico, Audiometria, Espirometria, Exame Clínico Dermatológico, Bateria NR-35 Completa"
          />

          {/* CARD GHE 9 & 10 */}
          <InfographicCard
            ghe="GHE 09 & 10"
            roles="Armador & Armador Encarregado"
            desc="Corte, dobra, montagem e amarração manual de armações estruturais de aço."
            riskLevel="RISCO ALTO (C:6)"
            riskColor="text-orange-400 bg-orange-500/10 border-orange-500/20"
            riskDetail="Perfurações por vergalhões expostos e esforços repetitivos (LER/DORT)."
            protocol="Clínico Ocupacional, Audiometria Tonal, Bateria NR-35 de Altura"
          />

          {/* CARD GHE 11 a 13 */}
          <InfographicCard
            ghe="GHE 11, 12 & 13"
            roles="Contra Mestre, Mestre de Obras & Geral"
            desc="Coordenação de cronograma de obras, segurança operacional e frentes independentes."
            riskLevel="MODERADO (C:4)"
            riskColor="text-amber-400 bg-amber-500/10 border-amber-500/20"
            riskDetail="Sobrecarga mental, estresse de prazos e tráfego em áreas instáveis."
            protocol="Clínico, Triagem de Pressão Arterial, Avaliação Psicossocial Ocupacional (NR-17)"
          />
        </div>

        {/* FOOTER TÉCNICO */}
        <footer className="mt-12 pt-6 border-t border-slate-800/60 text-[10px] font-mono text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-bold">
            © 2026 Nextcon Saúde Empresarial • Inteligência Aplicada à Proteção de Vidas
          </div>
          <div className="text-cyan-500/70 font-black uppercase tracking-widest bg-cyan-500/5 px-3 py-1 rounded-full border border-cyan-500/10">
            Homologado eSocial (S-2220 / S-2240)
          </div>
        </footer>
      </div>
    </div>
  );
}

function InfographicCard({ ghe, roles, desc, riskLevel, riskColor, riskDetail, protocol }: any) {
  return (
    <div className="bg-slate-950/60 border border-slate-800/60 rounded-[2rem] p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 transition-all duration-300 hover:border-slate-700/60 hover:shadow-2xl hover:scale-[1.01] group">
      <div className="space-y-2 lg:w-1/3">
        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
          {ghe}
        </span>
        <h3 className="text-lg font-black text-slate-200 uppercase tracking-tight">{roles}</h3>
        <p className="text-xs text-slate-400 leading-relaxed font-medium italic">
          &quot;{desc}&quot;
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:w-1/3">
        <div
          className={cn(
            "px-4 py-1.5 rounded-full border font-mono text-[10px] font-black uppercase tracking-widest w-fit shadow-inner",
            riskColor
          )}
        >
          {riskLevel}
        </div>
        <p className="text-[11px] text-slate-400 font-medium leading-tight">
          <ShieldCheck className="size-3 inline-block mr-1 text-cyan-400" />
          {riskDetail}
        </p>
      </div>

      <div className="bg-slate-900/80 border border-slate-800/80 p-5 rounded-2xl lg:w-1/3 w-full shadow-inner group-hover:bg-slate-900 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <HeartPulse className="size-3 text-cyan-400" />
          <span className="text-[10px] font-black font-mono text-cyan-400 uppercase tracking-widest">
            Protocolo PCMSO
          </span>
        </div>
        <span className="text-xs font-bold text-slate-300 leading-relaxed uppercase tracking-tight">
          {protocol}
        </span>
      </div>
    </div>
  );
}
