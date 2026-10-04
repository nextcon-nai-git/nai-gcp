"use client";

import * as React from "react";
import { Brain, FileSearch, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Header() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
          Inventário de Riscos
        </h1>
        <p className="text-muted-foreground font-medium flex items-center gap-2">
          <Brain className="size-4 text-accent" /> Gestão de Conformidade Técnica e Ambiental.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          asChild
          className="gap-2 border-primary text-primary h-11 font-black uppercase text-[10px] tracking-widest"
          aria-label="Analisar PGR legado via IA"
        >
          <Link href="/risk-management/pgr-analysis">
            <FileSearch className="size-4" /> Analisar PGR Legado
          </Link>
        </Button>
        <Button
          className="gradient-nextcon text-white gap-2 h-11 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg"
          aria-label="Adicionar novo risco ao inventário"
        >
          <Activity className="size-4" /> Novo Risco
        </Button>
      </div>
    </div>
  );
}
