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
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Stethoscope,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Printer,
  Copy,
  Check,
  Briefcase,
  HeartPulse,
  Activity,
  DollarSign,
  Scale,
  Search,
  Filter,
  ExternalLink,
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
import {
  CASSI_OFFICIAL_CONTRACT,
  HEALTH_OPERATION_CARDS,
  INITIAL_CASSI_ACTIVITIES,
  HealthOperationCard,
  CassiActivityItem,
} from "@/lib/cassi-contract-data";

export default function CassiOperationsHubPage() {
  const { toast } = useToast();
  const [activities, setActivities] = React.useState<CassiActivityItem[]>(INITIAL_CASSI_ACTIVITIES);
  const [filterCategory, setFilterCategory] = React.useState<string>("ALL");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [copiedAccount, setCopiedAccount] = React.useState(false);

  // Modal / Novo Atendimento State
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [newOrder, setNewOrder] = React.useState({
    serviceType: "Retorno ao Trabalho (RT)",
    tissCode: "0.096.03.0151",
    price: 291.34,
    employeeName: "",
    employeeMatricula: "",
    unitOrAgency: "",
    city: "Curitiba",
    uf: "PR",
    guideSadtNumber: "",
    authPassword: "",
    doctorName: "Dr. Rodrigo Martins (CRM-PR 38.921)",
  });

  // Formulário CAT Anexo II State
  const [catForm, setCatForm] = React.useState({
    employeeName: "",
    matricula: "",
    dependencia: "",
    medicalUnit: "NXC Saúde Empresarial - Curitiba",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    internacao: "NAO",
    provavelDuracaoDias: "15",
    afastamentoTrabalho: "SIM",
    descricaoLesao:
      "Trauma contuso em membro superior direito com escoriações após evento em agência bancária.",
    diagnosticoProvavel: "Transtorno de estresse agudo e contusão osteomuscular",
    cid: "F43.0 / S60",
    observacoes: "Encaminhado para acolhimento PAVAS e avaliação de estresse pós-traumático.",
    doctorName: "Dr. Rodrigo Martins",
    doctorCrm: "38.921",
    doctorUf: "PR",
  });

  const handleCopyBank = () => {
    navigator.clipboard.writeText(
      "Banco do Brasil (001) | Agência: 3722 | C/C: 13005630-6 | NXC SAUDE EMPRESARIAL LTDA"
    );
    setCopiedAccount(true);
    toast({
      title: "Dados Bancários Copiados!",
      description: "Agência 3722, C/C 13005630-6 copiada para faturamento CASSI.",
    });
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleServiceTypeChange = (sType: string) => {
    if (
      sType === "Retorno ao Trabalho (RT)" ||
      sType === "Avaliação de Capacidade Laborativa e Deficiência (PCD)"
    ) {
      setNewOrder((prev) => ({
        ...prev,
        serviceType: sType,
        tissCode: "0.096.03.0151",
        price: 291.34,
      }));
    } else {
      setNewOrder((prev) => ({
        ...prev,
        serviceType: sType,
        tissCode: "1.01.01.012",
        price: 173.76,
      }));
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.employeeName || !newOrder.guideSadtNumber || !newOrder.authPassword) {
      toast({
        title: "Preenchimento Obrigatório",
        description:
          "O contrato exige o preenchimento da Guia SP/SADT e Senha de Autorização CASSI.",
        variant: "destructive",
      });
      return;
    }

    const created: CassiActivityItem = {
      id: `CASSI_ACT_${Date.now()}`,
      orderNumber: `CASSI-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      serviceType: newOrder.serviceType,
      employeeName: newOrder.employeeName.toUpperCase(),
      employeeMatricula: newOrder.employeeMatricula.toUpperCase() || "BB-0.000.000-0",
      unitOrAgency: newOrder.unitOrAgency || "Agência Curitiba",
      city: newOrder.city,
      uf: newOrder.uf,
      date: new Date().toISOString().split("T")[0],
      tissCode: newOrder.tissCode,
      price: newOrder.price,
      status: "EM_ATENDIMENTO",
      guideSadtNumber: newOrder.guideSadtNumber,
      authPassword: newOrder.authPassword,
      hasGuideSignature: true,
      slaDeadline: newOrder.serviceType.includes("Retorno") ? "Hoje (SLA D0)" : "24h Portal CASSI",
      isSlaOnTrack: true,
      medicalDoctorName: newOrder.doctorName.split("(")[0].trim(),
      medicalDoctorCrm: newOrder.doctorName.includes("(")
        ? newOrder.doctorName.split("(")[1].replace(")", "")
        : "CRM-PR",
      notes: "Ordem gerada no hub de saúde. Aguardando conclusão clínica e upload no portal CASSI.",
    };

    setActivities([created, ...activities]);
    setShowNewModal(false);
    toast({
      title: "Ordem de Atendimento Criada!",
      description: `Atendimento registrado com código TISS ${newOrder.tissCode} (R$ ${newOrder.price.toFixed(2)}).`,
    });
  };

  const markCompletedD0 = (id: string) => {
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            status: "CONCLUIDO_D0",
            notes: "ASO e Parecer concluídos no mesmo dia (D0). Devolutiva enviada à CASSI.",
          };
        }
        return a;
      })
    );
    toast({
      title: "SLA D0 Cumprido!",
      description: "Atendimento finalizado com sucesso no mesmo dia conforme Cláusula 1ª §2º.",
    });
  };

  // Filtragem
  const filteredActivities = activities.filter((a) => {
    const matchesSearch =
      !searchTerm ||
      a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.employeeMatricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.unitOrAgency.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.guideSadtNumber.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterCategory === "ALL") return matchesSearch;
    if (filterCategory === "RETORNO") return matchesSearch && a.serviceType.includes("Retorno");
    if (filterCategory === "PAVAS") return matchesSearch && a.serviceType.includes("PAVAS");
    if (filterCategory === "EPS") return matchesSearch && a.serviceType.includes("EPS");
    if (filterCategory === "FATURADO") return matchesSearch && a.status === "FATURADO_TISS";
    return matchesSearch;
  });

  // Totais
  const totalFaturadoPrevisto = activities.reduce((acc, curr) => acc + curr.price, 0);
  const totalRetornosD0 = activities.filter(
    (a) => a.serviceType.includes("Retorno") && a.status === "CONCLUIDO_D0"
  ).length;
  const totalPavas = activities.filter((a) => a.serviceType.includes("PAVAS")).length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1650px] mx-auto pb-24">
      {/* HEADER BANNER CONTRATUAL OFICIAL */}
      <div className="bg-gradient-to-r from-[#002D62] via-[#003875] to-[#0A192F] p-6 md:p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-amber-400/20">
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
              CASSI — Operação em Saúde Ocupacional & PCMSO BB
            </h1>

            <p className="text-slate-300 text-xs md:text-sm max-w-4xl leading-relaxed">
              Central de gestão assistencial para a{" "}
              <strong>Caixa de Assistência dos Funcionários do Banco do Brasil</strong>. Controle em
              tempo real das linhas de cuidado (EPS, Retorno D0, PAVAS, Perícias), kit ambulatorial
              in company para agências e faturamento TISS.
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
              onClick={() => setShowNewModal(true)}
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

      {/* 4 CARDS DE INDICADORES PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-400/30 bg-slate-900/90 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Faturamento TISS Previsto
              </span>
              <div className="text-2xl font-black text-amber-400">
                R$ {totalFaturadoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock size={12} className="text-amber-400" /> Prazo 45 dias pós-protocolo
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
              <div className="text-2xl font-black text-emerald-400">100% no Prazo</div>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> {totalRetornosD0} devolutivas no mesmo dia
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
              <div className="text-2xl font-black text-rose-400">{totalPavas} Casos Acolhidos</div>
              <span className="text-[10px] text-rose-300 flex items-center gap-1">
                <AlertCircle size={12} /> Acolhimento imediato + CAT
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
                Trava de Preclusão TISS
              </span>
              <div className="text-2xl font-black text-blue-400">90 Dias</div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldCheck size={12} className="text-blue-400" /> Cláusula 4ª §1º (Sem glosas por
                prazo)
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
            Atendimentos e Ordens ({activities.length})
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
                        onClick={() => {
                          handleServiceTypeChange(card.serviceType);
                          setShowNewModal(true);
                        }}
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

        {/* ABA 2: LISTAGEM DE ATENDIMENTOS E ORDENS EM TEMPO REAL */}
        <TabsContent value="atendimentos_lista" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome do funcionário, matrícula BB, dependência ou guia SP/SADT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-800 text-xs rounded-xl text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={filterCategory === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory("ALL")}
                className={cn(
                  "text-xs rounded-xl",
                  filterCategory === "ALL"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "text-slate-300"
                )}
              >
                Todos ({activities.length})
              </Button>
              <Button
                variant={filterCategory === "RETORNO" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory("RETORNO")}
                className={cn(
                  "text-xs rounded-xl",
                  filterCategory === "RETORNO"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "text-slate-300"
                )}
              >
                Retorno D0
              </Button>
              <Button
                variant={filterCategory === "PAVAS" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory("PAVAS")}
                className={cn(
                  "text-xs rounded-xl",
                  filterCategory === "PAVAS"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "text-slate-300"
                )}
              >
                PAVAS
              </Button>
              <Button
                variant={filterCategory === "EPS" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory("EPS")}
                className={cn(
                  "text-xs rounded-xl",
                  filterCategory === "EPS"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "text-slate-300"
                )}
              >
                EPS BB
              </Button>
              <Button
                variant={filterCategory === "FATURADO" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory("FATURADO")}
                className={cn(
                  "text-xs rounded-xl",
                  filterCategory === "FATURADO"
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "text-slate-300"
                )}
              >
                Faturados
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredActivities.map((act) => (
              <Card
                key={act.id}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-700 rounded-2xl transition-all"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "text-[10px] font-black uppercase tracking-wider",
                          act.status === "CONCLUIDO_D0" && "bg-emerald-500 text-slate-950",
                          act.status === "FATURADO_TISS" && "bg-blue-600 text-white",
                          act.status === "AGUARDANDO_PORTAL" && "bg-amber-400 text-slate-950",
                          act.status === "EM_ATENDIMENTO" && "bg-purple-600 text-white"
                        )}
                      >
                        {act.status.replace("_", " ")}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        {act.orderNumber}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-bold text-white">{act.serviceType}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-slate-700 text-slate-300"
                      >
                        TISS: {act.tissCode}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Users size={14} className="text-amber-400" /> {act.employeeName}
                      </span>
                      <span className="text-slate-400 font-mono">
                        Matrícula: {act.employeeMatricula}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin size={13} className="text-slate-500" /> {act.unitOrAgency} (
                        {act.city}/{act.uf})
                      </span>
                      <span className="text-slate-400">
                        Guia:{" "}
                        <strong className="text-slate-200 font-mono">{act.guideSadtNumber}</strong>{" "}
                        (Senha: {act.authPassword})
                      </span>
                    </div>

                    {act.notes && (
                      <p className="text-xs text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                        {act.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Valor TISS:</span>
                      <span className="text-lg font-black text-emerald-400">
                        R$ {act.price.toFixed(2)}
                      </span>
                      <span className="text-[11px] text-amber-300 block font-semibold">
                        SLA: {act.slaDeadline}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {act.status !== "CONCLUIDO_D0" && act.status !== "FATURADO_TISS" && (
                        <Button
                          size="sm"
                          onClick={() => markCompletedD0(act.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-8 px-3 flex items-center gap-1"
                        >
                          <CheckCircle2 size={13} /> Concluir D0
                        </Button>
                      )}

                      <Link href="/cassi-billing">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 hover:border-amber-400 text-white font-bold text-xs rounded-xl h-8 px-3 flex items-center gap-1"
                        >
                          <FileSpreadsheet size={13} className="text-amber-300" /> Faturar TISS
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-white">{item}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] text-emerald-300 border-emerald-500/30"
                    >
                      Calibrado / OK
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
                    Modelo oficial contratual preenchido pelo médico examinador após atendimento
                    (Físico & Digital).
                  </CardDescription>
                </div>

                <Button
                  onClick={() => window.print()}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl flex items-center gap-2"
                >
                  <Printer size={14} /> Imprimir / Exportar CAT
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Nome do Funcionário</Label>
                  <Input
                    value={catForm.employeeName}
                    onChange={(e) => setCatForm({ ...catForm, employeeName: e.target.value })}
                    placeholder="Ex: MARCOS AURÉLIO DA SILVA"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">
                    Matrícula Banco do Brasil
                  </Label>
                  <Input
                    value={catForm.matricula}
                    onChange={(e) => setCatForm({ ...catForm, matricula: e.target.value })}
                    placeholder="Ex: BB-7.892.411-0"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">
                    Dependência / Agência BB
                  </Label>
                  <Input
                    value={catForm.dependencia}
                    onChange={(e) => setCatForm({ ...catForm, dependencia: e.target.value })}
                    placeholder="Ex: Agência Centro Cívico (0042)"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Data do Atendimento</Label>
                  <Input
                    type="date"
                    value={catForm.date}
                    onChange={(e) => setCatForm({ ...catForm, date: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Hora</Label>
                  <Input
                    value={catForm.time}
                    onChange={(e) => setCatForm({ ...catForm, time: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Houve Internação?</Label>
                  <Input
                    value={catForm.internacao}
                    onChange={(e) => setCatForm({ ...catForm, internacao: e.target.value })}
                    placeholder="SIM / NÃO"
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">
                    Duração do Tratamento (dias)
                  </Label>
                  <Input
                    value={catForm.provavelDuracaoDias}
                    onChange={(e) =>
                      setCatForm({ ...catForm, provavelDuracaoDias: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">
                  Descrição e Natureza da Lesão
                </Label>
                <Input
                  value={catForm.descricaoLesao}
                  onChange={(e) => setCatForm({ ...catForm, descricaoLesao: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Diagnóstico Provável</Label>
                  <Input
                    value={catForm.diagnosticoProvavel}
                    onChange={(e) =>
                      setCatForm({ ...catForm, diagnosticoProvavel: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">CID-10 ou CID-11</Label>
                  <Input
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
                    {catForm.doctorName} — CRM/{catForm.doctorUf} {catForm.doctorCrm}
                  </div>
                  <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                    <ShieldCheck size={13} /> Certificado Digital ICP-Brasil A1 Ativo
                  </span>
                </div>
                <Badge className="bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1">
                  Pronto para Envio à CASSI
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

      {/* MODAL / NOVA ORDEM DE ATENDIMENTO CASSI */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-400/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <PlusCircle className="text-amber-400" /> Nova Ordem de Atendimento CASSI
                </h3>
                <p className="text-xs text-slate-400">
                  Preencha os dados e valide a Guia SP/SADT obrigatória.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white rounded-xl"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">
                  Modalidade do Atendimento
                </Label>
                <select
                  value={newOrder.serviceType}
                  onChange={(e) => handleServiceTypeChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl"
                >
                  <option value="Retorno ao Trabalho (RT)">
                    Retorno ao Trabalho (RT) — Valor a cadastrar (SLA D0)
                  </option>
                  <option value="Atendimento PAVAS (Vítimas de Assalto/Sequestro)">
                    Atendimento PAVAS — Valor a cadastrar (Urgente)
                  </option>
                  <option value="EPS - Exames Periódicos de Saúde BB">
                    EPS - Periódico Banco do Brasil — Valor a cadastrar
                  </option>
                  <option value="Exame Médico Admissional">
                    Exame Admissional — Valor a cadastrar
                  </option>
                  <option value="Exame Médico Demissional">
                    Exame Demissional — Valor a cadastrar
                  </option>
                  <option value="Avaliação de Capacidade Laborativa e Deficiência (PCD)">
                    Avaliação PCD / Capacidade — Valor a cadastrar
                  </option>
                  <option value="Homologação de Atestados e Perícia Médica">
                    Homologação / Perícia Médica — Valor a cadastrar
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Código TISS</Label>
                  <Input
                    disabled
                    value={newOrder.tissCode}
                    className="bg-slate-950 border-slate-800 text-xs text-amber-300 font-mono rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Valor Fixo Contratual</Label>
                  <Input
                    disabled
                    value={`R$ ${newOrder.price.toFixed(2)}`}
                    className="bg-slate-950 border-slate-800 text-xs text-emerald-400 font-bold rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">
                    Nome do Funcionário BB *
                  </Label>
                  <Input
                    required
                    placeholder="Nome completo do bancário"
                    value={newOrder.employeeName}
                    onChange={(e) => setNewOrder({ ...newOrder, employeeName: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Matrícula BB</Label>
                  <Input
                    placeholder="Ex: BB-7.892.411-0"
                    value={newOrder.employeeMatricula}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, employeeMatricula: e.target.value })
                    }
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300 font-bold">Agência / Dependência BB</Label>
                <Input
                  placeholder="Ex: Agência Batel (1500) - Curitiba/PR"
                  value={newOrder.unitOrAgency}
                  onChange={(e) => setNewOrder({ ...newOrder, unitOrAgency: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">Número Guia SP/SADT *</Label>
                  <Input
                    required
                    placeholder="Ex: SP-SADT-9821099"
                    value={newOrder.guideSadtNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, guideSadtNumber: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-bold">
                    Senha de Autorização CASSI *
                  </Label>
                  <Input
                    required
                    placeholder="Ex: AUT-782991-BB"
                    value={newOrder.authPassword}
                    onChange={(e) => setNewOrder({ ...newOrder, authPassword: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-xs text-white rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewModal(false)}
                  className="text-slate-400 hover:text-white text-xs rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase px-5 rounded-xl shadow-lg"
                >
                  Confirmar Ordem
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
