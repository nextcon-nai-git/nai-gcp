"use client";

import * as React from "react";
import {
  MapPin,
  Phone,
  Clock,
  Search,
  Navigation,
  CheckCircle2,
  Star,
  Stethoscope,
  ExternalLink,
  Sparkles,
  Send,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateClinicProposalMessage } from "@/lib/domain-config";

export interface OccupationalClinic {
  id: string;
  name: string;
  type: string; // Ex: "Clínica Ocupacional Mestre", "Centro Diagnóstico SST"
  cnpj?: string;
  address: string;
  city: string;
  state: string;
  cep?: string;
  phone: string;
  whatsapp: string; // Número formatado para wa.me (somente dígitos)
  email: string;
  businessHours: string; // Ex: "Seg a Sex: 07:00 - 17:30 | Sáb: 08:00 - 12:00"
  specialties: string[]; // Ex: ["ASO Admissional", "Audiometria", "Espirometria", "Raio-X OIT", "Toxicológico"]
  rating: number;
  active: boolean;
}

export const CLINICAS_BRASIL_MESTRE: OccupationalClinic[] = [
  {
    id: "sqv_curitiba",
    name: "Clínica SQV - Soluções em Medicina e Segurança do Trabalho",
    type: "Rede Credenciada Premium - Curitiba/PR",
    cnpj: "08.832.190/0001-40",
    address: "Curitiba e Região Metropolitana - PR (https://clinicasqv.com.br/)",
    city: "Curitiba",
    state: "PR",
    cep: "80000-000",
    phone: "(41) 3500-7984",
    whatsapp: "554135007984",
    email: "contato@clinicasqv.com.br",
    businessHours: "Segunda a Sexta: 07:30 às 17:30 | Sábados: Sob Agendamento",
    specialties: [
      "Medicina do Trabalho (PCMSO & ASO)",
      "Análises Clínicas",
      "Audiometria Ocupacional",
      "Avaliação Oftalmológica",
      "Espirometria",
      "ECG / EEG",
      "Segurança do Trabalho (PGR/LTCAT)",
      "Integração SOC / eSocial",
    ],
    rating: 5.0,
    active: true,
  },
  {
    id: "clin_01",
    name: "Clínica de Saúde Ocupacional Paulista - Matriz SP",
    type: "Centro de Excelência SST",
    cnpj: "12.345.678/0001-90",
    address: "Avenida Paulista, 1000 - Bela Vista",
    city: "São Paulo",
    state: "SP",
    cep: "01310-100",
    phone: "(11) 3000-1000",
    whatsapp: "5511999887766",
    email: "sp.atendimento@saudeocupacional.com.br",
    businessHours: "Segunda a Sexta: 07:00 às 18:00 | Sábados: 07:30 às 12:00",
    specialties: [
      "ASO Completo",
      "Audiometria Ocupacional",
      "Espirometria",
      "Raio-X OIT",
      "ECG / EEG",
      "Exame Toxicológico",
      "PCMSO",
    ],
    rating: 5.0,
    active: true,
  },
  {
    id: "clin_02",
    name: "Clínica Saúde & Vida Ocupacional Joinville",
    type: "Credenciado Mestre NAI",
    cnpj: "98.765.432/0001-10",
    address: "Rua das Palmeiras, 450 - Centro",
    city: "Joinville",
    state: "SC",
    cep: "89201-000",
    phone: "(47) 3433-2020",
    whatsapp: "5547988776655",
    email: "joinville@saudeocupacional.com.br",
    businessHours: "Segunda a Sexta: 07:30 às 17:30 | Sábados: 08:00 às 11:30",
    specialties: [
      "ASO Ocupacional",
      "Audiometria",
      "Acuidade Visual",
      "Avaliação Psicológica NR-33/35",
      "Epi Test",
    ],
    rating: 4.9,
    active: true,
  },
  {
    id: "clin_03",
    name: "Centro Ocupacional Rio de Janeiro - Botafogo",
    type: "Clínica Integrada SST",
    cnpj: "33.444.555/0001-22",
    address: "Praia de Botafogo, 228 - Botafogo",
    city: "Rio de Janeiro",
    state: "RJ",
    cep: "22250-040",
    phone: "(21) 2555-8080",
    whatsapp: "5521977665544",
    email: "contato.rj@centroocupacional.com.br",
    businessHours: "Segunda a Sexta: 07:00 às 18:00 | Sábados: Fechado",
    specialties: [
      "ASO",
      "Espirometria",
      "Laboratório de Análises Clínicas",
      "Raio-X OIT",
      "Holter 24h",
    ],
    rating: 4.8,
    active: true,
  },
  {
    id: "clin_04",
    name: "Instituto de Medicina do Trabalho Curitiba",
    type: "Rede Credenciada NAI",
    cnpj: "44.555.666/0001-33",
    address: "Rua Cândido de Abreu, 526 - Centro Cívico",
    city: "Curitiba",
    state: "PR",
    cep: "80530-000",
    phone: "(41) 3222-9090",
    whatsapp: "5541966554433",
    email: "curitiba@medicinaocupacional.com.br",
    businessHours: "Segunda a Sexta: 07:00 às 17:00 | Sábados: 08:00 às 12:00",
    specialties: [
      "ASO",
      "Audiometria Tonal/Vocal",
      "ECG de Repouso",
      "Toxicológico Larga Janela",
      "EET",
    ],
    rating: 5.0,
    active: true,
  },
  {
    id: "clin_05",
    name: "ProSaúde Ocupacional Belo Horizonte",
    type: "Clínica Credenciada",
    cnpj: "55.666.777/0001-44",
    address: "Avenida Afonso Pena, 1500 - Centro",
    city: "Belo Horizonte",
    state: "MG",
    cep: "30130-005",
    phone: "(31) 3111-4040",
    whatsapp: "5531955443322",
    email: "bh@prosaudeocupacional.com.br",
    businessHours: "Segunda a Sexta: 07:30 às 17:30 | Sábados: 08:00 às 11:30",
    specialties: [
      "ASO Admissional/Periódico",
      "Raio-X de Tórax OIT",
      "Espirometria",
      "Glicemia e Exames Sangue",
    ],
    rating: 4.9,
    active: true,
  },
  {
    id: "clin_06",
    name: "MedTrabalho Saúde Ocupacional Brasília",
    type: "Centro Diagnóstico SST",
    cnpj: "66.777.888/0001-55",
    address: "Setor Comercial Sul (SCS), Quadra 4, Bloco A",
    city: "Brasília",
    state: "DF",
    cep: "70304-000",
    phone: "(61) 3333-7070",
    whatsapp: "5561944332211",
    email: "bsb@medtrabalho.com.br",
    businessHours: "Segunda a Sexta: 07:00 às 18:00 | Sábados: 08:00 às 12:00",
    specialties: ["ASO", "Audiometria", "Avaliação NR-33/35", "Toxicológico C, D, E", "Ergonomia"],
    rating: 4.8,
    active: true,
  },
];

