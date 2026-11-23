"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Clock,
  Mail,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GrupoAvpAsoManager } from "@/components/clients/grupo-avp-aso-manager";
import { GrupoAvpCredenciamentoHub } from "@/components/clients/grupo-avp-credenciamento-hub";

import { AvpEvidencePanel } from "@/components/clients/avp-evidence-panel";
import { AvpWorkflowPanel } from "@/components/clients/avp-workflow-panel";
import { AvpPeriodicControlPanel } from "@/components/clients/avp-periodic-control";
import { useUser } from "@/firebase";
import {
  avpQueueExamTypes,
  countAvpQueueExams,
  type AvpCampaignCount,
} from "@/lib/avp-queue-exam-counts";
import { canAccessAvpEvidence } from "@/lib/auth/avp-access";

const formatCount = new Intl.NumberFormat("pt-BR");

export default function GrupoAvpClientHubPage() {
  const session = useUser();
  const canSeeEvidence = !!session.user && canAccessAvpEvidence(session);
  const { toast } = useToast();
  const [copiedChannel, setCopiedChannel] = React.useState<string | null>(null);

  const [asoView, setAsoView] = React.useState("fila");
  const currentView = canSeeEvidence ? asoView : "fila";
  const [queueSummary, setQueueSummary] = React.useState(() => ({
    exams: countAvpQueueExams([]),
    campaign: null as AvpCampaignCount | null,
    available: false,
    total: 0,
    urgentes: 0,
    cidades: 0,
    concluidos: 0,
  }));

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
      <div className="relative rounded-[3rem] bg-linear-to-br from-[#00172e] via-[#002244] to-[#0a325c] text-white p-8 sm:p-12 overflow-hidden shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <Image
              src="/clients/grupo-avp.png"
              alt="Aqui Você Pode"
              width={64}
              height={64}
              unoptimized
              className="size-14 shrink-0 rounded-xl bg-white p-1 sm:size-16"
            />
            <div>
              <h1 className="text-2xl sm:text-4xl font-black font-headline uppercase tracking-tight text-white mt-1">
                Grupo AVP
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/financial/monthly-billing?group=GRUPO_AVP"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
            >
              CNPJs e faturamento mensal
            </Link>
            <details className="text-sm text-slate-200">
              <summary className="cursor-pointer">Dados da operação</summary>
              <p className="mt-2">Cliente nacional · ID GRUPO_AVP</p>
              <p>Operação ativa desde 01/09/2026</p>
            </details>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="relative z-10 pt-8 grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Capilaridade
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-accent">
              {queueSummary.available ? queueSummary.cidades : "—"} Municípios na fila
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">
              Cidades com solicitações importadas
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Exames concluídos
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-white">
              {queueSummary.available ? queueSummary.concluidos : "—"} Exames feitos
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">
              Conforme o status da fila
            </span>
          </div>

          <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-emerald-500/10 backdrop-blur-xs border border-emerald-400/30">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 block">
              Fila de ASOs
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-emerald-400">
              {queueSummary.available ? formatCount.format(queueSummary.exams.total) : "—"}{" "}
              {queueSummary.available && queueSummary.exams.total === 1 ? "ASO" : "ASOs"}
            </strong>
            {queueSummary.available && (
              <p className="text-xs text-emerald-200">
                {queueSummary.campaign
                  ? "Fila e campanha de periódicos"
                  : "Parcial da fila · campanha indisponível"}
              </p>
            )}
            <dl
              aria-label="ASOs por tipo de exame"
              className="mt-2 space-y-1 text-xs text-emerald-100"
            >
              {avpQueueExamTypes.map(([type, label]) => (
                <div key={type} className="flex items-baseline justify-between gap-2">
                  <dt>{label}</dt>
                  <dd className="font-semibold tabular-nums">
                    {queueSummary.available
                      ? formatCount.format(queueSummary.exams.byType[type])
                      : "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {queueSummary.available && !!queueSummary.campaign?.pending && (
              <p className="mt-2 text-xs text-amber-200">
                Registros da campanha a conciliar ·{" "}
                {formatCount.format(queueSummary.campaign.pending)}
              </p>
            )}
            {queueSummary.available && queueSummary.exams.excluded > 0 && (
              <p className="mt-2 border-t border-emerald-400/30 pt-2 text-xs text-slate-300">
                {formatCount.format(queueSummary.exams.excluded)} fora do total · outros tipos ou
                sem classificação
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              SLA Confirmação
            </span>
            <strong className="text-xl sm:text-2xl font-black font-headline text-emerald-400">
              Até 4h Úteis
            </strong>
            <span className="text-[9px] text-slate-300 block mt-0.5">Direto com Colaborador</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-xs border border-white/10">
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
          <TabsList className="w-full min-w-0 justify-start bg-slate-100 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1">
            <TabsTrigger value="asos" className="gap-2 rounded-lg px-3 py-2 text-sm font-medium">
              <FileSpreadsheet size={15} /> ASOs
            </TabsTrigger>
            <TabsTrigger
              value="credenciamento"
              className="gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            >
              <Building2 size={15} /> Credenciamentos
            </TabsTrigger>

            <TabsTrigger
              value="channels"
              className="gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            >
              <MessageSquare size={15} /> Canais e diretrizes
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: GESTÃO DE ASOS */}
        <TabsContent
          value="asos"
          className="space-y-6 focus-visible:outline-hidden data-[state=inactive]:hidden"
        >
          {canSeeEvidence && (
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
              Atividade de ASOs
              <select
                value={currentView}
                onChange={(event) => setAsoView(event.target.value)}
                className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="fila">Fila de ASOs</option>
                <option value="periodicos">Periódicos e rede AVP</option>
                <option value="workflow">Esteira de ASOs</option>
                <option value="payments">Pagamentos às clínicas</option>
                <option value="documents">ASOs recebidos</option>
              </select>
            </label>
          )}
          {currentView === "fila" && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-primary">Fila nacional de ASOs</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {queueSummary.available ? queueSummary.total : "—"} solicitações na fila importada
                  {" · "}
                  {queueSummary.available ? queueSummary.urgentes : "—"} urgentes em aberto
                </p>
              </div>
              <GrupoAvpAsoManager onQueueSummaryChange={setQueueSummary} />
            </>
          )}
          {currentView === "periodicos" && (
            <AvpPeriodicControlPanel onOpenCosts={() => setAsoView("fila")} />
          )}
          {currentView === "workflow" && <AvpWorkflowPanel />}
          {currentView === "payments" && <AvpEvidencePanel kind="payment" />}
          {currentView === "documents" && <AvpEvidencePanel kind="aso" />}
        </TabsContent>

        {/* TAB 1.5: CENTRAL NACIONAL DE CREDENCIAMENTO BRASIL (WHATSAPP 1-CLIQUE) */}
        <TabsContent value="credenciamento" className="space-y-6 focus-visible:outline-hidden">
          <GrupoAvpCredenciamentoHub />
        </TabsContent>

        {/* TAB 2: CANAIS E DIRETRIZES */}
        <TabsContent value="channels" className="space-y-10 focus-visible:outline-hidden">
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
              <Card className="rounded-[2.5rem] border-2 border-emerald-200/80 bg-linear-to-br from-white via-emerald-50/20 to-emerald-100/30 p-6 shadow-lg flex flex-col justify-between space-y-4">
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
              <Card className="rounded-[2.5rem] border-2 border-blue-200/80 bg-linear-to-br from-white via-blue-50/20 to-blue-100/30 p-6 shadow-lg flex flex-col justify-between space-y-4">
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
                      atendimento.grupavp@nextconsaude.com.br
                    </strong>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    asChild
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-wider h-10 gap-1.5 shadow-md"
                  >
                    <a href="mailto:atendimento.grupavp@nextconsaude.com.br">
                      <Mail size={14} /> Enviar E-mail
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy("atendimento.grupavp@nextconsaude.com.br", "E-mail")}
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
      </Tabs>
    </div>
  );
}
