"use client";

import * as React from "react";
import {
  Building2,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  Stethoscope,
  Activity,
  HeartPulse,
  ShieldCheck,
  FileText,
  DollarSign,
  Users,
  Printer,
  Send,
  Mail,
  Phone,
  Award,
  Check,
  Copy,
  Download,
  ChevronRight,
  Layers,
  Smile,
  ArrowRight,
  TrendingUp,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function InfobipSipatProposalPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  const [isConfirming, setIsConfirming] = React.useState(false);
  const [isConfirmed, setIsConfirmed] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  const PROPOSAL = {
    code: "PROP-INFOBIP-SIPAT-2026",
    title: "Ações de Saúde e Segurança do Trabalho para a Semana SIPAT",
    client: {
      name: "Infobip Brasil Serviços de Tecnologia Ltda",
      shortName: "Infobip",
      city: "Curitiba / PR",
      department: "People Operations & Legal",
    },
    elaborator: {
      name: "Pablo",
      role: "Executivo Comercial",
      email: "relacionamento@nextconsaude.com.br",
      company: "NextCon Saúde Empresarial",
      address: "Rua General Mário Tourinho, 1733 — Sala 804, Curitiba/PR",
      phone: "(41) 3358-0818",
    },
    period: "Última semana de Setembro de 2026 (29/09/2026 e 30/09/2026)",
    totalHours: 11,
    totalValue: 3878.91,
    items: [
      {
        id: "palestra-1",
        name: "Técnicas de Primeiros Socorros",
        type: "Palestra",
        axis: "Segurança do Trabalho",
        facilitator: "Enfermeiro(a) do Trabalho",
        duration: "1h",
        classes: "1 turma",
        value: 756.86,
        color: "from-blue-600 to-cyan-700",
        icon: ShieldCheck,
        description:
          "Abordagem rápida e prática de RCP, desengasgo (Manobra de Heimlich), controle de hemorragias, procedimentos de emergência no ambiente de trabalho corporativo e acionamento de SAMU/Siate.",
      },
      {
        id: "palestra-2",
        name: "Saúde do Homem no Ambiente Corporativo",
        type: "Palestra",
        axis: "Saúde Física & Prevenção",
        facilitator: "Médico(a) do Trabalho",
        duration: "1h",
        classes: "1 turma",
        value: 756.86,
        color: "from-indigo-600 to-blue-800",
        icon: Stethoscope,
        description:
          "Conscientização sobre doenças cardiovasculares, rastreamento preventivo (Novembro Azul), ergonomia, saúde mental, controle de estresse e longevidade no ambiente tech.",
      },
      {
        id: "palestra-3",
        name: "Saúde da Mulher no Ambiente Corporativo",
        type: "Palestra",
        axis: "Saúde Física & Prevenção",
        facilitator: "Médica Especialista",
        duration: "1h",
        classes: "1 turma",
        value: 756.86,
        color: "from-rose-600 to-pink-700",
        icon: HeartPulse,
        description:
          "Saúde integral feminina, prevenção do câncer de mama e colo do útero (Outubro Rosa), equilíbrio hormonal, rotina de exames, bem-estar e conciliação de jornada de trabalho.",
      },
      {
        id: "quick-massage",
        name: "Quick Massage In Company — 8h divididas em 2 dias",
        type: "Atividade Prática / Bem-Estar",
        axis: "Prevenção & Alívio Tensional",
        facilitator: "Fisioterapeuta / Terapeuta Corporal",
        duration: "8h (4h dia 29/09 + 4h dia 30/09)",
        classes: "Até 40 colaboradores/dia",
        value: 1608.33,
        color: "from-emerald-600 to-teal-800",
        icon: Activity,
        description:
          "Estações de massagem terapêutica rápida na sede da Infobip no período da tarde, focando em alívio da fadiga postural, musculatura cervical, dorsal e prevenção de LER/DORT.",
      },
    ],
    differentials: [
      {
        title: "Evidência técnica documentada",
        desc: "Cada palestra é registrada com lista de presença e conteúdo programático formal, prontos para compor o acervo da CIPA e do PGR.",
      },
      {
        title: "Equipe multidisciplinar de ponta",
        desc: "Enfermagem do trabalho, medicina ocupacional e fisioterapia corporativa alinhados ao perfil dinâmico da Infobip.",
      },
      {
        title: "Flexibilidade de formato & salas",
        desc: "Cargas horárias, temas desmembrados e divisão de horários customizados conforme agenda das equipes.",
      },
      {
        title: "Porta de entrada para visão 360°",
        desc: "A mesma estrutura que conduz a SIPAT também entrega laudos ergonômicos (AEP), PCMSO, PGR e eSocial na plataforma NAI.",
      },
    ],
  };

  const handleConfirmProposal = async () => {
    setIsConfirming(true);
    try {
      if (db) {
        const proposalRef = doc(db, "proposals", "infobip_sipat_2026");
        await setDoc(
          proposalRef,
          {
            ...PROPOSAL,
            status: "APROVADA",
            confirmedAt: serverTimestamp(),
            confirmedBy: user?.email || "operacional@nextconsaude.com.br",
          },
          { merge: true }
        );

        const taskRef = doc(db, "tasks", "task_infobip_sipat_delivery");
        await setDoc(
          taskRef,
          {
            title: "Semana SIPAT Infobip 2026 - Execução 29 e 30/09",
            companyId: "INFOBIP_CURITIBA",
            companyName: "INFOBIP BRASIL SERVIÇOS DE TECNOLOGIA LTDA",
            type: "sipat",
            status: "approved",
            priority: "high",
            totalValue: PROPOSAL.totalValue,
            scheduledDates: ["2026-09-29", "2026-09-30"],
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setIsConfirmed(true);
      toast({
        title: "Proposta Confirmada!",
        description:
          "A proposta da Infobip foi formalizada e as turmas de 29 e 30/09 foram reservadas na escala.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao confirmar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24 text-slate-900">
      {/* BANNER PRINCIPAL / COVER DA PROPOSTA */}
      <div className="relative rounded-[3rem] bg-gradient-to-br from-[#00172e] via-[#002244] to-[#0a325c] text-white p-8 sm:p-12 overflow-hidden shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="size-7 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-black tracking-widest text-accent uppercase">
                  NextCon Saúde Empresarial
                </span>
                <span className="text-white/40">•</span>
                <span className="text-xs font-black tracking-widest text-orange-400 uppercase">
                  Infobip
                </span>
              </div>
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                Proposta Técnica-Comercial
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-white/10 text-white font-mono font-bold text-[10px] px-3.5 h-8 border-white/20">
              {PROPOSAL.code}
            </Badge>
            <Badge className="bg-accent text-slate-950 font-black text-[10px] px-3.5 h-8 uppercase tracking-wider">
              Semana SIPAT • Setembro/2026
            </Badge>
            {isConfirmed && (
              <Badge className="bg-emerald-500 text-slate-950 font-black text-[10px] px-3.5 h-8 uppercase tracking-wider animate-pulse">
                Proposta Aprovada
              </Badge>
            )}
          </div>
        </div>

        <div className="relative z-10 pt-10 space-y-4 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl font-black font-headline uppercase tracking-tight text-white leading-tight">
            Ações de Saúde e Segurança do Trabalho para a Semana SIPAT
          </h1>
          <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
            Preparado com exclusividade para a <strong>Infobip</strong> em Curitiba/PR. Estrutura
            integrada com 3 palestras multidisciplinares e 8 horas de Quick Massage com foco na
            promoção de saúde, engajamento e conformidade normativa.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-accent" />
              <span>
                Cliente: <strong>Infobip Brasil (Curitiba / PR)</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" />
              <span>
                Solicitante: <strong>People Operations & Legal</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-accent" />
              <span>
                Data do Evento: <strong>29 e 30/09/2026</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO EXECUTIVO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="rounded-3xl border-none shadow-md bg-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Investimento Total
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-3xl font-black font-headline text-emerald-700">
              {PROPOSAL.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              3 Palestras + 8h Quick Massage
            </p>
          </div>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Carga Horária Total
            </span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-3xl font-black font-headline text-primary">11 Horas</strong>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              3h palestras + 8h massagem
            </p>
          </div>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Capacidade Massagem
            </span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
              <Smile size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-3xl font-black font-headline text-purple-700">
              Até 80 Pessoas
            </strong>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              40 atendimentos / dia (2 dias)
            </p>
          </div>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Elaborado Por
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
              <Award size={18} />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-lg font-black font-headline text-slate-800">
              {PROPOSAL.elaborator.name}
            </strong>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              {PROPOSAL.elaborator.role} NextCon
            </p>
          </div>
        </Card>
      </div>

      {/* DETALHAMENTO DAS AÇÕES PROPOSTAS */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black font-headline text-primary uppercase">
              Escopo Técnico das Ações
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
              Palestras especializadas e intervenções práticas desenhadas para a Infobip
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary font-black uppercase text-[10px] px-3.5 h-7">
            4 Atividades Confirmadas
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROPOSAL.items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden flex flex-col justify-between hover:scale-[1.01] transition-transform"
              >
                <div>
                  <div
                    className={cn(
                      "p-6 text-white bg-gradient-to-r flex items-start justify-between gap-4",
                      item.color
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
                        <Icon size={22} className="text-white" />
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/80">
                          {item.type} • {item.axis}
                        </span>
                        <h3 className="text-lg font-black font-headline uppercase text-white leading-tight mt-0.5">
                          {item.name}
                        </h3>
                      </div>
                    </div>
                    <Badge className="bg-white text-slate-950 font-black text-xs px-3 h-7 shadow-sm shrink-0">
                      {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Badge>
                  </div>

                  <CardContent className="p-6 space-y-4">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {item.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                          Facilitador
                        </span>
                        <strong className="text-slate-800 font-bold">{item.facilitator}</strong>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                          Duração
                        </span>
                        <strong className="text-slate-800 font-bold">{item.duration}</strong>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
                        <span className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">
                          Turmas / Vagas
                        </span>
                        <strong className="text-slate-800 font-bold">{item.classes}</strong>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="px-6 pb-6 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CheckCircle2 size={14} /> Material & Certificados Inclusos
                  </span>
                  <span className="font-mono font-bold text-slate-400">#0{idx + 1}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* TABELA CONSOLIDADA DA PROPOSTA COMERCIAL */}
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black font-headline text-primary uppercase">
                Tabela de Investimento Comercial
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                Valores calculados por volume e carga horária contratada
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase text-slate-400 block">
                Investimento Global
              </span>
              <strong className="text-2xl font-black font-headline text-emerald-700">
                {PROPOSAL.totalValue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100/60">
              <TableRow className="border-b border-slate-200">
                <TableHead className="font-black text-[10px] uppercase text-slate-700 pl-8">
                  Ação Proposta
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase text-slate-700">
                  Formato
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase text-slate-700">
                  Facilitador
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase text-slate-700 text-center">
                  Carga Horária
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase text-slate-700 text-center">
                  Turmas
                </TableHead>
                <TableHead className="font-black text-[10px] uppercase text-slate-700 text-right pr-8">
                  Valor Unitário
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {PROPOSAL.items.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/70">
                  <TableCell className="pl-8 py-4 font-black text-xs text-primary uppercase">
                    {item.name}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-600">{item.type}</TableCell>
                  <TableCell className="text-xs font-bold text-slate-700">
                    {item.facilitator}
                  </TableCell>
                  <TableCell className="text-center font-bold text-xs text-slate-800">
                    {item.duration}
                  </TableCell>
                  <TableCell className="text-center font-bold text-xs text-slate-800">
                    {item.classes}
                  </TableCell>
                  <TableCell className="text-right pr-8 font-black font-headline text-sm text-slate-900">
                    {item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-emerald-50/50 font-black">
                <TableCell
                  colSpan={3}
                  className="pl-8 py-5 text-xs font-black uppercase text-emerald-950"
                >
                  Total Geral (3 Palestras + Quick Massage 8h)
                </TableCell>
                <TableCell className="text-center font-black text-sm text-emerald-900">
                  11h
                </TableCell>
                <TableCell className="text-center font-black text-xs text-emerald-900">—</TableCell>
                <TableCell className="text-right pr-8 font-black font-headline text-lg text-emerald-700">
                  {PROPOSAL.totalValue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIFERENCIAIS DA NEXTCON PARA A INFOBIP */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black font-headline text-primary uppercase">
            Diferenciais Estratégicos NextCon
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Por que as maiores empresas de tecnologia e indústria confiam na NextCon
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PROPOSAL.differentials.map((diff, index) => (
            <Card
              key={index}
              className="rounded-3xl border-none shadow-lg bg-white p-6 space-y-3 relative"
            >
              <div className="size-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black font-headline text-sm shadow-md">
                0{index + 1}
              </div>
              <h3 className="font-black text-sm text-primary uppercase leading-snug">
                {diff.title}
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{diff.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* BARRA DE AÇÃO & CONFIRMAÇÃO */}
      <Card className="rounded-[2.5rem] bg-[#001f3f] text-white p-8 sm:p-10 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-accent">
            Próximos Passos • Validação Comercial
          </span>
          <h3 className="text-2xl font-black font-headline uppercase text-white">
            Vamos formalizar a Semana SIPAT da Infobip?
          </h3>
          <p className="text-xs text-slate-300 max-w-xl font-medium">
            Clique no botão ao lado para aprovar a proposta técnica, bloquear a agenda dos
            facilitadores para os dias <strong>29 e 30/09/2026</strong> e emitir o contrato de
            prestação de serviços.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-black text-xs uppercase tracking-wider rounded-2xl h-12 px-5 gap-2"
          >
            <Printer size={16} /> Imprimir Proposta
          </Button>

          <Button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopiedLink(true);
              toast({
                title: "Link Copiado!",
                description: "Link da proposta comercial copiado para a área de transferência.",
              });
              setTimeout(() => setCopiedLink(false), 2500);
            }}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-black text-xs uppercase tracking-wider rounded-2xl h-12 px-5 gap-2"
          >
            {copiedLink ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
            {copiedLink ? "Copiado!" : "Copiar Link"}
          </Button>

          <Button
            onClick={handleConfirmProposal}
            disabled={isConfirming || isConfirmed}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl h-12 px-7 gap-2 shadow-xl hover:scale-105 transition-all"
          >
            {isConfirmed ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
            {isConfirmed ? "Proposta Formalizada" : "Aprovar & Confirmar SIPAT"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
