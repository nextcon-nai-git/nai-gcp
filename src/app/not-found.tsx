"use client";

import Link from "next/link";
import { Compass, Home, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#001F3F] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="size-20 bg-accent/10 border border-accent/20 rounded-3xl flex items-center justify-center text-accent mb-6 shadow-2xl animate-pulse">
        <ShieldAlert size={40} />
      </div>

      <span className="text-[10px] font-black tracking-[0.4em] uppercase text-accent mb-2">
        ERRO 404 — PÁGINA NÃO LOCALIZADA
      </span>

      <h1 className="text-3xl md:text-5xl font-black font-headline uppercase tracking-tight mb-4 max-w-xl">
        Recurso ou Rota Indisponível
      </h1>

      <p className="text-slate-300 text-sm max-w-md mb-8 leading-relaxed">
        O recurso solicitado no portal NAI Nextcon Saúde não foi localizado ou foi movido para uma
        nova rota de segurança.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          asChild
          className="gradient-nextcon text-white h-12 px-8 rounded-2xl font-black uppercase text-xs tracking-widest gap-2 shadow-xl"
        >
          <Link href="/">
            <Home size={16} /> Voltar ao Painel Geral
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          className="border-white/10 hover:bg-white/10 text-white h-12 px-8 rounded-2xl font-black uppercase text-xs tracking-widest gap-2"
        >
          <Link href="/providers/map">
            <Compass size={16} /> Mapa da Rede
          </Link>
        </Button>
      </div>
    </div>
  );
}