export function OccupationalClinicsMap() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedClinic, setSelectedClinic] = React.useState<OccupationalClinic>(
    CLINICAS_BRASIL_MESTRE[0]
  );
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const filteredClinics = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return CLINICAS_BRASIL_MESTRE;
    return CLINICAS_BRASIL_MESTRE.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term) ||
        c.state.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term) ||
        c.specialties.some((s) => s.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const mapsQuery = encodeURIComponent(
    `clinica saude ocupacional, ${selectedClinic.address}, ${selectedClinic.city} - ${selectedClinic.state}`
  );
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  // TEXTO PADRÃO PROFISSIONAL DE PROPOSTA DE CREDENCIAMENTO PARCEIRO NEXTCON
  const generateProposalText = (clinicName: string) => {
    return generateClinicProposalMessage(clinicName);
  };

  const getCredentialingWhatsAppLink = (phoneDigits: string, clinicName: string) => {
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    const msg = generateProposalText(clinicName);
    return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(msg)}`;
  };

  const getWhatsAppLink = (phoneDigits: string, clinicName: string) => {
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá, equipe da ${clinicName}! Gostaria de informações sobre agendamento de exames de saúde ocupacional.`
    );
    return `https://wa.me/${cleanDigits}?text=${msg}`;
  };

  const handleCopyProposal = (clinic: OccupationalClinic) => {
    const text = generateProposalText(clinic.name);
    navigator.clipboard.writeText(text);
    setCopiedId(clinic.id);
    toast({
      title: "Proposta Copiada! 📋",
      description: `Texto de credenciamento para ${clinic.name} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      {/* HEADER DO BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Navigation size={160} className="text-accent" />
        </div>
        <div className="space-y-2 relative z-10 max-w-2xl">
          <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em] px-3 h-5 mb-1">
            REDE NACIONAL DE CREDENCIADOS
          </Badge>
          <h2 className="text-3xl font-headline font-black uppercase tracking-tight">
            Buscador & Credenciamento de Clínicas do Brasil
          </h2>
          <p className="text-slate-300 text-xs font-medium leading-relaxed">
            Localize clínicas ocupacionais em todo o Brasil e envie propostas oficiais de
            credenciamento parceiro Nextcon com 1-clique via WhatsApp.
          </p>
        </div>

        <div className="relative z-10 w-full md:w-80">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 size-4 text-slate-400" />
            <Input
              placeholder="Buscar por Cidade, UF, Nome ou Exame..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-12 bg-white/10 text-white placeholder:text-slate-400 border-white/20 rounded-2xl font-medium text-xs focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* BANNER DE CREDENCIAMENTO AUTOMÁTICO 1-CLIQUE */}
      <Card className="bg-gradient-to-r from-emerald-950 via-slate-900 to-primary text-white border-none rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black uppercase tracking-widest px-2.5 h-5">
              <Sparkles size={12} className="mr-1" /> MOTOR DE CREDENCIAMENTO AUTOMÁTICO 1-CLIQUE
            </Badge>
            <h3 className="text-lg font-headline font-black uppercase tracking-tight">
              Apresentação Nextcon para Novas Clínicas Parceiras
            </h3>
            <p className="text-slate-300 text-xs font-medium leading-relaxed">
              Mensagem enviada com 1-clique: A Nextcon se apresenta como cliente parceiro em
              expansão para credenciamento e envio de demandas na região da clínica selecionada.
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              onClick={() => handleCopyProposal(selectedClinic)}
              variant="outline"
              className="border-white/20 text-white bg-white/10 hover:bg-white/20 font-black text-xs uppercase tracking-widest h-11 px-5 rounded-2xl gap-2"
            >
              {copiedId === selectedClinic.id ? (
                <Check size={16} className="text-emerald-400" />
              ) : (
                <Copy size={16} />
              )}
              {copiedId === selectedClinic.id ? "Copiado!" : "Copiar Proposta"}
            </Button>

            <a
              href={getCredentialingWhatsAppLink(selectedClinic.whatsapp, selectedClinic.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105"
            >
              <Send size={16} /> Credenciar {selectedClinic.city} (1-Clique)
            </a>
          </div>
        </div>
      </Card>

      {/* PAINEL PRINCIPAL: LISTA DE CLÍNICAS + MAPA INTERATIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LISTA DE CLÍNICAS (ESQUERDA) */}
        <div className="lg:col-span-5 space-y-4 max-h-[780px] overflow-y-auto pr-2 scrollbar-thin">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
            {filteredClinics.length} Clínica(s) Encontrada(s)
          </p>

          {filteredClinics.map((clinic) => {
            const isSelected = selectedClinic.id === clinic.id;
            return (
              <Card
                key={clinic.id}
                onClick={() => setSelectedClinic(clinic)}
                className={cn(
                  "border-2 transition-all cursor-pointer rounded-[2rem] p-6 space-y-4 hover:shadow-lg",
                  isSelected
                    ? "border-primary bg-blue-50/40 shadow-xl ring-2 ring-primary/10"
                    : "border-slate-100 bg-white hover:border-slate-300"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase px-2 h-4 mb-1">
                      {clinic.type}
                    </Badge>
                    <h3 className="font-black text-sm text-primary uppercase leading-tight">
                      {clinic.name}
                    </h3>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[9px] px-2 h-5 shrink-0 flex items-center gap-1">
                    <Star size={10} className="fill-amber-500 text-amber-500" />{" "}
                    {clinic.rating.toFixed(1)}
                  </Badge>
                </div>

                <div className="space-y-2 text-[11px] text-slate-600 font-medium">
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-red-500 shrink-0" />
                    <span>
                      {clinic.address} —{" "}
                      <strong>
                        {clinic.city} / {clinic.state}
                      </strong>
                    </span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock size={14} className="text-blue-500 shrink-0" />
                    <span className="text-[10px]">{clinic.businessHours}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  {clinic.specialties.slice(0, 4).map((spec, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[7px] font-bold bg-white text-slate-600 border-slate-200"
                    >
                      {spec}
                    </Badge>
                  ))}
                  {clinic.specialties.length > 4 && (
                    <Badge
                      variant="outline"
                      className="text-[7px] font-bold bg-slate-100 text-slate-500"
                    >
                      +{clinic.specialties.length - 4} mais
                    </Badge>
                  )}
                </div>

                {/* AÇÕES RÁPIDAS COM BOTAO DE CREDENCIAMENTO PROPOSTA PARCEIRA */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 gap-2">
                  <a
                    href={getCredentialingWhatsAppLink(clinic.whatsapp, clinic.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all hover:scale-105"
                  >
                    <Send size={13} /> Credenciar (1-Clique)
                  </a>

                  <div className="flex items-center justify-between sm:justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyProposal(clinic);
                      }}
                      className="text-[9px] font-black uppercase text-slate-500 hover:text-primary gap-1"
                      title="Copiar Texto da Proposta"
                    >
                      <Copy size={12} /> Copiar
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[10px] font-black uppercase text-primary tracking-widest gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClinic(clinic);
                      }}
                    >
                      Mapa <ExternalLink size={12} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* MAPA INTERATIVO + DETALHES DE ATENDIMENTO E PROPOSTA (DIREITA) */}
        <div className="lg:col-span-7 space-y-6 sticky top-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            {/* FRAME GOOGLE MAPS EMBED */}
            <div className="w-full h-[380px] relative bg-slate-100">
              <iframe
                title={`Mapa da clínica ${selectedClinic.name}`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={mapsEmbedUrl}
                className="w-full h-full"
              />
            </div>

            {/* DETALHES COMPLETOS E PROPOSTA DA CLÍNICA SELECIONADA */}
            <CardContent className="p-8 space-y-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div className="space-y-1">
                  <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] uppercase tracking-widest px-2.5 h-5 mb-1">
                    <CheckCircle2 size={12} className="mr-1" /> CLÍNICA SELECIONADA
                  </Badge>
                  <h3 className="text-xl font-headline font-black text-primary uppercase">
                    {selectedClinic.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedClinic.type} • {selectedClinic.city} / {selectedClinic.state}
                  </p>
                </div>

                <a
                  href={getCredentialingWhatsAppLink(selectedClinic.whatsapp, selectedClinic.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 shrink-0"
                >
                  <Send size={18} /> Proposta Credenciamento (WhatsApp)
                </a>
              </div>

              {/* BOX COM PRÉVIA DO TEXTO DA PROPOSTA DE CREDENCIAMENTO */}
              <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-600" /> Prévia da Proposta de
                    Credenciamento (Nextcon Parceiro)
                  </h4>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyProposal(selectedClinic)}
                    className="h-7 text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg gap-1"
                  >
                    <Copy size={12} /> Copiar Texto
                  </Button>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {generateProposalText(selectedClinic.name)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-medium text-slate-700">
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <MapPin size={14} className="text-red-500" /> Endereço & Localização
                  </h4>
                  <p className="font-bold text-slate-900 leading-snug">{selectedClinic.address}</p>
                  <p className="text-slate-500">
                    {selectedClinic.city} / {selectedClinic.state} — CEP: {selectedClinic.cep}
                  </p>
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-500" /> Horário de Funcionamento
                  </h4>
                  <p className="font-bold text-slate-900">{selectedClinic.businessHours}</p>
                  <p className="text-slate-500 italic text-[11px]">
                    Credenciamento corporativo direto via Nextcon.
                  </p>
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Phone size={14} className="text-emerald-500" /> Contatos de Atendimento
                  </h4>
                  <p className="font-bold text-slate-900">Telefone: {selectedClinic.phone}</p>
                  <p className="text-slate-500 truncate">E-mail: {selectedClinic.email}</p>
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Stethoscope size={14} className="text-primary" /> Exames & Especialidades
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedClinic.specialties.map((spec, i) => (
                      <Badge
                        key={i}
                        className="bg-primary/10 text-primary border-none text-[8px] font-bold"
                      >
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
