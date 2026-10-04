"use client";

import * as React from "react";
import {
  ClipboardCheck,
  ShieldCheck,
  Zap,
  Flame,
  Biohazard,
  ArrowLeft,
  Printer,
  Download,
  Stethoscope,
  Building2,
  Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

/**
 * @fileOverview Relatório de Visita Técnica - Engehosp (HC-UFPR)
 * Elaborado pelo Eng. Felipe Coneglian para avaliação das áreas de Diagnóstico por Imagem
 * e Laboratório de Engenharia Clínica na Engehosp.
 */
export default function EngehospTechnicalVisitReport() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20 p-4 md:p-8">
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
            <Printer className="size-4" /> Imprimir Relatório
          </Button>
          <Button
            className="gradient-nextcon text-white h-10 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl gap-2"
            onClick={() => window.print()}
          >
            <Download className="size-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Cabeçalho do Relatório */}
      <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <div className="p-8 md:p-12 bg-[#001F3F] text-white relative">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Stethoscope className="size-48 text-accent" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                <ClipboardCheck className="size-8 text-accent" />
              </div>
              <div>
                <Badge className="bg-accent/20 text-accent border border-accent/40 font-mono text-[9px] uppercase tracking-widest mb-1">
                  Inspeção Técnica de Campo • HC-UFPR
                </Badge>
                <h1 className="text-3xl md:text-4xl font-headline font-black uppercase tracking-tighter leading-none">
                  Relatório de Visita Técnica & Inspeção
                </h1>
                <p className="text-white/60 font-bold uppercase text-xs tracking-widest mt-2">
                  NextconSST — Engenharia de Segurança & Higiene Ocupacional
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-white/10">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Empresa / Cliente
                </p>
                <p className="text-sm font-bold uppercase">Engehosp — Engenharia Clínica</p>
                <p className="text-[10px] font-mono text-white/60">Contrato HC-UFPR</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Local da Inspeção
                </p>
                <p className="text-sm font-bold uppercase">HC-UFPR</p>
                <p className="text-[10px] text-white/60">Hosp. de Clínicas UFPR</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Engenheiro Responsável
                </p>
                <p className="text-sm font-bold uppercase">Felipe Coneglian</p>
                <p className="text-[10px] text-white/60">Eng. Eletricista & Seg. Trabalho</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">
                  Data & Acompanhamento
                </p>
                <p className="text-sm font-bold uppercase">13 de Abril de 2026</p>
                <p className="text-[10px] text-accent font-bold">
                  Acomp.: Vinícius (Téc. Eletrônica)
                </p>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-8 md:p-12 space-y-12">
          {/* Seção 1: Objetivos */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
              1. Objeto & Objetivo da Visita
            </h2>
            <div className="p-6 bg-slate-50 rounded-3xl border shadow-inner space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                O presente relatório visa a avaliação técnica das condições de segurança,
                salubridade no trabalho e conformidade normativa nas áreas de{" "}
                <strong>Diagnóstico por Imagem</strong> e no{" "}
                <strong>Laboratório de Engenharia Clínica</strong> sob gestão da{" "}
                <strong>Engehosp</strong> dentro do{" "}
                <strong>Hospital de Clínicas da Universidade Federal do Paraná (HC-UFPR)</strong>,
                com foco na identificação e caracterização de riscos físicos, químicos e biológicos.
              </p>
            </div>
          </section>

          {/* Seção 2: Levantamento de Riscos */}
          <section className="space-y-6">
            <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
              2. Levantamento de Riscos & Diagnóstico Técnico
            </h2>

            {/* 2.1 Setor de Diagnóstico por Imagem */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                <Building2 className="size-5 text-primary" /> 2.1. Setor de Diagnóstico por Imagem
                (Raio-X e Tomografia)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-emerald-200 bg-emerald-50/50 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <Biohazard className="size-6 text-emerald-600 mt-1 shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-950 text-sm uppercase">
                        Riscos Biológicos
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                        Constatada a circulação constante e volumosa de pacientes, implicando risco
                        biológico inerente ao ambiente hospitalar crítico.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="size-6 text-blue-600 mt-1 shrink-0" />
                    <div>
                      <h4 className="font-bold text-blue-950 text-sm uppercase">
                        Riscos Físicos (Proteção Radiológica)
                      </h4>
                      <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                        Necessário monitoramento rigoroso da proteção radiológica e manutenção
                        preventiva permanente da integridade das barreiras de contenção plumbíferas.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* 2.2 Laboratório de Manutenção Eletromédica */}
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold text-slate-900 uppercase flex items-center gap-2">
                <Wrench className="size-5 text-accent" /> 2.2. Laboratório de Manutenção
                Eletromédica (Engehosp)
              </h3>
              <p className="text-xs text-slate-600">
                Foram identificados riscos de natureza crítica decorrentes da manutenção técnica em
                equipamentos hospitalares de suporte à vida (desfibriladores, eletrocardiógrafos,
                etc.):
              </p>

              <div className="grid grid-cols-1 gap-4">
                {/* Risco Elétrico / Capacitores */}
                <Alert className="border-amber-500/30 bg-amber-50 rounded-2xl p-5">
                  <Zap className="size-6 text-amber-600" />
                  <AlertTitle className="text-amber-950 font-bold uppercase text-sm flex items-center gap-2">
                    Riscos Elétricos & Descarga Residual de Capacitores (NR-10)
                  </AlertTitle>
                  <AlertDescription className="text-amber-900 text-xs mt-2 space-y-2 leading-relaxed">
                    <p>
                      • <strong>Painéis de 380V Energizados:</strong> Presença de painéis
                      energizados em 380V. Recomenda-se a utilização rigorosa de EPIs (luvas
                      isolantes, botas e óculos de segurança) na operação destes painéis.
                    </p>
                    <p>
                      • <strong>Risco Iminente de Choque Residual:</strong> Detectado risco iminente
                      de choque elétrico por descarga residual em capacitores durante o manuseio de
                      multímetros para diagnóstico em equipamentos como desfibriladores. Exige
                      adoção de procedimentos formais de desenergização e uso obrigatório de EPIs.
                    </p>
                  </AlertDescription>
                </Alert>

                {/* Risco Químico e Soldagem */}
                <Alert className="border-orange-500/30 bg-orange-50 rounded-2xl p-5">
                  <Flame className="size-6 text-orange-600" />
                  <AlertTitle className="text-orange-950 font-bold uppercase text-sm flex items-center gap-2">
                    Riscos Químicos, Solventes & Fumos de Soldagem
                  </AlertTitle>
                  <AlertDescription className="text-orange-900 text-xs mt-2 space-y-2 leading-relaxed">
                    <p>
                      • <strong>Processos de Solda Eletrônica:</strong> Exposição a vapores de
                      estanho e fumos metálicos liberados nos processos de soldagem de placas
                      eletrônicas.
                    </p>
                    <p>
                      • <strong>Substâncias Inflamáveis:</strong> Manipulação de solventes e agentes
                      desengraxantes (álcool isopropílico, tira-grudes e agentes químicos de
                      limpeza).
                    </p>
                  </AlertDescription>
                </Alert>

                {/* Risco Biológico UTI */}
                <Alert className="border-rose-500/30 bg-rose-50 rounded-2xl p-5">
                  <Biohazard className="size-6 text-rose-600" />
                  <AlertTitle className="text-rose-950 font-bold uppercase text-sm flex items-center gap-2">
                    Riscos Biológicos — Equipamentos Oriundos da UTI (NR-32)
                  </AlertTitle>
                  <AlertDescription className="text-rose-900 text-xs mt-2 leading-relaxed">
                    Identificado que equipamentos hospitalares retornam diretamente dos leitos da
                    Unidade de Terapia Intensiva (UTI) para manutenção no laboratório. Existe um
                    risco latente grave de contaminação biológica em caso de ausência de barreiras
                    sanitárias e protocolo rígido de desinfecção no recebimento.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </section>

          {/* Seção 3: Recomendações e Propostas de Medidas de Controle */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
              3. Recomendações & Plano de Medidas de Controle
            </h2>

            <div className="rounded-2xl border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold text-xs uppercase">
                      Item
                    </TableHead>
                    <TableHead className="font-bold text-xs uppercase">Área / Categoria</TableHead>
                    <TableHead className="font-bold text-xs uppercase">
                      Medida de Controle Recomendada
                    </TableHead>
                    <TableHead className="w-28 text-center font-bold text-xs uppercase">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-center font-mono font-bold">1</TableCell>
                    <TableCell className="font-bold text-xs">
                      Engenharia Clínica & Biossegurança (NR-32)
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      Exigir e implantar o fluxo obrigatório de desinfecção e esterilização prévia
                      para todo e qualquer equipamento oriundo de áreas críticas (UTI) antes da
                      manipulação técnica no laboratório.
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 bg-amber-50 text-[9px] font-bold"
                      >
                        Pendente
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="text-center font-mono font-bold">2</TableCell>
                    <TableCell className="font-bold text-xs">
                      Segurança em Eletricidade (NR-10)
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      Promover reforço imediato do treinamento em NR-10 com enfoque em extra-baixa e
                      alta tensão, além de métodos específicos de descarga segura de capacitores
                      para prevenir acidentes durante o uso de multímetros em desfibriladores.
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 bg-amber-50 text-[9px] font-bold"
                      >
                        Pendente
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="text-center font-mono font-bold">3</TableCell>
                    <TableCell className="font-bold text-xs">
                      Higiene Ocupacional & Exaustão
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      Implementar sistema de exaustão localizada eficaz para mitigação dos fumos de
                      solda (sistema atual detectado como ineficiente). Assegurar armazenamento de
                      inflamáveis (álcool isopropílico) em conformidade com as diretrizes contra
                      incêndio.
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="border-rose-500 text-rose-700 bg-rose-50 text-[9px] font-bold"
                      >
                        Ação Crítica
                      </Badge>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="text-center font-mono font-bold">4</TableCell>
                    <TableCell className="font-bold text-xs">Sinalização de Segurança</TableCell>
                    <TableCell className="text-xs text-slate-700">
                      Implementar sinalização visual de advertência de risco elétrico em todos os
                      painéis de 380V e bancadas de teste do laboratório.
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-600 text-white text-[9px] font-bold">
                        Implementado
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Seção 4: Considerações Finais */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-primary uppercase border-l-4 border-accent pl-4">
              4. Considerações Finais & Conclusão
            </h2>
            <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
              <p className="text-sm leading-relaxed text-slate-200">
                A integração e a cooperação contínua entre a{" "}
                <strong>Engenharia de Segurança do Trabalho (Nextcon SST)</strong> e a equipe da{" "}
                <strong>Engehosp</strong> são imprescindíveis para a mitigação dos riscos
                identificados no ambiente do Hospital de Clínicas da UFPR.
              </p>
              <p className="text-sm leading-relaxed text-slate-200">
                As adequações propostas visam resguardar a integridade física e a saúde do corpo
                técnico, garantindo que as atividades de manutenção dos equipamentos hospitalares de
                suporte à vida ocorram em estrita observância aos padrões de segurança estabelecidos
                pelas normas regulamentadoras do Ministério do Trabalho (NR-10, NR-32) e demais
                órgãos reguladores da saúde.
              </p>
              <div className="pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400">
                <div>
                  <p className="font-bold text-white uppercase">Felipe Coneglian</p>
                  <p>Engenheiro Eletricista e de Segurança do Trabalho</p>
                  <p className="font-mono text-[10px] text-accent">
                    CREA/CONFEA • Resp. Técnico Nextcon SST
                  </p>
                </div>
                <div>
                  <p className="font-bold text-white uppercase">Vinícius</p>
                  <p>Técnico em Eletrônica</p>
                  <p className="font-mono text-[10px] text-slate-500">
                    Engehosp — Engenharia Clínica HC-UFPR
                  </p>
                </div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
