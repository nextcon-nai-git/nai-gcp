"use client";

import * as React from "react";
import {
  Compass,
  Zap,
  ShieldCheck,
  Bot,
  Users,
  Globe,
  LayoutGrid,
  ShoppingCart,
  HeartPulse,
  Stethoscope,
  Database,
  Search,
  Scale,
  Sparkles,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  Video,
  FileText,
  Building2,
  HardHat,
  ArrowRight,
  DollarSign,
  ClipboardCheck,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * @fileOverview NAI FLOW - O Mapa Estratégico da Plataforma.
 * Detalha cada funcionalidade para usuários e novos clientes.
 */

export default function NaiFlowManual() {
  const sections = [
    {
      id: "central",
      title: "Inteligência Central",
      icon: ShieldCheck,
      description: "O coração da gestão e governança da rede.",
      items: [
        {
          title: "Dashboard NAI",
          icon: Zap,
          desc: "Visão panorâmica da operação. Aqui você enxerga os alertas urgentes, prazos de entrega e o status de conformidade global de todas as unidades.",
          features: ["Prazos de SLA", "Alertas de Vencimento", "Indicadores de Rede"],
        },
        {
          title: "Unidades (Clientes)",
          icon: Globe,
          desc: "Gerenciador Multi-tenant. Cadastre empresas e use o botão 'Lupa' para buscar dados automaticamente na Receita Federal via CNPJ.",
          features: ["Enriquecimento CNPJ", "Isolamento de Dados", "Configuração de Risco"],
        },
        {
          title: "Butler (Agente IA)",
          icon: Bot,
          desc: "Seu assistente de campo autônomo. Ele conversa com seus prestadores via WhatsApp para atualizar o progresso de tarefas sem que você precise ligar.",
          features: [
            "Follow-up Automático",
            "Atualização de Checklist",
            "Interpretação de Voz/Texto",
          ],
        },
        {
          title: "Quadro de Vidas",
          icon: Users,
          desc: "Gestão completa de funcionários. Veja quem está com ASO vencido e acesse o Prontuário Digital (PEP) protegido por sigilo médico.",
          features: ["Status de Aptidão", "PEP HIPAA Ready", "Alerta de Riscos de Saúde"],
        },
      ],
    },
    {
      id: "comercial",
      title: "Comercial & Financeiro",
      icon: DollarSign,
      description: "Transforme SST em estratégia de economia tributária.",
      items: [
        {
          title: "Propostas & Orçamentos",
          icon: ShoppingCart,
          desc: "Crie orçamentos de elite usando IA. O sistema calcula a economia potencial de RAT/FAP para convencer o cliente através do ROI.",
          features: ["Calculadora ROI", "Gerador de Escopo", "Dossiê Executivo PDF"],
        },
        {
          title: "ROI Jurídico",
          icon: Scale,
          desc: "Monitore o custo de processos trabalhistas e perícias em tempo real. Veja o quanto a gestão preventiva está economizando para a empresa.",
          features: ["Controle de Perícias", "Custo Estimado", "Histórico Jurídico"],
        },
        {
          title: "ERP Financeiro",
          icon: Database,
          desc: "Gestão de medição de contratos (especialmente para grandes clientes como CETESB). Controle horas de especialistas e rubricas técnicas.",
          features: ["Matriz de Medição", "Saldo de Contrato", "Gestão de Equipe SESMT"],
        },
      ],
    },
    {
      id: "saude",
      title: "Saúde Ocupacional",
      icon: HeartPulse,
      description: "Medicina do trabalho de alta tecnologia e telemedicina.",
      items: [
        {
          title: "Prontuário & Telemedicina",
          icon: Video,
          desc: "Realize consultas via Google Meet com suporte da IA NAI, que transcreve a conversa e sugere protocolos médicos automaticamente.",
          features: ["Meet Integrado", "Transcrição IA (SOAP)", "IoT Telemetria"],
        },
        {
          title: "Clínica (ASO Digital)",
          icon: Stethoscope,
          desc: "Gestão de fila de espera e emissão de ASOs com assinatura eletrônica ICP-Brasil. Tudo sincronizado com o eSocial S-2220.",
          features: ["Fila de Check-in", "Assinatura Digital", "Protocolo eSocial Live"],
        },
        {
          title: "Validador Forense",
          icon: FileText,
          desc: "Envie fotos de atestados e a NAI analisará pixels e metadados para detectar fraudes ou inconsistências de CRM automaticamente.",
          features: ["Detecção de Fraude", "Check de CRM", "Análise de Montagem"],
        },
      ],
    },
    {
      id: "engenharia",
      title: "Engenharia & Governança",
      icon: HardHat,
      description: "Segurança de campo e conformidade normativa rigorosa.",
      items: [
        {
          title: "Centro de Operação Next",
          icon: LayoutGrid,
          desc: "Kanban técnico para gerir PGR, PCMSO e laudos. Use as 'Sugestões NRs' para injetar planos de ação baseados na legislação atual.",
          features: ["Workflow Ágil", "Templates NR-01 a 38", "Gestão de Backlog"],
        },
        {
          title: "Inventário (PGR/EPI)",
          icon: ClipboardCheck,
          desc: "Mapeie perigos e riscos. Use o 'Quiosque Digital' para que o funcionário assine a entrega de EPI via biometria facial.",
          features: ["Matriz de Risco PxS", "Ficha de EPI Digital", "Geolocalização"],
        },
        {
          title: "Canal de Ética",
          icon: ShieldAlert,
          desc: "Portal seguro para denúncias anônimas. Garante conformidade com a ISO 37001 e proteção ao denunciante.",
          features: ["Relato Anônimo", "Chat Seguro", "Trilha de Auditoria"],
        },
      ],
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary text-accent rounded-2xl shadow-xl shadow-primary/20">
              <Compass className="size-8" />
            </div>
            <div>
              <h1 className="text-4xl font-headline font-black text-primary tracking-tighter uppercase leading-none">
                NAI FLOW
              </h1>
              <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em] mt-1">
                O Mapa de Inteligência Nextcon
              </p>
            </div>
          </div>
        </div>
        <Badge className="bg-accent text-primary h-12 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest border-none shadow-xl flex items-center gap-2">
          <Sparkles className="size-4" /> GUIA DE PRODUTIVIDADE 2026
        </Badge>
      </header>

      <div className="bg-slate-50 border border-slate-200 rounded-[3rem] p-10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
          <Zap className="size-64 text-primary" />
        </div>
        <div className="size-20 rounded-[2rem] bg-primary flex items-center justify-center text-white text-4xl font-black shadow-2xl relative z-10 shrink-0">
          N
        </div>
        <div className="space-y-3 relative z-10">
          <h2 className="text-2xl font-black text-primary uppercase font-headline">
            Bem-vindo ao Futuro da SST
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed max-w-3xl italic">
            "Este guia foi desenhado para traduzir a complexidade tecnológica da plataforma NAI em
            passos simples. Abaixo, detalhamos cada botão, pilar e fluxo para que você extraia o
            máximo de ROI da sua gestão."
          </p>
        </div>
      </div>

      <div className="space-y-20">
        {sections.map((section) => (
          <div key={section.id} className="space-y-10">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                <section.icon className="size-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-primary uppercase font-headline">
                  {section.title}
                </h2>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">
                  {section.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {section.items.map((item) => (
                <Card
                  key={item.title}
                  className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all"
                >
                  <CardHeader className="bg-slate-50/50 p-8 border-b">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                        <item.icon className="size-6" />
                      </div>
                      <CardTitle className="text-xl font-black text-primary uppercase tracking-tight">
                        {item.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {item.desc}
                    </p>
                    <div className="space-y-3 pt-4 border-t border-dashed">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        Principais Recursos:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.features.map((f) => (
                          <Badge
                            key={f}
                            variant="outline"
                            className="bg-slate-50 border-slate-100 text-slate-500 font-bold text-[9px] uppercase px-3 h-6"
                          >
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#090e24] text-white p-12 rounded-[3.5rem] relative overflow-hidden text-center shadow-2xl">
        <div className="absolute top-0 left-0 p-8 opacity-10">
          <Sparkles className="size-48 text-accent" />
        </div>
        <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
          <h3 className="text-2xl font-black uppercase font-headline">Pronto para começar?</h3>
          <p className="text-slate-400 font-medium">
            A NAI está pronta para automatizar seus processos e reduzir seus passivos. Navegue pelos
            pilares à esquerda ou peça ajuda ao Cérebro IA.
          </p>
          <div className="pt-4">
            <Button
              asChild
              className="h-16 px-12 bg-accent text-primary font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all gap-3"
            >
              <Link href="/">
                Ir para o Dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
