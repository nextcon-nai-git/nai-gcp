"use client";

import * as React from "react";
import {
  GraduationCap,
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Download,
  ChevronRight,
  HardHat,
  Brain,
  Building2,
  MoreHorizontal,
  Loader2,
  FileText,
  QrCode,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { REAL_TRAININGS } from "@/lib/real-data";
import { cn } from "@/lib/utils";

interface Training {
  id: string;
  title: string;
  hours?: number;
  totalHours?: number;
  students: any[];
  completions?: number;
  status?: string;
  companyName?: string;
  nrs?: string[];
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

export default function TrainingDashboard() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showQr, setShowQr] = React.useState(false);

  const trainings: Training[] = REAL_TRAININGS;
  const totalStudents = trainings.reduce(
    (acc: number, curr: Training) => acc + (curr.students?.length || 0),
    0
  );
  const completedHours = trainings.reduce(
    (acc: number, curr: Training) => acc + (curr.status === "completed" ? curr.totalHours || 0 : 0),
    0
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Academia NRs & Engenharia
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">
            Gestão de capacitação técnica e presença digital 2026.
          </p>
        </div>
        <div className="flex gap-2">
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
                    "Geolocalização e Biometria Facial ativas para conformidade NR-01."
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
          <Button
            onClick={() =>
              toast({
                title: "Novo Treinamento",
                description: "Painel de agendamento de treinamentos em desenvolvimento.",
              })
            }
            className="bg-primary text-white gap-2 h-11 px-6 shadow-lg font-bold uppercase text-[10px]"
          >
            <Plus className="size-4" /> Novo Treinamento
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-slate-50 border-b pb-8 px-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-headline font-black text-primary uppercase">
                  Cronograma de Capacitação
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400">
                  Status das turmas em tempo real.
                </CardDescription>
              </div>
              <Badge className="bg-[#001F3F] text-white font-black uppercase text-[10px] px-4 h-8 flex items-center">
                FEVEREIRO 2026
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-10">
              {trainings.map((trn: Training) => (
                <div key={trn.id} className="space-y-5">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="font-black text-primary uppercase text-sm tracking-tight">
                        {trn.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                          <Building2 className="size-3" /> {trn.companyName || "N/A"}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[8px] font-black border-accent/20 text-accent"
                        >
                          EM CURSO
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase">
                        Carga Horária
                      </p>
                      <p className="text-sm font-black text-primary">
                        {trn.totalHours || trn.hours || 0}h Totais
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3 h-20">
                    {["Seg", "Ter", "Qua", "Qui", "Sex"].map((day, i) => (
                      <div key={day} className="flex flex-col gap-2">
                        <div
                          className={cn(
                            "flex-1 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all shadow-inner",
                            i < 3
                              ? "bg-accent/10 border-accent/30 text-accent"
                              : "bg-slate-50 border-slate-200 text-slate-300 opacity-40"
                          )}
                        >
                          {i < 3 ? (
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
                      {(trn.nrs || []).map((nr: string) => (
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
                      onClick={() =>
                        toast({
                          title: "Lista de Presença",
                          description: "Visualização detalhada da turma em desenvolvimento.",
                        })
                      }
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[9px] font-black uppercase gap-2"
                    >
                      Ver Lista <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
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
                  "O engajamento digital na rede subiu 15%. Turmas presenciais com QR Code reduziram
                  o tempo de processamento de certificados."
                </p>
              </div>
              <Button
                onClick={() =>
                  toast({
                    title: "Análise de Gap",
                    description: "O Cérebro NAI está processando a matriz de competências...",
                  })
                }
                className="w-full h-14 bg-accent text-primary font-black uppercase text-[10px] rounded-xl shadow-xl hover:opacity-90"
              >
                Analisar Gap de Treinamento
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-[2.5rem] flex flex-col overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Alunos Matriculados (Lote Atual)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
              <div className="divide-y">
                {(trainings[0]?.students || []).map((student: any) => (
                  <div
                    key={student.id}
                    className="p-5 hover:bg-slate-50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                        {(student.name || "").substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-primary uppercase">{student.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">
                          Check-in: 08:04
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "text-[8px] font-black uppercase border-none px-3",
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
              <Button
                onClick={() =>
                  toast({
                    title: "Certificação em Lote",
                    description: "Gerando certificados assinados digitalmente (NR-01)...",
                  })
                }
                className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg gap-2"
              >
                <FileText className="size-4 text-accent" /> Gerar Certificados (Lote)
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }: KpiCardProps) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl group hover:ring-2 ring-primary/5 transition-all overflow-hidden">
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
        <h3 className="text-2xl font-black text-primary leading-none mb-1">{value}</h3>
      </CardContent>
    </Card>
  );
}
