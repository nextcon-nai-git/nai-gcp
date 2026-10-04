"use client";

import * as React from "react";
import { OccupationalClinicsMap } from "@/components/providers/occupational-clinics-map";
import { MapPin, Building2, Sparkles, ShieldCheck, PhoneCall, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function AccreditedNetworkPage() {
  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#001F3F] via-[#002B4E] to-[#0A192F] p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-accent/20">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent text-primary hover:bg-accent/90 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                REDE NACIONAL NAI 2026
              </Badge>
              <Badge
                variant="outline"
                className="text-white/80 border-white/20 text-[10px] font-bold uppercase"
              >
                Brasil & Regiões METROPOLITANAS
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <MapPin className="text-accent h-8 w-8 animate-pulse" /> Rede Credenciada — Clínicas
              Ocupacionais
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Consulte a rede de clínicas parceiras e centros diagnósticos integrados em todo o
              território nacional. Atendimento para exames complementares, ASO, audiometria,
              análises clínicas e laudos de SST.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <Link href="/providers/map">
              <Badge className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-black transition-all flex items-center gap-2 shadow-lg">
                <MapPin size={14} className="text-accent" /> Ver Mapa de Clínicas Brasil
              </Badge>
            </Link>
            <Link href="/providers">
              <Badge className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl cursor-pointer text-xs font-bold transition-all flex items-center gap-2">
                <Building2 size={14} /> Ver Prestadores (Técnicos & Médicos)
              </Badge>
            </Link>
          </div>
        </div>
      </div>

      {/* HIGHLIGHTED FEATURE: SQV CURITIBA */}
      <Card className="border-accent/30 bg-gradient-to-r from-emerald-950/20 via-slate-900 to-slate-950 shadow-xl rounded-2xl">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-widest">
                DESTAQUE CURITIBA / PR
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase"
              >
                Credenciado Oficial NAI
              </Badge>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <ShieldCheck className="text-emerald-400 h-5 w-5" /> Clínica SQV — Soluções em
              Medicina e Segurança do Trabalho
            </h2>
            <p className="text-slate-300 text-xs max-w-2xl">
              +18 anos de excelência com atendimento completo em Curitiba e Região Metropolitana.
              PCMSO, ASO, Audiometria, Análises Clínicas e integração SOC / eSocial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://clinicasqv.com.br/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-all"
            >
              <Globe size={14} /> Acessar site clinicasqv.com.br
            </a>
            <a
              href="https://api.whatsapp.com/send?phone=554135007984"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 font-bold text-xs uppercase rounded-xl transition-all"
            >
              <PhoneCall size={14} /> WhatsApp (41) 3500-7984
            </a>
          </div>
        </CardContent>
      </Card>

      {/* MAP & CLINICS SEARCH COMPONENT */}
      <OccupationalClinicsMap />
    </div>
  );
}
