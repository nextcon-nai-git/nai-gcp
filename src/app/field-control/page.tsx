"use client";

import * as React from "react";
import {
  MapPin,
  ClipboardCheck,
  ShieldCheck,
  Zap,
  HardHat,
  Loader2,
  Signal,
  Sparkles,
  ShieldAlert,
  Lock,
  History,
  AlertTriangle,
  UserCheck,
  Building2,
  Search,
  Cpu,
  CheckCircle2,
  XCircle,
  ScanLine,
  PenTool,
  Save,
  ShieldPlus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  collectionGroup,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { REAL_EMPLOYEES } from "@/lib/real-data";

const FIELD_PROFESSIONALS = {
  tst: {
    title: "Análise TST",
    role: "Técnico de Segurança (Operacional)",
    icon: HardHat,
    color: "text-blue-600",
    bg: "bg-blue-50",
    checklist: [
      {
        id: "tst1",
        label: "Realizar liberação de PT / APR nas frentes de trabalho.",
        ref: "NR-01 / NR-18",
      },
      { id: "tst2", label: "Fiscalizar uso de EPIs e integridade de EPCs.", ref: "NR-06 / NR-18" },
      {
        id: "tst3",
        label: "Executar DDS (Diálogo Diário de Segurança) com a equipe.",
        ref: "NR-01",
      },
      {
        id: "tst4",
        label: "Registrar inspeção de equipamentos e ferramentas manuais.",
        ref: "NR-12",
      },
      {
        id: "tst5",
        label: "Monitorar validade de treinamentos de terceiros em obra.",
        ref: "Solidária",
      },
    ],
  },
  eng: {
    title: "Análise ENG SEG",
    role: "Engenheiro de Segurança (Estratégico)",
    icon: ShieldPlus,
    color: "text-orange-600",
    bg: "bg-orange-50",
    checklist: [
      { id: "eng1", label: "Elaborar / Revisar Inventário de Riscos do PGR.", ref: "NR-01" },
      { id: "eng2", label: "Emitir ART (Anotação de Responsabilidade Técnica).", ref: "CREA" },
      {
        id: "eng3",
        label: "Realizar auditoria de conformidade das NRs na unidade.",
        ref: "SST 2026",
      },
      { id: "eng4", label: "Coordenar treinamentos técnicos especializados.", ref: "Capacitação" },
      { id: "eng5", label: "Definir medidas de controle de engenharia.", ref: "EPC" },
    ],
  },
};

export default function FieldControlOperational() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState("gatekeeper");
  const [activeProfessional, setActiveProfessional] =
    React.useState<keyof typeof FIELD_PROFESSIONALS>("tst");
  const [checklistProgress, setChecklistProgress] = React.useState<Record<string, boolean>>({});

  const [isGatekeeperLoading, setIsGatekeeperLoading] = React.useState(false);
  const [gatekeeperForm, setGatekeeperForm] = React.useState({
    employeeId: "",
    area: "caldeira_nr33",
  });
  const [lastResult, setLastResult] = React.useState<{
    authorized: boolean;
    message: string;
  } | null>(null);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const accessLogsQuery = useMemoFirebase(() => {
    if (!db || !profile?.companyId) return null;
    return query(
      collection(db, "companies", profile.companyId, "access_logs"),
      orderBy("timestamp", "desc")
    );
  }, [db, profile]);
  const { data: accessLogs } = useCollection(accessLogsQuery);

  const handleToggleCheck = (id: string) => {
    setChecklistProgress((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPercent = (profKey: keyof typeof FIELD_PROFESSIONALS) => {
    const items = FIELD_PROFESSIONALS[profKey].checklist;
    const checked = items.filter((item) => checklistProgress[item.id]).length;
    return Math.round((checked / items.length) * 100);
  };

  const handleSimulateTurnstile = async () => {
    if (!gatekeeperForm.employeeId || !db || !profile?.companyId) return;
    setIsGatekeeperLoading(true);
    setLastResult(null);

    try {
      const emp = REAL_EMPLOYEES.find((e) => e.id === gatekeeperForm.employeeId);
      const bloqueios = [];

      if (gatekeeperForm.area === "caldeira_nr33") {
        const hasAso = Math.random() > 0.3;
        const hasTraining = Math.random() > 0.2;
        if (!hasAso) bloqueios.push("ASO Vencido ou Inapto para NR-33.");
        if (!hasTraining) bloqueios.push("Treinamento NR-33 Ausente/Vencido.");
      } else if (gatekeeperForm.area === "obra_externa_nr35") {
        const hasAso = Math.random() > 0.3;
        const hasTraining = Math.random() > 0.2;
        if (!hasAso) bloqueios.push("ASO Vencido ou Inapto para NR-35.");
        if (!hasTraining) bloqueios.push("Treinamento NR-35 Ausente/Vencido.");
      }

      const isAuthorized = bloqueios.length === 0;
      const logRef = collection(db, "companies", profile.companyId, "access_logs");

      await addDoc(logRef, {
        employeeId: gatekeeperForm.employeeId,
        employeeName: emp?.name || "Desconhecido",
        area: gatekeeperForm.area,
        status: isAuthorized ? "authorized" : "denied",
        reason: isAuthorized ? "Acesso Liberado" : bloqueios[0],
        timestamp: serverTimestamp(),
      });

      setLastResult({
        authorized: isAuthorized,
        message: isAuthorized ? `✅ BEM-VINDO, ${emp?.name}` : `❌ ACESSO NEGADO: ${bloqueios[0]}`,
      });

      if (isAuthorized) {
        toast({ title: "Catraca Destravada", description: "Luz verde ativada." });
      } else {
        toast({
          variant: "destructive",
          title: "Entrada Bloqueada",
          description: "Inconsistência de segurança detectada.",
        });
      }
    } finally {
      setIsGatekeeperLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Controle Prestadores Segurança
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest flex items-center gap-2">
            <Signal className="size-3 text-accent animate-pulse" />
            Motor de Inteligência Operacional NAI
          </p>
        </div>
        <div className="flex gap-2">
          <Badge
            variant="outline"
            className="h-10 border-[#00f2ff]/30 text-[#00f2ff] font-black uppercase text-[10px] gap-2 bg-primary/5 px-4 flex items-center shadow-[0_0_15px_rgba(0,242,255,0.1)]"
          >
            <Sparkles className="size-4" /> NAI IoT ENGINE 2026
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Status do Perímetro"
          value="Ativo"
          icon={ScanLine}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <KpiCard
          label="Tentativas Negadas"
          value={accessLogs?.filter((l) => l.status === "denied").length || 0}
          icon={ShieldAlert}
          color="text-red-600"
          bg="bg-red-50"
        />
        <KpiCard
          label="Acessos Seguros"
          value={accessLogs?.filter((l) => l.status === "authorized").length || 0}
          icon={ShieldCheck}
          color="text-primary"
          bg="bg-primary/5"
        />
        <KpiCard
          label="Check-ins Campo"
          value="142"
          icon={MapPin}
          color="text-blue-600"
          bg="bg-blue-50"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[850px] grid-cols-4 bg-muted/50 p-1 rounded-2xl h-16">
          <TabsTrigger
            value="gatekeeper"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Catracas (IoT)
          </TabsTrigger>
          <TabsTrigger
            value="evolution"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-primary"
          >
            Evolução Técnica
          </TabsTrigger>
          <TabsTrigger
            value="activities"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Agenda Campo
          </TabsTrigger>
          <TabsTrigger
            value="equipments"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Instrumentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evolution" className="mt-8 space-y-8 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-3">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4 mb-4">
                Selecione o Profissional
              </p>
              {(
                Object.entries(FIELD_PROFESSIONALS) as [keyof typeof FIELD_PROFESSIONALS, any][]
              ).map(([key, prof]) => {
                const Icon = prof.icon;
                const isActive = activeProfessional === key;
                const progress = getPercent(key);

                return (
                  <Card
                    key={key}
                    className={cn(
                      "cursor-pointer border-none shadow-sm transition-all duration-300 rounded-2xl overflow-hidden",
                      isActive
                        ? "ring-2 ring-primary bg-white scale-[1.02] shadow-lg"
                        : "bg-slate-50 opacity-60 hover:opacity-100"
                    )}
                    onClick={() => setActiveProfessional(key)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2.5 rounded-xl",
                          isActive ? "bg-primary text-white" : prof.bg + " " + prof.color
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-primary uppercase truncate leading-none">
                          {prof.title}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden mr-3">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-black text-primary">{progress}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="lg:col-span-3 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-primary text-white p-8">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-2xl">
                      {React.createElement(FIELD_PROFESSIONALS[activeProfessional].icon, {
                        className: "size-8 text-accent",
                      })}
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-headline font-black uppercase tracking-tight">
                        {FIELD_PROFESSIONALS[activeProfessional].title}
                      </CardTitle>
                      <CardDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {FIELD_PROFESSIONALS[activeProfessional].role}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase opacity-40">Status do Plantão</p>
                    <h3 className="text-3xl font-black text-accent">
                      {getPercent(activeProfessional)}%
                    </h3>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Atividades Legais Obrigatórias:
                  </p>
                  {FIELD_PROFESSIONALS[activeProfessional].checklist.map((item: any) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group",
                        checklistProgress[item.id]
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-white border-slate-50 hover:border-primary/10 shadow-sm"
                      )}
                      onClick={() => handleToggleCheck(item.id)}
                    >
                      <Checkbox
                        checked={!!checklistProgress[item.id]}
                        onCheckedChange={() => handleToggleCheck(item.id)}
                        className="size-5 rounded-md border-slate-300"
                      />
                      <div className="flex-1">
                        <p
                          className={cn(
                            "text-sm font-bold",
                            checklistProgress[item.id] ? "text-emerald-800" : "text-primary"
                          )}
                        >
                          {item.label}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[8px] font-black border-none bg-slate-100 text-slate-400 mt-1"
                        >
                          Ref: {item.ref}
                        </Badge>
                      </div>
                      {checklistProgress[item.id] && (
                        <CheckCircle2 className="size-5 text-emerald-500" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-dashed flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-[10px] text-slate-400 italic font-medium">
                    "O preenchimento deste log garante a integridade do PGR e a defesa em
                    fiscalizações do MTE."
                  </p>
                  <Button className="h-12 px-8 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-xl gap-2">
                    <Save className="size-4" /> Protocolar Evolução Campo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gatekeeper" className="mt-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
              <div className="p-8 bg-primary text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/10 rounded-lg text-accent">
                    <Cpu className="size-5" />
                  </div>
                  <h3 className="text-xl font-headline font-black uppercase">Terminal de Acesso</h3>
                </div>
                <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest leading-tight">
                  Simulador de Crachá RFID & Biometria.
                </p>
              </div>

              <CardContent className="p-8 space-y-6">
                <div
                  className={cn(
                    "h-32 rounded-3xl border-4 flex flex-col items-center justify-center text-center p-4 transition-all duration-500 shadow-inner",
                    !lastResult
                      ? "bg-slate-900 border-slate-800"
                      : lastResult.authorized
                        ? "bg-emerald-950 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                        : "bg-red-950 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                  )}
                >
                  {!lastResult ? (
                    <div className="space-y-2">
                      <div className="size-2 bg-blue-500 rounded-full animate-pulse mx-auto" />
                      <p className="text-[#00f2ff] font-mono text-[10px] font-black uppercase tracking-[0.2em]">
                        Aguardando Crachá...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-in zoom-in-95">
                      {lastResult.authorized ? (
                        <CheckCircle2 className="size-8 text-accent mx-auto" />
                      ) : (
                        <XCircle className="size-8 text-red-500 mx-auto" />
                      )}
                      <p
                        className={cn(
                          "font-black text-xs uppercase leading-tight px-2",
                          lastResult.authorized ? "text-accent" : "text-red-400"
                        )}
                      >
                        {lastResult.message}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Simular Colaborador
                    </label>
                    <Select
                      value={gatekeeperForm.employeeId}
                      onValueChange={(v) => setGatekeeperForm({ ...gatekeeperForm, employeeId: v })}
                    >
                      <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                        <SelectValue placeholder="Escolha o Crachá..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REAL_EMPLOYEES.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Área de Risco
                    </label>
                    <Select
                      value={gatekeeperForm.area}
                      onValueChange={(v) => setGatekeeperForm({ ...gatekeeperForm, area: v })}
                    >
                      <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caldeira_nr33">
                          Zona Crítica (Espaço Confinado)
                        </SelectItem>
                        <SelectItem value="obra_externa_nr35">Zona Crítica (Altura)</SelectItem>
                        <SelectItem value="refeitorio">Área Comum (Refeitório)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleSimulateTurnstile}
                  disabled={isGatekeeperLoading || !gatekeeperForm.employeeId}
                  className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3 group"
                >
                  {isGatekeeperLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Lock className="size-5 text-accent group-hover:scale-110 transition-transform" />
                  )}
                  Bipar Crachá RFID
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2rem] overflow-hidden flex flex-col h-full">
              <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-primary uppercase">
                    Monitor de Acessos (Live)
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                    Logs de segurança física sincronizados.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="h-8 gap-2 border-emerald-100 text-emerald-700 font-black uppercase text-[10px] bg-emerald-50"
                >
                  <div className="size-2 bg-emerald-500 rounded-full animate-ping" /> Perímetro
                  Seguro
                </Badge>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                <Table>
                  <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black">
                    <TableRow>
                      <TableHead className="pl-8">Colaborador</TableHead>
                      <TableHead>Zona de Risco</TableHead>
                      <TableHead>Status NAI</TableHead>
                      <TableHead className="pr-8 text-right">Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessLogs?.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="pl-8">
                          <p className="font-black text-xs text-primary uppercase">
                            {log.employeeName}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[8px] font-black uppercase border-primary/10"
                          >
                            {log.area.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              className={cn(
                                "w-fit text-[8px] font-black uppercase border-none px-3 h-6",
                                log.status === "authorized"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              )}
                            >
                              {log.status === "authorized" ? "Autorizado" : "Bloqueado"}
                            </Badge>
                            {log.status === "denied" && (
                              <p className="text-[9px] text-red-600 italic font-medium leading-tight max-w-[150px]">
                                ⚠️ {log.reason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="pr-8 text-right text-[10px] font-bold text-slate-400">
                          {log.timestamp
                            ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString("pt-BR")
                            : "---"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!accessLogs || accessLogs.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest"
                        >
                          Nenhuma atividade no perímetro
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="mt-8">
          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50 border-b py-6 px-8">
              <CardTitle className="text-lg font-black text-primary uppercase">
                Agenda de Campo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 text-center py-20 opacity-30">
              <History className="size-16 mx-auto mb-4" />
              <p className="font-black uppercase text-xs tracking-widest">
                Histórico de Ordens de Serviço Externas
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn("p-3 rounded-2xl group-hover:scale-110 transition-transform", bg, color)}
          >
            <Icon className="size-5" />
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-300">
            Live
          </Badge>
        </div>
        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">
          {label}
        </p>
        <h3 className="text-2xl font-black text-primary leading-none">{value}</h3>
      </CardContent>
    </Card>
  );
}
