"use client";

import * as React from "react";
import {
  ShieldCheck,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Zap,
  HardHat,
  Stethoscope,
  Bot,
  ShoppingCart,
  TrendingDown,
  Scale,
  FileText,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

const NAI_AVATAR_URL = "/images/nai_health_avatar.png";

const PITCH_DATA = {
  avatar: {
    nome: "NAI",
    titulo: "Consultora Comercial Estratégica",
    saudacao_inicial:
      "Olá! Sou a NAI, consultora especialista em gestão estratégica de SST da Nextcon. Como posso ajudar sua empresa hoje?",
  },
  pilares_venda: [
    {
      ordem: 1,
      icone: FileText,
      titulo: "Elaboração de Documentos (PGR, LTCAT, etc.)",
      resumo:
        "Elaboração e gestão completa de laudos técnicos, PGR, PCMSO, LTCAT e programas de segurança.",
      texto_completo:
        "Emitimos e mantemos atualizados todos os documentos obrigatórios de SST (PGR, PCMSO, LTCAT e laudos), garantindo conformidade total e integração automatizada aos eventos do eSocial.",
    },
    {
      ordem: 2,
      icone: Calendar,
      titulo: "Agendamento de Exames Ocupacionais (ASO)",
      resumo: "Agendamento rápido de ASOs e exames complementares em rede credenciada nacional.",
      texto_completo:
        "Centralizamos o agendamento de ASOs admissionais, periódicos e demissionais com rede de clínicas parceiras espalhadas por todo o Brasil, com controle em tempo real do vencimento de ASO.",
    },
    {
      ordem: 3,
      icone: Sparkles,
      titulo: "Outras Demandas de SST (Especificar)",
      resumo: "Consultoria sob medida para treinamentos de NRs, eSocial e gestão de riscos.",
      texto_completo:
        "Sua empresa tem uma demanda específica? Atendemos treinamentos das NRs, auditorias, suporte para fiscalização e soluções customizadas de gestão em saúde ocupacional.",
    },
  ],
  cta_final: "Nextcon Saúde: Gestão Inteligente para Ambientes Produtivos.",
};

export function NaiSalesPitch() {
  const [expandedPilar, setExpandedPilar] = React.useState<number | null>(null);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="flex items-start gap-5 p-6 bg-white rounded-[2.5rem] border shadow-sm relative group">
        <div className="relative shrink-0 mt-2">
          <div className="size-20 rounded-[1.5rem] bg-[#090e24] flex items-center justify-center overflow-hidden shadow-xl border-2 border-primary/10 relative">
            <Image
              src={NAI_AVATAR_URL}
              alt="Avatar NAI"
              width={80}
              height={80}
              className="object-cover"
              priority
            />
          </div>
          <div className="absolute -bottom-1 -right-1 size-6 bg-primary rounded-full border-2 border-white flex items-center justify-center">
            <Bot className="size-3 text-white" />
          </div>
        </div>

        <div className="flex-1 space-y-2 relative">
          <div className="bg-slate-50 p-5 rounded-3xl rounded-tl-none border shadow-inner relative">
            <p className="text-sm italic text-slate-600 font-bold leading-relaxed">
              "{PITCH_DATA.avatar.saudacao_inicial}"
            </p>
          </div>
          <div className="pl-2 text-left">
            <h4 className="text-sm font-black text-primary uppercase tracking-tight leading-none">
              {PITCH_DATA.avatar.nome}
            </h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {PITCH_DATA.avatar.titulo}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {PITCH_DATA.pilares_venda.map((pilar) => {
          const Icon = pilar.icone;
          const isExpanded = expandedPilar === pilar.ordem;

          return (
            <Card
              key={pilar.ordem}
              className={cn(
                "border-none shadow-sm transition-all duration-500 cursor-pointer rounded-3xl overflow-hidden group",
                isExpanded
                  ? "ring-2 ring-primary bg-primary/5 shadow-xl scale-[1.02]"
                  : "bg-white hover:ring-2 ring-primary/10"
              )}
              onClick={() => setExpandedPilar(isExpanded ? null : pilar.ordem)}
            >
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-2xl transition-colors h-fit shadow-inner",
                      isExpanded
                        ? "bg-primary text-white"
                        : "bg-slate-50 text-primary group-hover:bg-primary group-hover:text-white"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0 text-left">
                    <div className="flex justify-between items-center">
                      <h5 className="font-black text-primary uppercase text-xs tracking-tight">
                        {pilar.titulo}
                      </h5>
                      <ChevronRight
                        className={cn(
                          "size-4 text-slate-300 transition-transform duration-500",
                          isExpanded && "rotate-90 text-primary"
                        )}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">
                      {pilar.resumo}
                    </p>

                    <div
                      className={cn(
                        "grid transition-all duration-500 ease-in-out",
                        isExpanded
                          ? "grid-rows-[1fr] opacity-100 mt-4"
                          : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="p-4 bg-white/50 rounded-2xl border border-dashed border-primary/20">
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
                            {pilar.texto_completo}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="p-6 bg-[#090e24] rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
          <Sparkles className="size-20 text-white" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center gap-3">
          <Badge className="bg-white/10 text-white border-none text-[8px] font-black uppercase tracking-[0.3em]">
            Nextcon Commercial Specialist
          </Badge>
          <h3 className="text-xs font-bold leading-tight uppercase tracking-widest">
            {PITCH_DATA.cta_final}
          </h3>
        </div>
      </div>
    </div>
  );
}
