"use client";

import * as React from "react";
import { BotaoSalvarRelatorio } from "@/components/BotaoSalvarRelatorio";
import relatorioMock from "@/data/relatorio.json";
import {
  ClipboardCheck,
  ArrowLeft,
  Building2,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ChevronRight,
  Brain,
  Sparkles,
  ShieldPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { type AnaliseRiscoOutput } from "@/actions/sst-report-processor";

export default function PaginaRelatorio() {
  const data = relatorioMock.relatorio_visita_tecnica;
  const header = data.cabecalho;
  const [analiseIA, setAnaliseIA] = React.useState<AnaliseRiscoOutput | null>(null);
  const [protocoloId, setProtocoloId] = React.useState<string | null>(null);

  const handleSucessoIA = (id: string, analise: AnaliseRiscoOutput) => {
    setProtocoloId(id);
    setAnaliseIA(analise);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-primary -ml-2 mb-2 gap-2"
          >
            <Link href="/reports">
              <ArrowLeft className="size-4" /> Voltar aos Relatórios
            </Link>
          </Button>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Revisão de Auditoria Técnica
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
            <ClipboardCheck className="size-3 text-accent" /> Validação de dados antes do protocolo
            NAI.
          </p>
        </div>
        <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest h-10 px-4 border border-white/10 shadow-lg">
          ESTÁGIO: PRÉ-PROCESSAMENTO
        </Badge>
      </header>

      {/* RESULTADO DA IA - VISÍVEL APÓS PROCESSAMENTO */}
      {analiseIA && (
        <Card className="border-none bg-emerald-50 ring-2 ring-emerald-200 rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-500 shadow-2xl">
          <div className="flex flex-col lg:flex-row">
            <div className="p-8 lg:w-1/3 bg-emerald-600 text-white flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-xl">
                  <ShieldCheck className="size-6 text-white" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Parecer NAI Cloud</h2>
              </div>
              <p className="text-sm font-bold text-emerald-100 mb-2 font-mono">ID: {protocoloId}</p>
              <div className="mt-4 p-4 bg-black/10 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black uppercase text-white/60 mb-1">
                  Nível de Risco Identificado:
                </p>
                <Badge
                  className={cn(
                    "border-none font-black uppercase text-[10px] h-7 px-4",
                    analiseIA.nivel_risco_geral === "Crítico"
                      ? "bg-red-500 text-white"
                      : "bg-white text-emerald-700"
                  )}
                >
                  {analiseIA.nivel_risco_geral}
                </Badge>
              </div>
            </div>
            <div className="p-8 lg:flex-1 space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-black text-primary uppercase flex items-center gap-2">
                  <Brain className="size-5 text-emerald-600" /> Resumo Executivo da Auditoria
                </h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                  &quot;{analiseIA.resumo_executivo}&quot;
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-emerald-100">
                <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2">
                  <Zap className="size-3 text-accent fill-current" /> Ações Imediatas Priorizadas
                  pela IA:
                </p>
                <div className="flex flex-wrap gap-2">
                  {analiseIA.acoes_imediatas_recomendadas.map((acao, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-white border-emerald-200 text-emerald-700 text-[10px] font-bold py-2 px-4 rounded-xl shadow-sm"
                    >
                      {acao}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-primary">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    {header.empresa_atendida}
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                    CNPJ: {header.cnpj} | Tipo de Visita: {header.tipo_visita}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-slate-400" />
                  <span className="text-[10px] font-bold text-primary uppercase">
                    Início: {new Date(header.datas_visita[0]).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-slate-400" />
                  <span className="text-[10px] font-bold text-primary uppercase">
                    Consultor: {header.consultor_responsavel}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Unidades em Vistoria
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {header.enderecos.map((end: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100"
                    >
                      <ChevronRight className="size-3 text-accent mt-0.5" />
                      <p className="text-xs font-medium text-slate-600 leading-tight">{end}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2">
              <AlertTriangle className="size-3 text-red-500" /> Itens de Não Conformidade Detectados
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {data.nao_conformidades.map((inspecao: any, i: number) => (
                <div
                  key={i}
                  className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-primary/10 transition-all flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "p-3 rounded-2xl text-white shadow-lg",
                        inspecao.prioridade === "Alta"
                          ? "bg-red-600 shadow-red-600/10"
                          : "bg-amber-500 shadow-amber-500/10"
                      )}
                    >
                      <AlertTriangle className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[8px] font-black uppercase border-primary/10 text-primary/60"
                        >
                          NR-{inspecao.nr_relacionada}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-[8px] font-black uppercase border-none px-2 h-4",
                            inspecao.prioridade === "Alta"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          Prioridade {inspecao.prioridade}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-bold text-primary uppercase leading-tight">
                        {inspecao.descricao}
                      </h4>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-200 group-hover:text-primary transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Zap className="size-32 text-accent" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent rounded-xl text-primary shadow-lg shadow-accent/20">
                  <Sparkles className="size-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-accent">
                  Inteligência de Rede
                </h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-white/60 leading-relaxed font-medium">
                  Acione a NAI para cruzar estes dados com a legislação 2026 e protocolar o plano de
                  ação automaticamente no Firestore.
                </p>
              </div>

              <div className="pt-6 border-t border-white/10">
                <BotaoSalvarRelatorio relatorioDados={relatorioMock} onSuccess={handleSucessoIA} />
              </div>
            </div>
          </Card>

          <Card className="card-shadow border-none bg-blue-50 border border-blue-100 rounded-[2.5rem] p-8 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg text-white shadow-sm">
                <ShieldPlus className="size-4" />
              </div>
              <h4 className="text-sm font-black text-primary uppercase">Selo de Auditoria</h4>
            </div>
            <p className="text-[10px] text-primary/70 leading-relaxed font-bold italic uppercase tracking-tighter">
              &quot;Validado conforme protocolos de governança Nextcon v2.6.&quot;
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
