"use client";

import * as React from "react";
import Link from "next/link";
import {
  Network,
  Layers,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Send,
  FileText,
  Users,
  Stethoscope,
  MessageSquare,
  Bot,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Settings2,
  DollarSign,
  Workflow,
  Check,
  Copy,
  Key,
  Terminal,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ERPConnector {
  id: string;
  name: string;
  category: "TOTVS" | "SENIOR" | "SANKHYA" | "SAP" | "OUTROS";
  logoName: string;
  status: "ACTIVE" | "SYNCING" | "STANDBY" | "CONFIGURING";
  lastSync: string;
  employeesCount: number;
  asosSynced: number;
  leavesSynced: number;
  latencyMs: number;
  protocol: "REST API / JSON" | "SOAP WebServices" | "RPA Bot Engine" | "Direct DB";
  activeConnectors: {
    employees: boolean;
    medicalLeaves: boolean;
    examResultsAsos: boolean;
    autoKitGen: boolean;
    naiGed: boolean;
    whatsappAlerts: boolean;
  };
}

export default function IntegrationsHubPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState("connectors");
  const [isSyncingAll, setIsSyncingAll] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState(100);

  // Lista de ERPs Conectados / Homologados
  const [connectors, setConnectors] = React.useState<ERPConnector[]>([
    {
      id: "totvs-rm",
      name: "TOTVS RM (Linha RM / Labore & Folha)",
      category: "TOTVS",
      logoName: "TOTVS RM",
      status: "ACTIVE",
      lastSync: "Há 4 minutos",
      employeesCount: 1420,
      asosSynced: 384,
      leavesSynced: 52,
      latencyMs: 142,
      protocol: "REST API / JSON",
      activeConnectors: {
        employees: true,
        medicalLeaves: true,
        examResultsAsos: true,
        autoKitGen: true,
        naiGed: true,
        whatsappAlerts: true,
      },
    },
    {
      id: "totvs-protheus",
      name: "TOTVS Protheus (Módulo SIGAGPE & SIGAMDT)",
      category: "TOTVS",
      logoName: "TOTVS Protheus",
      status: "ACTIVE",
      lastSync: "Há 12 minutos",
      employeesCount: 890,
      asosSynced: 210,
      leavesSynced: 34,
      latencyMs: 180,
      protocol: "REST API / JSON",
      activeConnectors: {
        employees: true,
        medicalLeaves: true,
        examResultsAsos: true,
        autoKitGen: true,
        naiGed: true,
        whatsappAlerts: false,
      },
    },
    {
      id: "senior-hcm",
      name: "Senior Sistemas (Ronda & Gestão de Pessoas HCM)",
      category: "SENIOR",
      logoName: "Senior HCM",
      status: "ACTIVE",
      lastSync: "Há 8 minutos",
      employeesCount: 2150,
      asosSynced: 640,
      leavesSynced: 89,
      latencyMs: 115,
      protocol: "REST API / JSON",
      activeConnectors: {
        employees: true,
        medicalLeaves: true,
        examResultsAsos: true,
        autoKitGen: true,
        naiGed: true,
        whatsappAlerts: true,
      },
    },
    {
      id: "sankhya-erp",
      name: "Sankhya OM (Gestão de RH & Folha)",
      category: "SANKHYA",
      logoName: "Sankhya",
      status: "ACTIVE",
      lastSync: "Há 25 minutos",
      employeesCount: 620,
      asosSynced: 145,
      leavesSynced: 18,
      latencyMs: 210,
      protocol: "REST API / JSON",
      activeConnectors: {
        employees: true,
        medicalLeaves: true,
        examResultsAsos: true,
        autoKitGen: true,
        naiGed: false,
        whatsappAlerts: true,
      },
    },
    {
      id: "sap-successfactors",
      name: "SAP SuccessFactors / SAP HCM",
      category: "SAP",
      logoName: "SAP",
      status: "STANDBY",
      lastSync: "Aguardando agendamento",
      employeesCount: 0,
      asosSynced: 0,
      leavesSynced: 0,
      latencyMs: 95,
      protocol: "REST API / JSON",
      activeConnectors: {
        employees: true,
        medicalLeaves: false,
        examResultsAsos: false,
        autoKitGen: false,
        naiGed: false,
        whatsappAlerts: false,
      },
    },
    {
      id: "apdata-lg-rh",
      name: "Apdata / LG Lugar de Gente",
      category: "OUTROS",
      logoName: "Outros RH",
      status: "ACTIVE",
      lastSync: "Há 40 minutos",
      employeesCount: 410,
      asosSynced: 92,
      leavesSynced: 11,
      latencyMs: 165,
      protocol: "RPA Bot Engine",
      activeConnectors: {
        employees: true,
        medicalLeaves: true,
        examResultsAsos: true,
        autoKitGen: false,
        naiGed: true,
        whatsappAlerts: false,
      },
    },
  ]);

  const [selectedConnectorCount, setSelectedConnectorCount] = React.useState(3);

  const handleToggleFeature = (connId: string, feature: keyof ERPConnector["activeConnectors"]) => {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id === connId) {
          return {
            ...c,
            activeConnectors: {
              ...c.activeConnectors,
              [feature]: !c.activeConnectors[feature],
            },
          };
        }
        return c;
      })
    );
    toast({
      title: "Conector Atualizado",
      description: `Parâmetro de sincronização atualizado em tempo real no Middleware NAI.`,
    });
  };

  const handleSyncAll = () => {
    setIsSyncingAll(true);
    setSyncProgress(20);
    toast({
      title: "Sincronização Iniciada",
      description: "Disparando pipelines REST e RPA para TOTVS, Senior, Sankhya e SAP...",
    });

    const timer1 = setTimeout(() => setSyncProgress(60), 700);
    const timer2 = setTimeout(() => setSyncProgress(90), 1400);
    const timer3 = setTimeout(() => {
      setSyncProgress(100);
      setIsSyncingAll(false);
      toast({
        title: "Sincronização Concluída com Sucesso!",
        description:
          "5.490 vidas, 1.471 ASOs e 204 atestados médicos reconciliados com os ERPs de folha.",
      });
    }, 2100);
  };

  // Cálculos do Modelo Comercial
  const UNIT_PRICE = 175.0;
  const TAX_RATE = 0.0865; // 8.65%
  const subtotalPrice = selectedConnectorCount * UNIT_PRICE;
  const taxPrice = subtotalPrice * TAX_RATE;
  const totalPriceWithTaxes = subtotalPrice + taxPrice;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 text-slate-900">
      <Link
        href="/financial/omie"
        className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5"
      >
        <div>
          <h2 className="font-semibold">Omie · Financeiro NEXTCON</h2>
          <p className="text-sm text-slate-600">
            Configurar a conexão e consultar contas a pagar e receber.
          </p>
        </div>
        <ArrowRight size={20} />
      </Link>
      {/* HEADER EXECUTIVO */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Badge className="bg-primary text-white font-black uppercase text-[10px] tracking-widest px-3 h-6">
              NEXTCON MIDDLEWARE
            </Badge>
            <Badge className="bg-accent text-slate-950 font-black uppercase text-[10px] tracking-widest px-3 h-6">
              NAI ERP CONNECTOR HUB
            </Badge>
          </div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none mt-2">
            Integrações Inteligentes de RH & ERPs
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Sparkles className="size-3 text-accent" /> Conexão Automatizada e Bidirecional: NAI ×
            TOTVS (RM/Protheus) × Senior × Sankhya × SAP
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/comercial/middleware-integrations">
            <Button
              variant="outline"
              className="rounded-2xl border-primary/20 text-primary font-black text-xs uppercase tracking-wider h-11 px-5 gap-2 hover:bg-primary/5"
            >
              <FileText size={16} /> Ver Proposta Comercial
            </Button>
          </Link>
          <Button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-wider h-11 px-6 gap-2 shadow-lg hover:scale-105 transition-all"
          >
            <RefreshCw size={16} className={cn(isSyncingAll && "animate-spin")} />
            {isSyncingAll ? "Sincronizando Pipelines..." : "Sincronizar Todos"}
          </Button>
        </div>
      </header>

      {/* BANNER DOS 6 PILARES ESTATÍSTICOS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="rounded-3xl border-none shadow-md bg-white p-5 space-y-2">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl w-fit">
            <Database size={18} />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
            Vidas em Sincronia
          </span>
          <strong className="text-2xl font-black font-headline text-slate-900">5.490</strong>
          <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={10} /> 100% Atualizado
          </span>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-5 space-y-2">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl w-fit">
            <Stethoscope size={18} />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
            ASOs & Resultados
          </span>
          <strong className="text-2xl font-black font-headline text-emerald-700">1.471</strong>
          <span className="text-[9px] font-bold text-slate-500">Módulo eSocial S-2220</span>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-5 space-y-2">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl w-fit">
            <FileText size={18} />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
            Licenças & Atestados
          </span>
          <strong className="text-2xl font-black font-headline text-purple-700">204</strong>
          <span className="text-[9px] font-bold text-slate-500">Folha de Pagamento</span>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-5 space-y-2">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl w-fit">
            <Layers size={18} />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
            NAI-GED Uploads
          </span>
          <strong className="text-2xl font-black font-headline text-amber-700">3.820</strong>
          <span className="text-[9px] font-bold text-slate-500">Prontuários & Laudos</span>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-5 space-y-2">
          <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-2xl w-fit">
            <MessageSquare size={18} />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
            Alertas WhatsApp
          </span>
          <strong className="text-2xl font-black font-headline text-cyan-700">892</strong>
          <span className="text-[9px] font-bold text-slate-500">Mensageria NAI Bot</span>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white p-5 space-y-2">
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl w-fit">
            <Cpu size={18} />
          </div>
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
            Latência Média
          </span>
          <strong className="text-2xl font-black font-headline text-primary">145 ms</strong>
          <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
            <Activity size={10} /> SLA 99.98%
          </span>
        </Card>
      </div>

      {/* TABS DE GERENCIAMENTO */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-2xl h-14">
            <TabsTrigger
              value="connectors"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <Network className="size-4" /> Conectores Ativos (ERPs)
            </TabsTrigger>
            <TabsTrigger
              value="features"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <Workflow className="size-4" /> Funcionalidades do Middleware
            </TabsTrigger>
            <TabsTrigger
              value="simulator"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6 text-accent"
            >
              <DollarSign className="size-4" /> Modelo de Investimento & Setup
            </TabsTrigger>
            <TabsTrigger
              value="api-docs"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-6"
            >
              <Terminal className="size-4" /> Webhooks & Swagger API
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: CONECTORES DE ERP */}
        <TabsContent value="connectors" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connectors.map((conn) => (
              <Card
                key={conn.id}
                className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="p-6 bg-slate-50/80 border-b flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                          {conn.category}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-800 font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                          {conn.status}
                        </Badge>
                      </div>
                      <h3 className="font-black font-headline text-base text-primary uppercase leading-tight pt-1">
                        {conn.name}
                      </h3>
                      <p className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                        <Clock size={11} /> Última sincronização: <strong>{conn.lastSync}</strong>
                      </p>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-5">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 block">
                          Vidas
                        </span>
                        <strong className="text-sm font-black text-slate-800">
                          {conn.employeesCount}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 block">
                          ASOs
                        </span>
                        <strong className="text-sm font-black text-emerald-700">
                          {conn.asosSynced}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 block">
                          Licenças
                        </span>
                        <strong className="text-sm font-black text-purple-700">
                          {conn.leavesSynced}
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Pipelines Habilitados neste Conector:
                      </span>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-700">
                            Funcionários & Hierarquias
                          </span>
                          <Switch
                            checked={conn.activeConnectors.employees}
                            onCheckedChange={() => handleToggleFeature(conn.id, "employees")}
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-700">
                            Licenças Médicas & Atestados
                          </span>
                          <Switch
                            checked={conn.activeConnectors.medicalLeaves}
                            onCheckedChange={() => handleToggleFeature(conn.id, "medicalLeaves")}
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-700">
                            Resultados de Exames & ASO
                          </span>
                          <Switch
                            checked={conn.activeConnectors.examResultsAsos}
                            onCheckedChange={() => handleToggleFeature(conn.id, "examResultsAsos")}
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-700">
                            Geração de Kit Automatizada
                          </span>
                          <Switch
                            checked={conn.activeConnectors.autoKitGen}
                            onCheckedChange={() => handleToggleFeature(conn.id, "autoKitGen")}
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-700">Envio NAI-GED Documentos</span>
                          <Switch
                            checked={conn.activeConnectors.naiGed}
                            onCheckedChange={() => handleToggleFeature(conn.id, "naiGed")}
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                          <span className="font-bold text-slate-700">
                            Alertas WhatsApp (NAI Bot)
                          </span>
                          <Switch
                            checked={conn.activeConnectors.whatsappAlerts}
                            onCheckedChange={() => handleToggleFeature(conn.id, "whatsappAlerts")}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <div className="p-6 bg-slate-50 border-t flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-slate-500 font-bold">
                    Protocolo: {conn.protocol}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast({
                        title: "Sincronização pontual",
                        description: `Atualizando conector ${conn.name}...`,
                      });
                    }}
                    className="rounded-xl h-8 px-3 font-bold text-[10px] uppercase tracking-wider"
                  >
                    Sync Agora
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: AS 6 FUNCIONALIDADES DETALHADAS */}
        <TabsContent value="features" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-4">
              <div className="size-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-black font-headline text-primary uppercase">
                1. Funcionários e Hierarquias
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Atualização automática e em tempo real de{" "}
                <strong>
                  Unidade, Setor, Cargo, Centro de Custo e GHE (Grupo Homogêneo de Exposição)
                </strong>{" "}
                diretamente do ERP de Folha (TOTVS RM, Protheus, Senior, Sankhya) para o NAI sem
                qualquer digitação manual.
              </p>
              <div className="p-4 bg-blue-50/50 rounded-2xl text-xs space-y-2 text-blue-900 font-medium">
                <p>• Admissões entram no NAI instantaneamente com geração do kit admissional.</p>
                <p>
                  • Mudanças de função recalculam os riscos ocupacionais e convocam ASO de mudança
                  de função.
                </p>
                <p>• Desligamentos bloqueiam acessos e agendam ASO demissional.</p>
              </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-4">
              <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <Stethoscope size={24} />
              </div>
              <h3 className="text-xl font-black font-headline text-primary uppercase">
                2. Lançamento de Resultados, ASO e Ficha Clínica
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Resultados de exames clínicos, complementares (audiometria, espirometria, ECG,
                raio-X) e ASOs emitidos na rede credenciada NextCon são inseridos automaticamente no
                ERP via integração direta.
              </p>
              <div className="p-4 bg-emerald-50/50 rounded-2xl text-xs space-y-2 text-emerald-900 font-medium">
                <p>
                  • Alimentação automática do evento <strong>eSocial S-2220</strong>.
                </p>
                <p>• Validação de aptidão pelo médico coordenador do PCMSO em tempo real.</p>
                <p>• Prontuário Eletrônico integrado ao PEP do cliente.</p>
              </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-4">
              <div className="size-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-black font-headline text-primary uppercase">
                3. Licenças Médicas e Atestados
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Retorno automatizado de atestados médicos validados, dias de afastamento, CID-10 e
                análise de nexo causal pelo Sentinela NAI diretamente para o módulo de frequência e
                folha do ERP.
              </p>
              <div className="p-4 bg-purple-50/50 rounded-2xl text-xs space-y-2 text-purple-900 font-medium">
                <p>• Eliminação do retrabalho de digitação de atestados no DP.</p>
                <p>
                  • Alerta preventivo de afastamentos superiores a 15 dias para o INSS (eSocial
                  S-2230).
                </p>
                <p>• Bloqueio automático de concessão indevida de benefícios acidentários.</p>
              </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-4">
              <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                <Workflow size={24} />
              </div>
              <h3 className="text-xl font-black font-headline text-primary uppercase">
                4. Geração de Kit Automatizada
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Ao solicitar qualquer exame no ERP ou no NAI, o sistema gera instantaneamente a
                ficha clínica digital, guia de encaminhamento para a clínica credenciada e o ASO
                pré-preenchido para atendimento sem filas.
              </p>
              <div className="p-4 bg-amber-50/50 rounded-2xl text-xs space-y-2 text-amber-900 font-medium">
                <p>• QR Code de autorização de atendimento no celular do trabalhador.</p>
                <p>• Pré-anamnese ocupacional preenchida antes da chegada à clínica.</p>
                <p>• Redução de 70% no tempo de espera no atendimento ambulatorial.</p>
              </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-4">
              <div className="size-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-black">
                <Layers size={24} />
              </div>
              <h3 className="text-xl font-black font-headline text-primary uppercase">
                5. Envio NAI-GED (Gestão Eletrônica)
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Automação completa no upload e arquivamento de documentos assinados digitalmente
                (ICP-Brasil / Gov.br) diretamente no repositório em nuvem com indexação por CPF,
                CNPJ e data.
              </p>
              <div className="p-4 bg-cyan-50/50 rounded-2xl text-xs space-y-2 text-cyan-900 font-medium">
                <p>• Laudos PGR, PCMSO, LTCAT, AEP e Ordens de Serviço disponíveis 24/7.</p>
                <p>• Trilhas de auditoria para conformidade ISO 27001 e LGPD.</p>
                <p>• Backup criptografado e sincronizado com o ERP do cliente.</p>
              </div>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-4">
              <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <Bot size={24} />
              </div>
              <h3 className="text-xl font-black font-headline text-primary uppercase">
                6. Mensagerias & RPA Inteligente (WhatsApp NAI)
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Robôs de RPA extraem pendências operacionais e disparam notificações automáticas via
                WhatsApp Oficial e E-mail diretamente para funcionários e gestores de RH com base em
                eventos e regras de negócios.
              </p>
              <div className="p-4 bg-emerald-50/50 rounded-2xl text-xs space-y-2 text-emerald-900 font-medium">
                <p>• Convocação de exames periódicos com escolha de dia e horário via WhatsApp.</p>
                <p>• Envio do ASO assinado em PDF diretamente para o colaborador.</p>
                <p>• Alertas diários para o RH sobre atestados e afastamentos pendentes.</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: MODELO DE INVESTIMENTO COMERCIAL */}
        <TabsContent value="simulator" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-black font-headline text-primary uppercase">
                    Simulador de Conectores do Middleware
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                    Preço transparente por pipeline integrado — Sem taxa de adesão ou taxas ocultas
                  </p>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-primary uppercase">
                      Quantidade de Integradores Contratados:
                    </span>
                    <strong className="text-2xl font-black font-headline text-primary">
                      {selectedConnectorCount} Conectores
                    </strong>
                  </div>

                  <div className="flex items-center gap-3">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <Button
                        key={num}
                        onClick={() => setSelectedConnectorCount(num)}
                        variant={selectedConnectorCount === num ? "default" : "outline"}
                        className={cn(
                          "flex-1 h-12 rounded-2xl font-black text-sm",
                          selectedConnectorCount === num
                            ? "bg-primary text-white shadow-lg"
                            : "bg-white"
                        )}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>

                  <div className="pt-2 text-xs text-slate-500 font-medium">
                    Exemplo de pacote mais contratado (3 integradores):{" "}
                    <strong>Funcionários + Licenças Médicas + Resultados/ASO</strong>.
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-wider text-slate-400">
                    Integradores Disponíveis na Plataforma:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                      <div>
                        <strong className="text-xs font-bold text-slate-800 block">
                          Funcionários (ERP ➔ NAI)
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Unidade, Setor, Cargo, Admissão
                        </span>
                      </div>
                      <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                        R$ 175,00/mês
                      </Badge>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                      <div>
                        <strong className="text-xs font-bold text-slate-800 block">
                          Licenças Médicas (NAI ➔ ERP)
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Atestados, Dias, CID-10 para Folha
                        </span>
                      </div>
                      <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                        R$ 175,00/mês
                      </Badge>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                      <div>
                        <strong className="text-xs font-bold text-slate-800 block">
                          Resultados & ASO (NAI ➔ ERP)
                        </strong>
                        <span className="text-[10px] text-slate-500">Aptidão e eSocial S-2220</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                        R$ 175,00/mês
                      </Badge>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                      <div>
                        <strong className="text-xs font-bold text-slate-800 block">
                          Envio NAI-GED (Repositório)
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Documentos e Laudos Assinados
                        </span>
                      </div>
                      <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                        R$ 175,00/mês
                      </Badge>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                      <div>
                        <strong className="text-xs font-bold text-slate-800 block">
                          Geração de Kit Automatizada
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Guia de Encaminhamento & ASO
                        </span>
                      </div>
                      <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                        R$ 175,00/mês
                      </Badge>
                    </div>

                    <div className="p-4 rounded-2xl border bg-white flex items-center justify-between">
                      <div>
                        <strong className="text-xs font-bold text-slate-800 block">
                          Mensageria WhatsApp (NAI Bot)
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Convocação & ASO pelo WhatsApp
                        </span>
                      </div>
                      <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                        R$ 175,00/mês
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* CARD DE RESUMO FINANCEIRO */}
            <div className="space-y-6">
              <Card className="rounded-[2.5rem] bg-[#001f3f] text-white p-8 shadow-2xl border border-white/10 space-y-6">
                <div>
                  <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-3 h-6 mb-3">
                    Custo Zero de Setup (R$ 0,00)
                  </Badge>
                  <h3 className="text-xl font-black font-headline uppercase text-white">
                    Investimento Final
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    Calculado com base em {selectedConnectorCount} conectores ativos
                  </p>
                </div>

                <div className="space-y-3 border-y border-white/10 py-5 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Mensalidade Base ({selectedConnectorCount}x R$ 175,00):</span>
                    <strong className="text-white font-mono">
                      {subtotalPrice.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Impostos sobre Consumo (8,65%):</span>
                    <strong className="text-white font-mono">
                      {taxPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>Taxa de Implantação / Setup:</span>
                    <span>GRÁTIS (R$ 0,00)</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Mensalidade Total (Valor NF-e)
                  </span>
                  <strong className="text-4xl font-black font-headline text-accent block mt-1">
                    {totalPriceWithTaxes.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Preço base líquido:{" "}
                    {subtotalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    /mês
                  </span>
                </div>

                <Button
                  onClick={() => {
                    toast({
                      title: "Simulação Salva",
                      description: `Proposta gerada para ${selectedConnectorCount} integradores NAI × ERPs.`,
                    });
                  }}
                  className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                >
                  Contratar Integradores NAI
                </Button>
              </Card>

              <Card className="rounded-3xl border-none shadow-md bg-white p-6 space-y-3">
                <div className="flex items-center gap-3 text-primary font-black uppercase text-xs">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  Garantias Técnicas NextCon
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Sustentação contínua de pipelines, atualização automática frente a mudanças de
                  leiaute do eSocial (versões S-1.2 e posteriores) e suporte N2 de engenharia de
                  software incluso.
                </p>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: SWAGGER / API DOCS */}
        <TabsContent value="api-docs" className="mt-6 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-slate-950 text-slate-100 p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <span className="text-xs font-mono font-bold text-accent">
                  API REST v2.0 • OpenAPI 3.0
                </span>
                <h3 className="text-2xl font-black font-headline text-white uppercase mt-1">
                  Endpoints NAI Middleware Engine
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Autenticação via Bearer Token JWT e Webhooks de eventos de RH
                </p>
              </div>
              <Badge className="bg-emerald-500 text-slate-950 font-mono font-bold text-xs px-3 h-8">
                TLS 1.3 / mTLS Ready
              </Badge>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-600 text-white font-bold text-[10px]">POST</Badge>
                  <span className="text-slate-200 font-bold">
                    /api/integrations/totvs/sync-employees
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Sincronização de vidas, admissões, alterações cadastrais e hierarquias do TOTVS
                  RM/Protheus para o NAI.
                </p>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">GET</Badge>
                  <span className="text-slate-200 font-bold">
                    /api/integrations/totvs/export-asos
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Exportação de ASOs emitidos, exames clínicos e aptidão para alimentação do módulo
                  de medicina do ERP e eSocial.
                </p>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-purple-600 text-white font-bold text-[10px]">GET</Badge>
                  <span className="text-slate-200 font-bold">
                    /api/integrations/totvs/export-medical-leaves
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Exportação de atestados médicos auditados, dias de afastamento e CID-10 para a
                  folha de pagamento do ERP.
                </p>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-600 text-white font-bold text-[10px]">POST</Badge>
                  <span className="text-slate-200 font-bold">
                    /api/integrations/ged/upload-document
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Upload automatizado de laudos e ASOs assinados com criptografia no NAI-GED.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
