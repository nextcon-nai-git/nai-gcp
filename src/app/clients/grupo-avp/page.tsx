"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  MapPin,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  ShieldCheck,
  Sparkles,
  Send,
  ExternalLink,
  Download,
  Copy,
  Check,
  ArrowRight,
  Layers,
  Stethoscope,
  AlertCircle,
  HelpCircle,
  Video,
  ListTodo,
  UserCheck,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { GrupoAvpAsoManager } from "@/components/clients/grupo-avp-aso-manager";
import { AvpSchedulingRequestForm } from "@/components/clients/avp-scheduling-request-form";
import { GrupoAvpCredenciamentoHub } from "@/components/clients/grupo-avp-credenciamento-hub";

export default function GrupoAvpClientHubPage() {
  const { toast } = useToast();
  const [copiedChannel, setCopiedChannel] = React.useState<string | null>(null);

  const [queueSummary, setQueueSummary] = React.useState({
    total: 0,
    urgentes: 0,
    cidades: 0,
    concluidos: 0,
  });

  // Checklist de Ações do Workshop
  const [tasks, setTasks] = React.useState([
    {
      id: "nxt-1",
      owner: "Relacionamento NEXTCON",
      title: "Disponibilizar gravação do workshop",
      desc: "Enviar o vídeo da reunião para que os participantes possam assistir novamente.",
      done: true,
    },
    {
      id: "nxt-2",
      owner: "Relacionamento NEXTCON",
      title: "Enviar material de apoio & Planilha",
      desc: "Disponibilizar via e-mail a planilha de agendamento em lote, manual e apresentação.",
      done: true,
    },
    {
      id: "nxt-3",
      owner: "Relacionamento NEXTCON",
      title: "Disponibilizar link de presença & Feedback",
      desc: "Enviar formulário para confirmação de presença e avaliação do treinamento.",
      done: true,
    },
    {
      id: "nxt-4",
      owner: "Relacionamento NEXTCON",
      title: "Compartilhar vídeos em pasta na nuvem",
      desc: "Criar pasta em nuvem para disponibilizar as gravações do 1º e 2º dia de workshop.",
      done: true,
    },
    {
      id: "nxt-5",
      owner: "Relacionamento NEXTCON",
      title: "Enviar orientações e contatos oficiais",
      desc: "Disponibilizar material com instruções de agendamento e contatos NextCon.",
      done: true,
    },
    {
      id: "nxt-6",
      owner: "Relacionamento NEXTCON",
      title: "Corrigir slide e reenviar versão retificada",
      desc: "Realizar retificação do arquivo apresentado e encaminhar aos participantes.",
      done: true,
    },
    {
      id: "avp-1",
      owner: "Grupo AVP",
      title: "Solicitar agendamentos via canais oficiais",
      desc: "Encaminhar demandas exclusivamente pelo WhatsApp (41) 98716-8938 ou e-mail oficial.",
      done: false,
    },
    {
      id: "avp-2",
      owner: "Grupo AVP",
      title: "Indicar clínicas para credenciamento",
      desc: "Enviar por e-mail novas indicações de clínicas para verificação documental.",
      done: false,
    },
    {
      id: "avp-3",
      owner: "Grupo AVP",
      title: "Enviar notas fiscais e boletos de Agosto",
      desc: "Encaminhar para o Erickson os boletos e notas fiscais de exames realizados até 31/08.",
      done: false,
    },
  ]);

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(label);
    toast({
      title: "Copiado com Sucesso!",
      description: `${label} copiado para a área de transferência.`,
    });
    setTimeout(() => setCopiedChannel(null), 2500);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24 text-slate-900">
      {/* BANNER PRINCIPAL GRUPO AVP & NEXTCON */}
      <div className="relative rounded-[3rem] bg-gradient-to-br from-[#00172e] via-[#002244] to-[#0a325c] text-white p-8 sm:p-12 overflow-hidden shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Building2 className="size-8 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-black tracking-widest text-accent uppercase">
                  Cliente Nacional
                </span>
                <span className="text-white/40">•</span>
                <span className="text-xs font-black tracking-widest text-slate-300 uppercase">
                  {queueSummary.cidades} Municípios na fila
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black font-headline uppercase tracking-tight text-white mt-1">
                Grupo AVP
              </h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Parceria Estratégica de Centralização de Saúde & Segurança do Trabalho (SST)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px] px-3.5 h-8 uppercase tracking-wider">
              Operação Ativa (01/09/2026)
            </Badge>
            <Badge className="bg-white/10 text-white font-mono font-bold text-[10px] px-3.5 h-8 border-white/20">
              ID: GRUPO_AVP
            </Badge>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="relative z-10 pt-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Capilaridade
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-accent">
              {queueSummary.cidades} Municípios na fila
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">
              Cidades com solicitações importadas
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Exames concluídos
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-white">
              {queueSummary.concluidos} Exames feitos
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">
              Conforme o status da fila
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/10 backdrop-blur-sm border border-emerald-400/30">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 block">
              Fila de ASOs
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-emerald-400">
              {queueSummary.total} Solicitações
            </strong>
            <span className="text-[9px] text-emerald-200 block mt-0.5">
              {queueSummary.cidades} Cidades na fila
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              SLA Confirmação
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-emerald-400">
              Até 4h Úteis
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">Direto com Colaborador</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              SLA Liberação ASO
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-amber-300">
              24h a 48h
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">Portal de Admissões AVP</span>
          </div>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO OPERACIONAL */}
      <Tabs defaultValue="asos" className="w-full space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="asos"
              className="rounded-xl py-2.5 px-4 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white gap-2 transition-all"
            >
              <FileSpreadsheet size={15} /> Gestão de ASOs ({queueSummary.total})
              <Badge className="bg-rose-500 text-white text-[9px] h-4 px-1.5 rounded-full font-bold">
                {queueSummary.urgentes} Urgentes
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="credenciamento"
              className="rounded-xl py-2.5 px-4 text-xs font-black uppercase tracking-wider data-[state=active]:bg-[#25D366] data-[state=active]:text-white gap-2 transition-all shadow-sm"
            >
              <Building2 size={15} /> Credenciamento Brasil (WhatsApp 1-Clique)
              <Badge className="bg-emerald-600 text-white text-[9px] h-4 px-1.5 rounded-full font-bold">
                117+ Clínicas
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="channels"
              className="rounded-xl py-2.5 px-4 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white gap-2 transition-all"
            >
              <MessageSquare size={15} /> Canais & Diretrizes SST
            </TabsTrigger>

            <TabsTrigger
              value="simulator"
              className="rounded-xl py-2.5 px-4 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white gap-2 transition-all"
            >
              <Send size={15} /> Nova Solicitação (10 Campos)
            </TabsTrigger>

            <TabsTrigger
              value="workshop"
              className="rounded-xl py-2.5 px-4 text-xs font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white gap-2 transition-all"
            >
              <ListTodo size={15} /> Alinhamento & Workshop
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: GESTÃO DE ASOS */}
        <TabsContent
          value="asos"
          forceMount
          className="space-y-6 focus-visible:outline-none data-[state=inactive]:hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-white font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                  FILA DA PLANILHA AVP
                </Badge>
                <h2 className="text-2xl font-black font-headline text-primary uppercase">
                  Fila Nacional de ASOs em Andamento
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                {queueSummary.total} solicitações em {queueSummary.cidades} municípios da fila
                importada • Filtros por status, responsável (Kelly, Letícia, Felipe, Isabelle),
                urgência e clínicas.
              </p>
            </div>
          </div>
          <GrupoAvpAsoManager onQueueSummaryChange={setQueueSummary} />
        </TabsContent>

        {/* TAB 1.5: CENTRAL NACIONAL DE CREDENCIAMENTO BRASIL (WHATSAPP 1-CLIQUE) */}
        <TabsContent value="credenciamento" className="space-y-6 focus-visible:outline-none">
          <GrupoAvpCredenciamentoHub />
        </TabsContent>

        {/* TAB 2: CANAIS E DIRETRIZES */}
        <TabsContent value="channels" className="space-y-10 focus-visible:outline-none">
          {/* CANAIS OFICIAIS & DIRETRIZES ESTREITAS */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-white font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                  DIRETRIZ OBRIGATÓRIA
                </Badge>
                <h2 className="text-2xl font-black font-headline text-primary uppercase">
                  Canais Oficiais de Atendimento
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                Proibido o contato direto com clínicas ou celulares pessoais. O uso dos canais
                oficiais garante a contagem do SLA e rastreabilidade total.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* WHATSAPP OFICIAL */}
              <Card className="rounded-[2.5rem] border-2 border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30 p-6 shadow-lg flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md">
                      <MessageSquare size={22} />
                    </div>
                    <Badge className="bg-emerald-600 text-white font-black text-[9px] uppercase px-2.5 h-6">
                      INDIVIDUAL & DÚVIDAS
                    </Badge>
                  </div>
                  <h3 className="font-black text-lg text-primary uppercase leading-tight">
                    WhatsApp Oficial
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Para agendamentos individuais, questões do cotidiano, dúvidas rápidas e
                    reagendamentos.
                  </p>
                  <div className="p-3 bg-white rounded-2xl border border-emerald-200 text-center">
                    <strong className="text-base font-black font-mono text-emerald-800">
                      (41) 98716-8938
                    </strong>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    asChild
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wider h-10 gap-1.5 shadow-md"
                  >
                    <a href="https://wa.me/5541987168938" target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} /> Abrir WhatsApp
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy("(41) 98716-8938", "WhatsApp")}
                    className="rounded-xl border-emerald-200 text-emerald-800 h-10 px-3"
                  >
                    {copiedChannel === "WhatsApp" ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </Card>

              {/* E-MAIL OFICIAL */}
              <Card className="rounded-[2.5rem] border-2 border-blue-200/80 bg-gradient-to-br from-white via-blue-50/20 to-blue-100/30 p-6 shadow-lg flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md">
                      <Mail size={22} />
                    </div>
                    <Badge className="bg-blue-600 text-white font-black text-[9px] uppercase px-2.5 h-6">
                      LOTES & COMPLEXOS
                    </Badge>
                  </div>
                  <h3 className="font-black text-lg text-primary uppercase leading-tight">
                    E-mail Oficial
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Para casos complexos, sigilosos, retorno ao trabalho e envio de planilhas de
                    agendamento em lote.
                  </p>
                  <div className="p-3 bg-white rounded-2xl border border-blue-200 text-center overflow-hidden">
                    <strong className="text-[11px] font-black font-mono text-blue-900 truncate block">
                      atendimento.grupavp@nextonsaude.com.br
                    </strong>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    asChild
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-wider h-10 gap-1.5 shadow-md"
                  >
                    <a href="mailto:atendimento.grupavp@nextonsaude.com.br">
                      <Mail size={14} /> Enviar E-mail
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy("atendimento.grupavp@nextonsaude.com.br", "E-mail")}
                    className="rounded-xl border-blue-200 text-blue-800 h-10 px-3"
                  >
                    {copiedChannel === "E-mail" ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </Card>

              {/* HORÁRIO DE ATENDIMENTO */}
              <Card className="rounded-[2.5rem] border-none bg-white p-6 shadow-lg flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-slate-100 text-primary rounded-2xl">
                      <Clock size={22} />
                    </div>
                    <Badge className="bg-slate-100 text-slate-800 font-black text-[9px] uppercase px-2.5 h-6">
                      HORÁRIO DE EXPEDIENTE
                    </Badge>
                  </div>
                  <h3 className="font-black text-lg text-primary uppercase leading-tight">
                    Horário Oficial
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Central operacional ativa de segunda a sexta para atendimento de todas as 192
                    unidades.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <strong className="text-base font-black text-primary">08:00 às 18:00</strong>
                    <span className="text-[10px] text-slate-500 block">Segunda a Sexta-feira</span>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-slate-400 font-bold text-center">
                  Solicitações fora do horário entram na fila às 08:00 do próximo dia útil.
                </div>
              </Card>

              {/* ESCALAÇÃO & RESPONSÁVEIS */}
              <Card className="rounded-[2.5rem] border-none bg-white p-6 shadow-lg flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                      <ShieldCheck size={22} />
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 font-black text-[9px] uppercase px-2.5 h-6">
                      ESCALAÇÃO
                    </Badge>
                  </div>
                  <h3 className="font-black text-lg text-primary uppercase leading-tight">
                    Gestão Operacional
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl border">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">
                        Operacional & Atendimento
                      </span>
                      <strong className="text-slate-800 font-bold">Kelly (NextCon)</strong>
                      <span className="text-[10px] text-slate-500 block">
                        Escalações de SLA e casos críticos
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">
                        Faturamento & Notas
                      </span>
                      <strong className="text-slate-800 font-bold">Erickson (NextCon)</strong>
                      <span className="text-[10px] text-slate-500 block">
                        Notas e boletos de Agosto/Setembro
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* FLUXO OPERACIONAL CENTRALIZADO SST & SLAS */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 sm:p-10 space-y-8">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                Processo Padronizado
              </span>
              <h2 className="text-2xl font-black font-headline text-primary uppercase mt-1">
                Como Funciona o Novo Fluxo SST Centralizado
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                A NextCon assume o agendamento, envio de guias ao colaborador e liberação do ASO no
                portal de admissões AVP.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-3 relative">
                <div className="size-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black font-headline text-sm shadow-md">
                  1
                </div>
                <h4 className="font-black text-sm text-primary uppercase">
                  Solicitação nos Canais
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  O coordenador/RH do Grupo AVP envia a solicitação com os{" "}
                  <strong>10 dados obrigatórios</strong> via WhatsApp ou E-mail.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-3 relative">
                <div className="size-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black font-headline text-sm shadow-md">
                  2
                </div>
                <h4 className="font-black text-sm text-primary uppercase">Confirmação em até 4h</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  A NextCon contata o colaborador diretamente via WhatsApp em até{" "}
                  <strong>4 horas úteis</strong> e envia a Guia de Encaminhamento.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-3 relative">
                <div className="size-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black font-headline text-sm shadow-md">
                  3
                </div>
                <h4 className="font-black text-sm text-primary uppercase">
                  Atendimento na Clínica
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  O colaborador comparece à clínica credenciada portando a Guia Digital gerada pela
                  NextCon.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-3 relative">
                <div className="size-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black font-headline text-sm shadow-md">
                  4
                </div>
                <h4 className="font-black text-sm text-primary uppercase">
                  ASO no Portal (24-48h)
                </h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  O ASO assinado é liberado diretamente no portal de admissões da AVP, eliminando
                  upload manual pelos coordenadores.
                </p>
              </div>
            </div>

            {/* TABELA DE SLAS */}
            <div className="p-6 rounded-3xl bg-slate-900 text-white grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Confirmação de Agendamento
                </span>
                <strong className="text-3xl font-black font-headline text-accent block">
                  Até 4 Horas Úteis
                </strong>
                <p className="text-xs text-slate-300 font-medium">
                  Contato direto com o colaborador via WhatsApp
                </p>
              </div>

              <div className="space-y-1 sm:border-x sm:border-slate-800 sm:px-6">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Exames Clínicos (ASO Simples)
                </span>
                <strong className="text-3xl font-black font-headline text-emerald-400 block">
                  24h a 48h
                </strong>
                <p className="text-xs text-slate-300 font-medium">
                  Disponível no Portal de Admissões AVP
                </p>
              </div>

              <div className="space-y-1 sm:text-right">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Exames com Complementares
                </span>
                <strong className="text-3xl font-black font-headline text-amber-300 block">
                  24h a 72h
                </strong>
                <p className="text-xs text-slate-300 font-medium">
                  Audiometria, ECG, Raio-X e Laboratoriais
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: SIMULADOR DE AGENDAMENTO (COM OS 10 CAMPOS OBRIGATÓRIOS) */}
        <TabsContent value="simulator" className="space-y-8 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 sm:p-10 space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                      FORMULÁRIO OFICIAL
                    </Badge>
                    <h3 className="text-xl font-black font-headline text-primary uppercase">
                      Solicitação Rápida de Agendamento
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                    Prepare e revise os 10 dados obrigatórios. O envio será concluído na conversa
                    com a central Nextcon.
                  </p>
                </div>

                <AvpSchedulingRequestForm />
              </Card>
            </div>

            {/* REGRAS & SAZONALIDADE */}
            <div className="space-y-6">
              <Card className="rounded-[2.5rem] bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white border border-amber-200 p-8 space-y-4">
                <div className="flex items-center gap-2 text-amber-800 font-black uppercase text-sm">
                  <Calendar size={18} /> Sazonalidade de Picos de Admissão
                </div>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  Nos meses de <strong>Janeiro, Fevereiro, Julho e Agosto</strong>, ocorre alto
                  volume de contratações. A NextCon recomenda o envio consolidado de planilhas por
                  e-mail para otimizar o fluxo de atendimento nacional.
                </p>
                <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs text-amber-900 font-bold">
                  💡 Dica: Utilize a planilha modelo disponibilizada no workshop.
                </div>
              </Card>

              <Card className="rounded-[2.5rem] bg-white p-8 shadow-lg space-y-4 border-none">
                <div className="flex items-center gap-2 text-primary font-black uppercase text-sm">
                  <ShieldCheck size={18} className="text-emerald-600" /> Indicação de Clínicas
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  As unidades podem indicar novas clínicas de preferência via e-mail. A equipe de
                  Credenciamento da NextCon realizará a avaliação técnica e documental em até 5 dias
                  úteis.
                </p>
                <span className="text-[10px] text-slate-400 font-bold block">
                  Nota: Não há lista fixa de clínicas, pois a rede é dinâmica e atualizada em tempo
                  real.
                </span>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: CHECKLIST DE PRÓXIMAS ETAPAS DO WORKSHOP */}
        <TabsContent value="workshop" className="space-y-8 focus-visible:outline-none">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 sm:p-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                  Alinhamento de Implantação
                </span>
                <h3 className="text-2xl font-black font-headline text-primary uppercase mt-1">
                  Checklist de Próximas Etapas do Workshop
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                  Acompanhamento de entregáveis entre a equipe NextCon e os coordenadores do Grupo
                  AVP
                </p>
              </div>

              <Badge className="bg-primary text-white font-black text-xs px-3.5 h-8">
                {tasks.filter((t) => t.done).length} de {tasks.length} Ações Concluídas
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    "p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-start gap-4",
                    task.done
                      ? "bg-emerald-50/40 border-emerald-200"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "size-6 rounded-xl flex items-center justify-center shrink-0 mt-0.5 font-black text-xs",
                      task.done
                        ? "bg-emerald-600 text-white"
                        : "bg-white border-2 border-slate-300 text-transparent"
                    )}
                  >
                    <Check size={14} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase px-2 h-5",
                          task.owner.includes("NEXTCON")
                            ? "bg-primary text-white"
                            : "bg-slate-800 text-white"
                        )}
                      >
                        {task.owner}
                      </Badge>
                    </div>
                    <h4
                      className={cn(
                        "text-xs font-black uppercase leading-tight",
                        task.done ? "text-emerald-950 line-through opacity-80" : "text-primary"
                      )}
                    >
                      {task.title}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {task.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
