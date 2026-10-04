"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GrupoAvpAso } from "@/lib/grupo-avp-asos-data";
import { GLOBAL_CLINICS_CATALOG } from "@/lib/avp-clinics-data";
import {
  analyzeNetworkRedundancy,
  generateWhatsAppCredenciamentoMessage,
  CityRedundancyReport,
} from "@/lib/avp-clinic-intelligence";
import {
  getStoredNationalClinics,
  generateOneClickCredenciamentoUrl,
  formatBrazilianPhoneDisplay,
  NationalOccupationalClinic,
} from "@/lib/avp-national-clinics-directory";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Building2,
  ExternalLink,
  Copy,
  Search,
  MessageSquare,
  Sparkles,
  MapPin,
  ArrowRight,
  Send,
  Phone,
} from "lucide-react";

interface GrupoAvpRedundancyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAsos: GrupoAvpAso[];
}

export function GrupoAvpRedundancyModal({
  open,
  onOpenChange,
  currentAsos,
}: GrupoAvpRedundancyModalProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "CRITICO_ZERO" | "VULNERAVEL_UMA" | "RESILIENTE_DUAS_OU_MAIS"
  >("ALL");

  // Auditoria de redundância
  const summary = useMemo(() => {
    return analyzeNetworkRedundancy(currentAsos, GLOBAL_CLINICS_CATALOG);
  }, [currentAsos]);

  // Lista filtrada de cidades
  const filteredCities = useMemo(() => {
    return summary.relatorioPorCidade.filter((city) => {
      if (statusFilter !== "ALL" && city.statusContingencia !== statusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = city.cidade.toLowerCase().includes(query);
        const matchUf = city.uf.toLowerCase().includes(query);
        const matchClinicas = city.clinicasExistentes.some((c) => c.toLowerCase().includes(query));
        if (!matchName && !matchUf && !matchClinicas) return false;
      }
      return true;
    });
  }, [summary, statusFilter, searchTerm]);

  // Carrega catálogo de clínicas com contatos de WhatsApp
  const nationalClinics = useMemo(() => getStoredNationalClinics(), [open]);

  // Disparo em 1 clique via WhatsApp
  const handleSendWhatsApp1Click = (clinic: NationalOccupationalClinic) => {
    const { waUrl, messageText } = generateOneClickCredenciamentoUrl(clinic);
    if (!waUrl) {
      toast({
        title: "WhatsApp Indisponível",
        description: "Não foi encontrado número válido com DDD para esta clínica.",
        variant: "destructive",
      });
      return;
    }
    window.open(waUrl, "_blank", "noopener,noreferrer");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText).catch(() => {});
    }
    toast({
      title: "WhatsApp Aberto em 1-Clique! 📲",
      description: `Proposta de credenciamento aberta para ${clinic.nome} (${clinic.cidade}/${clinic.uf}). Texto copiado.`,
    });
  };

  // Copia mensagem B2B de Pré-Credenciamento para a área de transferência
  const handleCopyOutreach = (city: CityRedundancyReport, clinicName?: string) => {
    const target = clinicName || "Clínica de Medicina Ocupacional";
    const text = generateWhatsAppCredenciamentoMessage(city.cidade, city.uf, target);
    navigator.clipboard.writeText(text);
    toast({
      title: "Mensagem B2B Copiada! 📲",
      description: `Proposta de pré-credenciamento pronta para envio via WhatsApp em ${city.cidade}/${city.uf}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-slate-200 shadow-2xl bg-white">
        {/* HEADER */}
        <div className="p-6 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <ShieldAlert size={24} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  Radar de Contingência de Rede SST
                  <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] uppercase">
                    Meta: 2+ Clínicas/Polo
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Auditoria de redundância operacional para garantir atendimento ininterrupto em
                  cada município do Brasil.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Polos Avaliados
              </span>
              <strong className="text-2xl font-black text-white">
                {summary.totalCidadesAvaliadas}
              </strong>
              <span className="text-[10px] text-slate-500 block">cidades com demanda</span>
            </div>

            <div
              onClick={() => setStatusFilter("CRITICO_ZERO")}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                statusFilter === "CRITICO_ZERO"
                  ? "bg-rose-950/60 border-rose-500"
                  : "bg-slate-800/80 border-slate-700/60 hover:border-rose-500/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  Zero Clínicas
                </span>
                <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
              </div>
              <strong className="text-2xl font-black text-rose-400">
                {summary.totalCidadesCriticas}
              </strong>
              <span className="text-[10px] text-rose-300/70 block">Gargalo Crítico</span>
            </div>

            <div
              onClick={() => setStatusFilter("VULNERAVEL_UMA")}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                statusFilter === "VULNERAVEL_UMA"
                  ? "bg-amber-950/60 border-amber-500"
                  : "bg-slate-800/80 border-slate-700/60 hover:border-amber-500/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Apenas 1 Clínica
                </span>
                <AlertTriangle size={12} className="text-amber-400" />
              </div>
              <strong className="text-2xl font-black text-amber-400">
                {summary.totalCidadesVulneraveis}
              </strong>
              <span className="text-[10px] text-amber-300/70 block">Sem Suplente/Backup</span>
            </div>

            <div
              onClick={() => setStatusFilter("RESILIENTE_DUAS_OU_MAIS")}
              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                statusFilter === "RESILIENTE_DUAS_OU_MAIS"
                  ? "bg-emerald-950/60 border-emerald-500"
                  : "bg-slate-800/80 border-slate-700/60 hover:border-emerald-500/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  Resilientes (2+)
                </span>
                <ShieldCheck size={12} className="text-emerald-400" />
              </div>
              <strong className="text-2xl font-black text-emerald-400">
                {summary.totalCidadesResilientes}
              </strong>
              <span className="text-[10px] text-emerald-300/70 block">
                {summary.percentualCoberturaMinima2}% da rede
              </span>
            </div>
          </div>
        </div>

        {/* TOOLBAR SEARCH & FILTERS */}
        <div className="p-4 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar polo por cidade, UF ou clínica..."
              className="pl-9 h-10 bg-white rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={statusFilter === "ALL" ? "default" : "outline"}
              onClick={() => setStatusFilter("ALL")}
              className="h-8 rounded-lg text-xs"
            >
              Todos ({summary.totalCidadesAvaliadas})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "CRITICO_ZERO" ? "default" : "outline"}
              onClick={() => setStatusFilter("CRITICO_ZERO")}
              className="h-8 rounded-lg text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              Críticos ({summary.totalCidadesCriticas})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "VULNERAVEL_UMA" ? "default" : "outline"}
              onClick={() => setStatusFilter("VULNERAVEL_UMA")}
              className="h-8 rounded-lg text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              Vulneráveis ({summary.totalCidadesVulneraveis})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "RESILIENTE_DUAS_OU_MAIS" ? "default" : "outline"}
              onClick={() => setStatusFilter("RESILIENTE_DUAS_OU_MAIS")}
              className="h-8 rounded-lg text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              Resilientes ({summary.totalCidadesResilientes})
            </Button>
          </div>
        </div>

        {/* LISTAGEM DE CIDADES E AÇÕES DE CREDENCIAMENTO */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {filteredCities.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Building2 size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">
                Nenhum polo municipal encontrado para este filtro.
              </p>
            </div>
          ) : (
            filteredCities.map((city) => {
              const googleSearchUrl = `https://www.google.com/maps/search/clinica+medicina+do+trabalho+saude+ocupacional+aso+${encodeURIComponent(city.cidade)}+${encodeURIComponent(city.uf)}`;

              const prospectClinic = nationalClinics.find(
                (c) =>
                  c.cidade.toLowerCase() === city.cidade.toLowerCase() ||
                  (c.cidade.toLowerCase().includes(city.cidade.toLowerCase()) &&
                    c.uf.toUpperCase() === city.uf.toUpperCase())
              );

              return (
                <div key={`${city.cidade}-${city.uf}`} className="pt-3 first:pt-0">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* INFO POLO */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-base flex items-center gap-1.5">
                          <MapPin size={16} className="text-primary" /> {city.cidade} - {city.uf}
                        </span>

                        {city.statusContingencia === "CRITICO_ZERO" && (
                          <Badge className="bg-rose-500 text-white font-black text-[9px] uppercase tracking-wider">
                            🔴 Zero Clínicas (Faltam 2)
                          </Badge>
                        )}
                        {city.statusContingencia === "VULNERAVEL_UMA" && (
                          <Badge className="bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider">
                            🟡 1 Clínica (Falta Suplente)
                          </Badge>
                        )}
                        {city.statusContingencia === "RESILIENTE_DUAS_OU_MAIS" && (
                          <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider">
                            🟢 Contingência Garantida ({city.totalClinicasCadastradas} Clínicas)
                          </Badge>
                        )}

                        <span className="text-[11px] font-bold text-slate-400 ml-auto">
                          {city.totalAsosNaQueue} ASO{city.totalAsosNaQueue > 1 ? "s" : ""} na fila
                        </span>
                      </div>

                      {/* CLÍNICAS JÁ ATIVAS */}
                      <div className="text-xs text-slate-600">
                        {city.clinicasExistentes.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-400 text-[10px] uppercase">
                              Cadastradas:
                            </span>
                            {city.clinicasExistentes.map((clin, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="bg-slate-50 text-slate-700 text-[10px] font-semibold"
                              >
                                {clin}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-rose-600 font-medium text-[11px]">
                            Nenhuma clínica credenciada no catálogo para este polo. ASOs correm
                            risco de atraso!
                          </p>
                        )}
                      </div>

                      {/* PRESTADOR SUGERIDO COM WHATSAPP DIRETO */}
                      {prospectClinic && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-1 rounded-lg flex items-center gap-2 mt-1">
                          <Phone size={12} className="text-emerald-600 shrink-0" />
                          <span>
                            Sugestão com WhatsApp: <strong>{prospectClinic.nome}</strong> (
                            {formatBrazilianPhoneDisplay(prospectClinic.whatsapp)})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* AÇÕES DE PROSPECÇÃO E CONTINGÊNCIA */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {prospectClinic?.whatsapp && (
                        <Button
                          size="sm"
                          onClick={() => handleSendWhatsApp1Click(prospectClinic)}
                          className="h-9 rounded-xl text-xs gap-1.5 font-bold bg-[#25D366] hover:bg-[#20ba59] text-white shadow-sm"
                          title={`Disparar WhatsApp de Credenciamento para ${prospectClinic.nome}`}
                        >
                          <Send size={13} />
                          WhatsApp 1-Clique
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-9 rounded-xl text-xs gap-1.5 border-slate-300 font-bold hover:bg-slate-50"
                      >
                        <a href={googleSearchUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={13} />
                          Maps
                        </a>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleCopyOutreach(city, prospectClinic?.nome)}
                        className="h-9 rounded-xl text-xs gap-1.5 font-bold bg-primary hover:bg-primary/90 text-white shadow-sm"
                      >
                        <Copy size={13} />
                        Copiar Mensagem
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Sparkles size={14} className="text-amber-500" />
            <span>
              Inteligência NAI 3.8: Redundância mínima de 2 credenciadas elimina atrasos de SLA e
              garante negociação de preços de ASO.
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-9 text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
