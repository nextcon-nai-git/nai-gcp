"use client";

import * as React from "react";
import {
  Users,
  Calendar,
  Loader2,
  Zap,
  FileText,
  TrendingUp,
  ShieldCheck,
  Calculator,
  Search,
  Printer,
  DollarSign,
  CloudLightning,
  Brain,
  LayoutGrid,
  Settings,
  ArrowRight,
  MailCheck,
  FileDown,
  Plane,
  Share2,
  FileSearch,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSgi } from "@/contexts/sgi-context";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore } from "@/firebase";

const MOCK_COMPANIES_STATUS = [
  {
    id: "1",
    name: "NATIVA EMPREENDIMENTOS",
    status: "Calculado",
    esocial: "Enviado",
    reinf: "Pendente",
    dctf: "Aguardando",
    delivery: "Pendente",
    lives: 48,
  },
  {
    id: "2",
    name: "BRITÂNIA JOINVILLE",
    status: "Aberto",
    esocial: "Pendente",
    reinf: "Pendente",
    dctf: "Aguardando",
    delivery: "Aguardando",
    lives: 1204,
  },
  {
    id: "3",
    name: "A TESTE DB 2026",
    status: "Fechado",
    esocial: "Sucesso",
    reinf: "Enviado",
    dctf: "Guia Gerada",
    delivery: "Enviado",
    lives: 15,
  },
  {
    id: "4",
    name: "CETESB",
    status: "Processando",
    esocial: "Sync Ativo",
    reinf: "Pendente",
    dctf: "Aguardando",
    delivery: "Processando",
    lives: 325,
  },
];

