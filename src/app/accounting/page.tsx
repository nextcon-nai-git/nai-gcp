"use client";

import * as React from "react";
import {
  Landmark,
  CalendarDays,
  Loader2,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Brain,
  Zap,
  LayoutGrid,
  DollarSign,
  FileText,
  Boxes,
  Send,
  CloudLightning,
  Users,
  FileStack,
  BarChart3,
  FileDigit,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { useSearchParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * @fileOverview Gestão Contábil v2.7 (Padrão Enterprise SAP Fiori).
 * Centralizador financeiro multi-tenant com integração nativa Fiscal/Folha.
 */

interface BatchFile {
  id: string;
  name: string;
  size: string;
  status: "pending" | "processing" | "completed" | "error";
  type: "PDF" | "OFX";
}

export default function AccountingModule() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { activeClientId } = useSgi();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") || "dashboard";
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [isGeneratingStatements, setIsGeneratingStatements] = React.useState(false);

  const [batchQueue, setBatchQueue] = React.useState<BatchFile[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = React.useState(false);
  const [showBatchDialog, setShowBatchDialog] = React.useState(false);

  const handleGenerateStatements = () => {
    setIsGeneratingStatements(true);
    setTimeout(() => {
      setIsGeneratingStatements(false);
      toast({
        title: "Demonstrativos Publicados",
        description: "Balanço e DRE enviados via NAI Cloud ao portal do cliente.",
      });
    }, 2500);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: BatchFile[] = Array.from(files).map((f) => ({
      id: Math.random().toString(36).substring(7),
      name: f.name,
      size: (f.size / 1024).toFixed(1) + " KB",
      status: "pending",
      type: f.name.toUpperCase().endsWith("PDF") ? "PDF" : "OFX",
    }));

    setBatchQueue((prev) => [...prev, ...newFiles]);
    setShowBatchDialog(true);
  };

  const processBatch = async () => {
    setIsBatchProcessing(true);
    for (let i = 0; i < batchQueue.length; i++) {
      const file = batchQueue[i];
      setBatchQueue((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "processing" } : f))
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      setBatchQueue((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "completed" } : f))
      );
    }
    setIsBatchProcessing(false);
    toast({
      title: "Lote Consolidado",
      description: `${batchQueue.length} documentos cruzados com sucesso.`,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none text-[8px] font-black uppercase tracking-[0.4em] mb-2 px-3 h-5">
            FINANCE & ACCOUNTING HUB
          </Badge>
          <h1 className="text-3xl font-headline font-black text-primary uppercase leading-tight">
            Master Ledger 2026
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <CloudLightning className="size-3 text-accent" /> Escrituração Inteligente v2.7 (Fiscal
            + Folha + Contas)
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            id="batch-upload"
            multiple
            accept=".pdf,.ofx"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("batch-upload")?.click()}
            className="h-12 px-6 border-slate-200 text-slate-500 font-black uppercase text-[10px] gap-2 rounded-2xl shadow-sm hover:bg-slate-50"
          >
            <FileStack className="size-4" /> Importar em Lote
          </Button>
          <Button
            onClick={handleGenerateStatements}
            disabled={isGeneratingStatements}
            className="gradient-nextcon text-white h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl gap-2"
          >
            {isGeneratingStatements ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4 text-accent" />
            )}
            Emitir Balancete
          </Button>
        </div>
      </header>

      {/* SUB-LEDGER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Receita Bruta"
          value="R$ 142.500"
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
          trend="+12%"
        />
        <MetricCard
          label="Provisão Tributária"
          value="R$ 14.850"
          icon={Landmark}
          color="text-red-600"
          bg="bg-red-50"
        />
        <MetricCard
          label="EBITDA Estimado"
          value="R$ 82.400"
          icon={TrendingUp}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <MetricCard
          label="Audit Compliance"
          value="100%"
          icon={ShieldCheck}
          color="text-primary"
          bg="bg-slate-100"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-[2.5rem] h-16 shadow-inner">
            <TabsTrigger
              value="dashboard"
              className="rounded-[2rem] gap-2 text-[10px] font-black uppercase tracking-widest px-8 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              <LayoutGrid className="size-4" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="bank"
              className="rounded-[2rem] gap-2 text-[10px] font-black uppercase tracking-widest px-8 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              <Landmark className="size-4" /> Conciliação Bancária
            </TabsTrigger>
            <TabsTrigger
              value="obligations"
              className="rounded-[2rem] gap-2 text-[10px] font-black uppercase tracking-widest px-8 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              <CalendarDays className="size-4" /> Fiscal & Agenda
            </TabsTrigger>
            <TabsTrigger
              value="fixed_assets"
              className="rounded-[2rem] gap-2 text-[10px] font-black uppercase tracking-widest px-8 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
            >
              <Boxes className="size-4" /> Ativo Fixo
            </TabsTrigger>
            <TabsTrigger
              value="statements"
              className="rounded-[2rem] gap-2 text-[10px] font-black uppercase tracking-widest px-8 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg text-accent"
            >
              <BarChart3 className="size-4" /> DRE Consolidada
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-8 space-y-6 focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] p-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
                <TrendingUp size={200} className="text-primary" />
              </div>
              <div className="relative z-10 space-y-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-primary text-accent rounded-3xl shadow-2xl">
                      <Brain size={28} />
                    </div>
                    <h2 className="text-3xl font-black text-primary uppercase font-headline tracking-tighter">
                      Sincronização Online 360°
                    </h2>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 h-10 px-6 font-black uppercase text-[10px] rounded-2xl">
                    Ledger Sync Active
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4 hover:shadow-inner transition-all">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                      <CloudLightning size={14} className="text-blue-500" /> Fiscal Data Stream
                    </h4>
                    <p className="text-sm font-bold text-primary leading-relaxed italic">
                      &quot;NFS-e capturadas em tempo real são liquidadas automaticamente no razão
                      contábil conforme o regime tributário.&quot;
                    </p>
                  </div>
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4 hover:shadow-inner transition-all">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                      <Users size={14} className="text-purple-500" /> Payroll Integration
                    </h4>
                    <p className="text-sm font-bold text-primary leading-relaxed italic">
                      &quot;Encargos e salários liquidados na Folha geram provisões automáticas no
                      Balancete de Verificação.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-[#090e24] text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl flex flex-col justify-between group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                <Zap size={180} className="text-accent" />
              </div>
              <div className="space-y-8 relative z-10">
                <Badge className="bg-accent text-primary font-black uppercase text-[10px] tracking-[0.3em] px-3 h-6">
                  PROTOCOL ENGINE v2.7
                </Badge>
                <h3 className="text-2xl font-black uppercase tracking-tight font-headline">
                  Fechamento do Período
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                    <span className="text-[10px] font-bold uppercase text-white/40 tracking-widest">
                      Competência
                    </span>
                    <span className="text-lg font-black text-accent">Fev / 2026</span>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                    <span className="text-[10px] font-bold uppercase text-white/40 tracking-widest">
                      Integridade Fiscal
                    </span>
                    <span className="text-lg font-black text-emerald-400">100% OK</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleGenerateStatements}
                className="w-full h-16 bg-accent text-primary font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 mt-10 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <FileText size={20} /> Publicar Demonstrativos
              </Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="statements" className="mt-8 space-y-8 focus-visible:ring-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[3rem] p-12 text-left">
              <div className="flex justify-between items-center mb-12">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-primary uppercase font-headline tracking-tighter">
                    Demonstrativo de Resultado (Live)
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                    Período: 01/02/2026 a 28/02/2026
                  </p>
                </div>
                <Badge className="bg-primary text-accent border-none font-black text-[10px] h-10 px-6 rounded-2xl shadow-lg">
                  CONSOLIDATED AUDIT
                </Badge>
              </div>

              <div className="space-y-6">
                <DreRow label="Receita Bruta Operacional" value={142500} isHeader />
                <DreRow label="(-) Impostos Incidentes sobre Vendas" value={14850} isNegative />
                <DreRow label="(=) Receita Operacional Líquida" value={127650} isSubtotal />
                <DreRow label="(-) Custos de Serviços Prestados" value={32000} isNegative />
                <DreRow label="(-) Despesas com Pessoal & Encargos" value={13250} isNegative />
                <DreRow label="(=) Lucro Operacional Bruto" value={82400} isSubtotal />
                <DreRow label="(-) Despesas Gerais e Administrativas" value={8500} isNegative />
                <div className="pt-10 border-t-[6px] border-primary">
                  <DreRow label="(=) Resultado Líquido do Exercício" value={73900} isTotal />
                </div>
              </div>
            </Card>

            <div className="space-y-6 text-left">
              <Card className="bg-[#090e24] text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                  <TrendingUp className="size-48 text-accent" />
                </div>
                <div className="relative z-10 space-y-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent flex items-center gap-3">
                    <Brain className="size-5" /> Cognitive Performance
                  </h3>
                  <p className="text-lg italic text-slate-300 leading-relaxed font-medium">
                    &quot;A margem operacional de 51,8% representa um recorde trimestral para o
                    grupo. A integração Omie identificou uma economia de escala de 12.4% nos custos
                    variáveis.&quot;
                  </p>
                  <div className="space-y-4">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase text-white/40 mb-2">
                        Efficiency Rating
                      </p>
                      <h4 className="text-4xl font-black text-emerald-400 font-headline">
                        9.8 <span className="text-sm font-bold text-white/20">/ 10</span>
                      </h4>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bank" className="mt-8 focus-visible:ring-0">
          <Card className="p-20 text-center bg-white border-none rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
            <Landmark size={80} className="text-primary" />
            <p className="font-black uppercase text-sm tracking-[0.4em]">
              Conciliação Bancária Integrada
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG DE PROCESSAMENTO EM LOTE */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="sm:max-w-[650px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-10 bg-[#001F3F] text-white shrink-0 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <FileStack className="size-32 text-accent" />
            </div>
            <div className="relative z-10 space-y-3">
              <Badge className="bg-accent text-primary border-none text-[9px] font-black uppercase tracking-[0.4em] px-3 h-6">
                NAI CORE ENGINE v2.7
              </Badge>
              <DialogTitle className="text-3xl font-black uppercase tracking-tight font-headline">
                Central de Importação em Lote
              </DialogTitle>
              <DialogDescription className="text-white/60 font-medium italic text-sm">
                O motor NAI cruzará múltiplos extratos com a escrituração fiscal.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-10 space-y-8">
            <ScrollArea className="h-[350px] pr-6">
              <div className="space-y-4">
                {batchQueue.map((file) => (
                  <div
                    key={file.id}
                    className="p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-between group hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className={cn(
                          "size-12 rounded-2xl flex items-center justify-center text-white shadow-inner transition-colors",
                          file.status === "completed" ? "bg-emerald-500" : "bg-primary"
                        )}
                      >
                        {file.status === "processing" ? (
                          <Loader2 className="size-6 animate-spin" />
                        ) : (
                          <FileDigit size={24} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-primary uppercase truncate max-w-[280px]">
                          {file.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                          {file.size} • {file.status.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                    {file.status === "completed" && (
                      <CheckCircle2 className="size-6 text-emerald-500 animate-in zoom-in" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2rem] flex gap-5 items-start shadow-inner">
              <Brain className="size-8 text-primary shrink-0 mt-1 opacity-40" />
              <p className="text-xs text-primary/70 font-medium leading-relaxed italic">
                &quot;A inteligência em lote detecta automaticamente pagamentos de impostos,
                salários e recebimentos de clientes, realizando a baixa por competência no razão
                contábil.&quot;
              </p>
            </div>

            <Button
              onClick={processBatch}
              disabled={isBatchProcessing || batchQueue.every((f) => f.status === "completed")}
              className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-4 hover:scale-[1.01] active:scale-95 transition-all"
            >
              {isBatchProcessing ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <CloudLightning className="size-6 text-accent" />
              )}
              {isBatchProcessing ? "Cruzando Documentos..." : "Iniciar Consolidação de Lote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, bg, trend }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-[2rem] group hover:ring-2 ring-primary/5 transition-all">
      <CardContent className="p-8 text-left">
        <div className="flex items-center justify-between mb-6">
          <div className={cn("p-3.5 rounded-2xl shadow-inner", bg, color)}>
            <Icon className="size-6" />
          </div>
          {trend && (
            <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] h-6 px-3 rounded-full">
              {trend}
            </Badge>
          )}
        </div>
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1.5 leading-none">
          {label}
        </p>
        <h3 className={cn("text-2xl font-black font-headline tracking-tighter", color)}>{value}</h3>
      </CardContent>
    </Card>
  );
}

function DreRow({ label, value, isHeader, isNegative, isSubtotal, isTotal }: any) {
  return (
    <div
      className={cn(
        "flex justify-between items-center py-2.5 transition-colors",
        isHeader ? "border-b-2 border-primary/10 pb-6 mb-6" : "",
        isSubtotal
          ? "bg-slate-50 p-6 rounded-3xl font-black my-4 border-l-[6px] border-primary shadow-sm"
          : "",
        isTotal ? "text-2xl font-black text-emerald-600" : "text-sm"
      )}
    >
      <span
        className={cn(
          "uppercase tracking-tight",
          isHeader ? "text-primary font-black text-base" : "text-slate-500 font-bold",
          isSubtotal ? "text-primary" : ""
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-headline font-black tabular-nums",
          isNegative ? "text-red-500" : isTotal ? "text-emerald-600" : "text-primary"
        )}
      >
        {isNegative ? "(-)" : ""}{" "}
        {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </span>
    </div>
  );
}
