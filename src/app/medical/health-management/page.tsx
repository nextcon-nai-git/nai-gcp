"use client";

import * as React from "react";
import {
  HeartPulse,
  Thermometer,
  TrendingUp,
  Clock,
  Brain,
  Building2,
  FileCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { MOCK_NURSING_ATTENDANCES } from "@/lib/real-data";

// --- Componentes Modulares ---
import { NewAttendanceModal } from "./components/modals/new-attendance-modal";
import { ReportModal } from "./components/modals/report-modal";
import { AttendanceTab } from "./components/tabs/attendance-tab";
import { StructuredRecordTab } from "./components/tabs/structured-record-tab";
import { ProfessionalEvolutionTab } from "./components/tabs/professional-evolution-tab";
import { OperationTab } from "./components/tabs/operation-tab";
import { PsychosocialTab } from "./components/tabs/psychosocial-tab";

export default function HealthManagementUnified() {
  const { user } = useUser();
  const db = useFirestore();

  const [activeTab, setActiveTab] = React.useState("attendance");
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>("PAC_MARIA_01");

  // --- Dados Remotos ---
  const attendancesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "nursing_attendances"), orderBy("createdAt", "desc"), limit(50));
  }, [db]);
  const { data: remoteAttendances, isLoading: loadingAttendances } =
    useCollection(attendancesQuery);

  const attendances = React.useMemo(() => {
    const list = [...(remoteAttendances || [])];
    if (!list.find((a) => a.employeeId === "COL_JOAO_SILVA")) {
      list.push(...MOCK_NURSING_ATTENDANCES);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [remoteAttendances]);

  // --- Métricas derivadas para o ReportModal ---
  const todayCount = attendances.filter(
    (a) => new Date(a.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const criticalCount = attendances.filter((a) => Number(a.bp_sys) >= 160).length;

  // --- Callback do modal de novo atendimento ---
  const handleAttendanceSaved = React.useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveTab("structured-record");
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* --- Header --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Gestão de Saúde da Unidade
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Building2 className="size-3" /> Central de Saúde | NR-07 | NR-18 | COFEN
          </p>
        </div>
        <div className="flex gap-2">
          <ReportModal todayCount={todayCount} criticalCount={criticalCount} />
          <NewAttendanceModal onAttendanceSaved={handleAttendanceSaved} />
        </div>
      </header>

      {/* --- Tabs --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full md:w-auto overflow-x-auto bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="attendance"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest shrink-0"
          >
            <Thermometer className="size-4" /> Atendimento & Triagem
          </TabsTrigger>
          <TabsTrigger
            value="structured-record"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest shrink-0"
          >
            <FileCheck className="size-4" /> Prontuário Estruturado
          </TabsTrigger>
          <TabsTrigger
            value="evolution"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-primary shrink-0"
          >
            <TrendingUp className="size-4" /> Evolução Profissional
          </TabsTrigger>
          <TabsTrigger
            value="operation"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest shrink-0"
          >
            <Clock className="size-4" /> Escala & Operação
          </TabsTrigger>
          <TabsTrigger
            value="psychosocial"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest shrink-0"
          >
            <Brain className="size-4" /> Risco Psicossocial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-8">
          <AttendanceTab attendances={attendances} isLoading={loadingAttendances} />
        </TabsContent>

        <TabsContent
          value="structured-record"
          className="mt-8 animate-in slide-in-from-bottom-8 duration-700"
        >
          <StructuredRecordTab
            selectedPatientId={selectedPatientId}
            onSelectPatient={setSelectedPatientId}
          />
        </TabsContent>

        <TabsContent value="evolution" className="mt-8 animate-in slide-in-from-bottom-4">
          <ProfessionalEvolutionTab onNavigateToOperation={() => setActiveTab("operation")} />
        </TabsContent>

        <TabsContent
          value="operation"
          className="mt-8 animate-in slide-in-from-bottom-4 duration-500"
        >
          <OperationTab />
        </TabsContent>

        <TabsContent
          value="psychosocial"
          className="mt-8 animate-in slide-in-from-right-8 duration-700"
        >
          <PsychosocialTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
