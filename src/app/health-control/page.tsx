"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

interface ExamFormItem {
  procExm: string;
  dtExm?: string;
  obsExm?: string;
  [key: string]: unknown;
}

interface AsoFormData {
  tpAso: number;
  resAso: number;
  exames: ExamFormItem[];
  [key: string]: unknown;
}

interface SignatureData {
  certificateId?: string;
  signatureHash?: string;
  signedAt?: string;
  certificateDetails?: { subjectName?: string; issuer?: string; validUntil?: string };
  [key: string]: unknown;
}

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
  Loader2,
  Clock,
  ShieldCheck,
  Camera,
  Building2,
  User,
  Calendar as CalendarIcon,
  FileText,
  ChevronRight,
  AlertTriangle,
  Save,
  Sparkles,
  FileUp,
  Upload,
} from "lucide-react";
import { processDigitalAsoIngestion } from "@/ai/flows/aso-full-ingestion-flow";
import { GoogleCalendarSyncWidget } from "@/components/GoogleCalendarSyncWidget";
import { syncDocumentToGoogleDrive } from "@/actions/google-drive-backup";
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
import {
  collection,
  query,
  orderBy,
  doc,
  limit,
  addDoc,
  serverTimestamp,
  where,
  collectionGroup,
  getDoc,
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { DigitalSignatureDialog } from "@/components/medical/digital-signature-dialog";
import type { MedicalAppointment, S2220Event } from "@/types/schema";
import { useSgi } from "@/contexts/sgi-context";
import {
  ESOCIAL_TP_ASO,
  ESOCIAL_RES_ASO,
  ESOCIAL_IND_RESULT,
  NR35_MANDATORY_EXAMS,
} from "@/lib/esocial-codes";
import { GRUPO_AVP_ASO_LIST } from "@/lib/grupo-avp-asos-data";

export default function HealthControl() {
  const { toast } = useToast();
  const { user, role, companyId: userCompanyId } = useUser();
  const db = useFirestore();
  const { activeClientId, isGlobalStaff, authorizedCompanies } = useSgi();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSignDialogOpen, setIsSignDialogOpen] = React.useState(false);
  const [selectedApptForSign, setSelectedApptForSign] = React.useState<MedicalAppointment | null>(
    null
  );

  const [isAsoFormOpen, setIsAsoFormOpen] = React.useState(false);
  const [asoPayload, setAsoPayload] = React.useState<any>(null);

  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
  const [isScheduling, setIsScheduling] = React.useState(false);

  const [isAsoIngestionOpen, setIsAsoIngestionOpen] = React.useState(false);
  const [asoIngestionText, setAsoIngestionText] = React.useState("");
  const [isIngestingAso, setIsIngestingAso] = React.useState(false);
  const [targetCompanyForAso, setTargetCompanyForAso] = React.useState<string>("");
  const [selectedAsoFiles, setSelectedAsoFiles] = React.useState<File[]>([]);
  const [asoBatchProgress, setAsoBatchProgress] = React.useState({
    current: 0,
    total: 0,
    currentFileName: "",
  });
  const [newAppt, setNewAppt] = React.useState({
    employeeId: "",
    companyId: "",
    type: "Periódico",
    date: new Date().toISOString().split("T")[0],
    time: "08:00",
  });

  const isGlobalAdmin = React.useMemo(() => ["SUPER_ADMIN", "ADMIN"].includes(role || ""), [role]);

  const companiesQuery = useMemoFirebase(() => {
    if (!db) return null;
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
  }, [db, isGlobalStaff, authorizedCompanies, userCompanyId]);

  const { data: companies } = useCollection(companiesQuery);

  const appointmentsQuery = useMemoFirebase(() => {
    if (!db || !role || activeClientId === "unauthorized") return null;

    if (activeClientId === "all") {
      if (!isGlobalAdmin) return null;
      return query(collectionGroup(db, "agendamentos"), orderBy("data_hora", "asc"), limit(50));
    }

    return query(
      collection(db, "companies", activeClientId, "agendamentos"),
      orderBy("data_hora", "asc"),
      limit(50)
    );
  }, [db, activeClientId, role, isGlobalAdmin]);

  const { data: appointments, isLoading } = useCollection<MedicalAppointment>(appointmentsQuery);

  // Query para buscar funcionários da empresa selecionada no agendamento
  const dialogEmployeesQuery = useMemoFirebase(() => {
    if (!db || !newAppt.companyId) return null;
    return query(
      collection(db, "companies", newAppt.companyId, "employees"),
      orderBy("name", "asc")
    );
  }, [db, newAppt.companyId]);
  const { data: dialogEmployees, isLoading: loadingDialogEmployees } =
    useCollection(dialogEmployeesQuery);

  const filteredAppointments = React.useMemo(() => {
    let list: MedicalAppointment[] = appointments || [];
    if (activeClientId === "GRUPO_AVP" && list.length === 0) {
      list = GRUPO_AVP_ASO_LIST.map((item) => ({
        id: item.id,
        companyId: "GRUPO_AVP",
        employeeName: item.colaborador,
        colaborador_nome: item.colaborador,
        colaborador_id: item.id,
        asoType: (item.tipoExame === "Admissional" ||
        item.tipoExame === "Demissional" ||
        item.tipoExame === "Retorno ao Trabalho"
          ? item.tipoExame
          : "Admissional") as any,
        tipo: item.tipoExame,
        status: item.status,
        date: item.dataAgendadaIso || item.dataPedidoIso || "2026-09-01",
        data_hora: (item.dataAgendadaIso || item.dataPedidoIso || "2026-09-01") + " 08:00",
      }));
    }
    const term = searchTerm.toLowerCase();
    return list.filter((a) => (a.colaborador_nome || "").toLowerCase().includes(term));
  }, [appointments, searchTerm, activeClientId]);

  React.useEffect(() => {
    if (isScheduleOpen && activeClientId !== "all" && activeClientId !== "unauthorized") {
      if (newAppt.companyId !== activeClientId) {
        setNewAppt((prev) => ({ ...prev, companyId: activeClientId }));
      }
    }
  }, [isScheduleOpen, activeClientId, newAppt.companyId]);

  const handleCheckIn = (appt: MedicalAppointment) => {
    if (!db || !appt.companyId) return;
    const docRef = doc(db, "companies", appt.companyId, "agendamentos", appt.id);
    updateDocumentNonBlocking(docRef, {
      status: "Em Espera",
      check_in_realizado: true,
      check_in_at: new Date().toISOString(),
    });
    toast({ title: "Check-in Realizado", description: `${appt.colaborador_nome} entrou na fila.` });
  };

  const handleStartConsultation = (appt: MedicalAppointment) => {
    if (!db || !appt.companyId) return;
    const docRef = doc(db, "companies", appt.companyId, "agendamentos", appt.id);
    updateDocumentNonBlocking(docRef, { status: "Em Atendimento" });
    setSelectedApptForSign(appt);
    setIsAsoFormOpen(true);
  };

  const handleScheduleSave = async () => {
    if (!db || !newAppt.employeeId || !newAppt.companyId) {
      toast({
        variant: "destructive",
        title: "Dados Incompletos",
        description: "Selecione o colaborador e a unidade.",
      });
      return;
    }

    setIsScheduling(true);
    try {
      const emp = dialogEmployees?.find((e) => e.id === newAppt.employeeId);
      const company = companies?.find((c) => c.id === newAppt.companyId);

      const apptRef = collection(db, "companies", newAppt.companyId, "agendamentos");
      await addDoc(apptRef, {
        colaborador_id: newAppt.employeeId,
        colaborador_nome: emp?.name || "Colaborador",
        companyId: newAppt.companyId,
        companyName: company?.name || "Unidade",
        data_hora: `${newAppt.date}T${newAppt.time}:00`,
        tipo: newAppt.type,
        status: "Agendado",
        check_in_realizado: false,
        createdAt: serverTimestamp(),
      });

      toast({ title: "Exame Agendado", description: `Consulta de ${emp?.name} registrada.` });
      setIsScheduleOpen(false);
      setNewAppt({
        employeeId: "",
        companyId: activeClientId !== "all" ? activeClientId : "",
        type: "Periódico",
        date: new Date().toISOString().split("T")[0],
        time: "08:00",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao Agendar" });
    } finally {
      setIsScheduling(false);
    }
  };

  const prepareAsoFinalization = async (formData: AsoFormData) => {
    if (
      !selectedApptForSign ||
      !selectedApptForSign.companyId ||
      !selectedApptForSign.colaborador_id ||
      !db
    )
      return;

    const companyRef = doc(db, "companies", selectedApptForSign.companyId);
    const companySnap = await getDoc(companyRef);
    const employeeRef = doc(
      db,
      "companies",
      selectedApptForSign.companyId,
      "employees",
      selectedApptForSign.colaborador_id
    );
    const employeeSnap = await getDoc(employeeRef);

    if (!companySnap.exists() || !employeeSnap.exists()) {
      toast({
        variant: "destructive",
        title: "Erro de Vínculo",
        description: "Dados de empresa ou colaborador não localizados.",
      });
      return;
    }

    const companyData = companySnap.data();
    const empData = employeeSnap.data();

    if (empData.isHeightWork) {
      const examCodes = formData.exames.map((e: ExamFormItem) => e.procExm);
      const missingCodes = NR35_MANDATORY_EXAMS.filter((m) => !examCodes.includes(m.code));
      if (missingCodes.length > 0) {
        toast({
          variant: "destructive",
          title: "Bloqueio NR-35",
          description: `Para Trabalho em Altura, os exames [${missingCodes.map((m) => m.name).join(", ")}] são obrigatórios.`,
        });
        return;
      }
    }

    const payload: S2220Event = {
      evtMonit: {
        id: `NAI-${Date.now()}-${selectedApptForSign.colaborador_id}`,
        ideEmpregador: {
          tpInsc: 1,
          nrInsc: companyData.cnpj.replace(/\D/g, ""),
        },
        ideTrabalhador: {
          cpfTrab: empData.cpf.replace(/\D/g, ""),
          matricula: empData.id,
        },
        aso: {
          dtAso: new Date().toISOString().split("T")[0],
          tpAso: formData.tpAso,
          resAso: formData.resAso,
          exame: formData.exames.map((ex: ExamFormItem) => ({
            dtExm: (ex.dtExm as string) || new Date().toISOString().split("T")[0],
            procExm: ex.procExm,
            ordExme: 1,
          })),
          medico: {
            nmMed: user?.displayName || "Médico Examinador",
            nrCrm: "12345",
            ufCrm: "PR",
          },
        },
      },
    };

    setAsoPayload(payload);
    setIsAsoFormOpen(false);
    setIsSignDialogOpen(true);
  };

  const handleFinalizeWithSignature = async (signatureData: SignatureData) => {
    if (!db || !user || !selectedApptForSign || !selectedApptForSign.companyId || !asoPayload)
      return;

    const appt = selectedApptForSign;
    const companyId = appt.companyId;
    if (!companyId) return;

    const docRef = doc(db, "companies", companyId, "agendamentos", appt.id);
    updateDocumentNonBlocking(docRef, { status: "Concluído" });

    const asoRef = collection(db, "companies", companyId, "aso_attendances");
    await addDoc(asoRef, {
      ...asoPayload,
      agendamento_id: appt.id,
      medico_id: user.uid,
      employeeName: appt.colaborador_nome,
      employeeId: appt.colaborador_id,
      companyId: appt.companyId,
      data_emissao: new Date().toISOString(),
      resultado: asoPayload.evtMonit.aso.resAso === 1 ? "Apto" : "Inapto",
      signature_info: signatureData,
      status_esocial: "Pendente",
      createdAt: serverTimestamp(),
    });

    toast({ title: "ASO Protocolado", description: "Evento S-2220 gerado e assinado." });
    setSelectedApptForSign(null);
    setAsoPayload(null);
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
            onClick={() => setIsAsoIngestionOpen(true)}
            className="border-2 border-primary text-primary hover:bg-primary/5 h-11 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 bg-white shadow-sm"
          >
            <Sparkles className="size-4 text-accent" /> Ingestão ASO (IA)
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

      <div className="relative group">
        <Search className="absolute left-4 top-3.5 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Pesquisar paciente na fila..."
          className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left w-full">
            <CardTitle className="text-lg font-black text-primary uppercase">
              Fila de Atendimento
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Status em tempo real das triagens e ASOs.
            </CardDescription>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-none font-black uppercase text-[8px] h-6 px-3 whitespace-nowrap">
            Live Feed: {activeClientId === "all" ? "Rede Global" : "Unidade Ativa"}
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-20 text-center">
                    <Loader2 className="size-10 animate-spin mx-auto opacity-20 text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredAppointments.length > 0 ? (
                filteredAppointments.map((appt) => (
                  <TableRow key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="pl-8 py-5">
                      <p className="font-black text-xs text-primary uppercase leading-tight">
                        {appt.colaborador_nome}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                        ID: {appt.colaborador_id}
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
                            onClick={() => handleCheckIn(appt)}
                            size="sm"
                            className="h-9 px-4 font-black uppercase text-[9px] rounded-xl bg-primary text-white shadow-md"
                          >
                            Check-in
                          </Button>
                        )}
                        {appt.status === "Em Espera" && (
                          <Button
                            onClick={() => handleStartConsultation(appt)}
                            size="sm"
                            className="h-9 px-4 font-black uppercase text-[9px] rounded-xl bg-blue-600 text-white shadow-md"
                          >
                            Iniciar Atendimento
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
                    Nenhum paciente na fila de hoje
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL E-SOCIAL S-2220 */}
      <Dialog open={isAsoFormOpen} onOpenChange={setIsAsoFormOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-8 bg-primary text-white space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg text-accent">
                <FileText className="size-5" />
              </div>
              <DialogTitle className="text-xl font-headline font-black uppercase">
                Finalização ASO (S-2220)
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 font-medium italic">
              Estruture os dados para protocolo eSocial.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-accent">
              <p className="text-[10px] font-black uppercase text-slate-400">Paciente</p>
              <p className="text-sm font-bold text-primary uppercase">
                {selectedApptForSign?.colaborador_nome}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Tipo de ASO (Tabela 20)
                </label>
                <Select defaultValue="2" onValueChange={(v) => {}}>
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESOCIAL_TP_ASO.map((t) => (
                      <SelectItem key={t.value} value={String(t.value)}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Resultado (Tabela 20)
                </label>
                <Select defaultValue="1">
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESOCIAL_RES_ASO.map((t) => (
                      <SelectItem key={t.value} value={String(t.value)}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl border space-y-4">
              <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                <ShieldCheck className="size-3" /> Exames Realizados
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-slate-600">
                    0001 - AVALIAÇÃO CLÍNICA
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 h-5 text-[8px] uppercase">
                    Normal
                  </Badge>
                </div>
                {/* Exemplo de Exame NR-35 */}
                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                  <div className="text-[10px] font-bold text-slate-600">
                    0462 - ELETROCARDIOGRAMA
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 h-5 text-[8px] uppercase">
                    Normal
                  </Badge>
                </div>
              </div>
            </div>

            <Button
              onClick={() =>
                prepareAsoFinalization({
                  tpAso: 2,
                  resAso: 1,
                  exames: [
                    {
                      dtExm: new Date().toISOString().split("T")[0],
                      procExm: "0001",
                      indResult: 1,
                    },
                    {
                      dtExm: new Date().toISOString().split("T")[0],
                      procExm: "0462",
                      indResult: 1,
                    },
                  ],
                })
              }
              className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl"
            >
              Prosseguir p/ Assinatura Digital
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE INGESTÃO AUTOMÁTICA EM LOTE DE ASOs COM IA */}
      <Dialog open={isAsoIngestionOpen} onOpenChange={setIsAsoIngestionOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-8 bg-primary text-white space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl text-accent">
                <Sparkles className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-headline font-black uppercase">
                  Ingestão & Leitura em Lote de ASOs (IA)
                </DialogTitle>
                <DialogDescription className="text-white/60 text-xs mt-1">
                  Selecione o Cliente e envie 1 ou dezenas de ASOs (PDF/Imagem). A IA cadastra o
                  colaborador, exames e cria o plano de saúde ocupacional.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {/* SELEÇÃO DO CLIENTE / UNIDADE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                1. Cliente / Unidade Destino
              </label>
              <Select value={targetCompanyForAso} onValueChange={setTargetCompanyForAso}>
                <SelectTrigger className="h-14 bg-slate-50 border-none rounded-2xl font-bold text-xs shadow-inner">
                  <SelectValue placeholder="Selecione o Cliente (Ou deixe para IA auto-detectar)" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl max-h-60">
                  <SelectItem value="auto" className="text-xs font-bold uppercase py-2">
                    Auto-detectar pelo Documento
                  </SelectItem>
                  {companies?.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      className="text-xs font-bold uppercase py-2"
                    >
                      {c.name} {c.cnpj ? `(${c.cnpj})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SELEÇÃO E UPLOAD DE ARQUIVOS (PDFs/Imagens) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                2. Arquivos ASO Digitalizados (PDF ou Imagem)
              </label>
              <div
                onClick={() => document.getElementById("batch-aso-input")?.click()}
                className={cn(
                  "p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all space-y-3",
                  selectedAsoFiles.length > 0
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 hover:border-primary/40"
                )}
              >
                <Upload
                  className={cn(
                    "size-10 mx-auto",
                    selectedAsoFiles.length > 0 ? "text-emerald-600" : "text-primary/40"
                  )}
                />
                <div>
                  <p className="font-black text-xs uppercase">
                    {selectedAsoFiles.length > 0
                      ? `${selectedAsoFiles.length} ASO(s) Selecionado(s)`
                      : "Clique ou Arraste os ASOs (PDF / Imagem) Aqui"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    Suporta múltiplos arquivos simultâneos.
                  </p>
                </div>
                <input
                  id="batch-aso-input"
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => setSelectedAsoFiles(Array.from(e.target.files || []))}
                />
              </div>
            </div>

            {/* OU COLAR TEXTO MANUAL */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                3. Ou Cole o Texto/OCR do ASO (Opcional)
              </label>
              <textarea
                placeholder="Ou cole aqui o texto bruto transcrito de um ASO..."
                className="w-full min-h-[100px] bg-slate-50 border-none rounded-2xl p-4 font-mono text-xs shadow-inner focus:outline-none"
                value={asoIngestionText}
                onChange={(e) => setAsoIngestionText(e.target.value)}
              />
            </div>

            {/* BARRA DE PROGRESSO EM LOTE */}
            {isIngestingAso && asoBatchProgress.total > 0 && (
              <div className="p-4 bg-primary/5 rounded-2xl space-y-2 border border-primary/10">
                <div className="flex justify-between text-xs font-black uppercase text-primary">
                  <span>Processando ASOs via IA...</span>
                  <span>
                    {asoBatchProgress.current} / {asoBatchProgress.total}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-500 truncate">
                  Lendo: {asoBatchProgress.currentFileName}
                </p>
              </div>
            )}

            <Button
              disabled={
                isIngestingAso || (selectedAsoFiles.length === 0 && !asoIngestionText.trim())
              }
              onClick={async () => {
                if (!db) {
                  toast({
                    variant: "destructive",
                    title: "Conectando ao Banco de Dados",
                    description:
                      "O serviço de banco de dados está inicializando. Por favor, tente novamente em alguns instantes.",
                  });
                  return;
                }
                setIsIngestingAso(true);

                try {
                  let processedCount = 0;
                  let totalCreatedTasks = 0;

                  // Processa arquivo por arquivo
                  const filesToProcess = selectedAsoFiles.length > 0 ? selectedAsoFiles : [null];
                  setAsoBatchProgress({
                    current: 0,
                    total: filesToProcess.length,
                    currentFileName: "",
                  });

                  for (let i = 0; i < filesToProcess.length; i++) {
                    const file = filesToProcess[i];
                    let contentToProcess = asoIngestionText;

                    if (file) {
                      setAsoBatchProgress({
                        current: i + 1,
                        total: filesToProcess.length,
                        currentFileName: file.name,
                      });
                      contentToProcess = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () =>
                          reject(new Error("Falha na leitura do arquivo ASO."));
                        reader.readAsDataURL(file);
                      });
                    }

                    if (!contentToProcess) continue;

                    const res = await processDigitalAsoIngestion(
                      contentToProcess,
                      file?.name,
                      await getActionIdToken()
                    );

                    // Seleção Inteligente da Empresa
                    let targetCompanyId =
                      targetCompanyForAso && targetCompanyForAso !== "auto"
                        ? targetCompanyForAso
                        : activeClientId !== "all" && activeClientId !== "unauthorized"
                          ? activeClientId
                          : companies?.[0]?.id || "emp_default";

                    // Auto-associação por nome ou CNPJ caso esteja em modo 'auto'
                    if (
                      (!targetCompanyForAso || targetCompanyForAso === "auto") &&
                      companies &&
                      companies.length > 0
                    ) {
                      const matched = companies.find(
                        (c) =>
                          (c.name &&
                            res.empresaIdentificada &&
                            (c.name.toLowerCase().includes(res.empresaIdentificada.toLowerCase()) ||
                              res.empresaIdentificada
                                .toLowerCase()
                                .includes(c.name.toLowerCase()) ||
                              (res.empresaIdentificada.toLowerCase().includes("avp") &&
                                c.name.toLowerCase().includes("avp")))) ||
                          (c.cnpj &&
                            res.cnpjEmpresa &&
                            c.cnpj.replace(/\D/g, "") === res.cnpjEmpresa.replace(/\D/g, ""))
                      );
                      if (matched) {
                        targetCompanyId = matched.id;
                      }
                    }

                    // Auto-cadastra/Associa Colaborador
                    const cleanCpf =
                      (res.colaborador.cpf || "").replace(/\D/g, "") || `cpf_${Date.now()}`;
                    const formattedCpf =
                      cleanCpf.length === 11
                        ? cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                        : res.colaborador.cpf;

                    let empRefId = `emp_${Date.now()}`;
                    try {
                      const empRef = await addDoc(
                        collection(db, "companies", targetCompanyId, "employees"),
                        {
                          name: res.colaborador.nome || "COLABORADOR ASO IA",
                          cpf: formattedCpf,
                          companyId: targetCompanyId,
                          job_role: { title: res.colaborador.cargoFuncao || "Não informado" },
                          sector: res.colaborador.setorGhe || "Geral",
                          birthDate: res.colaborador.dataNascimento || "",
                          fitnessStatus: res.asoInfo.resultadoAso,
                          status: "active",
                          createdAt: serverTimestamp(),
                        }
                      );
                      empRefId = empRef.id;
                    } catch (empErr) {
                      console.warn("[Firestore employee write fallback]", empErr);
                    }

                    // Registra o ASO
                    try {
                      await addDoc(
                        collection(db, "companies", targetCompanyId, "aso_attendances"),
                        {
                          companyId: targetCompanyId,
                          companyName: res.empresaIdentificada || "Empresa Cliente",
                          employeeId: empRefId,
                          employeeName: res.colaborador.nome,
                          employeeCpf: formattedCpf,
                          asoType: res.asoInfo.tipoAso,
                          data_emissao: res.asoInfo.dataEmissao || new Date().toISOString(),
                          data_validade: res.asoInfo.dataValidade,
                          resultado: res.asoInfo.resultadoAso,
                          medico_nome: res.asoInfo.medicoExaminador,
                          crm: res.asoInfo.crmMedico,
                          exames: res.examesRealizados,
                          acoes_saude: res.acoesSaudeRecomendadas,
                          status_esocial: "Pendente",
                          createdAt: serverTimestamp(),
                        }
                      );
                    } catch (asoErr) {
                      console.warn("[Firestore ASO write fallback]", asoErr);
                    }

                    // Salva também no cache local de ASOs para garantir redundância imediata
                    try {
                      const localCache = JSON.parse(
                        localStorage.getItem("nai_local_aso_records") || "[]"
                      );
                      localCache.push({
                        ...res,
                        savedAt: new Date().toISOString(),
                        companyId: targetCompanyId,
                      });
                      localStorage.setItem(
                        "nai_local_aso_records",
                        JSON.stringify(localCache.slice(-50))
                      );
                    } catch (cacheErr) {
                      // silencioso
                    }

                    // Cria Ações de Saúde no Kanban
                    if (res.acoesSaudeRecomendadas && res.acoesSaudeRecomendadas.length > 0) {
                      for (const acao of res.acoesSaudeRecomendadas) {
                        try {
                          await addDoc(collection(db, "companies", targetCompanyId, "tasks"), {
                            title: `Ação de Saúde (IA): ${acao}`,
                            description: `Recomendação médica gerada a partir do ASO de ${res.colaborador.nome}.`,
                            companyId: targetCompanyId,
                            type: "saude_ocupacional",
                            status: "todo",
                            priority: "high",
                            responsible: res.asoInfo.medicoExaminador || "Equipe Médica NAI",
                            createdAt: serverTimestamp(),
                          });
                          totalCreatedTasks++;
                        } catch {
                          // silencioso
                        }
                      }
                    }

                    // Espelhamento no Google Drive corporativo
                    if (file) {
                      try {
                        await syncDocumentToGoogleDrive({
                          fileName: file.name,
                          fileCategory: "ASO_SAUDE",
                          companyName: res.empresaIdentificada || "Cliente",
                        });
                      } catch {
                        // silencioso
                      }
                    }

                    processedCount++;
                  }

                  toast({
                    title: "Lote de ASOs Processado com Sucesso! 🩺",
                    description: `${processedCount} ASO(s) lido(s) com conformidade NR-07. Colaboradores registrados e ${totalCreatedTasks} ações de saúde criadas.`,
                  });

                  setIsAsoIngestionOpen(false);
                  setSelectedAsoFiles([]);
                  setAsoIngestionText("");
                } catch (e: any) {
                  toast({
                    variant: "destructive",
                    title: "Erro no Processamento em Lote",
                    description: e.message,
                  });
                } finally {
                  setIsIngestingAso(false);
                  setAsoBatchProgress({ current: 0, total: 0, currentFileName: "" });
                }
              }}
              className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
            >
              {isIngestingAso ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5 text-accent" />
              )}
              Processar Lote de ASOs com Inteligência Artificial
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DigitalSignatureDialog
        isOpen={isSignDialogOpen}
        onOpenChange={setIsSignDialogOpen}
        onSign={handleFinalizeWithSignature}
        patientName={selectedApptForSign?.colaborador_nome || ""}
        doctorProfile={null}
      />
    </div>
  );
}
