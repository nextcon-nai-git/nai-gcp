"use client";
import Link from "next/link";

import * as React from "react";
import { Plus, Zap, Search, Loader2, Calendar as CalendarIcon, Save, Sparkles } from "lucide-react";
import { GoogleCalendarSyncWidget } from "@/components/GoogleCalendarSyncWidget";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import type { MedicalAppointment } from "@/types/schema";
import { useSgi } from "@/contexts/sgi-context";

import {
  createClinicalAppointment,
  advanceClinicalAppointment,
} from "@/services/clinical-scheduling";
import {
  CLINICAL_QUEUE_PAGE_SIZE,
  clinicalQueuePage,
  clinicalQueueQuery,
  clinicalQueueToday,
} from "@/services/clinical-queue";

export default function HealthControl() {
  const { toast } = useToast();
  const { role, companyId: userCompanyId } = useUser();
  const db = useFirestore();
  const { activeClientId, isGlobalStaff, authorizedCompanies } = useSgi();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [queueDate, setQueueDate] = React.useState(() => clinicalQueueToday());
  const queueScope = `${activeClientId}:${queueDate}`;
  const [scheduledPage, setScheduledPage] = React.useState({
    scope: "",
    size: CLINICAL_QUEUE_PAGE_SIZE,
  });
  const [activePage, setActivePage] = React.useState({ scope: "", size: CLINICAL_QUEUE_PAGE_SIZE });
  const visibleLimits = {
    scheduled: scheduledPage.scope === queueScope ? scheduledPage.size : CLINICAL_QUEUE_PAGE_SIZE,
    active: activePage.scope === activeClientId ? activePage.size : CLINICAL_QUEUE_PAGE_SIZE,
  };
  const loadMore = (mode: "scheduled" | "active") => {
    if (mode === "scheduled")
      setScheduledPage({
        scope: queueScope,
        size: visibleLimits.scheduled + CLINICAL_QUEUE_PAGE_SIZE,
      });
    else
      setActivePage({
        scope: activeClientId,
        size: visibleLimits.active + CLINICAL_QUEUE_PAGE_SIZE,
      });
  };
  const [selectedAppointment, setSelectedApptForSign] = React.useState<MedicalAppointment | null>(
    null
  );
  const selectedApptForSign =
    selectedAppointment?.companyId === activeClientId && activeClientId !== "unauthorized"
      ? selectedAppointment
      : null;

  const [isAsoFormOpen, setIsAsoFormOpen] = React.useState(false);

  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
  const [isScheduling, setIsScheduling] = React.useState(false);
  const schedulingPending = React.useRef(false);
  const appointmentMutationPending = React.useRef(false);
  const [busyAppointmentId, setBusyAppointmentId] = React.useState<string | null>(null);

  const [newAppt, setNewAppt] = React.useState({
    employeeId: "",
    companyId: "",
    type: "Periódico",
    date: clinicalQueueToday(),
    time: "08:00",
  });

  const companiesQuery = useMemoFirebase(() => {
    if (!db || activeClientId === "unauthorized") return null;
    if (isGlobalStaff) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (authorizedCompanies && authorizedCompanies.length > 0) {
      return query(collection(db, "companies"), where("__name__", "in", authorizedCompanies));
    }
    if (userCompanyId) {
      return query(collection(db, "companies"), where("__name__", "==", userCompanyId));
    }
    return null;
  }, [db, isGlobalStaff, authorizedCompanies, userCompanyId, activeClientId]);

  const { data: companies } = useCollection(companiesQuery);

  const scheduledQuery = useMemoFirebase(() => {
    if (!db || !role) return null;
    return clinicalQueueQuery(db, activeClientId, "scheduled", queueDate, visibleLimits.scheduled);
  }, [db, activeClientId, role, queueDate, visibleLimits.scheduled]);
  const activeQuery = useMemoFirebase(() => {
    if (!db || !role) return null;
    return clinicalQueueQuery(db, activeClientId, "active", "", visibleLimits.active);
  }, [db, activeClientId, role, visibleLimits.active]);
  const scheduledQueue = useCollection<MedicalAppointment>(scheduledQuery);
  const activeQueue = useCollection<MedicalAppointment>(activeQuery);
  const queueSections = [
    {
      id: "active" as const,
      title: "Em espera e em atendimento",
      description:
        "Atendimentos ainda abertos, de todas as datas. Carregue mais para consultar os demais registros.",
      result: activeQueue,
    },
    {
      id: "scheduled" as const,
      title: "Agendados na data selecionada",
      description:
        "Use a data para consultar a agenda. Check-ins passam para a fila de atendimentos abertos.",
      result: scheduledQueue,
    },
  ].map((section) => {
    const page = clinicalQueuePage(section.result.data, visibleLimits[section.id]);
    const term = searchTerm.trim().toLocaleLowerCase("pt-BR");
    return {
      ...section,
      ...page,
      filtered: page.items.filter((item) =>
        (item.colaborador_nome || "").toLocaleLowerCase("pt-BR").includes(term)
      ),
    };
  });

  // Query para buscar funcionários da empresa selecionada no agendamento
  const dialogEmployeesQuery = useMemoFirebase(() => {
    if (!db || !newAppt.companyId || activeClientId === "unauthorized") return null;
    if (
      !isGlobalStaff &&
      userCompanyId !== newAppt.companyId &&
      !authorizedCompanies.includes(newAppt.companyId)
    )
      return null;
    return query(
      collection(db, "companies", newAppt.companyId, "employees"),
      orderBy("name", "asc")
    );
  }, [db, newAppt.companyId, activeClientId, isGlobalStaff, userCompanyId, authorizedCompanies]);
  const { data: dialogEmployees, isLoading: loadingDialogEmployees } =
    useCollection(dialogEmployeesQuery);

  React.useEffect(() => {
    if (isScheduleOpen && activeClientId !== "all" && activeClientId !== "unauthorized") {
      setNewAppt((prev) =>
        prev.companyId === activeClientId
          ? prev
          : { ...prev, companyId: activeClientId, employeeId: "" }
      );
    }
  }, [isScheduleOpen, activeClientId]);

  const advanceAppointment = async (
    appt: MedicalAppointment,
    next: "Em Espera" | "Em Atendimento"
  ) => {
    if (!db || !appt.companyId || appointmentMutationPending.current) return;
    appointmentMutationPending.current = true;
    setBusyAppointmentId(appt.id);
    try {
      await advanceClinicalAppointment(db, appt.companyId, appt.id, next);
      if (next === "Em Espera") {
        toast({
          title: "Check-in Realizado",
          description: `${appt.colaborador_nome} entrou na fila.`,
        });
      } else {
        setSelectedApptForSign(appt);
        setIsAsoFormOpen(true);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível atualizar o atendimento",
        description: "Atualize a fila para conferir o status e tente novamente.",
      });
    } finally {
      appointmentMutationPending.current = false;
      setBusyAppointmentId(null);
    }
  };

  const handleScheduleSave = async () => {
    if (schedulingPending.current) return;
    if (!db || !newAppt.employeeId || !newAppt.companyId) {
      toast({
        variant: "destructive",
        title: "Dados Incompletos",
        description: "Selecione o colaborador e a unidade.",
      });
      return;
    }

    schedulingPending.current = true;
    setIsScheduling(true);
    try {
      const result = await createClinicalAppointment(db, newAppt);

      toast({
        title: "Exame Agendado",
        description: `Consulta de ${result.employeeName} registrada.`,
      });
      setIsScheduleOpen(false);
      setNewAppt({
        employeeId: "",
        companyId: activeClientId !== "all" ? activeClientId : "",
        type: "Periódico",
        date: clinicalQueueToday(),
        time: "08:00",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao Agendar",
        description:
          "Confira a empresa, o colaborador, a data e o horário. Atualize para confirmar antes de tentar novamente.",
      });
    } finally {
      schedulingPending.current = false;
      setIsScheduling(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Clínica (ASO)
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Zap className="size-3 text-accent" /> Gestão Multi-tenant de Atendimentos.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            asChild
            className="border-2 border-primary text-primary hover:bg-primary/5 h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white shadow-sm"
          >
            <Link
              href="/nai-importa"
              title="Importar e revisar o ASO, a empresa e o colaborador antes de salvar"
            >
              <Sparkles className="size-4 text-accent" /> Importar e revisar ASO
            </Link>
          </Button>

          <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
                <Plus className="size-4" /> Agendar Exame
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
              <DialogHeader className="p-8 bg-primary text-white space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg text-accent">
                    <CalendarIcon className="size-5" />
                  </div>
                  <DialogTitle className="text-xl font-headline font-black uppercase">
                    Agendamento de Exame
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/60 font-medium italic">
                  Reserva de data e hora para atendimento ocupacional.
                </DialogDescription>
              </DialogHeader>
              <div className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Unidade / Empresa
                  </label>
                  <Select
                    value={newAppt.companyId}
                    onValueChange={(v) => setNewAppt({ ...newAppt, companyId: v, employeeId: "" })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Colaborador (Paciente)
                  </label>
                  <Select
                    value={newAppt.employeeId}
                    onValueChange={(v) => setNewAppt({ ...newAppt, employeeId: v })}
                    disabled={!newAppt.companyId || loadingDialogEmployees}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue
                        placeholder={
                          loadingDialogEmployees ? "Carregando..." : "Selecione o paciente..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {dialogEmployees?.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Tipo de ASO
                  </label>
                  <Select
                    value={newAppt.type}
                    onValueChange={(v) => setNewAppt({ ...newAppt, type: v })}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admissional">Admissional</SelectItem>
                      <SelectItem value="Periódico">Periódico</SelectItem>
                      <SelectItem value="Retorno ao Trabalho">Retorno ao Trabalho</SelectItem>
                      <SelectItem value="Mudança de Riscos">Mudança de Riscos</SelectItem>
                      <SelectItem value="Demissional">Demissional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                      Data
                    </label>
                    <Input
                      type="date"
                      value={newAppt.date}
                      onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })}
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                      Horário
                    </label>
                    <Input
                      type="time"
                      value={newAppt.time}
                      onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })}
                      className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleScheduleSave}
                  disabled={isScheduling}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
                >
                  {isScheduling ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Save className="size-5 text-accent" />
                  )}
                  Confirmar Agendamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* WIDGET SINCRONIZADOR GOOGLE CALENDAR */}
      <GoogleCalendarSyncWidget />

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-sm font-medium" htmlFor="clinical-queue-date">
          Data da agenda
          <Input
            id="clinical-queue-date"
            type="date"
            value={queueDate}
            onChange={(event) => setQueueDate(event.target.value)}
          />
        </label>
        <Button variant="outline" onClick={() => setQueueDate(clinicalQueueToday())}>
          Hoje
        </Button>
        <p className="text-sm text-muted-foreground">
          Atendimentos em espera ou em andamento continuam visíveis ao mudar a data.
        </p>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-3.5 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Pesquisar nos atendimentos carregados..."
          className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {queueSections.map((section) => (
        <Card
          key={section.id}
          role="region"
          aria-label={section.title}
          className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden"
        >
          <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left w-full">
              <CardTitle className="text-lg font-black text-primary uppercase">
                {section.title}
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {section.description}
              </CardDescription>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-none font-black uppercase text-[8px] h-6 px-3 whitespace-nowrap">
              {section.items.length} carregados{section.hasMore ? " · há mais" : ""}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-none text-[10px] font-black uppercase">
                  <TableHead className="pl-8 py-4">Colaborador / Unidade</TableHead>
                  <TableHead>Tipo de Exame</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="pr-8 text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.result.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-20 text-center">
                      <Loader2 className="size-10 animate-spin mx-auto opacity-20 text-primary" />
                    </TableCell>
                  </TableRow>
                ) : section.result.error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-8 text-center text-red-700">
                      Não foi possível consultar a fila. Confira sua conexão e o acesso à empresa
                      selecionada.
                    </TableCell>
                  </TableRow>
                ) : section.filtered.length > 0 ? (
                  section.filtered.map((appt) => (
                    <TableRow key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="pl-8 py-5">
                        <p className="font-black text-xs text-primary uppercase leading-tight">
                          {appt.colaborador_nome}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                          ID: {appt.colaborador_id}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {appt.data_hora
                            ? appt.data_hora.replace("T", " ").slice(0, 16)
                            : "Data e horário não informados"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black uppercase border-primary/10 text-primary/60 px-2 h-5"
                        >
                          {appt.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-[8px] font-black uppercase border-none px-3 h-6",
                            appt.status === "Concluído"
                              ? "bg-emerald-100 text-emerald-700"
                              : appt.status === "Em Espera"
                                ? "bg-amber-100 text-amber-700 animate-pulse"
                                : "bg-blue-100 text-blue-700"
                          )}
                        >
                          {appt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                          {appt.status === "Agendado" && (
                            <Button
                              onClick={() => advanceAppointment(appt, "Em Espera")}
                              disabled={busyAppointmentId !== null}
                              size="sm"
                              className="h-9 px-4 font-black uppercase text-[9px] rounded-xl bg-primary text-white shadow-md"
                            >
                              Check-in
                            </Button>
                          )}
                          {appt.status === "Em Espera" && (
                            <Button
                              onClick={() => advanceAppointment(appt, "Em Atendimento")}
                              disabled={busyAppointmentId !== null}
                              size="sm"
                              className="h-9 px-4 font-black uppercase text-[9px] rounded-xl bg-blue-600 text-white shadow-md"
                            >
                              Iniciar Atendimento
                            </Button>
                          )}
                          {appt.status === "Em Atendimento" && (
                            <Button
                              onClick={() => {
                                setSelectedApptForSign(appt);
                                setIsAsoFormOpen(true);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              Retomar atendimento
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-24 text-center opacity-30 font-black uppercase text-[10px] tracking-widest"
                    >
                      {activeClientId === "all" || activeClientId === "unauthorized"
                        ? "Selecione uma empresa autorizada para consultar sua fila"
                        : section.id === "scheduled" && !queueDate
                          ? "Selecione a data da agenda"
                          : searchTerm.trim()
                            ? "Nenhum resultado entre os atendimentos carregados"
                            : section.id === "active"
                              ? "Nenhum atendimento em espera ou em andamento"
                              : "Nenhum agendamento para a data selecionada"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {!section.result.error && section.hasMore && (
              <div className="border-t p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Há outros atendimentos nesta fila. Carregue mais para consultar e pesquisar os
                  demais.
                </p>
                <Button
                  variant="outline"
                  disabled={section.result.isLoading}
                  onClick={() => loadMore(section.id)}
                >
                  Carregar mais {section.id === "active" ? "atendimentos abertos" : "agendamentos"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={isAsoFormOpen && !!selectedApptForSign} onOpenChange={setIsAsoFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atendimento em andamento</DialogTitle>
            <DialogDescription>{selectedApptForSign?.colaborador_nome}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Registre as conclusões no ASO emitido pelo médico responsável. Importe o documento no
            NAI importa para conferir a empresa, o colaborador e os dados extraídos.
          </p>
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            A emissão e a assinatura digital dependem da configuração e validação do certificado
            profissional. O vínculo entre o ASO importado e a conclusão desta fila ainda não está
            disponível; o atendimento permanece em andamento. Nenhum resultado de exame é preenchido
            automaticamente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAsoFormOpen(false)}>
              Voltar à fila
            </Button>
            <Button asChild>
              <Link href="/nai-importa">Importar e revisar ASO</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