export default function PayrollManagementPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { activeClientId, isGlobalStaff } = useSgi();
  const [activeTab, setActiveTab] = React.useState(isGlobalStaff ? "central" : "monitoring");
  const [isClosing, setIsClosing] = React.useState(false);
  const [isDistributing, setIsDistributing] = React.useState(false);
  const [selectedReceipt, setSelectedReceipt] = React.useState<any>(null);
  const [isAutoConfigOpen, setIsAutoConfigOpen] = React.useState(false);

  const handleBatchClosing = async () => {
    setIsClosing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: "Fechamento Concluído",
        description: "Folhas encerradas. Iniciando transmissão eSocial em background...",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const handleAutoDistribute = async () => {
    setIsDistributing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      toast({
        title: "Distribuição Finalizada",
        description: "Holerites e Guias enviados automaticamente ao e-mail dos clientes.",
      });
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary uppercase leading-tight">
            Gestão de Folha eSocial
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <ShieldCheck className="size-3 text-emerald-500" /> Automação de Documentos &
            Transmissão v2.7
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAutoConfigOpen(true)}
            className="h-11 border-slate-200 text-slate-500 font-black uppercase text-[10px] gap-2 rounded-xl"
          >
            <Settings className="size-4" /> Configurar Datas
          </Button>
          <Button
            onClick={handleAutoDistribute}
            disabled={isDistributing}
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2 rounded-xl"
          >
            {isDistributing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Share2 className="size-4" />
            )}
            Enviar p/ Clientes
          </Button>
          {isGlobalStaff && (
            <Button
              onClick={handleBatchClosing}
              disabled={isClosing}
              className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2"
            >
              {isClosing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Zap className="size-4 text-accent" />
              )}
              Processar em Lote
            </Button>
          )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-2xl h-16">
            {isGlobalStaff && (
              <TabsTrigger
                value="central"
                className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8"
              >
                <LayoutGrid className="size-4" /> Visão Global ({MOCK_COMPANIES_STATUS.length})
              </TabsTrigger>
            )}
            <TabsTrigger
              value="monitoring"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8"
            >
              Lançamentos & Recibos
            </TabsTrigger>
            <TabsTrigger
              value="delivery"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-emerald-600"
            >
              <MailCheck className="size-4" /> Relatórios & Entregas
            </TabsTrigger>
            <TabsTrigger
              value="simulators"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-accent"
            >
              <Calculator className="size-4" /> Simuladores (Férias/Rescisão)
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="central" className="mt-8 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-left w-full">
                <CardTitle className="text-lg font-black text-primary uppercase">
                  Status de Operação da Rede
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400">
                  Status unificado de todas as etapas para cada unidade técnica.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="text-[9px] font-black uppercase">
                    <TableHead className="pl-8 py-4">Empresa / Colaboradores</TableHead>
                    <TableHead className="text-center">Cálculo Folha</TableHead>
                    <TableHead className="text-center">eSocial (S-1200)</TableHead>
                    <TableHead className="text-center">DCTF Web (Guia)</TableHead>
                    <TableHead className="text-center">Entrega Cliente</TableHead>
                    <TableHead className="pr-8 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_COMPANIES_STATUS.map((comp) => (
                    <TableRow key={comp.id} className="hover:bg-slate-50 transition-all group">
                      <TableCell className="pl-8 py-5">
                        <p className="font-black text-xs text-primary uppercase">{comp.name}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">
                          {comp.lives} Vínculos Ativos
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={comp.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={comp.esocial} type="secondary" />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={comp.dctf} type="accent" />
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={comp.delivery} />
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-300 hover:text-primary"
                        >
                          <ArrowRight size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Mês de Referência"
              value="Fev/2026"
              icon={Calendar}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <StatCard
              label="Total Bruto Folha"
              value="R$ 184.200"
              icon={DollarSign}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <StatCard
              label="Recibos Gerados"
              value="48 Unidades"
              icon={FileText}
              color="text-primary"
              bg="bg-slate-50"
            />
            <StatCard
              label="Encargos (INSS/FGTS)"
              value="R$ 41.500"
              icon={Calculator}
              color="text-red-600"
              bg="bg-red-50"
            />
          </div>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-left w-full">
                <CardTitle className="text-lg font-black text-primary uppercase">
                  Fila de Recibos Online
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400">
                  Visualize memórias de cálculo individuais com 1 clique.
                </CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-slate-300" />
                <Input
                  placeholder="Localizar trabalhador..."
                  className="pl-10 h-10 border-none bg-white shadow-sm text-xs rounded-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="text-[9px] font-black uppercase">
                    <TableHead className="pl-8 py-4">Trabalhador / Função</TableHead>
                    <TableHead>Remuneração Bruta</TableHead>
                    <TableHead className="text-center">Descontos Legais</TableHead>
                    <TableHead className="text-center">Líquido</TableHead>
                    <TableHead className="pr-8 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-slate-50 transition-colors group">
                    <TableCell className="pl-8 py-5">
                      <p className="font-black text-xs text-primary uppercase">ERICK HENRIQUE</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">
                        Analista de Sistemas Sênior
                      </p>
                    </TableCell>
                    <TableCell className="text-xs font-black text-primary">R$ 12.450,00</TableCell>
                    <TableCell className="text-center text-xs font-bold text-red-500">
                      - R$ 2.340,00
                    </TableCell>
                    <TableCell className="text-center font-black text-primary">
                      R$ 10.110,00
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-4 rounded-xl text-primary font-black uppercase text-[10px] gap-2 hover:bg-primary/5"
                        onClick={() =>
                          setSelectedReceipt({
                            name: "ERICK HENRIQUE",
                            salary: 12450,
                            inss: 900,
                            irrf: 1440,
                          })
                        }
                      >
                        <FileSearch className="size-3.5" /> Detalhar Cálculo
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DeliveryReportCard
              title="Holerites & Pagamentos"
              desc="Recibos mensais e adiantamentos."
              status="Disponível"
              count={48}
              icon={Users}
            />
            <DeliveryReportCard
              title="Posição de Férias"
              desc="Relatório de períodos aquisitivos."
              status="Gerado"
              count={1}
              icon={Plane}
            />
            <DeliveryReportCard
              title="Guias de Impostos (DARF)"
              desc="Guias DCTF Web e FGTS Digital."
              status="Pendente"
              count={2}
              icon={DollarSign}
              isCritical
            />
          </div>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    Dossiê Admissional & Registro
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-slate-400">
                    Centralização de documentos enviados ao RH do cliente.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="h-10 border-primary text-primary font-black uppercase text-[9px] rounded-xl gap-2"
                >
                  <FileDown className="size-3" /> Baixar Kit Completo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {[
                  "Contrato de Trabalho",
                  "Ficha de Registro",
                  "Declaração de Encargos",
                  "Protocolo eSocial",
                ].map((doc) => (
                  <div
                    key={doc}
                    className="p-5 flex items-center justify-between hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                        <FileText size={18} />
                      </div>
                      <span className="text-xs font-bold text-slate-600 uppercase">{doc}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase">
                        SINCRONIZADO
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-primary font-black text-[9px] uppercase"
                      >
                        Visualizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulators" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 card-shadow border-none bg-white rounded-[2.5rem] p-8 text-left space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-black text-primary uppercase">Simulação Preditiva</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Calcule impactos financeiros antes da efetivação.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                    Tipo de Evento
                  </label>
                  <Select defaultValue="vacation">
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">Férias (30 dias) + 1/3</SelectItem>
                      <SelectItem value="dismissal">Rescisão Sem Justa Causa</SelectItem>
                      <SelectItem value="bonus">Gratificação / Bônus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">
                    Colaborador
                  </label>
                  <Input
                    placeholder="Nome do funcionário..."
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                  />
                </div>
              </div>
              <Button className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2">
                <Brain className="size-4 text-accent" /> Processar Simulação
              </Button>
            </Card>

            <Card className="lg:col-span-2 card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                <TrendingUp className="size-48 text-accent" />
              </div>
              <div className="relative z-10 space-y-8 text-left h-full flex flex-col justify-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent rounded-2xl text-primary shadow-xl">
                    <Brain className="size-6" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-accent font-headline">
                    Parecer Preditivo NAI
                  </h3>
                </div>
                <p className="text-lg italic text-slate-300 font-medium leading-relaxed max-w-xl">
                  &quot;A projeção de caixa para Março/2026 indica um aumento de 18% no custo fixo
                  devido ao vencimento simultâneo de férias de 3 gestores. Recomendamos o
                  escalonamento para evitar impacto no fluxo operacional.&quot;
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG: CONFIGURAÇÃO DE AUTOMAÇÃO */}
      <Dialog open={isAutoConfigOpen} onOpenChange={setIsAutoConfigOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-8 bg-primary text-white">
            <DialogTitle className="text-xl font-black uppercase flex items-center gap-3">
              <CloudLightning className="size-6 text-accent" /> Automação Agendada
            </DialogTitle>
            <DialogDescription className="text-white/60 font-medium italic mt-1">
              A NAI executará os cálculos e transmissões nas datas definidas.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-primary">
                  Cálculo de Provisões
                </span>
                <Badge className="bg-emerald-100 text-emerald-700 uppercase font-black text-[8px]">
                  DIA 25
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-primary">
                  Fechamento & eSocial
                </span>
                <Badge className="bg-emerald-100 text-emerald-700 uppercase font-black text-[8px]">
                  DIA 01
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-primary">
                  Envio de Guias/Recibos ao Cliente
                </span>
                <Badge className="bg-emerald-100 text-emerald-700 uppercase font-black text-[8px]">
                  DIA 03
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => setIsAutoConfigOpen(false)}
              className="w-full h-14 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-xl"
            >
              Salvar Cronograma NAI
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: RECIBO ONLINE */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedReceipt && (
            <>
              <div className="p-8 bg-primary text-white relative">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <FileText className="size-24 text-accent" />
                </div>
                <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase mb-2">
                  Folha Digital v2.7
                </Badge>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                  {selectedReceipt.name}
                </DialogTitle>
                <DialogDescription className="text-white/60 font-medium italic mt-1">
                  Holerite Individual eSocial S-1200 Ready
                </DialogDescription>
              </div>
              <ScrollArea className="max-h-[60vh] p-8">
                <div className="space-y-8">
                  <div className="p-6 bg-slate-50 rounded-3xl border flex justify-between items-center shadow-inner">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Valor Líquido
                      </p>
                      <h3 className="text-3xl font-black text-primary">
                        R${" "}
                        {(
                          selectedReceipt.salary -
                          selectedReceipt.inss -
                          selectedReceipt.irrf
                        ).toLocaleString("pt-BR")}
                      </h3>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-2xl bg-white shadow-sm h-12 w-12"
                    >
                      <Printer size={20} />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 ml-1">
                      Discriminação de Rubricas
                    </h4>
                    <div className="divide-y divide-slate-100 border rounded-[2rem] bg-white overflow-hidden shadow-sm">
                      <RubricItem
                        label="001 - SALÁRIO BASE"
                        value={selectedReceipt.salary}
                        type="provento"
                      />
                      <RubricItem
                        label="050 - INSS RETIDO"
                        value={selectedReceipt.inss}
                        type="desconto"
                      />
                      <RubricItem
                        label="051 - IRRF SOBRE FOLHA"
                        value={selectedReceipt.irrf}
                        type="desconto"
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-8 bg-slate-50 border-t flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedReceipt(null)}
                  className="font-bold uppercase text-[10px]"
                >
                  Fechar Visualização
                </Button>
                <Button className="bg-primary text-white font-black uppercase text-[10px] rounded-xl px-8 shadow-lg gap-2">
                  <MailCheck className="size-4 text-accent" /> Reenviar ao Colaborador
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-2xl group hover:ring-2 ring-primary/5 transition-all">
      <CardContent className="pt-6 text-left">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl", bg, color)}>
            <Icon size={20} />
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter">
            Live
          </Badge>
        </div>
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
          {label}
        </p>
        <h2 className={cn("text-xl font-black font-headline tabular-nums", color)}>{value}</h2>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  type = "primary",
}: {
  status: string;
  type?: "primary" | "secondary" | "accent";
}) {
  const isOk = ["Sucesso", "Enviado", "Guia Gerada", "Fechado"].includes(status);
  const isProcessing = ["Processando", "Sync Ativo"].includes(status);

  return (
    <Badge
      className={cn(
        "text-[8px] font-black uppercase border-none px-3 h-6",
        isOk
          ? "bg-emerald-100 text-emerald-700"
          : isProcessing
            ? "bg-blue-100 text-blue-700 animate-pulse"
            : "bg-slate-100 text-slate-400"
      )}
    >
      {status}
    </Badge>
  );
}

function RubricItem({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type: "provento" | "desconto";
}) {
  return (
    <div className="p-5 flex justify-between items-center text-xs font-bold uppercase hover:bg-slate-50 transition-colors">
      <span className="text-slate-600">{label}</span>
      <span className={type === "provento" ? "text-primary" : "text-red-500"}>
        {type === "desconto" ? "-" : ""}{" "}
        {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </span>
    </div>
  );
}

function DeliveryReportCard({ title, desc, status, count, icon: Icon, isCritical }: any) {
  return (
    <Card
      className={cn(
        "card-shadow border-none rounded-[2rem] p-6 flex flex-col justify-between group transition-all hover:scale-[1.02]",
        isCritical ? "bg-red-50/50" : "bg-white"
      )}
    >
      <div className="space-y-4 text-left">
        <div className="flex justify-between items-start">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-inner",
              isCritical ? "bg-red-100 text-red-600" : "bg-slate-100 text-primary"
            )}
          >
            <Icon size={20} />
          </div>
          <Badge
            className={cn(
              "text-[8px] font-black uppercase",
              status === "Disponível"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700"
            )}
          >
            {status}
          </Badge>
        </div>
        <div>
          <h4 className="font-black text-primary text-sm uppercase">{title}</h4>
          <p className="text-[10px] text-slate-400 font-medium">{desc}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-dashed pt-4">
        <span className="text-[10px] font-black text-primary uppercase">{count} Arquivos</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-primary font-black uppercase text-[9px] gap-1 p-0 hover:bg-transparent"
        >
          Configurar <ArrowRight size={12} />
        </Button>
      </div>
    </Card>
  );
}
