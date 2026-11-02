"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  ShieldCheck,
  Stethoscope,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  HeartPulse,
  Activity,
  DollarSign,
  Scale,
  PlusCircle,
  LifeBuoy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CASSI_OFFICIAL_CONTRACT, HEALTH_OPERATION_CARDS } from "@/lib/cassi-contract-data";

export default function CassiOperationsHubPage() {
  const { toast } = useToast();
  const [copiedAccount, setCopiedAccount] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Draft only: a clinical record and verified professional review are required for issuance.
  const [catForm, setCatForm] = React.useState({
    employeeName: "",
    matricula: "",
    dependencia: "",
    medicalUnit: "",
    date: "",
    time: "",
    internacao: "",
    provavelDuracaoDias: "",
    afastamentoTrabalho: "",
    descricaoLesao: "",
    diagnosticoProvavel: "",
    cid: "",
    observacoes: "",
    doctorName: "",
    doctorCrm: "",
    doctorUf: "",
  });

  const handleCopyBank = async () => {
    setCopiedAccount(false);
    clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(
        "Banco do Brasil (001) | Agência: 3722 | C/C: 13005630-6 | NXC SAUDE EMPRESARIAL LTDA"
      );
      setCopiedAccount(true);
      toast({
        title: "Dados bancários copiados",
        description: "Confira os dados no contrato antes de utilizar.",
      });
      copyTimer.current = setTimeout(() => setCopiedAccount(false), 2500);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Selecione e copie os dados do contrato manualmente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1650px] mx-auto pb-24">
      {/* HEADER BANNER CONTRATUAL OFICIAL */}
      <div className="bg-linear-to-r from-[#002D62] via-[#003875] to-[#0A192F] p-6 md:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-amber-400/20">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-widest px-3 py-1 shadow-md">
                CONTRATO OFICIAL CASSI • BANCO DO BRASIL
              </Badge>
              <Badge
                variant="outline"
                className="text-amber-300 border-amber-400/30 text-[10px] font-bold uppercase"
              >
                ANS Nº 34665-9 (AUTOGESTÃO)
              </Badge>
              <Badge
                variant="outline"
                className="text-white/80 border-white/20 text-[10px] font-mono"
              >
                CNPJ: 33.719.485/0001-27
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                VIGÊNCIA: 01/05/2026 A 30/04/2027
              </Badge>
            </div>

            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Building2 className="text-amber-400 h-8 w-8 md:h-10 md:w-10" />
              CASSI — Referências contratuais & PCMSO BB
            </h1>

            <p className="text-slate-300 text-xs md:text-sm max-w-4xl leading-relaxed">
              Referências do contrato com a{" "}
              <strong>Caixa de Assistência dos Funcionários do Banco do Brasil</strong>: serviços,
              prazos, kit ambulatorial e orientações de faturamento TISS. A execução dos
              atendimentos e as devolutivas precisam ser confirmadas nos sistemas responsáveis.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-amber-400" />
                Sede CASSI: SIG Quadra 4, Lote 575, Brasília - DF
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-amber-400" />
                Gestora CASSI: Sra. Emilia Figueiredo Bezerra Braga
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                Contratada: NXC SAÚDE (Thiago Coneglian)
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <Button
              disabled
              aria-describedby="cassi-availability"
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase px-5 py-5 rounded-2xl shadow-xl flex items-center gap-2 transition-all"
            >
              <PlusCircle size={16} /> Nova Ordem de Atendimento
            </Button>

            <Link href="/cassi-billing">
              <Button
                variant="outline"
                className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold rounded-2xl flex items-center justify-center gap-2"
              >
                <FileSpreadsheet size={15} className="text-amber-300" /> Lote TISS & RPA Portal
                CASSI
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={handleCopyBank}
              className="bg-slate-900/60 hover:bg-slate-800 text-amber-300 border-amber-400/30 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2"
            >
              {copiedAccount ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
              Conta BB (Ag 3722 / CC 13005630-6)
            </Button>
          </div>
        </div>
      </div>

      <section
        id="cassi-availability"
        className="space-y-3 rounded-2xl border border-amber-400/40 bg-amber-50 p-5 text-slate-900"
        aria-labelledby="cassi-availability-title"
      >
        <h2 id="cassi-availability-title" className="font-semibold">
          Operação CASSI não integrada nesta página
        </h2>
        <p className="text-sm">
          O cadastro de ordens, a devolutiva à CASSI e a apuração de SLA estão indisponíveis aqui.
          Registre os atendimentos no sistema adotado pela equipe e confira o protocolo de cada
          devolutiva. Esta consulta contratual não comprova execução ou envio.
        </p>
        <Button asChild variant="outline">
          <Link href="/aso-scheduler">Abrir agendador interno de ASOs</Link>
        </Button>
      </section>

      {/* Referências contratuais; indicadores operacionais ainda não apurados. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-400/30 bg-slate-900/90 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Faturamento TISS Previsto
              </span>
              <div className="text-2xl font-black text-amber-400">Não apurado</div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock size={12} className="text-amber-400" /> Sem atendimentos confirmados nesta
                tela
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <DollarSign size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-slate-900/90 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Retorno ao Trabalho (SLA D0)
              </span>
              <div className="text-2xl font-black text-emerald-400">SLA não apurado</div>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <Clock size={12} /> Sem comprovantes de devolutiva nesta tela
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HeartPulse size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-slate-900/90 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Programa PAVAS (Assalto/Sequestro)
              </span>
              <div className="text-2xl font-black text-rose-400">Não apurado</div>
              <span className="text-[10px] text-rose-300 flex items-center gap-1">
                <AlertCircle size={12} /> Conferir registros assistenciais
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <LifeBuoy size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/30 bg-slate-900/90 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Referência contratual TISS
              </span>
              <div className="text-2xl font-black text-blue-400">90 Dias</div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <FileText size={12} className="text-blue-400" /> Conferir Cláusula 4ª §1º no
                contrato
              </span>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Scale size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS PRINCIPAIS DO COCKPIT */}
      <Tabs defaultValue="cards_operacao" className="space-y-6">
        <TabsList className="bg-slate-900/90 border border-slate-800 p-1 rounded-2xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger
            value="cards_operacao"
            className="rounded-xl text-xs font-bold py-2.5 px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
          >
            Cards de Operação em Saúde ({HEALTH_OPERATION_CARDS.length})
          </TabsTrigger>
          <TabsTrigger
            value="atendimentos_lista"
            className="rounded-xl text-xs font-bold py-2.5 px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
          >
            Atendimentos e Ordens
          </TabsTrigger>
          <TabsTrigger
            value="kit_ambulatorial_bb"
            className="rounded-xl text-xs font-bold py-2.5 px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
          >
            Visitas Agências BB & Kit Ambulatorial
          </TabsTrigger>
          <TabsTrigger
            value="faturamento_tiss"
            className="rounded-xl text-xs font-bold py-2.5 px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
          >
            Tabela de Preços & Faturamento TISS
          </TabsTrigger>
          <TabsTrigger
            value="cat_anexo_ii"
            className="rounded-xl text-xs font-bold py-2.5 px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
          >
            Emissor de CAT (Anexo II do Contrato)
          </TabsTrigger>
          <TabsTrigger
            value="clausulas_lgpd"
            className="rounded-xl text-xs font-bold py-2.5 px-4 data-[state=active]:bg-amber-400 data-[state=active]:text-slate-950"
          >
            Ficha Contratual & LGPD (Anexo I)
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: OS 6 CARDS DE OPERAÇÃO EM SAÚDE */}
        <TabsContent value="cards_operacao" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Activity className="text-amber-400" /> Linhas de Cuidado Assistencial do Contrato
                CASSI
              </h2>
              <p className="text-slate-400 text-xs">
                Cada card representa uma modalidade de atendimento contratada com seu respectivo
                código TISS, remuneração fixa e SLAs legais.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-amber-400/40 text-amber-300 text-xs px-3 py-1"
              >
                Código 1.01.01.012: Valor a cadastrar
              </Badge>
              <Badge
                variant="outline"
                className="border-blue-400/40 text-blue-300 text-xs px-3 py-1"
              >
                Código 0.096.03.0151: Valor a cadastrar
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {HEALTH_OPERATION_CARDS.map((card) => {
              const isUrgent = card.priority === "URGENTE";
              return (
                <Card
                  key={card.id}
                  className={cn(
                    "bg-slate-900/90 border transition-all duration-300 hover:shadow-2xl rounded-3xl overflow-hidden flex flex-col justify-between",
                    isUrgent
                      ? "border-rose-500/40 hover:border-rose-500"
                      : "border-slate-800 hover:border-amber-400/40"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge
                        className={cn(
                          "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5",
                          card.priority === "URGENTE" && "bg-rose-500 text-white",
                          card.priority === "ALTA" && "bg-amber-400 text-slate-950",
                          card.priority === "NORMAL" && "bg-blue-600 text-white"
                        )}
                      >
                        {card.priority}
                      </Badge>

                      <Badge
                        variant="outline"
                        className="font-mono text-xs font-bold text-amber-300 border-amber-400/30"
                      >
                        {card.tissCode}
                      </Badge>
                    </div>

                    <CardTitle className="text-lg font-black text-white leading-tight">
                      {card.serviceType}
                    </CardTitle>

                    <CardDescription className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {card.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Valor Contratual:</span>
                        <span className="font-black text-emerald-400 text-sm">
                          R$ {card.contractPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">SLA Contratual:</span>
                        <span className="font-bold text-amber-300 text-[11px]">
                          {card.slaLimit}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Requisitos Obrigatórios:
                      </span>
                      <ul className="space-y-1 text-xs text-slate-400">
                        {card.requirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2">
                      <Button
                        disabled
                        aria-describedby="cassi-availability"
                        className="w-full bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs rounded-xl py-2 transition-all flex items-center justify-center gap-2"
                      >
                        <PlusCircle size={14} /> Registrar Atendimento
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="atendimentos_lista" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de atendimentos CASSI indisponível</CardTitle>
              <CardDescription>
                Esta página não consulta ordens, assinaturas, faturamentos ou devolutivas
                confirmadas. O cumprimento de SLA depende dos registros e protocolos do atendimento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/aso-scheduler">Consultar solicitações de ASO</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: VISITAS ÀS AGÊNCIAS BB & KIT AMBULATORIAL */}
        <TabsContent value="kit_ambulatorial_bb" className="space-y-6">
          <div className="bg-amber-400/10 border border-amber-400/30 p-5 rounded-2xl flex items-start gap-4 text-amber-200">
            <AlertTriangle className="text-amber-400 h-6 w-6 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <strong className="text-amber-300 text-sm block font-black uppercase">
                Regra Rígida de Comunicação (Cláusula Segunda, Parágrafo 8º, Alínea A):
              </strong>
              <p className="leading-relaxed">
                A NXC Saúde e seus profissionais estão{" "}
                <strong>
                  expressamente proibidos de manter contato direto com as agências do Banco do
                  Brasil
                </strong>{" "}
                para agendamentos, remarcações ou ajustes operacionais. Toda e qualquer comunicação
                é centralizada exclusivamente com a <strong>CASSI</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD KIT OBRIGATÓRIO */}
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <Stethoscope className="text-amber-400" /> Kit Ambulatorial Móvel BB (Parágrafo
                  3º)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Equipamentos e insumos obrigatórios para atendimentos diretos nas agências do
                  Banco do Brasil.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {CASSI_OFFICIAL_CONTRACT.bbKitAmbulatorial.mandatoryItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-white">{item}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-slate-300 border-slate-700"
                    >
                      Exigência contratual
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* CARD CRONOGRAMA & REGRAS */}
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <Calendar className="text-amber-400" /> Prazos e Protocolos de Visita
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Normas contratuais para atendimento presencial in company.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Envio do Cronograma de Visitas:
                  </strong>
                  <p>
                    Mínimo de <strong>15 dias de antecedência</strong> encaminhado formalmente para
                    a CASSI.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Substituição ou Reagendamento Médico:
                  </strong>
                  <p>
                    Comunicação obrigatória à CASSI com pelo menos{" "}
                    <strong>48 horas de antecedência</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Caso Fortuito ou Força Maior:
                  </strong>
                  <p>
                    Justificativa apresentada em até <strong>2 horas úteis</strong> após o horário
                    programado.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Dias e Horários Permitidos:
                  </strong>
                  <p>
                    Exclusivamente em <strong>dias úteis e dentro da jornada do bancário</strong>.
                    Proibido em fins de semana, feriados e pontos facultativos.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ABA 4: TABELA DE PREÇOS E REGRAS FINANCEIRAS TISS */}
        <TabsContent value="faturamento_tiss" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TABELA DE PREÇOS */}
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <DollarSign className="text-amber-400" /> Tabela Contratual de Preços
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Cláusula Terceira — Despesas com eventual deslocamento já inclusas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {CASSI_OFFICIAL_CONTRACT.pricingTable.map((pt, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        Código {pt.code}
                      </span>
                      <span className="text-xl font-black text-emerald-400">
                        {pt.valueFormatted}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white block">{pt.description}</span>
                    <div className="text-[11px] text-slate-400">
                      <strong>Aplica-se a:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                        {pt.appliedTo.map((app, j) => (
                          <li key={j}>{app}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* REGRAS DE PAGAMENTO, GLOSAS E PRECLUSÃO */}
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <Scale className="text-amber-400" /> Regras de Faturamento e Preclusão
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Cláusula Quarta — Prazos de liquidação, glosas e contas bancárias.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Prazo de Pagamento: 45 Dias
                  </strong>
                  <p>
                    Contados a partir da data de protocolo na CASSI das guias de serviços e
                    formulários eletrônicos.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-rose-400 block font-bold">
                    Prazo Limite de Cobrança: 90 Dias (Preclusão)
                  </strong>
                  <p>
                    Decorrido o prazo de 90 dias sem envio da cobrança eletrônica e física, preclui
                    o direito ao recebimento sem ônus para a CASSI.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Contestação e Recursos de Glosa: 30 Dias
                  </strong>
                  <p>
                    CASSI manifesta-se em até 30 dias após protocolo da contestação. Em caso de
                    glosa mantida, NXC tem 30 dias para recurso formal no Portal CASSI.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Conta Bancária para Recebimento:
                  </strong>
                  <p className="font-mono text-emerald-400">
                    Banco do Brasil (001) | Agência: 3722 | C/C: 13005630-6
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Titular: NXC SAUDE EMPRESARIAL LTDA (CNPJ 44.337.647/0001-89)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ABA 5: EMISSOR DO CAT (ANEXO II DO CONTRATO) */}
        <TabsContent value="cat_anexo_ii" className="space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl shadow-xl">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                    <FileText className="text-amber-400" /> Anexo II — Comunicado de Acidente de
                    Trabalho (CAT)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Rascunho não emitido. A emissão depende de atendimento vinculado, identificação
                    do médico e revisão profissional. Nenhum certificado foi verificado.
                  </CardDescription>
                </div>

                <Button
                  disabled
                  title="Emissão requer atendimento vinculado e revisão profissional verificada."
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl flex items-center gap-2"
                >
                  <Printer size={14} /> Imprimir / Exportar CAT
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-employeeName" className="text-xs text-slate-300 font-bold">
                    Nome do Funcionário
                  </Label>
                  <Input
                    id="cat-employeeName"
                    value={catForm.employeeName}
                    onChange={(e) => setCatForm({ ...catForm, employeeName: e.target.value })}
                    placeholder="Ex: MARCOS AURÉLIO DA SILVA"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-matricula" className="text-xs text-slate-300 font-bold">
                    Matrícula Banco do Brasil
                  </Label>
                  <Input
                    id="cat-matricula"
                    value={catForm.matricula}
                    onChange={(e) => setCatForm({ ...catForm, matricula: e.target.value })}
                    placeholder="Ex: BB-7.892.411-0"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-dependencia" className="text-xs text-slate-300 font-bold">
                    Dependência / Agência BB
                  </Label>
                  <Input
                    id="cat-dependencia"
                    value={catForm.dependencia}
                    onChange={(e) => setCatForm({ ...catForm, dependencia: e.target.value })}
                    placeholder="Ex: Agência Centro Cívico (0042)"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-date" className="text-xs text-slate-300 font-bold">
                    Data do Atendimento
                  </Label>
                  <Input
                    type="date"
                    id="cat-date"
                    value={catForm.date}
                    onChange={(e) => setCatForm({ ...catForm, date: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-time" className="text-xs text-slate-300 font-bold">
                    Hora
                  </Label>
                  <Input
                    type="time"
                    required
                    id="cat-time"
                    value={catForm.time}
                    onChange={(e) => setCatForm({ ...catForm, time: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-internacao" className="text-xs text-slate-300 font-bold">
                    Houve Internação?
                  </Label>
                  <Input
                    pattern="SIM|NAO|NÃO"
                    required
                    id="cat-internacao"
                    value={catForm.internacao}
                    onChange={(e) => setCatForm({ ...catForm, internacao: e.target.value })}
                    placeholder="SIM / NÃO"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cat-provavelDuracaoDias"
                    className="text-xs text-slate-300 font-bold"
                  >
                    Duração do Tratamento (dias)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    required
                    id="cat-provavelDuracaoDias"
                    value={catForm.provavelDuracaoDias}
                    onChange={(e) =>
                      setCatForm({ ...catForm, provavelDuracaoDias: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cat-descricaoLesao" className="text-xs text-slate-300 font-bold">
                  Descrição e Natureza da Lesão
                </Label>
                <Input
                  id="cat-descricaoLesao"
                  value={catForm.descricaoLesao}
                  onChange={(e) => setCatForm({ ...catForm, descricaoLesao: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cat-diagnosticoProvavel"
                    className="text-xs text-slate-300 font-bold"
                  >
                    Diagnóstico Provável
                  </Label>
                  <Input
                    id="cat-diagnosticoProvavel"
                    value={catForm.diagnosticoProvavel}
                    onChange={(e) =>
                      setCatForm({ ...catForm, diagnosticoProvavel: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-cid" className="text-xs text-slate-300 font-bold">
                    CID-10 ou CID-11
                  </Label>
                  <Input
                    id="cat-cid"
                    value={catForm.cid}
                    onChange={(e) => setCatForm({ ...catForm, cid: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-xs space-y-1">
                  <span className="text-slate-400">Médico Examinador:</span>
                  <div className="font-bold text-white">
                    Profissional ainda não vinculado a atendimento
                  </div>
                  <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                    <ShieldCheck size={13} /> Certificado não verificado
                  </span>
                </div>
                <Badge className="bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1">
                  Rascunho — emissão indisponível
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 6: FICHA CONTRATUAL COMPLETA & LGPD */}
        <TabsContent value="clausulas_lgpd" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DADOS DAS PARTES */}
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <Building2 className="text-amber-400" /> Dados Cadastrais das Partes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">CONTRATANTE:</strong>
                  <p className="font-bold text-white">
                    CAIXA DE ASSISTÊNCIA DOS FUNCIONÁRIOS DO BANCO DO BRASIL - CASSI
                  </p>
                  <p>CNPJ: 33.719.485/0001-27 | Registro ANS: 34665-9 (Autogestão)</p>
                  <p>Endereço: SIG Quadra 4, Lote 575, Brasília - DF, CEP 70.610-910</p>
                  <p>Dados pessoais disponíveis no cadastro autenticado.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-emerald-400 block font-bold">CONTRATADA:</strong>
                  <p className="font-bold text-white">NXC SAUDE EMPRESARIAL LTDA</p>
                  <p>CNPJ: 44.337.647/0001-89</p>
                  <p>Endereço: Rua General Mario Tourinho, 1733, Curitiba - PR, CEP 80740-000</p>
                  <p>Dados pessoais disponíveis no cadastro autenticado.</p>
                  <p>Foro Eleito: Cidade de Curitiba / PR (Cláusula Sétima)</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-slate-400 block font-bold">
                    Testemunhas Contratuais:
                  </strong>
                  <p>Dados pessoais disponíveis no cadastro autenticado.</p>
                  <p>Dados pessoais disponíveis no cadastro autenticado.</p>
                </div>
              </CardContent>
            </Card>

            {/* ANEXO I LGPD */}
            <Card className="bg-slate-900/90 border-slate-800 rounded-3xl">
              <CardHeader>
                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="text-emerald-400" /> Anexo I — Disposições Gerais LGPD
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Papéis de Controlador (CASSI) e Operador (NXC Saúde).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-slate-300">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Encarregado de Dados CASSI:
                  </strong>
                  <p>E-mail: tratamentodedados@cassi.com.br</p>
                  <p>Política: cassi.com.br/images/2020/Politica_de_Privacidade.pdf</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Incidentes de Segurança: 24 Horas
                  </strong>
                  <p>
                    Obrigação de notificar por escrito em até 24 horas qualquer evento de vazamento,
                    perda ou acesso indevido.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <strong className="text-amber-300 block font-bold">
                    Término do Tratamento e Exclusão:
                  </strong>
                  <p>
                    Devolução e eliminação definitiva dos arquivos em até 10 dias úteis após
                    encerramento do contrato, ressalvada guarda obrigatória por lei.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
