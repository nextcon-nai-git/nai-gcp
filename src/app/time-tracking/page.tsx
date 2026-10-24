"use client";

import * as React from "react";
import { MonthlyTimesheet } from "@/components/time-tracking/monthly-timesheet";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ShieldCheck,
  FileText,
  Lock,
  Coffee,
  LogIn,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { cn } from "@/lib/utils";
import {
  eligibleCltEmployee,
  employeeCollectionPath,
  brasiliaDay,
  type TimeClockEmployee,
} from "@/lib/time-tracking";

interface ClockPunch {
  id: string;
  type: "entrada" | "almoco_saida" | "almoco_retorno" | "saida";
  time: string;
  date: string;
  timestamp: string;
  hash?: string;
  reference?: string;
  ipLocation?: string;
}

export default function TimeTrackingCLTPage() {
  const { user } = useUser();
  const { activeClientId, isGlobalStaff } = useSgi();
  const employeePath = employeeCollectionPath(activeClientId, isGlobalStaff);
  if (!user || !employeePath)
    return <p role="alert">Selecione uma empresa autorizada para consultar o ponto.</p>;
  return (
    <TimeTrackingSession
      key={`${user.uid}:${employeePath}`}
      employeePath={employeePath}
      userId={user.uid}
    />
  );
}

