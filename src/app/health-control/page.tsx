"use client";

import * as React from "react";
import {
  HeartPulse,
  Stethoscope,
  CheckCircle2,
  Plus,
  QrCode,
  Zap,
  Users,
  Search,
  Fingerprint,
  Loader2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, limit } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { DigitalSignatureDialog } from "@/components/medical/digital-signature-dialog";
import { DownloadAsoButton } from "@/components/documents/download-aso-button";

export default function HealthControl() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
  const [isSignDialogOpen, setIsSignDialogOpen] = React.useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = React.useState(false);
  const [selectedApptForSign, setSelectedApptForSign] = React.useState<any>(null);
  const [isScheduling, setIsScheduling] = React.useState(false);

  const [newAppt, setNewAppt] = React.useState({
    colaborador_nome: "",
    tipo: "Periódico" as any,
    data: "",
    hora: "",
  });

  React.useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const appointmentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "agendamentos"), orderBy("data_hora", "asc"), limit(50));
  }, [db]);
  const { data: appointments, isLoading } = useCollection(appointmentsQuery);

  const handleCheckIn = (appt: any) => {
    if (!db) return;
    const docRef = doc(db, "agendamentos", appt.id);
    updateDocumentNonBlocking(docRef, {
      status: "Em Espera",
      check_in_realizado: true,
      check_in_at: new Date().toISOString(),
    });
    toast({
      title: "Check-in Realizado",
      description: `${appt.colaborador_nome} entrou na fila de espera.`,
    });
  };

  const handleStartConsultation = (appt: any) => {
    if (!db) return;
    const docRef = doc(db, "agendamentos", appt.id);
    updateDocumentNonBlocking(docRef, { status: "Em Atendimento" });
    toast({
      title: "Chamada Realizada",
      description: "O paciente foi direcionado ao consultório.",
    });
  };

  const openSignDialog = (appt: any) => {
    setSelectedApptForSign(appt);
    setIsSignDialogOpen(true);
  };

  const handleFinalizeWithSignature = async (signatureData: any) => {
    if (!db || !user || !selectedApptForSign) return;

    const appt = selectedApptForSign;
    const docRef = doc(db, "agendamentos", appt.id);
    updateDocumentNonBlocking(docRef, { status: "Concluído" });

    const asoRef = collection(db, "atendimentos_aso");
    await addDocumentNonBlocking(asoRef, {
      agendamento_id: appt.id,
      medico_id: user.uid,
      employeeName: appt.colaborador_nome,
      companyId: appt.companyId || "CLI_NATIVA",
      data_emissao: new Date().toISOString(),
      resultado: "Apto",
      signature_info: signatureData,
      status_esocial: "Pendente",
      createdAt: new Date().toISOString(),
    });

    setSelectedApptForSign(null);
  };

  const handleScheduleExam = async () => {
    if (!db || !newAppt.colaborador_nome || !newAppt.data || !newAppt.hora) {
      toast({
        variant: "destructive",
        title: "Dados Incompletos",
        description: "Preencha todos os campos do agendamento.",
      });
      return;
    }

    setIsScheduling(true);
    try {
      const apptRef = collection(db, "agendamentos");
      await addDocumentNonBlocking(apptRef, {
        colaborador_nome: newAppt.colaborador_nome,
        tipo: newAppt.tipo,
        data_hora: `${newAppt.data}T${newAppt.hora}:00`,
        status: "Agendado",
        check_in_realizado: false,
        companyId: profile?.companyId || "Matriz",
        createdAt: new Date().toISOString(),
      });

      toast({ title: "Sucesso!", description: "Exame agendado com sucesso." });
      setIsScheduleDialogOpen(false);
      setNewAppt({ colaborador_nome: "", tipo: "Periódico", data: "", hora: "" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao agendar",
        description: "Tente novamente em instantes.",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const getWaitTime = (checkInAt: string) => {
    if (!checkInAt || !currentTime) return 0;
    const diff = currentTime.getTime() - new Date(checkInAt).getTime();
    return Math.floor(diff / 60000);
  };

  const stats = React.useMemo(() => {
    if (!appointments) return { waiting: 0, inProgress: 0, completed: 0 };
    return {
      waiting: appointments.filter((a) => a.status === "Em Espera").length,
      inProgress: appointments.filter((a) => a.status === "Em Atendimento").length,
      completed: appointments.filter((a) => a.status === "Concluído").length,
    };
  }, [appointments]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Clínica Digital Nextcon
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Zap className="size-3 text-accent animate-pulse" /> Monitoramento de Fluxo em Tempo
            Real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              toast({
                title: "Check-in QR",
                description: "Funcionalidade disponível no app mobile do colaborador.",
              })
            }
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2"
          >
            <QrCode className="size-4" /> Check-in QR
          </Button>
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                <Plus className="size-4" /> Agendar Exame
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <div className="p-8 bg-primary text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Plus className="size-5 text-accent" />
                  </div>
                  <DialogTitle className="text-xl font-headline font-black uppercase tracking-tight">
                    Novo Agendamento
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/70 font-medium italic">
                  Insira os dados do colaborador para o exame SST.
                </DialogDescription>
              </div>

              <div className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Nome do Colaborador
                  </Label>
                  <Input
                    placeholder="Nome completo"
                    value={newAppt.colaborador_nome}
                    onChange={(e) => setNewAppt({ ...newAppt, colaborador_nome: e.target.value })}
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Tipo de Exame
                  </Label>
                  <select
                    className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner px-4 text-sm"
                    value={newAppt.tipo}
                    onChange={(e) => setNewAppt({ ...newAppt, tipo: e.target.value as any })}
                  >
                    <option value="Admissional">Admissional</option>
                    <option value="Periódico">Periódico</option>
                    <option value="Demissional">Demissional</option>
                    <option value="Mudança de Função">Mudança de Função</option>
                    <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Data
                    </Label>
                    <Input
                      type="date"
                      value={newAppt.data}
                      onChange={(e) => setNewAppt({ ...newAppt, data: e.target.value })}
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Horário
                    </Label>
                    <Input
                      type="time"
                      value={newAppt.hora}
                      onChange={(e) => setNewAppt({ ...newAppt, hora: e.target.value })}
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleScheduleExam}
                  disabled={isScheduling}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 mt-4"
                >
                  {isScheduling ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-5 text-accent" />
                  )}
                  Confirmar Agendamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Em Espera"
          value={stats.waiting}
          icon={Users}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <MetricCard
          label="Em Atendimento"
          value={stats.inProgress}
          icon={Stethoscope}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <MetricCard
          label="Concluídos Hoje"
          value={stats.completed}
          icon={CheckCircle2}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <MetricCard
          label="SLA de Atendimento"
          value="20 min"
          icon={ShieldCheck}
          color="text-primary"
          bg="bg-slate-100"
        />
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-black text-primary uppercase">
              Painel de Atendimento
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
              Controle de Fluxo: Triagem &gt; Médico &gt; Assinatura.
            </CardDescription>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-300" />
            <Input
              placeholder="Buscar na fila..."
              className="pl-10 h-10 bg-white border-none shadow-sm rounded-xl text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black">
              <TableRow>
                <TableHead className="pl-8">Colaborador / Empresa</TableHead>
                <TableHead>Tipo de Exame</TableHead>
                <TableHead>Status / Tempo de Espera</TableHead>
                <TableHead className="pr-8 text-right">Ação Operacional</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-24 text-center">
                    <Loader2 className="size-10 animate-spin mx-auto text-primary opacity-20" />
                  </TableCell>
                </TableRow>
              ) : (
                appointments?.map((appt) => {
                  const waitTime = getWaitTime(appt.check_in_at);
                  const isCritical = waitTime >= 20;

                  return (
                    <TableRow
                      key={appt.id}
                      className={cn(
                        "hover:bg-slate-50/50 transition-all group",
                        appt.status === "Concluído" ? "opacity-60" : ""
                      )}
                    >
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-xs font-black shadow-inner">
                            {appt.colaborador_nome?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-xs text-primary uppercase leading-tight">
                              {appt.colaborador_nome}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                              Empresa ID: {appt.companyId || "Matriz"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black uppercase border-primary/10 text-primary py-1 px-3"
                        >
                          {appt.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge
                            className={cn(
                              "w-fit text-[8px] font-black uppercase border-none px-3 h-5",
                              appt.status === "Em Espera"
                                ? "bg-amber-100 text-amber-700"
                                : appt.status === "Em Atendimento"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {appt.status}
                          </Badge>
                          {appt.status === "Em Espera" && currentTime && (
                            <div
                              className={cn(
                                "flex items-center gap-1.5 text-[10px] font-black",
                                isCritical ? "text-red-600" : "text-slate-400"
                              )}
                            >
                              <Clock className="size-3" /> {waitTime} min de espera
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                          {appt.status === "Agendado" && (
                            <Button
                              onClick={() => handleCheckIn(appt)}
                              className="h-10 px-5 bg-primary text-white font-black uppercase text-[9px] rounded-xl shadow-lg"
                            >
                              Check-in
                            </Button>
                          )}
                          {appt.status === "Em Espera" && (
                            <Button
                              onClick={() => handleStartConsultation(appt)}
                              className="h-10 px-5 bg-blue-600 text-white font-black uppercase text-[9px] rounded-xl shadow-lg flex gap-2"
                            >
                              Chamar
                            </Button>
                          )}
                          {appt.status === "Em Atendimento" && (
                            <Button
                              onClick={() => openSignDialog(appt)}
                              className="h-10 px-5 bg-emerald-600 text-white font-black uppercase text-[9px] rounded-xl shadow-lg flex gap-2"
                            >
                              Assinar
                            </Button>
                          )}
                          {appt.status === "Concluído" && (
                            <DownloadAsoButton
                              patientData={{
                                patientName: appt.colaborador_nome,
                                companyName: appt.companyId,
                                status: "Apto",
                                type: appt.tipo,
                              }}
                              variant="default"
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DigitalSignatureDialog
        isOpen={isSignDialogOpen}
        onOpenChange={setIsSignDialogOpen}
        onSign={handleFinalizeWithSignature}
        patientName={selectedApptForSign?.colaborador_nome || ""}
        doctorProfile={profile}
      />
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
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
        <h3 className={cn("text-2xl font-black leading-none", color)}>{value}</h3>
      </CardContent>
    </Card>
  );
}
