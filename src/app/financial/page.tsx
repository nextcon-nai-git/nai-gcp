"use client";

import * as React from "react";
import Link from "next/link";
import {
  DollarSign,
  Briefcase,
  Layers,
  TrendingDown,
  Calculator,
  UserCheck,
  Scale,
  Plus,
  Building2,
  FileText,
  FileUp,
  TrendingUp,
  Stethoscope,
  Activity,
  HeartPulse,
  History,
  MoreVertical,
  Loader2,
  Database,
  Cpu,
  CloudLightning,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  CreditCard,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, collectionGroup, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import {
  CETESB_SESMT_TEAM,
  CETESB_BILLING_MATRIX,
  CETESB_JULY_2026_BILLING,
} from "@/lib/real-data";
import { FiscalIntelligenceTab } from "@/components/financial/fiscal-intelligence-tab";
import { BankStatementConciliation } from "@/components/financial/bank-statement-conciliation";
import { DreStatementTab } from "@/components/financial/dre-statement-tab";
import { useSgi } from "@/contexts/sgi-context";
import { useFinancialContracts } from "@/hooks/use-financial-contracts";

export default function FinancialModule() {
  const [activeTab, setActiveTab] = React.useState("dre");
  const { user, role } = useUser();
  const db = useFirestore();
  const { activeClientId, isGlobalStaff } = useSgi();

  const profileRef = useMemoFirebase(
    () => (!db || !user ? null : doc(db, "users", user.uid)),
    [db, user]
  );
  const { data: profile } = useDoc(profileRef);

  const activeCompanyRef = useMemoFirebase(
    () => (!db || activeClientId === "all" ? null : doc(db, "companies", activeClientId)),
    [db, activeClientId]
  );
  const { data: activeCompany } = useDoc(activeCompanyRef);

  const {
    data: contracts,
    isLoading: loadingContracts,
    error: contractsError,
    refresh: refreshContracts,
  } = useFinancialContracts(activeClientId);

  const totalContractValue = React.useMemo(
    () => (contracts || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
    [contracts]
  );

  const isCetesb = activeClientId === "CETESB_080680";

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5">
            FINANCIAL & ERP MODULE
          </Badge>
          <h1 className="text-4xl font-headline font-black text-primary tracking-tighter uppercase leading-none">
            Controle de Faturamento
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.3em] mt-2 flex items-center gap-2">
            <Building2 className="size-3.5 text-accent" />{" "}
            {activeClientId === "all"
              ? "Consolidação Global Nextcon"
              : activeCompany?.name || "Unidade Técnica"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-2xl h-12">
            <Link href="/financial/monthly-billing">Faturamento mensal por grupo</Link>
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-primary text-primary h-12 px-6 rounded-2xl font-black uppercase text-[10px] btn-hover-effect shadow-sm"
            onClick={() => setActiveTab("sesmt")}
          >
            <UserCheck className="size-4" /> Gestão SESMT
          </Button>
          <Button className="gradient-nextcon text-white hover:opacity-90 gap-3 h-12 px-8 shadow-xl font-black uppercase text-[10px] rounded-2xl btn-hover-effect">
            <Plus className="size-5 text-accent" /> Lançar Avulso
          </Button>
        </div>
      </header>

      <Link
        href="/financial/livro-diario"
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50 p-5 transition-colors hover:bg-teal-100/70"
      >
        <div className="flex items-center gap-4">
          <FileSpreadsheet className="size-8 text-teal-700" />
          <div>
            <h2 className="font-semibold text-slate-900">Livro Diário</h2>
            <p className="mt-1 text-sm text-slate-600">
              Explore lançamentos, contas e indicadores com rastreabilidade ao PDF original.
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-sm font-semibold text-teal-800">
          Abrir acervo <ArrowRight size={16} />
        </span>
      </Link>
      {/* INTEGRAÇÃO SENIOR / OMIE STATUS */}
      {activeClientId !== "all" && (
        <Card className="border-none bg-blue-50/50 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-blue-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-6">
            <div
              className={cn(
                "p-5 rounded-[1.5rem] shadow-2xl transition-all duration-500 group",
                activeCompany?.use_senior ? "bg-blue-600 text-white" : "bg-indigo-600 text-white"
              )}
            >
              {activeCompany?.use_senior ? (
                <Cpu size={28} className="group-hover:rotate-12 transition-transform" />
              ) : (
                <CloudLightning size={28} className="group-hover:scale-110 transition-transform" />
              )}
            </div>
            <div className="text-left space-y-1">
              <h4 className="text-lg font-black text-primary uppercase font-headline">
                Integração ERP {activeCompany?.use_senior ? "Senior (G7/X)" : "Omie"}
              </h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                Status: Sincronização em Tempo Real Ativa
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[10px] px-5 h-10 flex items-center gap-2 rounded-xl">
              <ShieldCheck className="size-4" /> API SECURE
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-xl text-primary font-black uppercase text-[10px] gap-2 px-5 bg-white shadow-sm border border-slate-200 btn-hover-effect"
            >
              Configurar Webhook <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Receita Bruta 2026"
          amount="R$ 1.159.556,54"
          trend="Acumulado"
          icon={Briefcase}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          title="Resultado Líquido"
          amount="+R$ 231.116,76"
          trend="+19.9% Margem"
          icon={TrendingUp}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <StatCard
          title="Mês Recorde (Ago/26)"
          amount="R$ 335.581,19"
          trend="Lucro R$ 197k"
          icon={Sparkles}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          title="Medição Cetesb"
          amount="R$ 46.603,75"
          trend="Protocolado"
          icon={Calculator}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-[2rem] h-16 shadow-inner">
            <TabsTrigger
              value="dre"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <FileSpreadsheet className="size-4" /> DRE Gerencial 2026 (Oficial)
            </TabsTrigger>
            <TabsTrigger
              value="bank_statement"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-red-600 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <CreditCard className="size-4" /> Extrato Santander (Conciliado)
            </TabsTrigger>
            <TabsTrigger
              value="overview"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="contracts"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              Contratos
            </TabsTrigger>
            <TabsTrigger
              value="fiscal"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-accent data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              <Database className="size-4" /> Inteligência Fiscal
            </TabsTrigger>
            <TabsTrigger
              value="sesmt"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              Time SESMT
            </TabsTrigger>
            {(isCetesb || activeClientId === "all") && (
              <TabsTrigger
                value="cetesb_matrix"
                className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-emerald-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-lg"
              >
                Medição Técnica (Julho/26)
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-10 space-y-8 focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Card de Faturamento Rápido se for Cetesb */}
            {isCetesb && (
              <Card className="lg:col-span-2 border-none bg-emerald-50 rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-10 border border-emerald-100 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000 group-hover:rotate-12">
                  <TrendingUp size={240} className="text-emerald-600" />
                </div>
                <div className="space-y-8 flex-1 relative z-10">
                  <Badge className="bg-emerald-600 text-white border-none font-black text-[9px] tracking-[0.4em] h-7 px-4 shadow-lg rounded-lg">
                    MEDIÇÃO PROTOCOLADA
                  </Badge>
                  <h3 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter">
                    Resumo Executivo Julho/2026
                  </h3>
                  <p className="text-lg font-medium text-emerald-800 leading-relaxed italic max-w-xl">
                    "O faturamento total de{" "}
                    <strong className="text-emerald-950">R$ 46.603,75</strong> foi validado e está
                    pronto para emissão de nota fiscal técnica."
                  </p>
                </div>
                <div className="text-center md:text-right shrink-0 relative z-10 bg-white/20 p-8 rounded-[2.5rem] backdrop-blur-md border border-white/30 shadow-2xl">
                  <p className="text-[11px] font-black uppercase text-emerald-700 tracking-widest mb-2">
                    Valor Total do Período
                  </p>
                  <h2 className="text-4xl font-black text-primary font-headline tabular-nums leading-none mb-6">
                    R$ 46.603,75
                  </h2>
                  <Button
                    onClick={() => setActiveTab("cetesb_matrix")}
                    className="w-full bg-primary text-white h-14 px-8 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl gap-3 btn-hover-effect"
                  >
                    Ver Detalhamento <ArrowRight size={18} className="text-accent" />
                  </Button>
                </div>
              </Card>
            )}

            <Card className="lg:col-span-1 bg-[#090e24] text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl border-2 border-white/5 flex flex-col justify-center">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Zap className="size-48 text-accent animate-pulse" />
              </div>
              <div className="relative z-10 space-y-8 text-left">
                <Badge className="bg-accent text-primary border-none text-[9px] font-black uppercase tracking-[0.3em] px-4 h-7 flex items-center w-fit shadow-lg">
                  PERSISTÊNCIA ERP
                </Badge>
                <div className="space-y-3">
                  <h4 className="text-2xl font-black uppercase tracking-tight font-headline">
                    Status do Razão
                  </h4>
                  <p className="text-sm text-white/50 leading-relaxed font-medium">
                    O fechamento fiscal de Fevereiro está{" "}
                    <span className="text-accent font-black">92% concluído</span>. Aguardando
                    sincronização final das rubricas.
                  </p>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: "92%" }} />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fiscal" className="mt-10 focus-visible:ring-0">
          <FiscalIntelligenceTab />
        </TabsContent>

        <TabsContent value="cetesb_matrix" className="mt-10 space-y-8 focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[3rem] overflow-hidden border-2 border-slate-50">
              <CardHeader className="bg-emerald-600 text-white p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <FileText size={180} />
                </div>
                <div className="flex justify-between items-center relative z-10">
                  <div className="space-y-2">
                    <CardTitle className="text-3xl font-headline font-black uppercase tracking-tight">
                      Memória de Medição: Jul/26
                    </CardTitle>
                    <CardDescription className="text-emerald-100 font-bold uppercase text-[11px] tracking-[0.3em] mt-1">
                      Consolidação de Horas e Especialidades
                    </CardDescription>
                  </div>
                  <Badge className="bg-white text-emerald-700 font-black h-10 px-8 rounded-[1.25rem] shadow-xl border-none">
                    STATUS: FINALIZADO
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/80 text-[11px] font-black uppercase">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="pl-10 py-6">Rubrica de Serviço Prestado</TableHead>
                      <TableHead className="text-right pr-10">Valor Protocolado (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CETESB_JULY_2026_BILLING.services.map((svc) => (
                      <TableRow
                        key={svc.id}
                        className="hover:bg-slate-50 transition-all group border-b last:border-none"
                      >
                        <TableCell className="pl-10 py-8">
                          <div className="flex items-center gap-6">
                            <div className="size-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all">
                              <CheckCircle2 size={24} />
                            </div>
                            <div className="space-y-1">
                              <span className="font-black text-sm text-primary uppercase block tracking-tight">
                                {svc.name}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                Gatilho eSocial: OK
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          <span className="text-lg font-black text-primary font-headline tabular-nums">
                            {svc.value.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 shadow-inner">
                      <TableCell className="pl-10 py-12 font-black text-primary text-xl uppercase font-headline tracking-tighter">
                        Faturamento Total do Período
                      </TableCell>
                      <TableCell className="text-right pr-10 py-12 font-black text-emerald-600 text-3xl font-headline tabular-nums">
                        {CETESB_JULY_2026_BILLING.totalValue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-8 text-left">
              <Card className="bg-[#090e24] text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl group border-2 border-white/5 h-fit">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                  <Zap className="size-48 text-accent" />
                </div>
                <div className="relative z-10 space-y-8">
                  <Badge className="bg-accent text-primary border-none text-[9px] font-black uppercase tracking-widest px-4 h-7 flex items-center w-fit shadow-lg">
                    CONFORMIDADE TÉCNICA
                  </Badge>
                  <div className="space-y-4">
                    <h4 className="text-2xl font-black uppercase tracking-tight font-headline">
                      Parecer da Auditoria
                    </h4>
                    <p className="text-base italic text-slate-300 font-medium leading-relaxed">
                      "As rubricas médicas e de engenharia foram cruzadas com os logs de ponto
                      digital e evidências de plantão, garantindo 100% de integridade financeira."
                    </p>
                  </div>
                  <div className="pt-6 border-t border-white/10 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/30">
                      <span>Rastreabilidade</span>
                      <span className="text-emerald-400">NAI SECURE-SYNC</span>
                    </div>
                    <Button className="w-full h-16 bg-accent hover:opacity-90 text-primary font-black uppercase text-[11px] tracking-widest rounded-2xl shadow-2xl gap-3 btn-hover-effect">
                      <FileText className="size-5" /> Exportar p/ Fiscalização
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-10 focus-visible:ring-0">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden border-2 border-slate-50">
            <CardHeader className="bg-slate-50 border-b p-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-left w-full space-y-1">
                <CardTitle className="text-2xl font-black text-primary uppercase font-headline tracking-tighter">
                  Repositório de Contratos Globais
                </CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                  Dossiês comerciais e financeiros unificados.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Badge className="bg-primary/5 text-primary border-none font-black text-[9px] h-8 px-5 rounded-full">
                  {contracts?.length || 0} Ativos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {contractsError ? (
                <div role="alert" className="p-8 text-sm text-amber-800">
                  <p>{contractsError}</p>
                  <Button variant="outline" className="mt-3" onClick={refreshContracts}>
                    Tentar novamente
                  </Button>
                </div>
              ) : loadingContracts ? (
                <div className="py-24 text-center flex flex-col items-center gap-4 opacity-20">
                  <Loader2 className="animate-spin size-12 text-primary" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em]">
                    Cruzando Base de Dados...
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="pl-10 py-6">Empresa / Unidade</TableHead>
                      <TableHead>Título do Acordo</TableHead>
                      <TableHead>Faturamento Médio</TableHead>
                      <TableHead className="text-center">Status SGI</TableHead>
                      <TableHead className="pr-10 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts?.map((contract) => (
                      <TableRow
                        key={contract.id}
                        className="hover:bg-slate-50 transition-all group border-b last:border-none cursor-pointer"
                      >
                        <TableCell className="pl-10 py-8">
                          <div className="flex items-center gap-5">
                            <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner group-hover:shadow-2xl group-hover:rotate-6">
                              <Building2 size={24} />
                            </div>
                            <p className="font-black text-sm text-primary uppercase font-headline tracking-tight">
                              {contract.companyName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-500 uppercase tracking-tight">
                          {contract.title}
                        </TableCell>
                        <TableCell className="text-lg font-black text-primary font-headline tabular-nums">
                          {(Number(contract.value) || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] h-7 px-4 rounded-xl uppercase shadow-sm">
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-10 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-12 rounded-2xl text-slate-300 hover:text-primary hover:bg-white hover:shadow-xl transition-all"
                          >
                            <ChevronRight size={24} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sesmt" className="mt-10 focus-visible:ring-0">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden border-2 border-slate-50">
            <CardHeader className="bg-slate-50 border-b p-10 text-left space-y-1">
              <CardTitle className="text-2xl font-black text-primary uppercase font-headline tracking-tighter">
                Contratos Especialistas (PJ)
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                Time SESMT Consolidado 2026 • Alocação e Custos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="pl-10 py-6">Profissional / Clínica</TableHead>
                    <TableHead>Contrato ID</TableHead>
                    <TableHead>Carga Horária</TableHead>
                    <TableHead className="pr-10 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CETESB_SESMT_TEAM.map((prof) => (
                    <TableRow
                      key={prof.id}
                      className="hover:bg-slate-50 transition-all border-b last:border-none group"
                    >
                      <TableCell className="pl-10 py-8">
                        <div className="flex items-center gap-6 text-left">
                          <div
                            className={cn(
                              "size-14 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl transition-all group-hover:scale-110",
                              prof.role === "DOCTOR"
                                ? "bg-blue-600"
                                : prof.role === "ENGINEER"
                                  ? "bg-emerald-600"
                                  : "bg-red-600"
                            )}
                          >
                            {prof.role === "DOCTOR" ? (
                              <Stethoscope size={24} />
                            ) : prof.role === "ENGINEER" ? (
                              <Activity size={24} />
                            ) : (
                              <HeartPulse size={24} />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-sm text-primary uppercase font-headline leading-none mb-1.5">
                              {prof.name}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {prof.specialty}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-black text-slate-500">
                        {prof.contractId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-slate-50 border-slate-200 text-slate-700 font-black h-8 px-4 rounded-xl text-[10px] shadow-sm"
                        >
                          {typeof prof.dailyHours === "number"
                            ? `${prof.dailyHours}h / Dia`
                            : prof.dailyHours}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-10 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-10 rounded-xl text-slate-300 hover:text-primary"
                        >
                          <MoreVertical size={20} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dre" className="mt-10 focus-visible:ring-0">
          <DreStatementTab />
        </TabsContent>
        <TabsContent value="bank_statement" className="mt-10 focus-visible:ring-0">
          <BankStatementConciliation />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, amount, value, trend, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-[2rem] group hover:ring-2 ring-primary/5 transition-all btn-hover-effect">
      <CardContent className="pt-8 text-left p-8">
        <div className="flex items-center justify-between mb-8">
          <div
            className={cn(
              "p-4 rounded-[1.25rem] shadow-inner transition-transform group-hover:rotate-6",
              bg,
              color
            )}
          >
            <Icon size={24} />
          </div>
          <Badge
            variant="outline"
            className="text-[9px] font-black uppercase tracking-tighter border-slate-100 bg-slate-50 px-3 h-6 rounded-lg"
          >
            {trend}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-2">
            {title}
          </p>
          <h2
            className={cn(
              "text-3xl font-black font-headline tracking-tighter tabular-nums leading-none",
              color
            )}
          >
            {amount || value}
          </h2>
        </div>
      </CardContent>
    </Card>
  );
}
