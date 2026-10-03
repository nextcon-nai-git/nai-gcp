"use client";

import * as React from "react";
import {
  ShieldPlus,
  CircleDollarSign,
  HardHat,
  Sparkles,
  ChevronRight,
  Zap,
  Loader2,
  MessageSquare,
  ShieldCheck,
  ClipboardCheck,
  Zap as ZapIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

const NAI_AVATAR_URL =
  "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/logo%2FAvatar%20Nextcon%20NAI.png?alt=media";

const PITCH_DATA = {
  avatar: {
    nome: "NAI",
    titulo: "Inteligência Nextcon",
    saudacao_inicial:
      "Olá. Eu sou a NAI. Enquanto você cota seu orçamento, saiba: você não está contratando apenas um software, mas um parceiro de inteligência em conformidade SST.",
  },
  pilares_venda: [
    {
      ordem: 1,
      icone: ClipboardCheck,
      titulo: "Gestão de PGR e PCMSO",
      resumo: "Elaboração e controle de programas conforme NR-01 e NR-07.",
      texto_completo:
        "Minha inteligência permite mapear riscos em tempo real e sugerir protocolos médicos precisos, garantindo que o PGR e o PCMSO da sua empresa estejam sempre atualizados e tecnicamente sólidos.",
    },
    {
      ordem: 2,
      icone: ZapIcon,
      titulo: "Auditoria eSocial",
      resumo: "Validação de eventos S-2210, S-2220 e S-2240.",
      texto_completo:
        "Eu atuo como um firewall antes de qualquer envio. Verifico a consistência dos dados do eSocial para evitar multas por inconsistências entre o ambiente de trabalho e o monitoramento de saúde.",
    },
    {
      ordem: 3,
      icone: HardHat,
      titulo: "Consultoria em NRs",
      resumo: "Suporte técnico especializado em todas as Normas Regulamentadoras.",
      texto_completo:
        "Tenho acesso imediato a toda a legislação de SST vigente em 2026. Posso tirar dúvidas técnicas sobre qualquer NR e sugerir medidas de controle de engenharia ou administrativas.",
    },
  ],
  cta_final: "A Nextcon é sobre gestão de conformidade. Blinde sua operação agora.",
};

export function NaiSalesPitch() {
  const [expandedPilar, setExpandedPilar] = React.useState<number | null>(null);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
      {/* Balão de Fala e Avatar */}
      <div className="flex items-start gap-5 p-6 bg-white rounded-[2.5rem] border shadow-sm relative group">
        <div className="relative shrink-0 mt-2">
          <div className="size-20 rounded-[1.5rem] bg-[#090e24] flex items-center justify-center overflow-hidden shadow-xl border-2 border-primary/10">
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
            <Zap className="size-3 text-white fill-current" />
          </div>
        </div>

        <div className="flex-1 space-y-2 relative">
          <div className="bg-slate-50 p-5 rounded-3xl rounded-tl-none border shadow-inner relative">
            <p className="text-sm italic text-slate-600 leading-relaxed font-medium">
              "{PITCH_DATA.avatar.saudacao_inicial}"
            </p>
          </div>
          <div className="pl-2">
            <h4 className="text-sm font-black text-primary uppercase tracking-tight leading-none">
              {PITCH_DATA.avatar.nome}
            </h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {PITCH_DATA.avatar.titulo}
            </p>
          </div>
        </div>
      </div>

      {/* Pilares de Venda Interativos */}
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
                  <div className="flex-1 space-y-1 min-w-0">
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

      {/* CTA Final */}
      <div className="p-6 bg-[#090e24] rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
          <Sparkles className="size-20 text-white" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center gap-3">
          <Badge className="bg-white/10 text-white border-none text-[8px] font-black uppercase tracking-[0.3em]">
            Compliance 2026
          </Badge>
          <h3 className="text-xs font-bold leading-tight uppercase tracking-widest">
            {PITCH_DATA.cta_final}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase">
            <MessageSquare className="size-3" /> NAI Forensic Sales Engine
          </div>
        </div>
      </div>
    </div>
  );
}
