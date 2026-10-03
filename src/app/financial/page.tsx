"use client";

import * as React from "react";
import {
  DollarSign,
  ArrowUpRight,
  Database,
  Download,
  Plus,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Scale,
  Sparkles,
  Loader2,
  Briefcase,
  Layers,
  TrendingDown,
  Brain,
  Key,
  FileUp,
  RefreshCw,
  MoreVertical,
  Building2,
  Settings2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { analyzeFiscalScenario } from "@/ai/flows/fiscal-intelligence-flow";
import { useFirestore, useDoc, useMemoFirebase, useCollection, useUser } from "@/firebase";
import { doc, collectionGroup, query, orderBy, collection } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

const cashFlowData = [
  { day: "01/02", entradas: 45000, saidas: 32000, saldo: 13000 },
  { day: "05/02", entradas: 52000, saidas: 28000, saldo: 37000 },
  { day: "10/02", entradas: 38000, saidas: 45000, saldo: 30000 },
  { day: "15/02", entradas: 65000, saidas: 31000, saldo: 64000 },
  { day: "20/02", entradas: 42000, saidas: 22000, saldo: 84000 },
  { day: "25/02", entradas: 58000, saidas: 35000, saldo: 107000 },
];

export default function FinancialModule() {
  const [activeTab, setActiveTab] = React.useState("contracts");
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [isAnalyzingFiscal, setIsAnalyzingFiscal] = React.useState(false);
  const [fiscalAiResult, setFiscalFiscalAiResult] = React.useState<any>(null);

  const [ibptToken, setIbptToken] = React.useState("");
  const [isSavingToken, setIsSavingToken] = React.useState(false);

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

  const contractsQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;
    if (isGlobalAdmin) return query(collectionGroup(db, "contracts"), orderBy("value", "desc"));
    if (profile.companyId)
      return query(
        collection(db, "companies", profile.companyId, "contracts"),
        orderBy("value", "desc")
      );
    return null;
  }, [db, profile, isGlobalAdmin]);

  const { data: contracts, isLoading: loadingContracts } = useCollection(contractsQuery);

  const totalContractValue = React.useMemo(() => {
    return (contracts || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [contracts]);

  const handleAiFiscalAnalysis = async () => {
    setIsAnalyzingFiscal(true);
    try {
      const result = await analyzeFiscalScenario({
        companySegment: "Serviços de Engenharia e Saúde",
        location: profile?.companyName || "Unidade Local",
        monthlyRevenue: totalContractValue || 150000,
      });
      setFiscalFiscalAiResult(result);
      toast({ title: "Análise Fiscal Concluída" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na IA Fiscal" });
    } finally {
      setIsAnalyzingFiscal(false);
    }
  };

  const handleSaveIbptToken = () => {
    if (!db || !profile?.companyId || !ibptToken) return;
    setIsSavingToken(true);
    const compRef = doc(db, "companies", profile.companyId);
    updateDocumentNonBlocking(compRef, {
      "fiscal_config.ibpt_token": ibptToken,
      "fiscal_config.last_ibpt_update": new Date().toISOString(),
    });
    setTimeout(() => {
      setIsSavingToken(false);
      toast({
        title: "Token IBPT Ativado",
        description: "Sincronização automática de impostos habilitada.",
      });
    }, 800);
  };

  const summary = [
    {
      title: "Gestão Ativa",
      amount: totalContractValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      trend: "Acumulado",
      icon: Briefcase,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "ROI Segurança",
      amount: "+R$ 142k",
      trend: "Previsto 2026",
      icon: TrendingDown,
      color: "text-accent",
      bg: "bg-accent/5",
    },
    {
      title: "A Receber",
      amount: "R$ 142.500",
      trend: "Parcelado",
      icon: ArrowUpRight,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Sincronização",
      amount: isGlobalAdmin ? "Rede Global" : "Unidade",
      trend: "Multiapp",
      icon: Layers,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            ERP Financeiro Nextcon
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest">
            Inteligência Fiscal e Governança Bancária 2026.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 border-primary text-primary h-11 px-6 rounded-xl font-bold uppercase text-[10px]"
            onClick={() => setActiveTab("config")}
          >
            <Settings2 className="size-4" /> Configurar Fiscal
          </Button>
          <Button
            onClick={() =>
              toast({
                title: "Lançamento Avulso",
                description: "Iniciando formulário de lançamento financeiro...",
              })
            }
            className="bg-accent text-primary hover:bg-accent/90 gap-2 h-11 px-6 shadow-lg font-black uppercase text-[10px] tracking-widest rounded-xl"
          >
            <Plus className="size-4" /> Lançar Avulso
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.title}
              className="border-none shadow-sm bg-white rounded-2xl overflow-hidden group hover:ring-2 ring-primary/5 transition-all"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${item.bg}`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[8px] font-black uppercase tracking-tighter"
                  >
                    {item.trend}
                  </Badge>
                </div>
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
                  {item.title}
                </p>
                <h2 className="text-xl font-black text-primary font-headline">{item.amount}</h2>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-2xl h-16">
            <TabsTrigger
              value="contracts"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 shrink-0"
            >
              <Briefcase className="size-4" /> Contratos
            </TabsTrigger>
            <TabsTrigger
              value="cashflow"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 shrink-0"
            >
              <TrendingUp className="size-4" /> Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger
              value="fiscal"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 shrink-0 text-accent"
            >
              <Scale className="size-4" /> Governança 2026
            </TabsTrigger>
            <TabsTrigger
              value="config"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 shrink-0"
            >
              <Key className="size-4" /> Configurações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contracts" className="mt-8">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-primary uppercase">
                  Faturamento Global
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Status dos contratos vigentes.
                </CardDescription>
              </div>
              <Button
                onClick={() =>
                  toast({
                    title: "Faturamento em Lote",
                    description: "Processando notas fiscais da rede via integração API...",
                  })
                }
                variant="outline"
                size="sm"
                className="h-10 text-[9px] font-black uppercase border-primary/10"
              >
                Faturar Lote
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingContracts ? (
                <div className="p-20 text-center flex flex-col items-center gap-4">
                  <Loader2 className="size-10 animate-spin text-primary opacity-20" />
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Sincronizando Faturamento...
                  </p>
                </div>
              ) : contracts && contracts.length > 0 ? (
                <Table>
                  <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black">
                    <TableRow>
                      <TableHead className="pl-8">Cliente / Unidade</TableHead>
                      <TableHead>Valor Mensal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right pr-8">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((item, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="pl-8">
                          <p className="font-black text-xs text-primary uppercase">
                            {item.companyName || "Cliente"}
                          </p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">
                            {item.title}
                          </p>
                        </TableCell>
                        <TableCell className="font-black text-xs text-primary">
                          {item.value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-accent/10 text-accent text-[8px] font-black uppercase border-none px-3">
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                            <MoreVertical className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-32 text-center opacity-20 flex flex-col items-center gap-4">
                  <Building2 size={64} className="text-primary" />
                  <p className="font-black uppercase text-xs tracking-widest">
                    Nenhum contrato ativo localizado
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-primary/5 border-b p-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary text-white rounded-2xl">
                    <Key className="size-6 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      Integração IBPT
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                      Lei 12.741/2012 - Transparência de Impostos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Token da Empresa
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Insira o Token IBPT..."
                      value={ibptToken}
                      onChange={(e) => setIbptToken(e.target.value)}
                      className="h-12 bg-slate-50 border-none rounded-xl font-mono text-xs shadow-inner"
                    />
                    <Button
                      onClick={handleSaveIbptToken}
                      disabled={isSavingToken || !ibptToken}
                      className="h-12 px-6 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-lg gap-2"
                    >
                      {isSavingToken ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4 text-accent" />
                      )}
                      Ativar
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="size-4 text-emerald-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase">
                      Status do Token: {profile?.fiscal_config?.ibpt_token ? "Ativo" : "Pendente"}
                    </p>
                    <p className="text-[10px] text-emerald-700 leading-tight">
                      Última sincronização:{" "}
                      {profile?.fiscal_config?.last_ibpt_update
                        ? new Date(profile.fiscal_config.last_ibpt_update).toLocaleDateString(
                            "pt-BR"
                          )
                        : "Nunca"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden border-2 border-dashed border-slate-200">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 text-primary rounded-2xl">
                    <FileUp className="size-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      Importação Manual
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Upload de CSV com alíquotas aproximadas
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 flex flex-col items-center justify-center text-center space-y-4">
                <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200">
                  <FileUp className="size-8 text-slate-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-primary uppercase">
                    Arraste a tabela IBPT aqui
                  </p>
                  <p className="text-[10px] text-slate-400">Suporta formato .CSV oficial</p>
                </div>
                <Button
                  onClick={() =>
                    toast({
                      title: "Importação IBPT",
                      description: "Selecione o arquivo .csv exportado do De Olho no Imposto.",
                    })
                  }
                  variant="ghost"
                  className="text-[10px] font-black uppercase text-primary border border-primary/10 h-10 px-6 rounded-xl"
                >
                  Selecionar Arquivo
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fiscal" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FiscalKpi label="Teto INSS 2026" value="R$ 8.157,41" status="Atualizado Jan/26" />
            <FiscalKpi
              label="Incidência Saúde Mental"
              value="CP + FGTS"
              status="Portaria 13/2026"
            />
            <FiscalKpi label="FAE (S-2240)" value="Sincronizado" status="Integridade SST" />
          </div>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b py-8 px-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-headline font-black text-primary uppercase">
                    Análise de Impacto Governança
                  </CardTitle>
                  <CardDescription className="text-xs font-bold uppercase text-slate-400">
                    Monitoramento de rubricas e cruzamento SST x Folha.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleAiFiscalAnalysis}
                  disabled={isAnalyzingFiscal}
                  className="bg-accent text-primary font-black uppercase text-[10px] h-12 px-8 rounded-xl shadow-xl gap-2"
                >
                  {isAnalyzingFiscal ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Consultar NAI Compliance
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              {fiscalAiResult && (
                <div className="p-8 bg-blue-50/50 rounded-[2rem] border border-blue-100 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary text-white rounded-lg">
                      <Brain className="size-4" />
                    </div>
                    <h4 className="font-black text-primary uppercase text-sm">
                      Parecer NAI Intelligence 2026
                    </h4>
                  </div>
                  <p className="text-sm text-primary/80 leading-relaxed italic font-medium">
                    "{fiscalAiResult.analysis}"
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {fiscalAiResult.taxEfficiencyTips.map((tip: string, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="bg-white border-blue-200 text-accent text-[9px] font-bold py-1 px-3 rounded-lg"
                      >
                        {tip}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FiscalKpi({ label, value, status }: any) {
  return (
    <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3 hover:border-primary/20 transition-all group">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-primary group-hover:scale-110 transition-transform">
        {value}
      </p>
      <Badge
        variant="outline"
        className="text-[8px] uppercase font-black text-slate-300 border-slate-200"
      >
        {status}
      </Badge>
    </div>
  );
}
