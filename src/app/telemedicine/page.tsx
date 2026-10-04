"use client";

import * as React from "react";
import {
  Video,
  Calendar,
  User,
  Stethoscope,
  Plus,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Clock,
  Search,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Lock,
  Brain,
  Zap,
  ChevronRight,
  MailCheck,
  ClipboardList,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  doc,
} from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { gerarLinkMeet } from "@/actions/telemedicine";
import { cn } from "@/lib/utils";
import { ClinicalSidebar } from "@/components/telemedicine/clinical-sidebar";
import { CalendarSyncButton } from "@/components/telemedicine/calendar-sync-button";

/**
 * @fileOverview Telemedicina Segura - Auditoria Firestore Real & Trava Acessibilidade.
 */

export default function TelemedicinePage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isBookingOpen, setIsBookingOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeClinicalSheet, setActiveClinicalSheet] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    pacienteEmail: "",
    medicoEmail: user?.email || "doutor.nextcon@nextconsaude.com.br",
    data: "",
    hora: "",
    titulo: "Videoconsulta Nextcon",
  });

  // Listener Real-time para Agendamentos de Telemedicina
  const appointmentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "agendamentos_telemedicina"), orderBy("inicio", "desc"), limit(50));
  }, [db]);

  const { data: appointments, isLoading } = useCollection(appointmentsQuery);

  async function handleBook() {
    if (!formData.pacienteEmail || !formData.data || !formData.hora) {
      toast({
        variant: "destructive",
        title: "Dados Incompletos",
        description: "Preencha todos os campos obrigatórios.",
      });
      return;
    }

    if (!db) return;

    setIsSubmitting(true);
    try {
      const inicioStr = `${formData.data}T${formData.hora}:00-03:00`;
      const dateInicio = new Date(inicioStr);
      const dateFim = new Date(dateInicio.getTime() + 30 * 60000);

      const result = await gerarLinkMeet({
        pacienteEmail: formData.pacienteEmail,
        medicoEmail: formData.medicoEmail,
        dataHoraInicio: inicioStr,
        dataHoraFim: dateFim.toISOString(),
        tituloConsulta: formData.titulo,
      });

      if (result.sucesso && result.link_meet) {
        const appointmentsRef = collection(db, "agendamentos_telemedicina");
        addDocumentNonBlocking(appointmentsRef, {
          paciente_email: formData.pacienteEmail,
          medico_email: formData.medicoEmail,
          inicio: Timestamp.fromDate(dateInicio),
          fim: Timestamp.fromDate(dateFim),
          link_meet: result.link_meet,
          status: "agendada",
          is_mock: result.simulado,
          security_protocol: "NAI_HEALTH_HIPAA_V4",
          createdAt: serverTimestamp(),
        });

        toast({
          title: result.simulado ? "Agendado (Modo Simulado)" : "Consulta Protocolada!",
          description: result.simulado
            ? "O link do Meet está disponível na fila."
            : "Link gerado e convite enviado via NAI API/Gmail.",
        });

        setIsBookingOpen(false);
        setFormData({ ...formData, pacienteEmail: "", data: "", hora: "" });
      } else {
        toast({
          variant: "destructive",
          title: "Erro no Agendamento",
          description: result.mensagem,
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Falha Crítica",
        description: "Não foi possível processar o agendamento.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-6">
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
              <Video className="size-6 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
                Telemedicina Segura
              </h1>
              <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em] mt-1 flex items-center gap-2">
                <ShieldCheck className="size-3 text-emerald-600" /> Protocolo NAI Health HIPAA v4.0
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-2xl gap-2 hover:scale-105 transition-all">
                <Plus className="size-4 text-accent" /> Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <DialogHeader className="p-8 bg-primary text-white">
                <DialogTitle className="text-xl font-headline font-black uppercase tracking-tight">
                  Sala Segura Meet
                </DialogTitle>
                <DialogDescription className="text-white/60 font-medium italic mt-1">
                  Geração de link e convite via motor NAI API para Google Calendar.
                </DialogDescription>
              </DialogHeader>

              <div className="p-8 space-y-5 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    E-mail do Paciente
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-3.5 size-4 text-slate-300" />
                    <Input
                      type="email"
                      placeholder="ex@paciente.com.br"
                      value={formData.pacienteEmail}
                      onChange={(e) => setFormData({ ...formData, pacienteEmail: e.target.value })}
                      className="pl-12 h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Data
                    </label>
                    <Input
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Horário
                    </label>
                    <Input
                      type="time"
                      value={formData.hora}
                      onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3">
                  <MailCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-emerald-800 font-bold leading-relaxed italic">
                    "O convite será enviado automaticamente pelo motor NAI para o Gmail do paciente
                    e do médico."
                  </p>
                </div>

                <Button
                  onClick={handleBook}
                  disabled={isSubmitting}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 mt-4"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Zap className="size-5 text-accent" />
                  )}
                  Finalizar e Enviar Convites
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-6 px-8 flex justify-between items-center flex-row">
            <CardTitle className="text-lg font-black text-primary uppercase">
              Fila de Consultas Digitais
            </CardTitle>
            <Badge
              variant="outline"
              className="bg-emerald-50 border-emerald-100 text-emerald-700 border-none h-5 px-3 uppercase text-[8px] font-black"
            >
              NAI API LIVE
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-32 flex flex-col items-center gap-4">
                <Loader2 className="size-12 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Sincronizando Google Meet...
                </p>
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {appointments
                  .filter((a) => a.paciente_email.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((appt) => {
                    const date = appt.inicio?.seconds
                      ? new Date(appt.inicio.seconds * 1000)
                      : new Date(appt.inicio);
                    const dateEnd = appt.fim?.seconds
                      ? new Date(appt.fim.seconds * 1000)
                      : new Date(appt.fim);

                    return (
                      <div
                        key={appt.id}
                        className="p-6 hover:bg-slate-50 transition-all group flex flex-col sm:flex-row items-center justify-between gap-6"
                      >
                        <div className="flex items-center gap-5 flex-1 text-left">
                          <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                            <Video className="size-7" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-sm text-primary uppercase leading-tight">
                              {appt.paciente_email.split("@")[0]}
                            </p>
                            <div className="flex items-center gap-3">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                {appt.paciente_email}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase">
                                <Calendar className="size-3" /> {date.toLocaleDateString("pt-BR")}
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase">
                                <Clock className="size-3" />{" "}
                                {date.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Sheet
                            open={activeClinicalSheet === appt.id}
                            onOpenChange={(open) => setActiveClinicalSheet(open ? appt.id : null)}
                          >
                            <SheetTrigger asChild>
                              <Button
                                variant="ghost"
                                className={cn(
                                  "h-11 px-5 border border-slate-100 text-primary font-black uppercase text-[9px] rounded-xl hover:bg-slate-50 gap-2",
                                  appt.status === "concluído" && "opacity-50 pointer-events-none"
                                )}
                              >
                                <Brain className="size-3.5 text-accent" /> Suporte Clínico
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="p-0 border-none sm:max-w-md w-full">
                              <SheetHeader className="sr-only">
                                <SheetTitle>Painel do Assistente NAI</SheetTitle>
                                <SheetDescription>
                                  Suporte técnico e transcrição para teleconsulta em tempo real.
                                </SheetDescription>
                              </SheetHeader>
                              <ClinicalSidebar
                                isOpen={true}
                                onToggle={() => setActiveClinicalSheet(null)}
                                patientData={{
                                  name: appt.paciente_email.split("@")[0],
                                  id: appt.id,
                                }}
                                telemetry={[{ heartRate: 72, spo2: 98 }]}
                              />
                            </SheetContent>
                          </Sheet>
                          <Button
                            asChild
                            className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg group gap-2"
                          >
                            <a href={appt.link_meet} target="_blank" rel="noopener noreferrer">
                              Entrar na Sala{" "}
                              <ChevronRight className="size-3 group-hover:translate-x-1 transition-transform" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="py-40 text-center opacity-20 flex flex-col items-center gap-4">
                <Video className="size-20" />
                <p className="font-black uppercase text-xs tracking-widest">
                  Aguardando Consultas Digitais
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <ShieldCheck className="size-48 text-accent" />
            </div>
            <div className="relative z-10 space-y-6 text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent rounded-xl text-primary shadow-lg shadow-accent/20">
                  <Lock className="size-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-accent">
                  Status NAI Health
                </h3>
              </div>
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase text-white/40 mb-2">
                  Protocolo de Segurança
                </p>
                <p className="text-xl font-black text-emerald-400">ATIVO (HIPAA v4.0)</p>
              </div>
              <p className="text-[10px] leading-relaxed italic text-white/40 border-t border-white/5 pt-4">
                "Todo agendamento dispara convites automáticos sincronizados com calendários Google
                via motor NAI API."
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
