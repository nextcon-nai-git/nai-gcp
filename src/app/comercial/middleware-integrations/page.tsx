"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Sparkles,
  CheckCircle2,
  Database,
  Cpu,
  Network,
  FileText,
  Users,
  Stethoscope,
  MessageSquare,
  Bot,
  ShieldCheck,
  DollarSign,
  Printer,
  Copy,
  Check,
  ArrowRight,
  Layers,
  Workflow,
  Zap,
  BarChart3,
  TrendingUp,
  Share2,
  Lock,
  Globe,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function MiddlewareIntegrationsProposalPage() {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [selectedIntegrators, setSelectedIntegrators] = React.useState<string[]>([
    "employees",
    "medical_leaves",
    "exam_results_aso",
  ]);

  const ALL_INTEGRATORS = [
    {
      id: "employees",
      name: "Funcionários & Hierarquias",
      flow: "TOTVS RM / Senior / Sankhya ➔ NAI",
      desc: "Atualização automática de Unidade, Setor, Cargo e GHE sem intervenção manual.",
      price: 175.0,
    },
    {
      id: "medical_leaves",
      name: "Licenças Médicas & Atestados",
      flow: "NAI ➔ TOTVS RM / Senior / Sankhya",
      desc: "Atestados, dias de afastamento e CID-10 lançados na folha de pagamento automaticamente.",
      price: 175.0,
    },
    {
      id: "exam_results_aso",
      name: "Resultados de Exames e ASO",
      flow: "NAI ➔ TOTVS RM / Senior / Sankhya",
      desc: "Resultados de exames clínicos, complementares e ASO inseridos para eSocial S-2220.",
      price: 175.0,
    },
    {
      id: "auto_kit",
      name: "Geração de Kit Automatizada",
      flow: "NAI Hub ➔ Clínicas Credenciadas",
      desc: "Ao solicitar exame, gera ficha clínica digital, guia de encaminhamento e ASO.",
      price: 175.0,
    },
    {
      id: "nai_ged",
      name: "Envio NAI-GED (Gestão Eletrônica)",
      flow: "NAI Cloud ➔ Repositório Digital",
      desc: "Upload automático de laudos assinados com ICP-Brasil e indexação por CPF.",
      price: 175.0,
    },
    {
      id: "whatsapp_bot",
      name: "Mensagerias & Alertas WhatsApp",
      flow: "NAI Bot ➔ Trabalhadores & RH",
      desc: "Disparo automático de convocações de exames e envio de ASO digital via WhatsApp.",
      price: 175.0,
    },
  ];

  const toggleIntegrator = (id: string) => {
    setSelectedIntegrators((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // mínimo 1
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const basePrice = selectedIntegrators.length * 175.0;
  const taxRate = 0.0865; // 8,65%
  const taxValue = basePrice * taxRate;
  const totalPriceWithTaxes = basePrice + taxValue;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24 text-slate-900">
      {/* CAPA DA APRESENTAÇÃO / PROPOSTA */}
      <div className="relative rounded-[3rem] bg-gradient-to-br from-[#00172e] via-[#002244] to-[#0a325c] text-white p-8 sm:p-12 overflow-hidden shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="size-7 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-widest text-accent uppercase">
                  NextCon
                </span>
                <span className="text-white/40">•</span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                  Transformando dados em estratégia
                </span>
              </div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Proposta Técnica & Comercial de Integração
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-white/10 text-white font-mono font-bold text-[10px] px-3.5 h-8 border-white/20">
              PROP-NEXTCON-MIDDLEWARE-2026
            </Badge>
            <Badge className="bg-accent text-slate-950 font-black text-[10px] px-3.5 h-8 uppercase tracking-wider">
              Setup R$ 0,00 (Grátis)
            </Badge>
          </div>
        </div>

        <div className="relative z-10 pt-10 space-y-4 max-w-3xl">
          <h1 className="text-3xl sm:text-5xl font-black font-headline uppercase tracking-tight text-white leading-tight">
            Sua Solução para Decisões Estratégicas: Middleware NAI × ERPs de RH
          </h1>
          <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
            A <strong>NextCon</strong> oferece uma plataforma inteligente que centraliza, processa e
            analisa seus dados, facilitando o gerenciamento da informação e auxiliando na tomada de
            decisões estratégicas através da integração bidirecional do ecossistema{" "}
            <strong>NAI</strong> com{" "}
            <strong>TOTVS RM, TOTVS Protheus, Senior Sistemas, Sankhya, SAP HCM</strong> e outros.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-accent" />
              <span>
                Plataforma: <strong>NextCon Intelligence (NAI Hub)</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Network className="size-4 text-accent" />
              <span>
                Compatibilidade: <strong>TOTVS, Senior, Sankhya, SAP & Webhooks</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" />
              <span>
                Conformidade: <strong>eSocial S-2210, S-2220 e S-2240</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* OS 6 PILARES ESTRATÉGICOS DA NEXTCON */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black font-headline text-primary uppercase">
            Transformando Dados em Inteligência Estratégica
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Arquitetura moderna dividida em 6 frentes de alto desempenho operacional
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-7 space-y-3 hover:scale-[1.01] transition-transform">
            <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              <Database size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">Engenharia de Dados</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Processamento avançado e limpeza de dados para garantir informações confiáveis, sem
              duplicidade de CPFs ou inconsistências de cargos e setores.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-7 space-y-3 hover:scale-[1.01] transition-transform">
            <div className="size-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
              <BarChart3 size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">Dashboards BI</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Visualizações personalizadas e interativas que transformam dados brutos de saúde
              ocupacional e frequência em insights acionáveis para o C-Level.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-7 space-y-3 hover:scale-[1.01] transition-transform">
            <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <Network size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">Integração de Sistemas</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Conexão automatizada entre diferentes plataformas, bancos de dados, ERPs de folha de
              pagamento e o ecossistema NAI.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-7 space-y-3 hover:scale-[1.01] transition-transform">
            <div className="size-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-black">
              <Zap size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">
              IA — Inteligência Artificial NAI
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Inteligência artificial no processamento de dados para identificar padrões de
              absenteísmo, prever cenários de FAP/RAT e gerar insights mais rápidos e precisos.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-7 space-y-3 hover:scale-[1.01] transition-transform">
            <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <Bot size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">
              RPA (Automação Robótica)
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Robôs personalizados extraem dados de sistemas, APIs ou portais web, executam rotinas
              operacionais repetitivas e alimentam automaticamente os dashboards da empresa.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-7 space-y-3 hover:scale-[1.01] transition-transform">
            <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
              <MessageSquare size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">
              Mensagerias (WhatsApp NAI Bot)
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Automatize mensagens e alertas com base em regras dos dashboards e envie comunicações
              diretamente para clientes ou equipes via WhatsApp, acionadas por eventos e dados.
            </p>
          </Card>
        </div>
      </div>

      {/* INTRODUÇÃO: DA COMPLEXIDADE AOS ATIVOS ESTRATÉGICOS */}
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 sm:p-10 space-y-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-accent">
            Visão Estratégica
          </span>
          <h2 className="text-2xl font-black font-headline text-primary uppercase mt-1">
            Introdução: Da Complexidade aos Ativos Estratégicos
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 bg-rose-50/60 rounded-3xl border border-rose-100 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-black uppercase text-sm">
              <ShieldCheck size={18} /> O Desafio do Mercado
            </div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Organizações de Medicina e Segurança do Trabalho enfrentam crescentes demandas de
              conformidade legal e gestão de dados complexos. A integração manual de informações
              entre múltiplos sistemas consome tempo valioso, gera retrabalho constante e eleva
              drasticamente o risco de multas no eSocial.
            </p>
          </div>

          <div className="p-6 bg-emerald-50/60 rounded-3xl border border-emerald-100 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-black uppercase text-sm">
              <CheckCircle2 size={18} /> A Nossa Solução NextCon
            </div>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              A <strong>NextCon</strong> propõe uma solução completa que une nossa plataforma de
              Business Intelligence e Inteligência Artificial à expertise em engenharia de software,
              com foco especial na sustentação contínua de integrações entre o{" "}
              <strong>ecossistema NAI</strong> e os principais ERPs do mercado.
            </p>
          </div>
        </div>
      </Card>

      {/* INTEGRAÇÕES INTELIGENTES: MIDDLEWARE NAI */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black font-headline text-primary uppercase">
            Integrações Inteligentes: Middleware NAI
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            A NextCon atua na sustentação de integrações que eliminam o retrabalho manual. Temos
            experiência consolidada com Sankhya, Totvs, Senior, NAI e outros diversos softwares de
            mercado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="rounded-3xl border-none shadow-lg bg-white p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-primary uppercase">
                Funcionários e Hierarquias
              </h3>
              <Badge className="bg-blue-100 text-blue-800 font-black text-[9px]">ERP ➔ NAI</Badge>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Atualização automática de Unidade, Setor e Cargo sem intervenção manual, mantendo a
              estrutura de GHE e riscos ocupacionais 100% sincronizada.
            </p>
          </Card>

          <Card className="rounded-3xl border-none shadow-lg bg-white p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-primary uppercase">
                Lançamento de Resultados, ASO e Ficha Clínica
              </h3>
              <Badge className="bg-emerald-100 text-emerald-800 font-black text-[9px]">
                NAI ➔ ERP
              </Badge>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Resultados de Exames e ASO inseridos automaticamente via integração direta,
              alimentando prontamente o evento eSocial S-2220.
            </p>
          </Card>

          <Card className="rounded-3xl border-none shadow-lg bg-white p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-primary uppercase">
                Geração de Kit Automatizada
              </h3>
              <Badge className="bg-amber-100 text-amber-800 font-black text-[9px]">
                AUTOMATIZADO
              </Badge>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Ao solicitar o exame no sistema, a plataforma gera a ficha clínica, guia de
              encaminhamento e ASO para preenchimento ou envio imediato ao colaborador.
            </p>
          </Card>

          <Card className="rounded-3xl border-none shadow-lg bg-white p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-primary uppercase">Envio NAI-GED</h3>
              <Badge className="bg-cyan-100 text-cyan-800 font-black text-[9px]">
                GESTOR DE LAUDOS
              </Badge>
            </div>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Automação no upload de documentos, laudos PGR/PCMSO e prontuários médicos assinados
              para o módulo de gestão eletrônica segura.
            </p>
          </Card>
        </div>
      </div>

      {/* MODELO DE INVESTIMENTO */}
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-accent">
                Transparência Comercial
              </span>
              <CardTitle className="text-2xl font-black font-headline text-primary uppercase mt-1">
                Modelo de Investimento
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                Selecione os integradores para simular a mensalidade da sua operação
              </CardDescription>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-right">
              <span className="text-[9px] font-black uppercase text-emerald-800 block">
                Custo de Implantação
              </span>
              <strong className="text-lg font-black font-headline text-emerald-700">
                Custo Zero (R$ 0,00) Setup
              </strong>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 sm:p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ALL_INTEGRATORS.map((integ) => {
              const isSelected = selectedIntegrators.includes(integ.id);
              return (
                <div
                  key={integ.id}
                  onClick={() => toggleIntegrator(integ.id)}
                  className={cn(
                    "p-5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-slate-200 bg-white hover:border-slate-300 opacity-70"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">
                        {integ.flow}
                      </span>
                      <div
                        className={cn(
                          "size-5 rounded-full flex items-center justify-center text-white",
                          isSelected ? "bg-primary" : "bg-slate-200"
                        )}
                      >
                        <Check size={12} />
                      </div>
                    </div>
                    <h4 className="font-black text-sm text-primary uppercase leading-snug">
                      {integ.name}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium">{integ.desc}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Mensalidade
                    </span>
                    <strong className="text-sm font-black text-primary">R$ 175,00/mês</strong>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAINEL DE VALORES FINAIS */}
          <div className="p-8 rounded-3xl bg-slate-900 text-white grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Mensalidade por Integrador
              </span>
              <strong className="text-3xl font-black font-headline text-accent block">
                R$ 175,00
              </strong>
              <p className="text-[10px] text-slate-400">Preço base líquido mensal</p>
              <p className="text-[10px] text-slate-400">R$ 190,13* com impostos (8,65%)</p>
            </div>

            <div className="space-y-1 sm:border-x sm:border-slate-800 sm:px-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Integradores Selecionados
              </span>
              <strong className="text-3xl font-black font-headline text-white block">
                {selectedIntegrators.length} de 6
              </strong>
              <p className="text-[10px] text-slate-300 font-medium">
                {selectedIntegrators.length === 3
                  ? "Pacote Standard (3 integradores)"
                  : "Configuração Customizada"}
              </p>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Mensalidade Final Calculada
              </span>
              <strong className="text-4xl font-black font-headline text-emerald-400 block">
                {basePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
              <p className="text-xs text-slate-300 font-bold">
                Preço com impostos (Nota Fiscal):{" "}
                {totalPriceWithTaxes.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                *
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GANHOS ESTRATÉGICOS */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-black font-headline text-primary uppercase">
            Ganhos Estratégicos Comprovados
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
            Impacto direto no compliance, eficiência e redução de custos da sua organização
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-3">
            <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              <FileText size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">Conformidade Total</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Visão clara do eSocial e normas regulamentadoras, garantindo total conformidade legal
              e reduzindo riscos de multas e penalidades governamentais.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-3">
            <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <DollarSign size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">Redução de Custos</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Automação de processos que hoje dependem de digitação manual, liberando equipes para
              atividades estratégicas de maior valor agregado.
            </p>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-3">
            <div className="size-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
              <BarChart3 size={22} />
            </div>
            <h3 className="font-black text-base text-primary uppercase">
              Decisão Baseada em Dados
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Dashboards atualizados que permitem uma gestão proativa da saúde ocupacional com
              indicadores em tempo real para a diretoria.
            </p>
          </Card>
        </div>
      </div>

      {/* FOOTER & AÇÕES */}
      <Card className="rounded-[2.5rem] bg-[#001f3f] text-white p-8 sm:p-10 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-accent">
            NextCon Inteligência & Integrações
          </span>
          <h3 className="text-2xl font-black font-headline uppercase text-white">
            Pronto para conectar seu ERP ao NAI?
          </h3>
          <p className="text-xs text-slate-300 max-w-xl font-medium">
            Ative hoje mesmo os integradores com suporte N2 dedicado da equipe NextCon e taxa zero
            de implantação.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-black text-xs uppercase tracking-wider rounded-2xl h-12 px-5 gap-2"
          >
            <Printer size={16} /> Imprimir Apresentação
          </Button>

          <Link href="/integrations">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl h-12 px-7 gap-2 shadow-xl hover:scale-105 transition-all">
              <Network size={16} /> Abrir Painel de Conectores NAI
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
