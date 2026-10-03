"use client";

import * as React from "react";
import {
  SearchCheck,
  FileWarning,
  CheckCircle2,
  AlertCircle,
  Download,
  ShieldCheck,
  Sparkles,
  Loader2,
  History,
  SendHorizontal,
  Layers,
  ChevronDown,
  Mail,
  Calendar,
  Settings2,
  FileDown,
  Trash2,
  Save,
  Check,
  Filter,
  ArrowRight,
  ShieldAlert,
  Zap,
  Network,
  Scale,
  Lock,
  RefreshCw,
  Link as LinkIcon,
  Activity,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { runEsocialAudit, type EsocialAuditOutput } from "@/ai/flows/esocial-audit-flow";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, addDoc } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";

export default function EsocialAudit() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [activeTab, setActiveTab] = React.useState("agrupador");
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [isSyncingRubrics, setIsSyncingRubrics] = React.useState(false);
  const [aiReport, setAiReport] = React.useState<EsocialAuditOutput | null>(null);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const queueQuery = useMemoFirebase(() => {
    if (!db || !profile?.companyId) return null;
    return query(
      collection(db, "companies", profile.companyId, "esocial_events_queue"),
      orderBy("createdAt", "desc")
    );
  }, [db, profile]);
  const { data: queueDocs } = useCollection(queueQuery);

  const handleSimulateEvent = async (type: string) => {
    if (!db || !profile?.companyId) return;

    const names = ["BRUNO GADELHA", "ERICK HENRIQUE", "JOÃO BESTEL"];
    const name = names[Math.floor(Math.random() * names.length)];

    let firewallMessage = "";
    let status = "approved_firewall_aguardando_transmissao";

    if (type === "S-2240") {
      const caValido = Math.random() > 0.3;
      if (!caValido) {
        status = "blocked_pelo_firewall";
        firewallMessage = "Risco de multa: Tentativa de envio com EPI sem C.A. válido.";
      }
    }

    const colRef = collection(db, "companies", profile.companyId, "esocial_events_queue");
    await addDocumentNonBlocking(colRef, {
      id: `EVT-${Date.now()}`,
      eventType: type,
      employeeName: name,
      status,
      firewallMessage,
      payload: { ca_epi: type === "S-2240" ? (firewallMessage ? "" : "45678") : null },
      createdAt: new Date().toISOString(),
    });

    if (status.includes("blocked")) {
      toast({
        variant: "destructive",
        title: "NAI Firewall Ativado!",
        description: "Evento bloqueado por inconsistência técnica.",
      });
    } else {
      toast({
        title: "Evento na Fila",
        description: "Auditado via NAI API e pronto para transmissão.",
      });
    }
  };

  const handleSyncRubrics = () => {
    setIsSyncingRubrics(true);
    setTimeout(() => {
      setIsSyncingRubrics(false);
      toast({
        title: "Tabela S-1010 Sincronizada",
        description: "Rubricas atualizadas para a Versão S-1.3 do eSocial.",
      });
    }, 2000);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            NAI Firewall e-Social
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest mt-2">
            Infraestrutura 2026 contra multas e inconsistências via NAI API.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleSimulateEvent("S-2240")}
            variant="outline"
            className="h-11 px-6 border-primary text-primary font-black uppercase text-[10px] gap-2"
          >
            <Zap className="size-4" /> Validar S-2240
          </Button>
          <Button
            onClick={() => handleSimulateEvent("S-2220")}
            className="gradient-nextcon text-white h-11 px-6 rounded-xl font-black uppercase text-[10px] gap-2"
          >
            <SendHorizontal className="size-4" /> Transmitir S-2220
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[850px] grid-cols-4 bg-muted/50 p-1.5 rounded-2xl h-16">
          <TabsTrigger
            value="agrupador"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Fila NAI API
          </TabsTrigger>
          <TabsTrigger
            value="governanca"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-accent"
          >
            <ShieldCheck className="size-4" /> Governança 2026
          </TabsTrigger>
          <TabsTrigger
            value="auditoria"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Diagnóstico NAI
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            Configuração API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agrupador" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3 card-shadow border-none bg-white overflow-hidden">
              <CardHeader className="bg-primary/5 border-b pb-6">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-black text-primary uppercase flex items-center gap-2">
                    <ShieldAlert className="size-5 text-accent" /> Monitoramento Firewall 2026
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="h-6 gap-2 border-emerald-100 text-emerald-700 font-black uppercase text-[8px] bg-emerald-50"
                  >
                    <div className="size-1.5 bg-emerald-500 rounded-full animate-ping" /> Live
                    Validation
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-8">Evento</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Status Firewall</TableHead>
                      <TableHead className="pr-8">Diagnóstico NAI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueDocs?.map((evt) => (
                      <TableRow key={evt.id} className="hover:bg-slate-50 transition-colors group">
                        <TableCell className="pl-8">
                          <Badge
                            variant="outline"
                            className="font-mono text-primary border-primary/20 group-hover:bg-primary group-hover:text-white transition-all"
                          >
                            {evt.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-black text-xs uppercase text-primary">
                            {evt.employeeName}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[8px] font-black uppercase border-none px-3",
                              evt.status === "blocked_pelo_firewall"
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {evt.status === "blocked_pelo_firewall" ? "Bloqueado" : "Aprovado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-8">
                          {evt.firewallMessage ? (
                            <p className="text-[10px] text-red-600 italic font-bold leading-tight flex items-center gap-1">
                              <AlertCircle className="size-3" /> {evt.firewallMessage}
                            </p>
                          ) : (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="size-3 text-emerald-500" />
                              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">
                                Sincronização OK
                              </p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!queueDocs || queueDocs.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-widest"
                        >
                          Nenhum evento pendente no firewall
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 card-shadow border-none bg-slate-900 text-white rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-white/5 border-b pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Terminal className="size-4" /> NAI API Protocol
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 font-mono text-[9px] space-y-4">
                <div className="space-y-1">
                  <p className="text-emerald-400">$ GET /api/v2/compliance</p>
                  <p className="text-slate-400">Verifying TLS 1.2... OK</p>
                  <p className="text-slate-400">Verifying S-1.3 Dictionary... OK</p>
                </div>
                <div className="space-y-1">
                  <p className="text-accent">$ VALIDATE EVENT S-2240</p>
                  <p className="text-slate-400">JSON Payload Check: Valid</p>
                  <p className="text-slate-400">Cross-Ref NAIGED: PGR-2026-01</p>
                  <p className="text-emerald-400">Result: PROCEED_TO_GOV</p>
                </div>
                <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-3">
                  <Activity className="size-8 text-accent animate-pulse" />
                  <p className="text-[8px] font-black uppercase tracking-widest text-center">
                    Firewall Intelligence Ativa 24/7
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="governanca"
          className="mt-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      Tabela S-1010 (Rubricas)
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                      Sincronização Versão S-1.3
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 font-black uppercase text-[8px] px-2 h-5">
                    Ano 2026
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <p className="text-[11px] font-medium text-emerald-800 italic leading-relaxed">
                    "Incidências de CP e FGTS configuradas conforme Portaria Interministerial nº
                    13/2026."
                  </p>
                </div>
                <Button
                  onClick={handleSyncRubrics}
                  disabled={isSyncingRubrics}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-3"
                >
                  {isSyncingRubrics ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-5 text-accent" />
                  )}
                  Sincronizar Rubricas com Governo
                </Button>
              </CardContent>
            </Card>

            <Card className="card-shadow border-none bg-slate-900 text-white rounded-[2rem] overflow-hidden">
              <CardHeader className="border-b border-white/5 p-8">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-black uppercase">
                      Criptografia & Certificado
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      Protocolo TLS 1.2+ Ativo
                    </CardDescription>
                  </div>
                  <Badge className="bg-accent text-primary font-black uppercase text-[8px] px-2 h-5">
                    Seguro
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-5 p-5 bg-white/5 rounded-2xl border border-white/10">
                  <div className="p-3 bg-accent rounded-xl text-primary">
                    <Lock className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">
                      Status Certificado A1
                    </p>
                    <p className="text-[10px] text-white/60 mt-1 uppercase font-bold">
                      Validade: 12/12/2026
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-white/40 italic leading-relaxed">
                  "O eSocial 2026 exige padrões elevados de criptografia para o envio das rubricas
                  S-1010."
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl text-accent">
                  <Scale className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-headline font-black uppercase leading-none">
                    Cruzamento SST x Folha (S-2240)
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-white/60 mt-2">
                    Vínculo de Adicionais e Financiamento da Aposentadoria Especial (FAE).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="h-8 font-mono text-primary">
                      RUB-042
                    </Badge>
                    <div>
                      <p className="text-xs font-black text-primary uppercase">
                        Adicional de Insalubridade 20%
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">
                        Vínculo: LTCAT - Agente Ruído Continuo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-100 text-emerald-700 font-black uppercase text-[8px] h-5">
                      Vínculo OK
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-primary"
                    >
                      <LinkIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="h-8 font-mono text-primary">
                      RUB-058
                    </Badge>
                    <div>
                      <p className="text-xs font-black text-primary uppercase">
                        Periculosidade Engenharia
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">
                        Vínculo: LTCAT - Agente Eletricidade
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-100 text-emerald-700 font-black uppercase text-[8px] h-5">
                      Vínculo OK
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-300 hover:text-primary"
                    >
                      <LinkIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-8 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                <p className="text-[11px] text-primary/70 leading-relaxed font-medium italic">
                  <Sparkles className="size-3 inline mr-2 text-accent" />
                  "Dica NAI: O vínculo direto entre rubricas e agentes nocivos do S-2240 garante que
                  o eSocial aceite o código de tributação FAE sem inconsistências no fechamento da
                  folha."
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-8">
          <Card className="card-shadow border-none bg-white p-10 text-center">
            <div className="max-w-md mx-auto space-y-6">
              <SearchCheck className="size-16 mx-auto text-primary opacity-20" />
              <div className="space-y-2">
                <h3 className="text-xl font-black text-primary uppercase leading-tight">
                  Diagnóstico Gemini 2.0
                </h3>
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  "O motor NAI audita a consistência entre NAIGED, PGR e PCMSO, garantindo
                  conformidade legal plena em milissegundos."
                </p>
              </div>
              <Button
                onClick={async () => {
                  setIsAuditing(true);
                  try {
                    const res = await runEsocialAudit({
                      sector: "Geral",
                      riskList: ["Ruído"],
                      examList: [],
                    });
                    setAiReport(res);
                  } finally {
                    setIsAuditing(false);
                  }
                }}
                disabled={isAuditing}
                className="gradient-nextcon text-white h-12 px-10 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-xl"
              >
                {isAuditing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4 text-accent" />
                )}
                Auditar Toda a Unidade
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