function TimeTrackingSession({ employeePath, userId }: { employeePath: string; userId: string }) {
  const { toast } = useToast();
  const db = useFirestore();
  const mounted = React.useRef(true);
  const submitting = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Live Digital Clock
  React.useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const employeesQuery = useMemoFirebase(
    () => (db ? collection(db, employeePath) : null),
    [db, employeePath]
  );
  const {
    data: allEmployees,
    isLoading: loadingEmployees,
    error: employeesError,
  } = useCollection<TimeClockEmployee>(employeesQuery);
  const cltEmployees = React.useMemo(
    () =>
      (allEmployees || [])
        .filter(eligibleCltEmployee)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [allEmployees]
  );
  // A seleção é explícita: mudar de empresa ou perder o vínculo não escolhe outra pessoa.
  const selectedEmployee =
    cltEmployees.find((employee) => employee.id === selectedEmployeeId) || null;
  const day = currentTime ? brasiliaDay(currentTime) : "";
  const punchesQuery = useMemoFirebase(
    () =>
      db && selectedEmployee && day
        ? query(
            collection(db, employeePath, selectedEmployee.id, "time_clock_entries"),
            where("date", "==", day)
          )
        : null,
    [db, employeePath, selectedEmployee?.id, day]
  );
  const {
    data: savedPunches,
    isLoading: loadingPunches,
    error: punchesError,
  } = useCollection<ClockPunch>(punchesQuery);
  const punchesToday = React.useMemo(
    () => [...(savedPunches || [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [savedPunches]
  );
  const canPunch =
    !!db &&
    !!selectedEmployee &&
    !loadingEmployees &&
    !loadingPunches &&
    !employeesError &&
    !punchesError &&
    !isSubmitting;

  // Handle Punch Registration
  const handlePunch = async (type: "entrada" | "almoco_saida" | "almoco_retorno" | "saida") => {
    if (!canPunch || !selectedEmployee || !db || submitting.current) {
      toast({
        variant: "destructive",
        title: "Seleção Obrigatória",
        description: "Selecione um colaborador CLT para registrar o ponto.",
      });
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    const dateStr = brasiliaDay(now);
    const newPunch: ClockPunch = {
      id: `${dateStr}_${type}`,
      type,
      time: timeStr,
      date: dateStr,
      timestamp: now.toISOString(),
      reference: crypto.randomUUID(),
    };

    try {
      const punchRef = doc(
        db,
        employeePath,
        selectedEmployee.id,
        "time_clock_entries",
        newPunch.id
      );
      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(punchRef);
        if (existing.exists()) throw new Error("Batida já registrada.");
        transaction.set(punchRef, {
          ...newPunch,
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
          employeeCpf: selectedEmployee.cpf || "",
          contractType: "CLT",
          createdBy: userId,
          createdAt: serverTimestamp(),
        });
      });
      if (!mounted.current) return;

      const typeLabels = {
        entrada: "Entrada Registrada 🌅",
        almoco_saida: "Saída para Almoço 🥗",
        almoco_retorno: "Retorno do Almoço ☕",
        saida: "Saída do Expediente 🌇",
      };

      toast({
        title: typeLabels[type],
        description: `Ponto registrado às ${timeStr} para ${selectedEmployee.name}. Referência: ${newPunch.reference}`,
      });
    } catch {
      if (!mounted.current) return;
      toast({
        variant: "destructive",
        title: "Erro ao registrar ponto",
        description:
          "A batida não foi gravada. Confira a conexão, as permissões e se esse registro já existe.",
      });
    } finally {
      submitting.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  };

  const getPunchStatus = (type: "entrada" | "almoco_saida" | "almoco_retorno" | "saida") => {
    return punchesToday.find((p) => p.type === type);
  };

  return (
    <div className="space-y-8 text-left max-w-7xl mx-auto p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-black uppercase text-[9px] tracking-widest px-3 py-1">
              <Lock className="size-3 mr-1 text-emerald-600" /> Colaboradores CLT ativos
            </Badge>
          </div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Controle interno de frequência CLT
          </h1>
          <p className="text-slate-500 font-medium text-xs flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" /> Registro interno de frequência por
            colaborador.
          </p>
        </div>

        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center gap-4 shadow-xl border border-slate-800 shrink-0">
          <Clock className="size-8 text-accent animate-pulse" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Horário de Brasília
            </p>
            <p className="text-2xl font-black font-mono tracking-wider text-white">
              {currentTime
                ? currentTime.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })
                : "--:--:--"}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {currentTime
                ? currentTime.toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "Carregando..."}
            </p>
          </div>
        </div>
      </div>

      {/* PAINEL PRINCIPAL DE PONTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LADO ESQUERDO: SELEÇÃO DO COLABORADOR CLT + BOTOEIRA */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                <User className="size-5 text-accent" /> Seleção do Colaborador CLT
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">
                {employeePath === "nxc_employees"
                  ? "Equipe interna NXC: colaboradores ativos com contrato CLT."
                  : "Colaboradores CLT ativos da empresa selecionada."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Colaborador CLT Habilitado
                </label>
                {employeesError ? (
                  <p role="alert" className="text-sm text-red-700">
                    Não foi possível consultar os colaboradores. Recarregue a página para tentar
                    novamente.
                  </p>
                ) : loadingEmployees ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium">
                    Carregando colaboradores CLT...
                  </div>
                ) : cltEmployees.length > 0 ? (
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger
                      aria-label="Colaborador CLT habilitado"
                      className="h-14 bg-slate-50 border-slate-200 rounded-2xl text-sm font-bold text-slate-900"
                    >
                      <SelectValue placeholder="Selecione o colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cltEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="py-2">
                          <span className="font-bold text-slate-900">{emp.name}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({emp.cpf || "CPF Indefinido"}) •{" "}
                            {emp.role ||
                              emp.jobTitle ||
                              emp.jobRole ||
                              emp.job_role?.title ||
                              "CLT"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="size-5 text-amber-600 shrink-0" /> NENHUM COLABORADOR
                    CLT ATIVO ENCONTRADO.{" "}
                    {employeePath === "nxc_employees"
                      ? "Confira o cadastro em Colaboradores NXC."
                      : "Confira o Quadro de Vidas da empresa selecionada."}
                  </div>
                )}
              </div>

              {selectedEmployee && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs font-medium text-slate-700">
                  <div>
                    <p className="font-black text-slate-900 text-sm uppercase">
                      {selectedEmployee.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Cargo:{" "}
                      {selectedEmployee.role ||
                        selectedEmployee.jobTitle ||
                        selectedEmployee.jobRole ||
                        selectedEmployee.job_role?.title ||
                        "CLT"}{" "}
                      • CPF: {selectedEmployee.cpf || "Não informado"}
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-black text-[9px] uppercase px-3 py-1">
                    Cadastro CLT ativo
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BOTOEIRA DE REGISTRO DO DIA */}
          <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
              <CardTitle className="text-base font-black uppercase tracking-tight text-primary flex items-center gap-2">
                <Clock className="size-5 text-accent" /> Botoeira de Batida de Ponto Hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ENTRADA */}
              <button
                onClick={() => handlePunch("entrada")}
                disabled={!canPunch || !!getPunchStatus("entrada")}
                className={cn(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between h-32 text-left cursor-pointer group hover:scale-[1.02]",
                  getPunchStatus("entrada")
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5">
                    <LogIn className="size-4 text-emerald-600" /> 1. Entrada
                  </span>
                  {getPunchStatus("entrada") && (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-black font-mono text-slate-900">
                    {getPunchStatus("entrada")?.time || "--:--"}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">
                    {getPunchStatus("entrada")
                      ? `Registrado • ${getPunchStatus("entrada")?.reference || getPunchStatus("entrada")?.hash || "Salvo"}`
                      : "Clique para registrar entrada"}
                  </p>
                </div>
              </button>

              {/* SAÍDA ALMOÇO */}
              <button
                onClick={() => handlePunch("almoco_saida")}
                disabled={!canPunch || !!getPunchStatus("almoco_saida")}
                className={cn(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between h-32 text-left cursor-pointer group hover:scale-[1.02]",
                  getPunchStatus("almoco_saida")
                    ? "bg-amber-50 border-amber-300 text-amber-900"
                    : "bg-slate-50 border-slate-200 hover:border-amber-500 hover:bg-amber-50/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                    <Coffee className="size-4 text-amber-600" /> 2. Saída Almoço
                  </span>
                  {getPunchStatus("almoco_saida") && (
                    <CheckCircle2 className="size-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-black font-mono text-slate-900">
                    {getPunchStatus("almoco_saida")?.time || "--:--"}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">
                    {getPunchStatus("almoco_saida")
                      ? `Registrado • ${getPunchStatus("almoco_saida")?.reference || getPunchStatus("almoco_saida")?.hash || "Salvo"}`
                      : "Clique para registrar saída almoço"}
                  </p>
                </div>
              </button>

              {/* RETORNO ALMOÇO */}
              <button
                onClick={() => handlePunch("almoco_retorno")}
                disabled={!canPunch || !!getPunchStatus("almoco_retorno")}
                className={cn(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between h-32 text-left cursor-pointer group hover:scale-[1.02]",
                  getPunchStatus("almoco_retorno")
                    ? "bg-sky-50 border-sky-300 text-sky-900"
                    : "bg-slate-50 border-slate-200 hover:border-sky-500 hover:bg-sky-50/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-700 flex items-center gap-1.5">
                    <LogIn className="size-4 text-sky-600" /> 3. Volta Almoço
                  </span>
                  {getPunchStatus("almoco_retorno") && (
                    <CheckCircle2 className="size-5 text-sky-600" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-black font-mono text-slate-900">
                    {getPunchStatus("almoco_retorno")?.time || "--:--"}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">
                    {getPunchStatus("almoco_retorno")
                      ? `Registrado • ${getPunchStatus("almoco_retorno")?.reference || getPunchStatus("almoco_retorno")?.hash || "Salvo"}`
                      : "Clique para registrar retorno"}
                  </p>
                </div>
              </button>

              {/* SAÍDA EXPEDIENTE */}
              <button
                onClick={() => handlePunch("saida")}
                disabled={!canPunch || !!getPunchStatus("saida")}
                className={cn(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between h-32 text-left cursor-pointer group hover:scale-[1.02]",
                  getPunchStatus("saida")
                    ? "bg-rose-50 border-rose-300 text-rose-900"
                    : "bg-slate-50 border-slate-200 hover:border-rose-500 hover:bg-rose-50/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 flex items-center gap-1.5">
                    <LogOut className="size-4 text-rose-600" /> 4. Saída Expediente
                  </span>
                  {getPunchStatus("saida") && <CheckCircle2 className="size-5 text-rose-600" />}
                </div>
                <div>
                  <p className="text-xl font-black font-mono text-slate-900">
                    {getPunchStatus("saida")?.time || "--:--"}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">
                    {getPunchStatus("saida")
                      ? `Registrado • ${getPunchStatus("saida")?.reference || getPunchStatus("saida")?.hash || "Salvo"}`
                      : "Clique para registrar encerramento"}
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* LADO DIREITO: RESUMO DO ESPELHO DE PONTO CLT */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary text-white p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                  <FileText className="size-5 text-accent" /> Resumo de frequência do dia
                </CardTitle>
                <Badge className="bg-white/20 text-white font-mono text-[9px]">
                  Registros do dia
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-300">
                Batidas salvas no cadastro do colaborador selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Horas Previstas (Expediente CLT):</span>
                  <span className="font-mono text-slate-900">Conferir jornada cadastrada</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Horas Registradas Hoje:</span>
                  <span className="font-mono text-emerald-700">A apurar</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Saldo de Banco de Horas:</span>
                  <span className="font-mono text-sky-700">A apurar</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Marcações originais registradas hoje:
                </h4>

                {punchesError ? (
                  <p role="alert">
                    Não foi possível consultar as batidas salvas. Recarregue a página.
                  </p>
                ) : loadingPunches ? (
                  <p>Carregando batidas salvas...</p>
                ) : punchesToday.length > 0 ? (
                  <div className="space-y-2">
                    {punchesToday.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-slate-900 uppercase">
                            {p.type.replace("_", " ")}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">
                            {p.reference || p.hash}
                          </p>
                        </div>
                        <span className="font-mono font-black text-primary text-sm">{p.time}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium text-center italic">
                    {selectedEmployee
                      ? "Nenhuma batida de ponto registrada hoje para o colaborador selecionado."
                      : "Selecione um colaborador para consultar o ponto."}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <MonthlyTimesheet
        key={selectedEmployee?.id || "no-employee"}
        employee={selectedEmployee}
        employeePath={employeePath}
        rosterReady={!loadingEmployees && !employeesError}
      />
    </div>
  );
}
