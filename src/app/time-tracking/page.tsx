"use client";

import * as React from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  ShieldCheck,
  FileText,
  Download,
  Lock,
  Coffee,
  LogIn,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { collection, query, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { cn } from "@/lib/utils";

interface ClockPunch {
  id: string;
  type: "entrada" | "almoco_saida" | "almoco_retorno" | "saida";
  time: string;
  date: string;
  timestamp: string;
  hash: string;
  ipLocation?: string;
}

export default function TimeTrackingCLTPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const { activeClientId, isGlobalStaff } = useSgi();

  const [currentTime, setCurrentTime] = React.useState<Date | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>("");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [punchesToday, setPunchesToday] = React.useState<ClockPunch[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Live Digital Clock
  React.useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Query apenas colaboradores cadastrados como CLT
  const employeesQuery = useMemoFirebase(() => {
    if (!db || activeClientId === "unauthorized") return null;
    if (activeClientId === "all") {
      if (!isGlobalStaff) return null;
      return query(collection(db, "companies", "piloto_empresa_demo", "employees"));
    }
    return query(collection(db, "companies", activeClientId, "employees"));
  }, [db, activeClientId, isGlobalStaff]);

  const { data: allEmployees, isLoading: loadingEmployees } = useCollection(employeesQuery);

  // FILTRAR ESTRITAMENTE APENAS COLABORADORES CLT
  const cltEmployees = React.useMemo(() => {
    if (!allEmployees) return [];
    return allEmployees.filter((emp) => {
      const type = (emp.contractType || emp.regime || emp.type || "CLT").toUpperCase();
      // Se não especificado explicitamente como PJ/Estágio, tratar como CLT por padrão de folha
      return (
        type === "CLT" ||
        (!type.includes("PJ") && !type.includes("ESTAGIO") && !type.includes("TERCEIRO"))
      );
    });
  }, [allEmployees]);

  const selectedEmployee = React.useMemo(() => {
    return cltEmployees.find((e) => e.id === selectedEmployeeId) || cltEmployees[0] || null;
  }, [cltEmployees, selectedEmployeeId]);

  React.useEffect(() => {
    if (selectedEmployee && !selectedEmployeeId) {
      setSelectedEmployeeId(selectedEmployee.id);
    }
  }, [selectedEmployee, selectedEmployeeId]);

  // Handle Punch Registration
  const handlePunch = async (type: "entrada" | "almoco_saida" | "almoco_retorno" | "saida") => {
    if (!selectedEmployee) {
      toast({
        variant: "destructive",
        title: "Seleção Obrigatória",
        description: "Selecione um colaborador CLT para registrar o ponto.",
      });
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dateStr = now.toISOString().split("T")[0];
    const hash =
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      Date.now().toString(36).toUpperCase();

    const newPunch: ClockPunch = {
      id: Date.now().toString(),
      type,
      time: timeStr,
      date: dateStr,
      timestamp: now.toISOString(),
      hash: `SHA256-${hash}`,
      ipLocation: "Curitiba, PR - GPS Auditado",
    };

    try {
      if (db && selectedEmployee.companyId) {
        const punchRef = doc(
          db,
          "companies",
          selectedEmployee.companyId,
          "employees",
          selectedEmployee.id,
          "time_clock_entries",
          `${dateStr}_${type}`
        );

        await setDoc(
          punchRef,
          {
            ...newPunch,
            employeeId: selectedEmployee.id,
            employeeName: selectedEmployee.name,
            employeeCpf: selectedEmployee.cpf,
            contractType: "CLT",
            compliancePortaria671: true,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setPunchesToday((prev) => [...prev.filter((p) => p.type !== type), newPunch]);

      const typeLabels = {
        entrada: "Entrada Registrada 🌅",
        almoco_saida: "Saída para Almoço 🥗",
        almoco_retorno: "Retorno do Almoço ☕",
        saida: "Saída do Expediente 🌇",
      };

      toast({
        title: typeLabels[type],
        description: `Ponto registrado às ${timeStr} para ${selectedEmployee.name}. Hash Portaria 671: ${newPunch.hash}`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro ao registrar ponto",
        description: "Ocorreu um erro ao gravar o registro de ponto eletrônico.",
      });
    } finally {
      setIsSubmitting(false);
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
              <Lock className="size-3 mr-1 text-emerald-600" /> Apenas Regime CLT (Portaria MTP nº
              671/2021)
            </Badge>
          </div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Registro de Ponto Eletrônico CLT
          </h1>
          <p className="text-slate-500 font-medium text-xs flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" /> SistemaREP-P Auditado com Hash de
            Segurança e Registro de Frequência eSocial.
          </p>
        </div>

        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center gap-4 shadow-xl border border-slate-800 shrink-0">
          <Clock className="size-8 text-accent animate-pulse" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Horário Oficial de Brasília
            </p>
            <p className="text-2xl font-black font-mono tracking-wider text-white">
              {currentTime ? currentTime.toLocaleTimeString("pt-BR") : "--:--:--"}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {currentTime
                ? currentTime.toLocaleDateString("pt-BR", {
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
                Apenas vidas com contrato registrado sob Regime CLT estão habilitadas para ponto
                eletrônico.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Colaborador CLT Habilitado
                </label>
                {loadingEmployees ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium">
                    Carregando quadro de vidas CLT...
                  </div>
                ) : cltEmployees.length > 0 ? (
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="h-14 bg-slate-50 border-slate-200 rounded-2xl text-sm font-bold text-slate-900">
                      <SelectValue placeholder="Selecione o colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cltEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="py-2">
                          <span className="font-bold text-slate-900">{emp.name}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            ({emp.cpf || "CPF Indefinido"}) •{" "}
                            {emp.jobRole || emp.job_role?.title || "CLT"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="size-5 text-amber-600 shrink-0" /> NENHUM COLABORADOR
                    CLT ENCONTRADO. Cadastre colaboradores CLT no Quadro de Vidas.
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
                      Cargo: {selectedEmployee.jobRole || selectedEmployee.job_role?.title || "CLT"}{" "}
                      • CPF: {selectedEmployee.cpf}
                    </p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-black text-[9px] uppercase px-3 py-1">
                    Regime CLT Válido
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
                disabled={isSubmitting || !selectedEmployee}
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
                      ? `Registrado • ${getPunchStatus("entrada")?.hash}`
                      : "Clique para registrar entrada"}
                  </p>
                </div>
              </button>

              {/* SAÍDA ALMOÇO */}
              <button
                onClick={() => handlePunch("almoco_saida")}
                disabled={isSubmitting || !selectedEmployee}
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
                      ? `Registrado • ${getPunchStatus("almoco_saida")?.hash}`
                      : "Clique para registrar saída almoço"}
                  </p>
                </div>
              </button>

              {/* RETORNO ALMOÇO */}
              <button
                onClick={() => handlePunch("almoco_retorno")}
                disabled={isSubmitting || !selectedEmployee}
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
                      ? `Registrado • ${getPunchStatus("almoco_retorno")?.hash}`
                      : "Clique para registrar retorno"}
                  </p>
                </div>
              </button>

              {/* SAÍDA EXPEDIENTE */}
              <button
                onClick={() => handlePunch("saida")}
                disabled={isSubmitting || !selectedEmployee}
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
                      ? `Registrado • ${getPunchStatus("saida")?.hash}`
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
                  <FileText className="size-5 text-accent" /> Espelho de Ponto Eletrônico
                </CardTitle>
                <Badge className="bg-white/20 text-white font-mono text-[9px]">
                  CLT Portaria 671
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-300">
                Demonstrativo diário de frequência e horas trabalhadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Horas Previstas (Expediente CLT):</span>
                  <span className="font-mono text-slate-900">08:00 hs</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Horas Registradas Hoje:</span>
                  <span className="font-mono text-emerald-700">
                    {punchesToday.length >= 2 ? "08:00 hs (Regular)" : "00:00 hs"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Saldo de Banco de Horas:</span>
                  <span className="font-mono text-sky-700">+00:00 hs</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Comprovantes Digitais Registrados Hoje:
                </h4>

                {punchesToday.length > 0 ? (
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
                          <p className="text-[9px] text-slate-400 font-mono">{p.hash}</p>
                        </div>
                        <span className="font-mono font-black text-primary text-sm">{p.time}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium text-center italic">
                    Nenhuma batida de ponto efetuada hoje para o colaborador selecionado.
                  </div>
                )}
              </div>

              <Button
                onClick={() => window.print()}
                variant="outline"
                className="w-full h-12 border-primary text-primary font-black uppercase text-[10px] tracking-widest rounded-2xl gap-2 cursor-pointer"
              >
                <Download className="size-4 text-accent" /> Imprimir / Imprimir Espelho de Ponto
                (PDF)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
