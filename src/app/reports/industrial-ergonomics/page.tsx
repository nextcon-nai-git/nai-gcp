"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BRITANIA_AEP_DATA } from "@/lib/real-data";

export default function IndustrialErgonomicsPage() {
  const data = BRITANIA_AEP_DATA;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 antialiased rounded-[3rem] -m-10">
      {/* CONTROLES PREMIUM (NO-PRINT) */}
      <div className="max-w-[1400px] mx-auto mb-4 flex justify-between items-center print:hidden">
        <Button asChild variant="ghost" className="text-slate-400 hover:text-white gap-2">
          <Link href="/reports">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
        <div className="flex gap-2">
          <span className="text-xs text-slate-500 font-mono hidden md:block self-center mr-4">
            Modo Panorama 16:9 - Live AEP
          </span>
          <Button
            onClick={() => window.print()}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-black uppercase text-[10px] tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95"
          >
            💾 Exportar Ficha Paisagem (PDF)
          </Button>
        </div>
      </div>

      {/* INFOGRÁFICO PAISAGEM PRINCIPAL */}
      <div className="max-w-[1400px] mx-auto bg-slate-900/30 border border-slate-800/80 rounded-[3rem] p-8 md:p-12 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[700px] text-left">
        {/* AURORA GLOW FX */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-gradient-to-tr from-cyan-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

        {/* HEADER DA APRESENTAÇÃO EXECUTIVA */}
        <header className="border-b border-slate-800/80 pb-6 mb-10 flex justify-between items-start relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-orange-500 animate-pulse" />
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent uppercase font-headline">
                NAI Studio{" "}
                <span className="text-orange-400 font-mono font-light text-sm tracking-widest border border-orange-500/20 bg-orange-500/5 px-3 py-1 rounded ml-2">
                  AEP 2026
                </span>
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Análise Ergonômica Preliminar — {data.setor}
            </p>
          </div>
          <div className="text-right font-mono text-[11px] bg-slate-950/60 border border-slate-800/60 p-4 rounded-2xl shadow-inner">
            <div className="uppercase">
              Unidade:{" "}
              <span className="text-slate-200 font-black">
                BRITÂNIA ELETRODOMÉSTICOS - JOINVILLE
              </span>
            </div>
            <div className="text-slate-500 mt-1 uppercase">
              Diretriz Transversal:{" "}
              <span className="text-orange-400 font-bold">{data.diretrizes.pausa}</span>
            </div>
          </div>
        </header>

        {/* GRID 3 COLUNAS HORIZONTAIS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch my-auto relative z-10">
          {/* COLUNA 1: ESTATÍSTICAS E RODÍZIO */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between transition-all hover:border-orange-500/30 group">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
                <h2 className="text-xs font-mono font-black text-orange-400 tracking-[0.2em] uppercase">
                  01. Estatísticas Setoriais
                </h2>
                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 h-5 font-black text-[8px]">
                  LIVE SYNC
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <span className="text-[8px] font-black uppercase text-slate-500 block mb-1">
                    Total Postos
                  </span>
                  <span className="text-xl font-black text-white">
                    {data.estatisticas.totalPostos}
                  </span>
                </div>
                <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <span className="text-[8px] font-black uppercase text-slate-500 block mb-1">
                    Linha Principal
                  </span>
                  <span className="text-xl font-black text-white">
                    {data.estatisticas.linhaPrincipal}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-orange-500/5 border border-orange-500/10 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-orange-400 mb-2">
                  Matriz de Rodízio NAI
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  &quot;Divisão simétrica em 4 grupos (20% a 40%) estruturada para o balanceamento
                  sistêmico de fadiga muscular.&quot;
                </p>
              </div>
            </div>
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-t border-slate-800 pt-4">
              Mapeamento Normativo: NR-17 / AEP
            </div>
          </div>

          {/* COLUNA 2: INVENTÁRIO DE POSTOS CRÍTICOS */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between transition-all hover:border-purple-500/30 group">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
                <h2 className="text-xs font-mono font-black text-purple-400 tracking-[0.2em] uppercase">
                  02. Achados Epidemiológicos
                </h2>
                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 h-5 font-black text-[8px]">
                  ALERTA ATIVO
                </Badge>
              </div>

              <div className="space-y-3">
                {data.postosCriticos.map((p) => (
                  <div
                    key={p.seq}
                    className="flex items-start gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-900"
                  >
                    <span className="text-purple-500 font-black text-xs">#{p.seq}</span>
                    <div className="text-[10px] leading-tight">
                      <strong className="text-slate-200 block uppercase mb-1">{p.atv}</strong>
                      <span className="text-slate-400 italic">&quot;{p.queixa}&quot;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest border-t border-slate-800 pt-4">
              Rastreabilidade via eSocial S-2240
            </div>
          </div>

          {/* COLUNA 3: PLANO DE AÇÃO E ENGENHARIA */}
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between transition-all hover:border-emerald-500/30 group">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
                <h2 className="text-xs font-mono font-black text-emerald-400 tracking-[0.2em] uppercase">
                  03. Prescrição Técnica
                </h2>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 h-5 font-black text-[8px]">
                  ENGENHARIA
                </Badge>
              </div>

              <ul className="space-y-4">
                <li className="flex items-start gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/40 group/item">
                  <span className="text-emerald-400 text-lg font-black group-hover/item:scale-125 transition-transform">
                    ✓
                  </span>
                  <div className="text-[11px] leading-relaxed">
                    <strong className="text-slate-100 block uppercase mb-1">
                      Mitigação de Esforço:
                    </strong>
                    Implementar balancins e plataformas ergonômicas que avancem 30cm abaixo da
                    bancada.
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/40 group/item">
                  <span className="text-emerald-400 text-lg font-black group-hover/item:scale-125 transition-transform">
                    ✓
                  </span>
                  <div className="text-[11px] leading-relaxed">
                    <strong className="text-slate-100 block uppercase mb-1">
                      Gestão de Pausas:
                    </strong>
                    {data.diretrizes.regra} a cada {data.diretrizes.pausa}.
                  </div>
                </li>
              </ul>
            </div>
            <div className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest border-t border-slate-800 pt-4">
              Foco: Prevenção LER/DORT v2.6
            </div>
          </div>
        </div>

        {/* FOOTER INTEGRADO */}
        <footer className="mt-10 pt-6 border-t border-slate-800/60 text-[10px] font-mono text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
          <div className="font-bold">
            © 2026 Nextcon Saúde Empresarial • Inteligência NAI Aplicada à Salvaguarda de Vidas
          </div>
          <div className="text-orange-500/80 font-black uppercase tracking-widest bg-orange-500/5 px-3 py-1 rounded-lg border border-orange-500/10">
            Protocolo COERGO: Sincronização Estrita com a Indústria 4.0
          </div>
        </footer>
      </div>
    </div>
  );
}
