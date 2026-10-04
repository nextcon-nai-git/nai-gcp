"use client";

import * as React from "react";
import {
  FileDigit,
  Plus,
  Zap,
  CheckCircle2,
  HardHat,
  Flame,
  ZapOff,
  Lock,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  UserCheck,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REAL_EMPLOYEES } from "@/lib/real-data";

export default function PtAprDigital() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = React.useState(false);
  const [aprProgress, setAprProgress] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState("queue");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const [newPtData, setNewPtData] = React.useState({
    employeeId: "",
    task: "",
    location: "",
  });

  const handleStartPT = () => {
    if (!newPtData.employeeId || !newPtData.task) {
      toast({
        variant: "destructive",
        title: "Dados Incompletos",
        description: "Selecione o colaborador e a atividade.",
      });
      return;
    }
    setIsCreating(true);
    setAprProgress(15);
    setActiveTab("workflow");
    setIsDialogOpen(false);
    toast({ title: "Workflow Iniciado", description: "Siga as etapas da APR para liberar a PT." });
  };

  const handleCompleteAPR = () => {
    setAprProgress(100);
    toast({
      title: "APR Finalizada",
      description: "Vínculo digital estabelecido. PT liberada para assinatura.",
    });
    setTimeout(() => {
      setIsCreating(false);
      setActiveTab("queue");
      setNewPtData({ employeeId: "", task: "", location: "" });
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Despapelização: PT & APR
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Zap className="size-3 text-accent" /> Gestão Digital de Atividades de Alto Risco
            (NR-10, 33, 35).
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
                <Plus className="size-4 text-accent" /> Nova Permissão (PT)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
              <DialogHeader className="p-8 bg-primary text-white">
                <DialogTitle className="text-xl font-headline font-black uppercase">
                  Nova Permissão de Trabalho
                </DialogTitle>
                <DialogDescription className="text-white/60 font-medium italic">
                  Inicie o protocolo de segurança para atividade crítica.
                </DialogDescription>
              </DialogHeader>
              <div className="p-8 space-y-5">
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Colaborador Responsável
                  </label>
                  <Select
                    value={newPtData.employeeId}
                    onValueChange={(v) => setNewPtData({ ...newPtData, employeeId: v })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REAL_EMPLOYEES.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Atividade / Task
                  </label>
                  <Input
                    placeholder="Ex: Manutenção em Altura - Torre A"
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                    value={newPtData.task}
                    onChange={(e) => setNewPtData({ ...newPtData, task: e.target.value })}
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Localidade
                  </label>
                  <Input
                    placeholder="Ex: Galpão Logístico"
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                    value={newPtData.location}
                    onChange={(e) => setNewPtData({ ...newPtData, location: e.target.value })}
                  />
                </div>
                <Button
                  onClick={handleStartPT}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-xl mt-4"
                >
                  Abrir Fluxo de Liberação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="PTs Ativas"
          value="12"
          icon={Flame}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <KpiCard
          label="APRs em Análise"
          value="05"
          icon={ClipboardCheck}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Bloqueios Digitais"
          value="02"
          icon={ZapOff}
          color="text-red-600"
          bg="bg-red-50"
        />
        <KpiCard
          label="Conformidade"
          value="100%"
          icon={ShieldCheck}
          color="text-primary"
          bg="bg-slate-100"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-3 bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="queue"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Fila de Liberação
          </TabsTrigger>
          <TabsTrigger
            value="workflow"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-accent"
          >
            <Sparkles className="size-4" /> Workflow APR
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-8">
          {isCreating ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
              <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] p-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <HardHat className="size-6 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-primary uppercase">
                      Emissão de APR Digital
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Tarefa: {newPtData.task || "Nova Atividade"}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 text-left">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary uppercase">
                        Checklist de Riscos Críticos
                      </span>
                      <Badge variant="outline" className="text-[8px] font-black uppercase">
                        Passo 1 de 3
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <CheckItem label="A rede foi desenergizada e bloqueada (LOTO)?" />
                      <CheckItem label="EPIs dielétricos inspecionados e válidos?" />
                      <CheckItem label="Área de trabalho isolada e sinalizada?" />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <span className="text-xs font-bold text-primary uppercase">
                      Assinatura da Equipe Alocada
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 h-8 px-3 rounded-xl gap-2">
                        <UserCheck className="size-3" />{" "}
                        {REAL_EMPLOYEES.find((e) => e.id === newPtData.employeeId)?.name ||
                          "Colaborador"}{" "}
                        - VALIDADO
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 border border-dashed border-slate-300 text-slate-400 rounded-xl text-[8px] font-black uppercase"
                      >
                        Aguardando TST...
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={handleCompleteAPR}
                    className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl gap-2"
                  >
                    <CheckCircle2 className="size-4 text-accent" /> Finalizar APR & Gerar PT
                  </Button>
                </div>
              </Card>

              <div className="space-y-6 text-left">
                <Card className="bg-[#090e24] text-white p-8 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                    <Zap className="size-32 text-accent" />
                  </div>
                  <div className="relative z-10 space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                      <Lock className="size-4" /> Trava de Segurança
                    </h3>
                    <p className="text-xs italic text-slate-300 font-medium leading-relaxed">
                      &quot;O motor NAI não permite a emissão da Permissão de Trabalho (PT) sem que
                      todos os itens da APR sejam validados via assinatura digital.&quot;
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-white/40">
                        <span>Progresso da Liberação</span>
                        <span>{aprProgress}%</span>
                      </div>
                      <Progress value={aprProgress} className="h-1.5 bg-white/5" />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="p-20 text-center bg-white border-none card-shadow rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
              <FileDigit className="size-16" />
              <p className="font-black uppercase text-sm tracking-[0.4em]">
                Selecione um processo na fila ou crie uma nova PT
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-8">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-left w-full">
                <CardTitle className="text-lg font-black text-primary uppercase">
                  Fila de Liberação Digital
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                  Monitoramento de atividades críticas em tempo real.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="h-8 border-emerald-100 text-emerald-700 bg-emerald-50 px-4 font-black uppercase text-[10px] whitespace-nowrap"
              >
                03 PTs Aguardando APR
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                <PtQueueItem
                  id="PT-2026-843"
                  task="Reparo em Telhado"
                  location="Galpão Matriz"
                  type="Trabalho em Altura"
                  status="Aguardando APR"
                  onAction={() => {
                    setIsCreating(true);
                    setActiveTab("workflow");
                  }}
                />
                <PtQueueItem
                  id="PT-2026-844"
                  task="Inspeção de Espaço Confinado"
                  location="Tanque de Reúso"
                  type="NR-33"
                  status="Aguardando APR"
                  onAction={() => {
                    setIsCreating(true);
                    setActiveTab("workflow");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-8">
          <Card className="p-20 text-center bg-white border-none card-shadow rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
            <Clock className="size-16" />
            <p className="font-black uppercase text-sm tracking-[0.4em]">
              Nenhum registro histórico localizado
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl group hover:ring-2 ring-primary/5 transition-all hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl", bg, color)}>
            <Icon className="size-5" />
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-300">
            Live
          </Badge>
        </div>
        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1 leading-none">
          {label}
        </p>
        <h3 className={cn("text-2xl font-black leading-none", color)}>{value}</h3>
      </CardContent>
    </Card>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 group cursor-pointer hover:border-primary/20">
      <div className="size-5 rounded border-2 border-slate-200 group-hover:border-primary/20 transition-all flex items-center justify-center">
        <CheckCircle2 className="size-3 text-transparent group-hover:text-primary/20" />
      </div>
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{label}</span>
    </div>
  );
}

function PtQueueItem({ id, task, location, type, status, onAction }: any) {
  return (
    <div className="p-6 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row items-center justify-between gap-6 group">
      <div className="flex items-center gap-5 flex-1 text-left">
        <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner font-black text-xs">
          {id.split("-").pop()}
        </div>
        <div className="space-y-1">
          <p className="font-black text-sm text-primary uppercase leading-tight">{task}</p>
          <div className="flex items-center gap-3">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
              {location}
            </p>
            <Badge
              variant="outline"
              className="text-[7px] font-black h-4 px-1.5 uppercase border-slate-100"
            >
              {type}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge className="bg-amber-100 text-amber-700 border-none font-black uppercase text-[8px] h-6 px-3">
          {status}
        </Badge>
        <Button
          onClick={onAction}
          variant="ghost"
          size="sm"
          className="h-10 px-4 rounded-xl text-primary font-black uppercase text-[10px] gap-2 hover:bg-primary hover:text-white transition-all"
        >
          Realizar APR <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
