"use client";

import * as React from "react";
import {
  ClipboardCheck,
  FileText,
  MapPin,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  HardHat,
  Hammer,
  Construction,
  ChevronRight,
  ArrowLeft,
  Info,
  BadgeAlert,
  Zap,
  PenTool,
  Printer,
  Download,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function NativaTechnicalVisitReport() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      {/* Botões de Ação e Navegação */}
      <div className="flex justify-between items-center print:hidden">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-primary gap-2"
        >
          <Link href="/reports">
            <ArrowLeft className="size-4" /> Voltar aos Relatórios
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10 px-6 rounded-xl font-black uppercase text-[10px] gap-2 border-primary text-primary"
            onClick={() => window.print()}
          >
            <Printer className="size-4" /> Imprimir
          </Button>
          <Button className="gradient-nextcon text-white h-10 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl gap-2">
            <Download className="size-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Cabeçalho do Relatório */}
      <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <div className="p-12 bg-[#001F3F] text-white relative">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Construction className="size-48 text-accent" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                <ClipboardCheck className="size-8 text-accent" />
              </div>
              <div>
                <h1 className="text-4xl font-headline font-black uppercase tracking-tighter leading-none">
                  Relatório de Visita Técnica
                </h1>
                <p className="text-white/60 font-bold uppercase text-xs tracking-widest mt-2">
                  NextconSST - Consultoria em Segurança do Trabalho
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-6 border-t border-white/10">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Empresa Atendida
                </p>
                <p className="text-sm font-bold uppercase">Nativa Empreendimentos</p>
                <p className="text-[10px] font-mono text-white/60">CNPJ: 51.633.820/0001-51</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Responsável (Engenheiro)
                </p>
                <p className="text-sm font-bold uppercase">Cassio Vinicius</p>
                <p className="text-[10px] font-medium text-white/60">Telefone: 41 9 9666-2019</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Consultor Responsável
                </p>
                <p className="text-sm font-bold uppercase">Lucas Nextcon</p>
                <Badge className="bg-accent text-primary font-black uppercase text-[8px] h-5">
                  Visita Inicial
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-12 space-y-12">
          {/* Seção 1: Objetivos */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
              1. Objetivo da Visita
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl border shadow-inner space-y-3">
                <div className="flex items-center gap-3 text-primary font-bold text-sm uppercase">
                  <ShieldCheck className="size-5 text-accent" /> Inspeção de Segurança
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "Identificar riscos e sugerir ações corretivas e preventivas para as unidades
                  Laguna e Mônaco."
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border shadow-inner space-y-3">
                <div className="flex items-center gap-3 text-primary font-bold text-sm uppercase">
                  <FileText className="size-5 text-accent" /> Auditoria Documental
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "Verificação de fichas de EPI e cronogramas de treinamento obrigatórios (NR-01,
                  06, 18, 35)."
                </p>
              </div>
            </div>
          </section>

          {/* Seção 2: Não Conformidades */}
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
                2. Não Conformidades Identificadas
              </h2>
              <Badge className="bg-red-600 text-white font-black text-[10px] uppercase px-4 h-8 flex items-center gap-2">
                <AlertTriangle className="size-3" /> 08 Pontos Críticos
              </Badge>
            </div>

            <div className="border rounded-3xl overflow-hidden shadow-sm bg-white">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-12 text-center text-[9px] font-black uppercase">
                      #
                    </TableHead>
                    <TableHead className="text-[9px] font-black uppercase">
                      Descrição da Irregularidade
                    </TableHead>
                    <TableHead className="text-[9px] font-black uppercase">NR</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-center">
                      Prioridade
                    </TableHead>
                    <TableHead className="text-[9px] font-black uppercase pr-8">
                      Recomendação Técnica
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    {
                      id: 1,
                      desc: "Ausência de linha de vida complementar no último andar",
                      nr: "35",
                      risk: "Grave",
                      prio: "Alta",
                      rec: "Implementar linha de vida complementar imediatamente.",
                    },
                    {
                      id: 2,
                      desc: "Ausência de parapeito e redes de proteção danificadas",
                      nr: "18/35",
                      risk: "Grave",
                      prio: "Alta",
                      rec: "Instalar/adequar redes e colocar sinalização de advertência.",
                    },
                    {
                      id: 3,
                      desc: "Diversos buracos nas lajes entre os andares",
                      nr: "18",
                      risk: "Médio",
                      prio: "Média",
                      rec: "Colocar tampas com angulação de 45° para evitar tropeços.",
                    },
                    {
                      id: 4,
                      desc: "Serras circulares em não conformidade (Laguna e Mônaco)",
                      nr: "12/18",
                      risk: "Grave",
                      prio: "Alta",
                      rec: "Adequação imediata conforme Anexo I (NR-12).",
                    },
                    {
                      id: 5,
                      desc: "Serra com peça quebrada no estacionamento",
                      nr: "12/18",
                      risk: "Grave",
                      prio: "Alta",
                      rec: "Realizar a troca da peça danificada e enclausuramento.",
                    },
                    {
                      id: 6,
                      desc: "Ausência de proteção no poço de lavagem de carrinhos",
                      nr: "18",
                      risk: "Médio",
                      prio: "Médio",
                      rec: "Instalar proteção física no perímetro do poço.",
                    },
                    {
                      id: 7,
                      desc: "Ausência de proteção entre o prédio e as bandejas",
                      nr: "18",
                      risk: "Médio",
                      prio: "Médio",
                      rec: "Instalar proteção complementar nas bandejas de proteção.",
                    },
                    {
                      id: 8,
                      desc: "Pessoas com vestimentas inapropriadas pela obra",
                      nr: "6",
                      risk: "Médio",
                      prio: "Médio",
                      rec: "Fornecer orientações e EPIs para visitantes.",
                    },
                  ].map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-center font-black text-slate-400 text-xs">
                        {item.id}
                      </TableCell>
                      <TableCell className="py-5">
                        <p className="font-bold text-primary text-xs leading-tight">{item.desc}</p>
                        <p className="text-[9px] text-red-600 font-bold uppercase mt-1">
                          Consequência: Risco de Queda / Amputação
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black border-primary/10"
                        >
                          NR-{item.nr}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-[8px] font-black uppercase border-none px-3 h-5",
                            item.prio === "Alta"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {item.prio}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8">
                        <p className="text-[10px] text-slate-600 italic font-medium leading-relaxed">
                          "{item.rec}"
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Seção 3: Treinamentos */}
          <section className="space-y-6">
            <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
              3. Treinamentos Obrigatórios 2026
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: "NR-01 - Integração PGR",
                  app: "Admissão / Início Obra",
                  valid: "Por obra",
                  type: "Inicial",
                },
                {
                  title: "NR-35 - Trabalho em Altura",
                  app: "Colaboradores em Lajes",
                  valid: "2 anos",
                  type: "Crítico",
                },
                {
                  title: "NR-12 - Operação de Serras",
                  app: "Carpinteiros / Operadores",
                  valid: "Anual",
                  type: "Específico",
                },
                {
                  title: "NR-18 - Construção Civil",
                  app: "Todos os colaboradores",
                  valid: "Anual",
                  type: "Setorial",
                },
              ].map((trn) => (
                <div
                  key={trn.title}
                  className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-4 hover:border-primary/20 transition-all"
                >
                  <div className="p-3 bg-primary/5 rounded-2xl text-primary">
                    <HardHat className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-xs font-black text-primary uppercase">{trn.title}</h4>
                      <Badge
                        variant="outline"
                        className="text-[8px] font-black text-slate-400 uppercase"
                      >
                        {trn.type}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Aplicação: {trn.app} | Validade: {trn.valid}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Seção 4: Próximos Passos */}
          <section className="bg-[#090e24] text-white p-10 rounded-[3rem] relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Zap className="size-32 text-accent" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent rounded-xl text-primary shadow-lg shadow-accent/20">
                  <Zap className="size-5" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  Plano de Ação Imediato
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Implementar as proteções coletivas (Linha de vida e Parapeitos) em até 48h.",
                  "Retirar de operação as serras circulares não conformes até a devida adequação NR-12.",
                  "Padronizar a entrega de EPIs para 100% dos colaboradores e visitantes.",
                  "Agendar reciclagem NR-35 para os colaboradores com certificados vencidos.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-4 items-start text-sm font-medium text-slate-300">
                    <span className="size-6 bg-white/10 rounded-full flex items-center justify-center text-accent font-black text-xs shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Assinaturas */}
          <section className="pt-12 border-t border-dashed">
            <div className="flex flex-col md:flex-row justify-around gap-12 text-center">
              <div className="space-y-4">
                <div className="w-64 border-b-2 border-slate-200 mx-auto py-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase italic">
                    Assinado Digitalmente via NAI
                  </span>
                </div>
                <div>
                  <p className="font-black text-primary uppercase text-sm">Lucas Nextcon</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Consultor de Segurança do Trabalho
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="w-64 border-b-2 border-slate-200 mx-auto py-4"></div>
                <div>
                  <p className="font-black text-primary uppercase text-sm">Cassio Vinicius</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Engenheiro Civil - Nativa Empreendimentos
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Anexo I: NR-12 Detalhada */}
          <section className="space-y-6 pt-12 border-t">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="h-8 px-4 border-red-200 text-red-600 bg-red-50 font-black uppercase text-[10px]"
              >
                ANEXO I
              </Badge>
              <h2 className="text-xl font-black text-primary uppercase">
                Recomendações NR-12 (Serra Circular)
              </h2>
            </div>
            <Card className="border-2 border-red-100 shadow-none rounded-[2rem] bg-white overflow-hidden">
              <CardHeader className="bg-red-50 p-8 border-b border-red-100">
                <CardTitle className="text-sm font-black uppercase text-red-700 flex items-center gap-2">
                  <AlertTriangle className="size-4" /> Diagnóstico de Risco Elevado
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      Principais Falhas (Não Atende)
                    </h4>
                    {[
                      {
                        item: "Zona de Corte",
                        desc: "Disco exposto sem coifa superior e cutelo divisor.",
                        ref: "12.38 / 12.55",
                      },
                      {
                        item: "Transmissão",
                        desc: "Correias e polias inferiores totalmente expostas.",
                        ref: "12.38",
                      },
                      {
                        item: "Sistema Elétrico",
                        desc: "Painel improvisado, fiação aparente e sem proteção contra religamento.",
                        ref: "12.56 / 12.71",
                      },
                    ].map((f, i) => (
                      <div key={i} className="flex gap-3">
                        <XCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-primary">{f.item}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{f.desc}</p>
                          <Badge
                            variant="secondary"
                            className="text-[8px] p-0 font-mono text-red-400 uppercase bg-transparent hover:bg-transparent"
                          >
                            Ref: {f.ref}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-emerald-600">
                      Adequações Obrigatórias
                    </h4>
                    {[
                      "Instalar Coifa Articulada ajustável à espessura da madeira.",
                      "Enclausurar totalmente correias e polias com chapa metálica.",
                      "Implementar Painel Elétrico IP54 com Botão de Emergência Categoria 4.",
                      "Fornecer Empurrador de Madeira para peças pequenas.",
                    ].map((a, i) => (
                      <div key={i} className="flex gap-3">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-slate-600 leading-tight">{a}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-red-600 text-white rounded-3xl text-center shadow-xl">
                  <p className="text-xs font-black uppercase tracking-widest">
                    ⚠️ CONCLUSÃO TÉCNICA
                  </p>
                  <p className="text-sm font-bold mt-2">
                    Equipamento oferece risco iminente de amputação. Deve ser interditado até a
                    regularização total.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
          Gerado em {new Date().toLocaleDateString("pt-BR")} • Nextcon Platform 2026
        </p>
      </div>
    </div>
  );
}
