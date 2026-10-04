"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calculator,
  ShoppingCart,
  Plus,
  Minus,
  FileText,
  Loader2,
  Sparkles,
  Briefcase,
  Brain,
  LayoutGrid,
  TrendingUp,
  Globe,
  ExternalLink,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, collectionGroup, limit } from "firebase/firestore";
import { SST_CATALOG } from "@/lib/services-data";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NaiQuoteComponent } from "@/components/commercial/nai-quote-component";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { COMMERCIAL_COLUMNS } from "@/types/kanban";
import { OpsTask } from "@/types/schema";

export default function ComercialPortal() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const [activeTab, setActiveTab] = React.useState("ai");
  const [selectedServices, setSelectedServices] = React.useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const [licitacoes, setLicitacoes] = React.useState<any[]>([]);
  const [loadingRadar, setLoadingRadar] = React.useState(false);
  const [erroRadar, setErroRadar] = React.useState("");

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    return ["SUPER_ADMIN", "ADMIN"].includes(role);
  }, [profile]);

  const commercialTasksQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;
    if (isGlobalAdmin) {
      return query(collectionGroup(db, "tasks"), orderBy("createdAt", "desc"), limit(50));
    }
    if (profile.companyId) {
      return query(
        collection(db, "companies", profile.companyId, "tasks"),
        orderBy("createdAt", "desc"),
        limit(50)
      );
    }
    return null;
  }, [db, profile, isGlobalAdmin]);

  const { data: allTasks, isLoading: loadingTasks } = useCollection<OpsTask>(commercialTasksQuery);

  const commercialTasks = React.useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) =>
      ["to_review", "sent", "approved", "implementation"].includes(t.status)
    );
  }, [allTasks]);

  const handleUpdateQty = (serviceId: string, delta: number) => {
    setSelectedServices((prev) => {
      const current = prev[serviceId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [serviceId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [serviceId]: next };
    });
  };

  const totalItemsCount = React.useMemo(() => {
    return Object.values(selectedServices).reduce((acc, curr) => acc + curr, 0);
  }, [selectedServices]);

  const buscarLicitacoes = async () => {
    setLoadingRadar(true);
    setErroRadar("");
    setLicitacoes([]);

    try {
      const res = await fetch("/api/licitacoes");
      const json = await res.json();

      if (json.sucesso) {
        setLicitacoes(json.oportunidades);
        if (json.oportunidades.length === 0) {
          setErroRadar("Nenhum edital novo localizado com os termos técnicos de SST hoje.");
        }
      } else {
        setErroRadar(json.erro || "Falha na resposta do servidor governamental.");
      }
    } catch (err) {
      setErroRadar("Falha crítica na conexão com a base de dados do Governo.");
    } finally {
      setLoadingRadar(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Inteligência Comercial
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest mt-2 flex items-center gap-2">
            <Sparkles className="size-3 text-accent" /> Gestão de Oportunidades e Vendas SST 2026.
          </p>
        </div>
        <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest h-10 px-4 border border-white/10 shadow-lg">
          MÓDULO VENDAS
        </Badge>
      </header>

      {/* PROPOSTAS ESTRATÉGICAS EM DESTAQUE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link href="/comercial/infobip-sipat" className="group">
          <Card className="rounded-3xl border-2 border-orange-200/80 bg-gradient-to-br from-white via-orange-50/20 to-orange-100/30 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-orange-500 text-white font-black text-[9px] uppercase tracking-wider px-3 h-6">
                  CLIENTE INFOBIP
                </Badge>
                <span className="text-xs font-black font-headline text-emerald-700">
                  R$ 3.878,91
                </span>
              </div>
              <h3 className="font-black text-base text-primary uppercase leading-snug group-hover:text-orange-600 transition-colors">
                Semana SIPAT 2026 — 3 Palestras & Quick Massage
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Proposta técnica-comercial personalizada para a Infobip (Curitiba/PR) com 11h de
                ações corporativas.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-orange-100 flex items-center justify-between text-xs font-black text-orange-600 uppercase tracking-wider">
              <span>Abrir Proposta Executiva</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/comercial/middleware-integrations" className="group">
          <Card className="rounded-3xl border-2 border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider px-3 h-6">
                  MIDDLEWARE NAI
                </Badge>
                <span className="text-xs font-black font-headline text-emerald-700">
                  R$ 175/integrador
                </span>
              </div>
              <h3 className="font-black text-base text-primary uppercase leading-snug group-hover:text-emerald-700 transition-colors">
                Integrações ERP: TOTVS, Senior & NAI
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Sincronização de vidas, ASO, atestados na folha, NAI-GED e WhatsApp Bot com setup
                grátis.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-emerald-100 flex items-center justify-between text-xs font-black text-emerald-700 uppercase tracking-wider">
              <span>Ver Proposta & Simulador</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/comercial/multidisciplinary-proposal" className="group">
          <Card className="rounded-3xl border-2 border-blue-100 bg-gradient-to-br from-white via-blue-50/20 to-blue-100/30 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider px-3 h-6">
                  IN COMPANY
                </Badge>
                <span className="text-xs font-black font-headline text-emerald-700">
                  R$ 12.000,00 /mês
                </span>
              </div>
              <h3 className="font-black text-base text-primary uppercase leading-snug group-hover:text-blue-600 transition-colors">
                Gestão Multidisciplinar Corporativa
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Médico, Fisioterapeuta Ergonomista e Psicólogo do Trabalho alocados na operação do
                cliente.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-blue-100 flex items-center justify-between text-xs font-black text-blue-600 uppercase tracking-wider">
              <span>Ver Proposta & Escala</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>

        <Link href="/comercial/construction-proposal" className="group">
          <Card className="rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/50 p-6 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden h-full flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-slate-900 text-white font-black text-[9px] uppercase tracking-wider px-3 h-6">
                  OBRAS & ENGENHARIA
                </Badge>
                <span className="text-xs font-black font-headline text-emerald-700">
                  Escala 12x36h
                </span>
              </div>
              <h3 className="font-black text-base text-primary uppercase leading-snug group-hover:text-slate-900 transition-colors">
                SESMT & Ambulatório Canteiro de Obras
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Dimensionamento operacional para grandes empreendimentos, NR-18 e gestão de
                emergências.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-700 uppercase tracking-wider">
              <span>Simular Dimensionamento</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Card>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-2xl h-16">
            <TabsTrigger
              value="ai"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <Brain className="size-4" /> Consultoria NAI (IA)
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <Calculator className="size-4" /> Gerador de Escopo
            </TabsTrigger>
            <TabsTrigger
              value="cards"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <LayoutGrid className="size-4" /> Funil de Vendas
            </TabsTrigger>
            <TabsTrigger
              value="radar"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 text-accent"
            >
              <Globe className="size-4" /> Radar PNCP
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="manual" className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-primary/5 border-b pb-6 p-8">
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    Definição de Escopo Técnico
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                    Selecione os itens para compor sua proposta estratégica.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <Accordion type="multiple" className="w-full">
                    {SST_CATALOG.map((category) => (
                      <AccordionItem
                        key={category.id}
                        value={category.id}
                        className="border-b last:border-none"
                      >
                        <AccordionTrigger className="hover:no-underline py-6 group">
                          <div className="flex items-center gap-4 text-left">
                            <div className="p-3 bg-slate-50 rounded-2xl text-primary group-data-[state=open]:bg-primary group-data-[state=open]:text-white transition-all shadow-inner">
                              <Briefcase className="size-5" />
                            </div>
                            <div>
                              <h3 className="font-black text-primary uppercase text-sm">
                                {category.title}
                              </h3>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                Clique para expandir
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2">
                            {category.services.map((svc) => (
                              <div
                                key={svc.id}
                                className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-primary/20 transition-all shadow-sm"
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <p className="font-black text-xs text-primary uppercase leading-tight">
                                    {svc.name}
                                  </p>
                                  <p className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-tighter">
                                    Unidade: {svc.unit}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 bg-white p-1 rounded-2xl shadow-inner border">
                                  <button
                                    onClick={() => handleUpdateQty(svc.id, -1)}
                                    className="size-9 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400"
                                  >
                                    <Minus className="size-4" />
                                  </button>
                                  <span className="text-sm font-black w-8 text-center text-primary">
                                    {selectedServices[svc.id] || 0}
                                  </span>
                                  <button
                                    onClick={() => handleUpdateQty(svc.id, 1)}
                                    className="size-9 rounded-xl bg-primary text-white flex items-center justify-center transition-transform active:scale-95 shadow-lg"
                                  >
                                    <Plus className="size-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] sticky top-24 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
                  <ShoppingCart className="size-32" />
                </div>
                <CardHeader className="border-b border-white/5 pb-6 p-8 relative z-10">
                  <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                    <ShoppingCart className="size-4" /> Resumo do Escopo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6 relative z-10">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black uppercase text-white/40">
                        Itens Selecionados:
                      </p>
                      <h2 className="text-4xl font-black text-accent font-headline tabular-nums">
                        {totalItemsCount}
                      </h2>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] leading-relaxed text-slate-300 font-medium italic">
                        &quot;O escopo selecionado será processado pela NAI para gerar a
                        precificação final baseada no perfil da unidade.&quot;
                      </p>
                    </div>
                  </div>
                  <Button
                    disabled={totalItemsCount === 0 || isSaving}
                    className="w-full h-16 bg-accent text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-2xl gap-3"
                  >
                    {isSaving ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                    Configurar Proposta Final
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-8">
          <NaiQuoteComponent />
        </TabsContent>

        <TabsContent value="cards" className="mt-8">
          <div className="min-h-[600px] glass-panel rounded-[3rem] p-8 relative">
            {loadingTasks ? (
              <div className="flex flex-col items-center justify-center gap-6 py-24">
                <Loader2 className="size-12 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">
                  Sincronizando Funil Comercial...
                </p>
              </div>
            ) : commercialTasks.length > 0 ? (
              <KanbanBoard
                tasks={commercialTasks}
                columns={COMMERCIAL_COLUMNS}
                boardType="commercial"
              />
            ) : (
              <div className="text-center py-32 opacity-20 flex flex-col items-center gap-4">
                <TrendingUp className="size-16" />
                <p className="font-black uppercase text-xs tracking-widest">
                  Nenhuma proposta no funil
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent
          value="radar"
          className="mt-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500"
        >
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                    <Globe className="size-6" />
                  </div>
                  <CardTitle className="text-2xl font-headline font-black text-primary uppercase tracking-tight">
                    Radar de Editais SST
                  </CardTitle>
                </div>
                <CardDescription className="text-sm font-medium text-slate-400">
                  Monitoramento PNCP de oportunidades governamentais.
                </CardDescription>
              </div>
              <Button
                onClick={buscarLicitacoes}
                disabled={loadingRadar}
                className="gradient-nextcon text-white h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl gap-3"
              >
                {loadingRadar ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Search className="size-5" />
                )}
                Capturar Oportunidades
              </Button>
            </CardHeader>
            <CardContent className="p-8 md:p-10 min-h-[400px]">
              {erroRadar && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-700 mb-8 shadow-inner">
                  <AlertTriangle className="size-6 shrink-0" />
                  <p className="text-sm font-bold italic">&quot;{erroRadar}&quot;</p>
                </div>
              )}

              {licitacoes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {licitacoes.map((item, index) => (
                    <div
                      key={index}
                      className="p-6 bg-white rounded-[2.5rem] border border-slate-100 hover:border-primary/20 transition-all flex flex-col group shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <Badge
                          variant="outline"
                          className="bg-slate-50 border-primary/10 text-primary/60 text-[8px] font-black uppercase h-6 px-3"
                        >
                          ID: {item.numeroContratacao || "PNCP"}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase h-6 px-3">
                          Edital Ativo
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <Building2 className="size-4 text-slate-400" />
                        <h3 className="font-black text-primary uppercase text-[11px] leading-tight line-clamp-2">
                          {item.orgaoEntidade?.razaoSocial || "Órgão Público"}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-500 font-medium italic leading-relaxed line-clamp-3 mb-8 bg-slate-50 p-4 rounded-2xl border-2 border-dashed">
                        &quot;{item.objetoCompra}&quot;
                      </p>

                      <div className="mt-auto space-y-4 pt-4 border-t border-dashed">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                              <Calendar size={10} /> Publicação
                            </p>
                            <p className="text-[10px] font-bold text-primary">
                              {new Date(item.dataPublicacaoPncp).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1 justify-end">
                              <TrendingUp size={10} /> Estimado
                            </p>
                            <p className="text-[10px] font-bold text-accent">
                              {item.valorTotalEstimado
                                ? item.valorTotalEstimado.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "A consultar"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          className="w-full h-11 bg-primary/5 hover:bg-primary hover:text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all gap-2"
                          asChild
                        >
                          <a
                            href={item.linkSistemaOrigem}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver Edital Completo <ExternalLink className="size-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !loadingRadar && !erroRadar ? (
                <div className="flex flex-col items-center justify-center py-24 opacity-20 text-center space-y-6">
                  <div className="p-8 bg-slate-50 rounded-full shadow-inner">
                    <Globe size={64} className="text-primary" />
                  </div>
                  <div className="max-w-xs">
                    <p className="text-xl font-black uppercase tracking-[0.2em] text-primary leading-tight">
                      Radar em Standby
                    </p>
                    <p className="text-xs font-bold mt-2">
                      Clique no botão superior para escanear oportunidades no setor público.
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
