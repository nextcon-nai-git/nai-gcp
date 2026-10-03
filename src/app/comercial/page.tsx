"use client";

import * as React from "react";
import {
  Calculator,
  ShoppingCart,
  Plus,
  Minus,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
  Briefcase,
  Brain,
  Zap,
  LayoutGrid,
  TrendingUp,
  Globe,
  ExternalLink,
  Search,
  Building2,
  Calendar,
  AlertTriangle,
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
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { NaiQuoteComponent } from "@/components/commercial/nai-quote-component";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { COMMERCIAL_COLUMNS } from "@/types/kanban";
import { OpsTask } from "@/types/schema";
import { cn } from "@/lib/utils";

export default function ComercialPortal() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const [activeTab, setActiveTab] = React.useState("ai");
  const [selectedServices, setSelectedServices] = React.useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);

  // Estados para o Radar PNCP
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
    const companyId = profile.companyId;
    return (
      ["SUPER_ADMIN", "ENGINEER", "DOCTOR", "ADMIN"].includes(role) &&
      (!companyId || companyId === "")
    );
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

  const companiesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "companies"), orderBy("name", "asc"));
  }, [db]);
  const { data: companies, isLoading: loadingCompanies } = useCollection<any>(companiesQuery);

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

  const totalValueManual = React.useMemo(() => {
    let total = 0;
    SST_CATALOG.forEach((cat) => {
      cat.services.forEach((svc) => {
        if (selectedServices[svc.id]) {
          total += svc.basePrice * selectedServices[svc.id];
        }
      });
    });
    return total;
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
        } else {
          toast({
            title: "Radar Atualizado",
            description: `${json.oportunidades.length} oportunidades encontradas.`,
          });
        }
      } else {
        setErroRadar(json.erro || "Falha na resposta do servidor governamental.");
      }
    } catch (err) {
      setErroRadar(
        "Falha crítica na conexão com a base de dados do Governo. Verifique o log da API."
      );
    } finally {
      setLoadingRadar(false);
    }
  };

  async function handleSaveManualProposal() {
    if (!db || !profile) return;
    setIsSaving(true);
    try {
      const proposalData = {
        title: `Proposta Manual - ${profile.name}`,
        companyId: profile.companyId || "leads",
        companyName: profile.name,
        type: "comercial",
        status: "to_review",
        priority: "medium",
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        totalValue: totalValueManual,
        services: selectedServices,
        checklist: [
          { id: "1", text: "Validar quantidades", checked: false, mandatory: true },
          { id: "2", text: "Gerar PDF formal", checked: false, mandatory: true },
        ],
      };
      const colRef = collection(db, "companies", profile.companyId || "leads", "tasks");
      await addDocumentNonBlocking(colRef, proposalData);
      toast({
        title: "Proposta Salva!",
        description: "Card comercial criado na etapa 'Propostas a Revisar'.",
      });
      setActiveTab("cards");
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSeedData() {
    if (!db) return;
    setIsSeeding(true);
    try {
      const clients = [
        {
          name: "Alpha Tech",
          scope: "Alocação de TST (PJ) em SJP/PR, SL/MA e Natal/RN.",
          activities: "Inspeções, Atividades Críticas, EPIs/EPCs, DDS, NRs.",
          regime: "2 dias/localidade (8h/dia)",
          type: "comercial",
          status: "implementation",
          value: 15000,
        },
        {
          name: "Britânia / Philco (Manaus/AM)",
          scope: "Consultoria Ergonomia e Fisioterapia do Trabalho (4 CNPJs).",
          activities: "AETs, Treinamentos Posturais, Cinesio-funcionais, Luximetry.",
          type: "comercial",
          status: "approved",
          value: 25000,
        },
        {
          name: "Time Now (ArcelorMittal)",
          scope: "Documentos Técnicos SST (25 colaboradores, 6 GHEs).",
          activities: "LTCAT, AEP, LTIP (Elétrica).",
          type: "comercial",
          status: "implementation",
          value: 8500,
        },
        {
          name: "Time Now (Braskem)",
          scope: "Serviços SST Plantas PVC e UCS.",
          activities: "LTCAT, Dosimetrias, AEPs, PCA, PPR, Fit Tests.",
          type: "comercial",
          status: "implementation",
          value: 12000,
        },
        {
          name: "Lvalle",
          scope: "Serviços de TST.",
          type: "comercial",
          status: "approved",
          value: 5000,
        },
        {
          name: "Midea",
          scope: "Alocação de TST (Faturamento via NF específica).",
          type: "comercial",
          status: "approved",
          value: 7000,
        },
        {
          name: "Roofservice",
          scope: "Alocação de TST (11 dias, Seg-Sab) - Início Jan 20, 2026.",
          type: "comercial",
          status: "implementation",
          value: 4500,
        },
        {
          name: "BRDE",
          scope: "Serviços Médicos (Médico do Trabalho) - 2 profissionais.",
          type: "comercial",
          status: "approved",
          value: 18000,
        },
        {
          name: "Noxi",
          scope: "Execução de Laudos e Alocação de TST.",
          type: "comercial",
          status: "approved",
          value: 6000,
        },
        {
          name: "Nativa Empreendimentos",
          scope: "Engenharia e Treinamentos de CIPA.",
          type: "comercial",
          status: "implementation",
          value: 9000,
        },
        {
          name: "EP Teixeira (Esquina da Gulla)",
          scope: "Mensalidade recorrente e Visitas Técnicas.",
          type: "comercial",
          status: "approved",
          value: 1200,
        },
      ];

      for (const client of clients) {
        const taskId = client.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const colRef = collection(db, "companies", "leads", "tasks");
        await addDocumentNonBlocking(colRef, {
          id: taskId,
          title: client.name,
          companyId: "leads",
          companyName: client.name,
          type: client.type as any,
          status: client.status as any,
          priority: "high",
          dueDate: new Date(2026, 5, 1).toISOString(),
          createdAt: new Date().toISOString(),
          totalValue: client.value,
          checklist: [
            { id: "1", text: client.scope, checked: true, mandatory: true },
            {
              id: "2",
              text: client.activities || "Execução do escopo acordado",
              checked: false,
              mandatory: true,
            },
          ],
        });
      }
      toast({
        title: "Dados Inseridos!",
        description: "Os clientes reais agora estão no funil comercial.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na Migração" });
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Inteligência Comercial
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest mt-2 flex items-center gap-2">
            <Sparkles className="size-3 text-accent" /> Gestão de Oportunidades e Vendas SST 2026.
          </p>
        </div>
        <div className="flex gap-2">
          {isGlobalAdmin && (
            <Button
              onClick={handleSeedData}
              disabled={isSeeding}
              variant="outline"
              className="h-10 border-accent text-accent hover:bg-accent hover:text-primary font-black uppercase text-[9px] px-4 rounded-xl"
            >
              {isSeeding ? (
                <Loader2 className="size-3 animate-spin mr-2" />
              ) : (
                <Zap className="size-3 mr-2" />
              )}
              Importar Clientes Reais
            </Button>
          )}
          <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest h-10 px-4 border border-white/10">
            MÓDULO VENDAS
          </Badge>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[950px] grid-cols-4 bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="ai"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <Brain className="size-4" /> Consultoria NAI (IA)
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <Calculator className="size-4" /> Simulador Manual
          </TabsTrigger>
          <TabsTrigger
            value="cards"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <LayoutGrid className="size-4" /> Funil de Vendas
          </TabsTrigger>
          <TabsTrigger
            value="clients"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600"
          >
            <Building2 className="size-4" /> Clientes na Base
          </TabsTrigger>
          <TabsTrigger
            value="radar"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-accent"
          >
            <Globe className="size-4" /> Radar PNCP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-primary/5 border-b pb-6 p-8">
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    Catálogo de Serviços
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                    Selecione os itens para compor sua proposta técnica.
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
                        <AccordionTrigger className="hover:no-underline py-6">
                          <div className="flex items-center gap-4 text-left">
                            <div className="p-3 bg-slate-50 rounded-2xl text-primary">
                              <Briefcase className="size-5" />
                            </div>
                            <div>
                              <h3 className="font-black text-primary uppercase text-sm">
                                {category.title}
                              </h3>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">
                                Clique para expandir
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6">
                          <div className="space-y-3 px-2">
                            {category.services.map((svc) => (
                              <div
                                key={svc.id}
                                className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all"
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <p className="font-black text-xs text-primary uppercase leading-tight">
                                    {svc.name}
                                  </p>
                                  <p className="text-[9px] font-black text-accent mt-1 uppercase">
                                    {svc.basePrice.toLocaleString("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    })}{" "}
                                    / {svc.unit}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border">
                                  <button
                                    onClick={() => handleUpdateQty(svc.id, -1)}
                                    className="size-8 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-400"
                                  >
                                    <Minus className="size-4" />
                                  </button>
                                  <span className="text-sm font-black w-8 text-center text-primary">
                                    {selectedServices[svc.id] || 0}
                                  </span>
                                  <button
                                    onClick={() => handleUpdateQty(svc.id, 1)}
                                    className="size-8 rounded-lg bg-primary text-white flex items-center justify-center transition-transform active:scale-95"
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
              <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] sticky top-24 overflow-hidden">
                <CardHeader className="border-b border-white/5 pb-6 p-8">
                  <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                    <ShoppingCart className="size-4" /> Resumo do Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex justify-between items-end mb-6">
                    <p className="text-[10px] font-black uppercase text-white/40">
                      Investimento Total:
                    </p>
                    <h2 className="text-3xl font-black text-accent font-headline">
                      {totalValueManual.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </h2>
                  </div>
                  <Button
                    onClick={handleSaveManualProposal}
                    disabled={totalValueManual === 0 || isSaving}
                    className="w-full h-16 bg-accent text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-2xl gap-3"
                  >
                    {isSaving ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                    Criar Proposta Comercial
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

        <TabsContent value="clients" className="mt-8 animate-in fade-in zoom-in-95">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-emerald-50 border-b p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <CardTitle className="text-2xl font-headline font-black text-emerald-900 uppercase tracking-tight flex items-center gap-3">
                  <Building2 className="size-6 text-emerald-600" />
                  Carteira de Clientes Ativos
                </CardTitle>
                <CardDescription className="text-sm font-medium text-emerald-700/70">
                  Todas as empresas prospectadas e ativas cadastradas no sistema.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest h-10 px-4 border-none">
                {companies?.length || 0} Empresas
              </Badge>
            </CardHeader>
            <CardContent className="p-8">
              {loadingCompanies ? (
                <div className="flex flex-col items-center justify-center gap-6 py-24">
                  <Loader2 className="size-12 animate-spin text-emerald-600 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/40">
                    Sincronizando Banco de Dados...
                  </p>
                </div>
              ) : companies && companies.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companies.map((company) => (
                    <div
                      key={company.id}
                      className="p-5 bg-slate-50 border rounded-2xl flex justify-between items-center group hover:border-emerald-500 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-10 bg-white border rounded-xl flex items-center justify-center shrink-0">
                          <Building2 className="size-5 text-slate-400 group-hover:text-emerald-500" />
                        </div>
                        <div>
                          <p
                            className="font-black text-sm text-slate-800 uppercase leading-tight line-clamp-1"
                            title={company.name}
                          >
                            {company.name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                            {company.id}
                          </p>
                        </div>
                      </div>
                      {company.active && (
                        <div className="size-3 bg-emerald-500 rounded-full shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 opacity-20 flex flex-col items-center gap-4">
                  <Building2 className="size-16" />
                  <p className="font-black uppercase text-xs tracking-widest">
                    Nenhuma empresa encontrada
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="radar"
          className="mt-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500"
        >
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                    <Globe className="size-6" />
                  </div>
                  <CardTitle className="text-2xl font-headline font-black text-primary uppercase tracking-tight">
                    Radar de Contratos Públicos
                  </CardTitle>
                </div>
                <CardDescription className="text-sm font-medium text-slate-400">
                  Monitoramento em tempo real do PNCP (Editais de SST).
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
                {loadingRadar ? "Vasculhando Portais..." : "Capturar Oportunidades"}
              </Button>
            </CardHeader>
            <CardContent className="p-8 md:p-10 min-h-[400px]">
              {erroRadar && (
                <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-700 mb-8">
                  <AlertTriangle className="size-6 shrink-0" />
                  <p className="text-sm font-bold italic">"{erroRadar}"</p>
                </div>
              )}

              {licitacoes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {licitacoes.map((item, index) => (
                    <div
                      key={index}
                      className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all flex flex-col group shadow-sm bg-white"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <Badge
                          variant="outline"
                          className="bg-white border-primary/10 text-primary/60 text-[8px] font-black uppercase h-6"
                        >
                          ID: {item.numeroContratacao || "PNCP"}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase h-6">
                          Edital Ativo
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="size-3.5 text-slate-400" />
                        <h3 className="font-black text-primary uppercase text-[11px] leading-tight line-clamp-2">
                          {item.orgaoEntidade?.razaoSocial || "Órgão Público"}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-500 font-medium italic leading-relaxed line-clamp-3 mb-6">
                        "{item.objetoCompra}"
                      </p>

                      <div className="mt-auto space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-white rounded-xl border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                              <Calendar className="size-2" /> Publicação
                            </p>
                            <p className="text-[10px] font-bold text-primary">
                              {new Date(item.dataPublicacaoPncp).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="p-3 bg-white rounded-xl border border-slate-100 text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1 justify-end">
                              <TrendingUp className="size-2 text-accent" /> Estimado
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
                          className="w-full h-11 bg-primary/5 hover:bg-primary hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all gap-2"
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
                <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center space-y-4">
                  <Globe className="size-20" />
                  <div className="max-w-xs">
                    <p className="text-xl font-black uppercase tracking-widest text-primary">
                      Radar em Standby
                    </p>
                    <p className="text-sm font-bold">
                      Clique no botão superior para escanear oportunidades nos portais do Governo.
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
