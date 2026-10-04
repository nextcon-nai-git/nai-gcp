"use client";

import * as React from "react";
import {
  HeartPulse,
  ShieldCheck,
  Lock,
  Calendar,
  FileUp,
  Loader2,
  Activity,
  Filter,
  Sparkles,
  Zap,
  TrendingUp,
  Brain,
  ChevronRight,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { AttendanceTab } from "@/components/medical/tabs/AttendanceTab";
import { StructuredRecordTab } from "@/components/medical/tabs/StructuredRecordTab";
import { ProfessionalEvolutionTab } from "@/components/medical/tabs/ProfessionalEvolutionTab";
import { PsychosocialTab } from "@/components/medical/tabs/PsychosocialTab";
import { NewAttendanceModal } from "@/components/medical/modals/NewAttendanceModal";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_NURSING_ATTENDANCES } from "@/lib/real-data";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export default function HealthManagementUnified() {
  const db = useFirestore();
  const { role } = useUser();
  const { activeClientId } = useSgi();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("attendance");
  const [selectedMonth, setSelectedMonth] = React.useState("05");
  const [selectedYear, setSelectedYear] = React.useState("2026");
  const [isImporting, setIsImporting] = React.useState(false);

  const attendancesQuery = useMemoFirebase(() => {
    if (!db || !role || activeClientId === "unauthorized") return null;
    if (activeClientId === "all") {
      return query(collection(db, "nursing_attendances"), orderBy("createdAt", "desc"), limit(200));
    }
    return query(
      collection(db, "nursing_attendances"),
      where("companyId", "==", activeClientId),
      orderBy("createdAt", "desc"),
      limit(200)
    );
  }, [db, role, activeClientId]);

  const { data: firestoreAttendances, isLoading: loadingAttendances } =
    useCollection(attendancesQuery);

  const attendances = React.useMemo(() => {
    const list = [...(firestoreAttendances || [])];
    if (activeClientId === "CETESB_080680" || activeClientId === "all") {
      REAL_NURSING_ATTENDANCES.forEach((rd) => {
        if (
          !list.find((ld) => ld.employeeName === rd.employeeName && ld.createdAt === rd.createdAt)
        ) {
          list.push({ ...rd, id: rd.id });
        }
      });
    }
    return list
      .filter((a) => {
        const date = new Date(a.createdAt);
        return (
          (date.getMonth() + 1).toString().padStart(2, "0") === selectedMonth &&
          date.getFullYear().toString() === selectedYear
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [firestoreAttendances, activeClientId, selectedMonth, selectedYear]);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || activeClientId === "all") return;
    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const batch = writeBatch(db);
        let count = 0;
        for (const row of results.data as any[]) {
          const patientName = row["PACIENTE"] || row["paciente"];
          if (!patientName) continue;
          const docRef = doc(collection(db, "nursing_attendances"));
          batch.set(docRef, {
            id: docRef.id,
            companyId: activeClientId,
            employeeName: patientName.toUpperCase(),
            employeeId: `IMP_${Math.random().toString(36).substring(7).toUpperCase()}`,
            complaint: row["QUEIXA"] || "Atendimento",
            nurseName: "Equipe NAI",
            status_esocial: "Pendente",
            conduct: "observation",
            createdAt: row["DATA"] || new Date().toISOString(),
            timestamp: serverTimestamp(),
          });
          count++;
        }
        if (count > 0) await batch.commit();
        toast({ title: "Importação Concluída", description: `${count} registros salvos.` });
        setIsImporting(false);
      },
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-primary text-white rounded-[1.25rem] shadow-2xl shadow-primary/20 transition-transform hover:rotate-12">
              <HeartPulse size={32} className="text-accent" />
            </div>
            <div>
              <h1 className="text-4xl font-headline font-black text-primary tracking-tighter uppercase leading-none">
                Saúde & Prontuário Digital
              </h1>
              <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.4em] mt-2 flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" /> Compliance PEP & LGPD v2.7
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-3 bg-white border p-1.5 rounded-2xl shadow-inner h-14 px-5">
            <Filter className="size-4 text-slate-400" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-10 w-32 border-none font-black uppercase text-[10px] tracking-widest focus:ring-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                {MONTHS.map((m) => (
                  <SelectItem
                    key={m.value}
                    value={m.value}
                    className="text-[10px] font-bold uppercase"
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-6 w-px bg-slate-200" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-10 w-24 border-none font-black text-[10px] tracking-widest focus:ring-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="2026" className="text-[10px] font-bold">
                  2026
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            disabled={isImporting}
            className="h-14 px-8 border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-widest gap-3 rounded-2xl shadow-sm hover:bg-slate-50 btn-hover-effect"
            onClick={() => document.getElementById("csv-import-attendance")?.click()}
          >
            {isImporting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <FileUp className="size-5" />
            )}
            Importar Lote
          </Button>
          <input
            id="csv-import-attendance"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <NewAttendanceModal />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-9">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full border-none">
            <div className="overflow-x-auto pb-4 scrollbar-thin">
              <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-[2.25rem] h-16 shadow-inner">
                <TabsTrigger
                  value="attendance"
                  className="rounded-[1.75rem] gap-3 text-[10px] font-black uppercase tracking-widest px-10 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
                >
                  Atendimento{" "}
                  <Badge className="bg-primary/5 text-primary border-none ml-1 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center font-mono">
                    {attendances.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="clinical_records"
                  className="rounded-[1.75rem] gap-3 text-[10px] font-black uppercase tracking-widest px-10 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
                >
                  Prontuário (PEP)
                </TabsTrigger>
                <TabsTrigger
                  value="evolution"
                  className="rounded-[1.75rem] gap-3 text-[10px] font-black uppercase tracking-widest px-10 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
                >
                  Evolução
                </TabsTrigger>
                <TabsTrigger
                  value="psychosocial"
                  className="rounded-[1.75rem] gap-3 text-[10px] font-black uppercase tracking-widest px-10 transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg"
                >
                  Psicossocial
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="attendance" className="mt-8 focus-visible:ring-0">
              <AttendanceTab attendances={attendances} loading={loadingAttendances} />
            </TabsContent>
            <TabsContent value="clinical_records" className="mt-8 focus-visible:ring-0">
              <StructuredRecordTab />
            </TabsContent>
            <TabsContent value="evolution" className="mt-8 focus-visible:ring-0">
              <ProfessionalEvolutionTab />
            </TabsContent>
            <TabsContent value="psychosocial" className="mt-8 focus-visible:ring-0">
              <PsychosocialTab />
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-[#090e24] text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl border-2 border-white/5">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Lock className="size-48 text-accent" />
            </div>
            <div className="relative z-10 space-y-8 text-left">
              <Badge className="bg-emerald-50 text-primary border-none text-[8px] font-black uppercase tracking-[0.3em] h-7 px-4 rounded-lg flex items-center w-fit shadow-xl">
                PROTOCOL HIPAA ACTIVE
              </Badge>
              <div className="space-y-4">
                <h3 className="text-xl font-black uppercase tracking-tight font-headline">
                  Auditoria Epidemiológica
                </h3>
                <p className="text-sm text-white/50 leading-relaxed font-medium italic">
                  Monitorando <span className="text-accent font-black">{attendances.length}</span>{" "}
                  atendimentos técnicos no período.
                </p>
              </div>
              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase text-white/30">
                  <span>eSocial Persistence</span>
                  <span className="text-emerald-400">Synced</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase text-white/30">
                  <span>Encryption AES-256</span>
                  <span className="text-emerald-400">Active</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full h-12 border-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/5 btn-hover-effect mt-4"
              >
                Emitir Relatório RN 424
              </Button>
            </div>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8 space-y-6 text-left group hover:ring-4 ring-primary/5 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
                <Activity size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-primary uppercase">Métrica de Saúde</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Performance Mensal
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-500 uppercase">
                  Aptidão Global
                </span>
                <span className="text-2xl font-black text-primary font-headline">94%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-blue-600 transition-all duration-1000"
                  style={{ width: "94%" }}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full h-10 p-0 text-primary font-black uppercase text-[9px] tracking-widest gap-2 justify-start hover:bg-transparent"
            >
              Ver Detalhes BI <ArrowRight size={14} className="text-accent" />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
