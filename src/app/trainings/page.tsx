"use client";

import * as React from "react";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  HardHat,
  Brain,
  Building2,
  QrCode,
  Zap,
  AlertCircle,
  FileCheck,
  BookOpen,
  FileSearch,
  Share2,
  PlayCircle,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REAL_TRAININGS, REAL_COMPANIES } from "@/lib/real-data";
import { cn } from "@/lib/utils";

export default function TrainingDashboard() {
  const [showQr, setShowQr] = React.useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("all");
  const [activeTab, setActiveTab] = React.useState("matrix");

  const trainings = React.useMemo(() => {
    if (selectedCompanyId === "all") return REAL_TRAININGS;
    return REAL_TRAININGS.filter((t) => t.companyId === selectedCompanyId);
  }, [selectedCompanyId]);

  const totalStudents = trainings.reduce((acc, curr) => acc + curr.students.length, 0);
  const completedHours = trainings.reduce(
    (acc, curr) => acc + (curr.status === "completed" ? curr.totalHours : 0),
    0
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Academia NRs & Engenharia
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Gestão de capacitação técnica e base de conhecimento 2026.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="w-48">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-white border-muted h-11 text-[10px] font-black uppercase tracking-widest">
                <Building2 className="size-4 mr-2" />
                <SelectValue placeholder="Filtrar Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Rede Global</SelectItem>
                {REAL_COMPANIES.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[10px] font-bold uppercase">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={showQr} onOpenChange={setShowQr}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-accent text-accent hover:bg-accent/5 h-11 px-6 font-bold uppercase text-[10px]"
              >
                <QrCode className="size-4" /> Check-in Digital
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] border-none shadow-2xl p-8 text-center bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-primary uppercase font-headline">
                  Assinatura de Presença
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                  Aponte a câmera para registrar sua entrada
                </DialogDescription>
              </DialogHeader>
              <div className="py-8 flex flex-col items-center gap-6">
                <div className="size-64 bg-slate-50 rounded-[2rem] border-4 border-dashed border-primary/10 flex items-center justify-center relative overflow-hidden group">
                  <QrCode className="size-48 text-primary opacity-80 group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
                </div>
                <div className="space-y-2">
                  <Badge className="bg-emerald-100 text-emerald-700 border-none uppercase font-black text-[9px]">
                    Sessão Ativa: NR-18
                  </Badge>
                  <p className="text-xs text-slate-500 italic">
                    &quot;Geolocalização e Biometria Facial ativas para conformidade NR-01.&quot;
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowQr(false)}
                className="w-full h-14 bg-primary text-white font-black uppercase text-xs rounded-2xl"
              >
                Fechar Painel
              </Button>
            </DialogContent>
          </Dialog>
          <Button className="bg-primary text-white gap-2 h-11 px-6 shadow-lg font-bold uppercase text-[10px]">
            <Zap className="size-4" /> Novo Treinamento
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Alunos Ativos"
          value={totalStudents}
          icon={Users}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <KpiCard
          label="Horas Presenciais"
          value={`${completedHours}h`}
          icon={Clock}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          label="Capacitação Mensal"
          value="40h / 5 Dias"
          icon={HardHat}
          color="text-orange-600"
          bg="bg-orange-50"
        />
        <KpiCard
          label="Conformidade Digital"
          value="98%"
          icon={CheckCircle2}
          color="text-accent"
          bg="bg-accent/5"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[650px] grid-cols-3 bg-muted/50 p-1.5 rounded-2xl h-16 mb-8">
          <TabsTrigger
            value="matrix"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8"
          >
            Matriz ISO 45001
          </TabsTrigger>
          <TabsTrigger
            value="learning"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-accent"
          >
            <BookOpen className="size-4" /> Onboarding & Conhecimento
          </TabsTrigger>
          <TabsTrigger
            value="certificates"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8"
          >
            Certificados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50 border-b pb-8 px-8 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-headline font-black text-primary uppercase">
                    Matriz de Treinamentos
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-slate-400">
                    Competências mandatórias por função e validade.
                  </CardDescription>
                </div>
                <Badge className="bg-[#001F3F] text-white font-black uppercase text-[10px] px-4 h-8 flex items-center shadow-lg">
                  FEVEREIRO 2026
                </Badge>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-10">
                  {trainings.map((trn) => (
                    <div key={trn.id} className="space-y-5">
                      <div className="flex justify-between items-end">
                        <div>
                          <h3 className="font-black text-primary uppercase text-sm tracking-tight">
                            {trn.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                              <Building2 className="size-3" /> {trn.companyName}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[8px] font-black border-none uppercase px-2 h-5",
                                trn.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-blue-100 text-blue-700"
                              )}
                            >
                              {trn.status === "completed" ? "FINALIZADO" : "EM CURSO"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase">
                            Carga Horária
                          </p>
                          <p className="text-sm font-black text-primary">
                            {trn.totalHours}h Totais
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-3 h-20">
                        {["Seg", "Ter", "Qua", "Qui", "Sex"].map((day, i) => (
                          <div key={day} className="flex flex-col gap-2">
                            <div
                              className={cn(
                                "flex-1 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all shadow-inner",
                                i < 3 || trn.status === "completed"
                                  ? "bg-accent/10 border-accent/30 text-accent"
                                  : "bg-slate-50 border-slate-200 text-slate-300 opacity-40"
                              )}
                            >
                              {i < 3 || trn.status === "completed" ? (
                                <CheckCircle2 className="size-5" />
                              ) : (
                                <Calendar className="size-5" />
                              )}
                            </div>
                            <span className="text-[9px] font-black uppercase text-center text-slate-400 tracking-tighter">
                              {day}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-dashed">
                        <div className="flex gap-2">
                          {trn.nrs.map((nr) => (
                            <Badge
                              key={nr}
                              variant="secondary"
                              className="text-[8px] font-black uppercase bg-primary/5 text-primary border-none"
                            >
                              {nr}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-[9px] font-black uppercase gap-2"
                        >
                          Ver Lista <ChevronRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {trainings.length === 0 && (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                      <AlertCircle className="size-16" />
                      <p className="font-black uppercase text-xs tracking-widest">
                        Nenhum treinamento para esta unidade
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-8">
              <Card className="border-none shadow-xl bg-[#090e24] text-white rounded-[2.5rem] overflow-hidden relative">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Brain className="size-32 text-accent" />
                </div>
                <CardHeader className="p-8">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                    <Zap className="size-4" /> Insight NAI Academia
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                    <p className="text-sm italic leading-relaxed text-white/80">
                      &quot;O engajamento digital na rede subiu 15%. Turmas presenciais com QR Code
                      reduziram o tempo de processamento de certificados.&quot;
                    </p>
                  </div>
                  <Button className="w-full h-14 bg-accent text-primary font-black uppercase text-[10px] rounded-xl shadow-xl hover:opacity-90">
                    Analisar Gap de Treinamento
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="learning" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
                  <CardHeader className="bg-slate-50/50 p-8 border-b">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                        <PlayCircle className="size-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black text-primary uppercase leading-none">
                          Playbook de Onboarding
                        </CardTitle>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          Treinamento Ágil de Colaboradores
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        Materiais e passo a passo estruturado para integração imediata.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <span className="text-[10px] font-bold text-primary uppercase">
                            Módulo 1: Cultura de Segurança
                          </span>
                          <Badge className="bg-emerald-100 text-emerald-700 text-[8px]">
                            LIBERADO
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl opacity-60">
                          <span className="text-[10px] font-bold text-primary uppercase">
                            Módulo 2: Procedimentos NR-18
                          </span>
                          <Badge className="bg-blue-100 text-blue-700 text-[8px]">EM BREVE</Badge>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-lg gap-2">
                      Iniciar Trilha <ArrowRight className="size-3" />
                    </Button>
                  </CardContent>
                </Card>

                <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
                  <CardHeader className="bg-slate-50/50 p-8 border-b">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                        <FileSearch className="size-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black text-primary uppercase leading-none">
                          Registro de Saber
                        </CardTitle>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          O Conhecimento não se perde
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        As informações técnicas e lições aprendidas ficam sempre disponíveis para
                        serem compartilhadas.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[8px] font-black uppercase">
                          Wiki Técnica
                        </Badge>
                        <Badge variant="outline" className="text-[8px] font-black uppercase">
                          Fórum de Dúvidas
                        </Badge>
                        <Badge variant="outline" className="text-[8px] font-black uppercase">
                          FAQ Normas
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full h-12 border-primary text-primary font-black uppercase text-[10px] rounded-xl gap-2"
                    >
                      <Share2 className="size-3" /> Compartilhar Conhecimento
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="card-shadow border-none bg-blue-50/50 rounded-[2.5rem] p-10 flex items-start gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Lightbulb className="size-32 text-primary" />
                </div>
                <div className="size-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary shrink-0">
                  <Brain size={32} />
                </div>
                <div className="space-y-4 relative z-10 text-left">
                  <h3 className="text-xl font-black text-primary uppercase font-headline leading-tight">
                    Biblioteca Técnica NAI
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                    &quot;Centralizamos todos os materiais didáticos, vídeos instrucionais e guias
                    de normas para que a expertise técnica da rede seja escalável e perene.&quot;
                  </p>
                  <div className="flex gap-4 pt-4">
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-primary">124</span>
                      <span className="text-[8px] font-black uppercase text-slate-400">
                        Documentos Registrados
                      </span>
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-4 self-center" />
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-primary">850</span>
                      <span className="text-[8px] font-black uppercase text-slate-400">
                        Acessos este Mês
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6 text-left">
              <Card className="bg-[#090e24] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Zap className="size-32 text-accent" />
                </div>
                <div className="relative z-10 space-y-6">
                  <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-widest">
                    NAI Onboarding v2.7
                  </Badge>
                  <h3 className="text-lg font-black uppercase tracking-tight font-headline">
                    Treinamento Ágil
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed font-medium">
                    O aprendizado rápido de novos colaboradores é garantido por materiais dinâmicos
                    e trilhas automatizadas pela NAI.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase text-white/80">
                        Checklists de Admissão
                      </span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase text-white/80">
                        Vídeos Instrucionais
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="certificates" className="mt-8 space-y-6">
          <Card className="border-none shadow-xl bg-white rounded-[2.5rem] flex flex-col overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-8">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Validade de Certificados Digitais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {trainings[0]?.students.map((student) => (
                  <div
                    key={student.id}
                    className="p-5 hover:bg-slate-50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                        {student.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-primary uppercase">{student.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">
                          Expira em: 12/2026
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "text-[8px] font-black uppercase border-none px-3 h-5 flex items-center",
                        student.status === "certified"
                          ? "bg-emerald-100 text-emerald-700"
                          : student.status === "present"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {student.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="p-6 bg-slate-50 border-t">
              <Button className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg gap-2">
                <FileCheck className="size-4 text-accent" /> Auditar Certificados
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl group hover:ring-2 ring-primary/5 transition-all overflow-hidden text-left">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl", bg, color)}>
            <Icon className="size-5" />
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-300">
            Live
          </Badge>
        </div>
        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
          {label}
        </p>
        <h3 className={cn("text-2xl font-black leading-none mb-1", color)}>{value}</h3>
      </CardContent>
    </Card>
  );
}
