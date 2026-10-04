"use client";

import * as React from "react";
import {
  Cpu,
  XCircle,
  CheckCircle2,
  Loader2,
  Fingerprint,
  Zap,
  ShieldAlert,
  ArrowRight,
  Camera,
  Eye,
  Scan,
  HardHat,
  Monitor,
  User,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { REAL_EMPLOYEES } from "@/lib/real-data";

export default function FieldControlElite() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isScanning, setIsScanning] = React.useState(false);
  const [selectedEmp, setSelectedEmp] = React.useState("");
  const [visionAiEnabled, setVisionAiEnabled] = React.useState(true);
  const [lastResult, setLastResult] = React.useState<any>(null);

  const accessLogsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "access_logs"), orderBy("timestamp", "desc"), limit(10));
  }, [db]);
  const { data: accessLogs } = useCollection(accessLogsQuery);

  const handleSimulateTurnstile = async () => {
    if (!selectedEmp || !db) return;
    setIsScanning(true);
    setLastResult(null);

    try {
      const emp = REAL_EMPLOYEES.find((e) => e.id === selectedEmp);

      // Lógica de Firewall v3.2
      const isAsoOk = Math.random() > 0.1; // 90% chance de ASO estar OK
      const isPpeOk = Math.random() > 0.15; // 85% chance de Vision AI detectar EPI

      const authorized = isAsoOk && isPpeOk;
      const message = authorized ? "ACESSO LIBERADO" : "ACESSO BLOQUEADO";
      const detail = authorized
        ? "Conformidade Plena"
        : !isAsoOk
          ? "ASO VENCIDO (eSocial)"
          : "FALHA EPI (Vision AI)";

      await addDoc(collection(db, "access_logs"), {
        employeeName: emp?.name,
        status: authorized ? "authorized" : "denied",
        reason: message,
        detail,
        visionAi: visionAiEnabled,
        timestamp: serverTimestamp(),
      });

      setLastResult({ authorized, message, detail });

      if (authorized) {
        toast({ title: "Acesso Autorizado", description: `Catraca liberada para ${emp?.name}.` });
      } else {
        toast({ variant: "destructive", title: "Entrada Bloqueada!", description: detail });
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-8">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5 uppercase">
            COMPUTER VISION & FIREWALL v3.2
          </Badge>
          <h1 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter leading-none">
            Controle de Campo Live
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-2 flex items-center gap-2">
            <Cpu className="size-4 text-accent animate-pulse" />
            Integração em Tempo Real: eSocial + Biometria + CFTV.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setVisionAiEnabled(!visionAiEnabled)}
            className={cn(
              "h-12 px-6 font-black uppercase text-[10px] gap-2 rounded-2xl border-2 transition-all shadow-sm",
              visionAiEnabled
                ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                : "border-slate-200 text-slate-400"
            )}
          >
            <Camera className="size-4" /> Vision AI: {visionAiEnabled ? "ATIVO" : "OFF"}
          </Button>
          <Badge className="h-12 bg-red-600 text-white font-black uppercase text-[10px] gap-3 px-6 flex items-center shadow-2xl rounded-2xl">
            <ShieldAlert className="size-5 text-accent" /> ZERO ACIDENTES
          </Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* TERMINAL DA CATRACA */}
        <div className="lg:col-span-5 space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
            <div className="p-10 bg-[#090e24] text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Fingerprint className="size-32 text-accent" />
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-accent shadow-2xl">
                  <Monitor className="size-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-headline font-black uppercase tracking-tight">
                    NAI GateKeeper
                  </h3>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">
                    Terminal de Acesso Seguro 360°
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="p-10 space-y-10">
              <div
                className={cn(
                  "h-72 rounded-[2.5rem] border-4 flex flex-col items-center justify-center text-center p-10 transition-all duration-700 shadow-2xl relative overflow-hidden",
                  !lastResult
                    ? "bg-slate-900 border-slate-800"
                    : lastResult.authorized
                      ? "bg-emerald-950 border-emerald-500"
                      : "bg-red-950 border-red-500"
                )}
              >
                {visionAiEnabled && !lastResult && (
                  <div className="absolute inset-0 z-0 opacity-20">
                    <div className="w-full h-1 bg-cyan-400 absolute top-0 animate-[scan_4s_ease-in-out_infinite] shadow-[0_0_20px_#22d3ee]" />
                  </div>
                )}

                {!lastResult ? (
                  <div className="space-y-6 relative z-10">
                    <div className="size-6 bg-blue-500 rounded-full animate-ping mx-auto" />
                    <p className="text-[#00f2ff] font-mono text-[11px] font-black uppercase tracking-[0.5em]">
                      Aguardando Biometria...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in zoom-in-95 relative z-10">
                    {lastResult.authorized ? (
                      <CheckCircle2 className="size-20 text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="size-20 text-red-500 mx-auto" />
                    )}
                    <div className="space-y-2">
                      <p
                        className={cn(
                          "font-black text-3xl uppercase tracking-tighter",
                          lastResult.authorized ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {lastResult.message}
                      </p>
                      <p className="text-[11px] text-white/40 font-bold uppercase tracking-widest max-w-[250px] mx-auto leading-relaxed italic">
                        &quot;{lastResult.detail}&quot;
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">
                    Identificar Colaborador:
                  </label>
                  <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                    <SelectTrigger className="h-16 bg-slate-50 border-none rounded-[1.5rem] font-bold shadow-inner text-lg">
                      <SelectValue placeholder="Selecione na Unidade..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {REAL_EMPLOYEES.map((e) => (
                        <SelectItem
                          key={e.id}
                          value={e.id}
                          className="font-bold text-xs uppercase py-3"
                        >
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSimulateTurnstile}
                  disabled={isScanning || !selectedEmp}
                  className="w-full h-20 bg-primary text-white font-black uppercase text-sm tracking-widest rounded-[1.5rem] shadow-2xl gap-4 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {isScanning ? (
                    <Loader2 className="size-6 animate-spin text-accent" />
                  ) : (
                    <Scan className="size-6 text-accent" />
                  )}
                  Bipar Crachá + Scan Vision AI
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FEED DE MONITORAMENTO */}
        <div className="lg:col-span-7 space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[3rem] overflow-hidden flex flex-col h-full">
            <CardHeader className="bg-slate-50 border-b p-10 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black text-primary uppercase font-headline tracking-tighter">
                  Live Monitor Hub
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                  Rastreabilidade em tempo real de acessos e desvios.
                </CardDescription>
              </div>
              <div className="flex gap-3">
                <Badge className="bg-blue-600 text-white h-10 px-5 flex items-center font-black uppercase text-[10px] rounded-xl shadow-lg">
                  NAI API READY
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader className="bg-slate-50/50 text-[10px] uppercase font-black tracking-widest">
                  <TableRow>
                    <TableHead className="pl-10 py-6">Colaborador / Tempo</TableHead>
                    <TableHead>Diagnóstico Local</TableHead>
                    <TableHead className="text-center">Firewall Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs?.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="pl-10 py-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "size-10 rounded-xl flex items-center justify-center text-white shadow-inner",
                              log.status === "authorized" ? "bg-emerald-500" : "bg-red-500"
                            )}
                          >
                            <User size={18} />
                          </div>
                          <div>
                            <p className="font-black text-xs text-primary uppercase leading-tight">
                              {log.employeeName}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                              {log.timestamp
                                ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString("pt-BR")
                                : "--:--"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p
                          className={cn(
                            "text-[10px] font-bold leading-tight uppercase",
                            log.status === "authorized" ? "text-emerald-600" : "text-red-600 italic"
                          )}
                        >
                          {log.detail}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-[9px] font-black uppercase border-none px-4 h-7 rounded-lg shadow-sm",
                            log.status === "authorized"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {log.status === "authorized" ? "OK" : "BLOCKED"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-10 bg-slate-900 text-white rounded-[3rem] flex gap-8 items-start relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <HardHat className="size-48" />
          </div>
          <div className="p-5 bg-white/10 rounded-3xl border border-white/20 text-accent shadow-2xl transition-transform group-hover:rotate-6">
            <Eye className="size-8" />
          </div>
          <div className="space-y-4 relative z-10">
            <h4 className="text-xl font-black uppercase text-accent tracking-tighter font-headline">
              Áreas de Risco Ativas
            </h4>
            <p className="text-sm text-white/60 leading-relaxed font-medium italic">
              &quot;Delimitação digital via CFTV integrada (NR-12). O motor Vision AI envia comando
              imediato de parada para máquinas se houver detecção de invasão em zonas de
              perigo.&quot;
            </p>
          </div>
        </div>
        <div className="p-10 bg-blue-50 border-2 border-blue-100 rounded-[3rem] flex gap-8 items-start shadow-xl group">
          <div className="p-5 bg-primary text-white rounded-3xl shadow-2xl transition-transform group-hover:scale-110">
            <Zap className="size-8 text-accent" />
          </div>
          <div className="space-y-4 text-left">
            <h4 className="text-xl font-black text-primary uppercase font-headline tracking-tighter">
              Gatilho eSocial v3.2
            </h4>
            <p className="text-sm text-primary/70 leading-relaxed font-medium">
              Sincronização atômica: O sistema impede fisicamente o acesso de colaboradores que não
              possuem o evento S-2220 (Saúde) ou S-2240 (Riscos) protocolado no Governo.
            </p>
            <Button
              variant="link"
              className="text-primary p-0 h-auto font-black uppercase text-[10px] tracking-widest gap-2"
            >
              Configurar Webhooks <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
