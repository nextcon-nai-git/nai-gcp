"use client";

import * as React from "react";
import { X, Sparkles, Zap, Loader2, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

/**
 * @fileOverview Widget Flutuante da NAI (Assistente Comercial).
 * Agora consome diretamente do Firestore para evitar falhas em rotas de API server-side.
 */

const NAI_AVATAR_URL = "/nai-avatar.png";

// Fallback robusto caso o Firestore ainda não tenha sido semeado
const DEFAULT_PITCH = {
  avatar: {
    saudacao_inicial:
      "Olá! Sou a NAI, a Inteligência Artificial da Nextcon. Estou aqui para ajudar você a blindar sua empresa com as melhores práticas de SST e Auditoria. Como posso ajudar seu negócio hoje?",
  },
  pilares_venda: [
    {
      ordem: 1,
      titulo: "Gestão de PGR e PCMSO",
      resumo: "Elaboração e controle de programas conforme NR-01 e NR-07.",
    },
    {
      ordem: 2,
      titulo: "Auditoria eSocial",
      resumo: "Validação de eventos S-2210, S-2220 e S-2240.",
    },
    {
      ordem: 3,
      titulo: "Consultoria em NRs",
      resumo: "Suporte técnico especializado em todas as Normas Regulamentadoras.",
    },
  ],
  cta_final: "A Nextcon é sobre gestão de conformidade. Blinde sua operação agora.",
};

export function NaiFloatingWidget() {
  const [isOpen, setIsOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [isHovering, setIsHovering] = React.useState(false);
  const db = useFirestore();

  const pitchRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, "config_nai_avatar", "pitch_vendas_padrao");
  }, [db]);

  const { data: remotePitch, isLoading: loading } = useDoc(pitchRef);

  // Usa dados do banco ou o fallback padrão
  const pitchData = remotePitch || DEFAULT_PITCH;

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && buttonRef.current) {
      // Reset transform when opening
      buttonRef.current.style.transform = "translate(0, 0)";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current || isOpen) return;
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - left - width / 2;
    const y = e.clientY - top - height / 2;
    // Puxar o botão em direção ao cursor
    buttonRef.current.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (!buttonRef.current) return;
    buttonRef.current.style.transform = "translate(0, 0)";
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      {/* Painel do Chat */}
      {isOpen && (
        <Card className="w-[350px] border-none shadow-2xl rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 bg-white">
          <CardHeader className="bg-primary text-white p-6 relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 overflow-hidden">
                <Image
                  src={NAI_AVATAR_URL}
                  alt="NAI"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-tight">
                  NAI Intelligence
                </CardTitle>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                  Assistente de Blindagem
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 max-h-[450px] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Sincronizando NAI...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border shadow-inner">
                  <p className="text-xs italic text-slate-600 leading-relaxed font-medium">
                    "{pitchData.avatar?.saudacao_inicial}"
                  </p>
                </div>

                <div className="space-y-3">
                  {pitchData.pilares_venda?.map((pilar: any) => (
                    <div
                      key={pilar.ordem}
                      className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-accent/30 transition-all group"
                    >
                      <h4 className="text-[11px] font-black text-primary uppercase mb-1 flex items-center gap-2">
                        <Zap className="size-3 text-accent" />
                        {pilar.titulo}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium leading-tight">
                        {pilar.resumo}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-dashed space-y-4">
                  <p className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest">
                    {pitchData.cta_final}
                  </p>
                  <Button
                    asChild
                    className="w-full h-12 bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg gap-2"
                  >
                    <Link href="/comercial" onClick={() => setIsOpen(false)}>
                      Solicitar Orçamento <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botão Flutuante humanizado com avatar NAI */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        style={{
          transition: isHovering ? "none" : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
        className={cn(
          "h-16 px-8 rounded-full shadow-2xl flex items-center gap-3 active:scale-95 group overflow-hidden border-2 border-white/20 will-change-transform",
          isOpen
            ? "bg-primary text-white"
            : "gradient-nextcon text-white ring-4 ring-accent/20 shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:shadow-[0_0_40px_rgba(56,189,248,0.8)]",
          !isOpen && !isHovering && "animate-[pulse_3s_ease-in-out_infinite]"
        )}
      >
        <div className="relative size-10 rounded-full overflow-hidden border-2 border-white/20 bg-[#090e24] flex items-center justify-center shrink-0">
          <Image src={NAI_AVATAR_URL} alt="NAI" fill className="object-cover" sizes="40px" />
          {!isOpen && (
            <span className="absolute top-0 right-0 size-2.5 bg-accent rounded-full border-2 border-primary animate-ping" />
          )}
        </div>
        <span className="font-black uppercase text-xs tracking-widest">
          {isOpen ? "Fechar Assistente" : "Falar com a NAI"}
        </span>
      </button>
    </div>
  );
}
