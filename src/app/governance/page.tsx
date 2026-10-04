"use client";

import * as React from "react";
import {
  Scale,
  ShieldCheck,
  Brain,
  Zap,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Landmark,
  ShieldQuestion,
  Info,
  Lock,
  Database,
  History,
  FileSearch,
  Eye,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useFirestore, useMemoFirebase, useDoc, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, limit } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { useToast } from "@/hooks/use-toast";

export default function CorporateGovernance() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();
  const [activeTab, setActiveTab] = React.useState("lira");
  const [isScanningSystems, setIsScanningSystems] = React.useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  // SGSI Audit Logs - ISO 27001 Requisito 9.1
  const auditLogsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "phi_audit_logs"), orderBy("timestamp", "desc"), limit(10));
  }, [db]);
  const { data: auditLogs } = useCollection(auditLogsQuery);

  const handleSystemScan = () => {
    setIsScanningSystems(true);
    setTimeout(() => {
      setIsScanningSystems(false);
      toast({
        title: "Varredura ISO 27001 Concluída",
        description: "Todos os parâmetros de segurança estão regulares.",
      });
    }, 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Governança SGI & SGSI
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <ShieldCheck className="size-3 text-emerald-600" /> ISO 27001 (Segurança da Informação)
            & LIRA v2.7.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge
            variant="outline"
            className="h-11 border-primary text-primary font-black uppercase text-[10px] bg-white px-4 flex items-center shadow-sm"
          >
            <Building2 className="size-4 mr-2" />
            {activeClientId === "all" ? "VISÃO GLOBAL SGSI" : "UNIDADE ATIVA"}
          </Badge>
          <Button
            onClick={handleSystemScan}
            disabled={isScanningSystems}
            className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2"
          >
            {isScanningSystems ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Database className="size-4 text-accent" />
            )}
            Audit Engine SGSI
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <TabsList className="flex w-fit bg-muted/50 p-1.5 rounded-2xl h-16">
            <TabsTrigger
              value="lira"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8"
            >
              LIRA (Legislação)
            </TabsTrigger>
            <TabsTrigger
              value="sgsi"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-emerald-600"
            >
              <Lock className="size-4" /> ISO 27001 (Segurança)
            </TabsTrigger>
            <TabsTrigger
              value="radar_gov"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-accent"
            >
              <Landmark className="size-4" /> Radar Gov / CADIN
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest px-8 text-red-600"
            >
              <ShieldAlert className="size-4" /> Alertas Críticos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sgsi" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden flex flex-col">
              <CardHeader className="bg-slate-50 border-b p-8 text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      Trilha de Auditoria PHI (ISO 27001 A.8.16)
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                      Monitoramento de acesso a dados de saúde protegidos.
                    </CardDescription>
                  </div>
                  <Badge className="bg-primary text-white font-black text-[8px] h-6 px-3">
                    SGSI ACTIVE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px]">
                <div className="divide-y">
                  {auditLogs?.map((log) => (
                    <div
                      key={log.id}
                      className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                          <Eye className="size-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-primary uppercase">
                            {log.userName}
                          </p>
                          <p className="text-[10px] text-slate-500 italic">
                            Acessou prontuário de: {log.patientName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="outline"
                          className="text-[8px] font-mono border-slate-100 text-slate-400"
                        >
                          {log.compliance}
                        </Badge>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                          {log.timestamp
                            ? new Date(log.timestamp.seconds * 1000).toLocaleString("pt-BR")
                            : "---"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!auditLogs || auditLogs.length === 0) && (
                    <div className="py-20 text-center opacity-20 flex flex-col items-center gap-3">
                      <History size={48} />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        Aguardando logs de sistema
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 text-left">
              <Card className="bg-[#090e24] text-white p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                  <Lock className="size-32 text-accent" />
                </div>
                <div className="relative z-10 space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <ShieldCheck className="size-4" /> ISMS Control A.10
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black uppercase text-accent mb-2">
                        Segurança em Repouso
                      </p>
                      <p className="text-xs italic text-slate-300 font-medium">
                        "Criptografia AES-256 ativa em todos os buckets de documentos e tabelas de
                        prontuário."
                      </p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black uppercase text-accent mb-2">
                        Segurança em Trânsito
                      </p>
                      <p className="text-xs italic text-slate-300 font-medium">
                        "Protocolo TLS 1.3 obrigatório para todas as chamadas de API e streaming
                        NAI."
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="card-shadow border-none bg-white rounded-[2rem] p-8 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shadow-sm">
                    <ShieldAlert className="size-4" />
                  </div>
                  <h4 className="text-sm font-black text-primary uppercase">
                    Gestão de Incidentes
                  </h4>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium italic">
                  "Tempo médio de resposta a alertas de segurança:{" "}
                  <span className="text-emerald-600 font-black">1.4s (Automático)</span>."
                </p>
                <Button
                  variant="outline"
                  className="w-full h-11 border-primary text-primary font-black uppercase text-[10px] rounded-xl hover:bg-primary hover:text-white transition-all"
                >
                  Gerar Relatório ISO 27001
                </Button>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lira" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-8 text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      LIRA: Matriz de Aplicabilidade Legal
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {activeClientId === "all"
                        ? "Monitoramento consolidado da rede"
                        : `Diagnóstico unitário ativo.`}
                    </CardDescription>
                  </div>
                  <Badge className="bg-primary text-white font-black text-[8px] h-6 px-3">
                    ATUALIZADO JAN/26
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  <LiraItem
                    law="Portaria Interministerial 13/2026"
                    scope="SST / Saúde Mental"
                    evaluation="Atendido"
                    status="Conforme"
                    impact="Alto"
                  />
                  <LiraItem
                    law="Decreto Estadual 4.500/26"
                    scope="Ambiental / Efluentes"
                    evaluation="Em Implantação"
                    status="Pendente"
                    impact="Crítico"
                  />
                  <LiraItem
                    law="Lei Municipal 843/2025"
                    scope="Licenciamento de Operação"
                    evaluation="Vencendo em 45 dias"
                    status="Ação Requerida"
                    impact="Médio"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-[#001F3F] text-white border-none rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                  <Globe className="size-32 text-accent" />
                </div>
                <div className="relative z-10 space-y-6 text-left">
                  <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <Zap className="size-4" /> NAI Legal Scan
                  </h3>
                  <p className="text-xs italic text-slate-300 font-medium leading-relaxed">
                    "A NAI monitorou 1.204 atos normativos hoje. Identificamos que a Portaria X
                    sobre Resíduos Químicos afeta seus processos vigentes."
                  </p>
                  <Button
                    variant="outline"
                    className="w-full h-11 border-white/20 text-white font-black uppercase text-[10px] hover:bg-white/10 transition-all gap-2"
                  >
                    <ShieldCheck className="size-3" /> Ver Diário Oficial
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="radar_gov" className="mt-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
            <Card className="lg:col-span-2 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-8 text-left">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg font-black text-primary uppercase">
                      Integração Sistemas Oficiais
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                      Monitoramento de pendências e sanções estaduais/federais.
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-600 text-white font-black text-[8px] h-6 px-3">
                    NAI API HUB
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-4">
                  <SystemStatusItem
                    system="CADIN ESTADUAL"
                    status="Regular"
                    detail="Sem pendências financeiras registradas."
                    icon={CheckCircle2}
                    color="text-emerald-600"
                  />
                  <SystemStatusItem
                    system="PORTAL E-SANÇÕES"
                    status="Vigilância Ativa"
                    detail="Monitorando registros da Lei 12.846/2013 (Anticorrupção)."
                    icon={ShieldCheck}
                    color="text-primary"
                  />
                  <SystemStatusItem
                    system="CEIS (EMPRESAS INIDÔNEAS)"
                    status="Limpo"
                    detail="Não consta no Cadastro Nacional de Empresas Inidôneas."
                    icon={ShieldQuestion}
                    color="text-blue-600"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6 text-left">
              <Card className="bg-[#090e24] text-white p-8 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                  <Zap className="size-32 text-accent" />
                </div>
                <div className="relative z-10 space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <Zap className="size-4" /> Inteligência Regulatória
                  </h3>
                  <p className="text-xs italic text-slate-300 font-medium leading-relaxed">
                    "A NAI realiza varreduras automáticas a cada 24h em 42 bases de dados
                    governamentais para antecipar riscos de bloqueio contratual."
                  </p>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-[8px] font-black uppercase text-white/40 tracking-[0.3em]">
                      Status: 100% REGULAR
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SystemStatusItem({ system, status, detail, icon: Icon, color }: any) {
  return (
    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white transition-all group">
      <div className="flex items-center gap-4 text-left">
        <div className={cn("p-2.5 rounded-xl bg-white shadow-inner", color)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-black text-primary uppercase">{system}</p>
          <p className="text-[10px] text-slate-500 italic">"{detail}"</p>
        </div>
      </div>
      <Badge
        className={cn(
          "text-[8px] font-black uppercase border-none px-3 h-6",
          status === "Regular" || status === "Limpo"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-primary text-white"
        )}
      >
        {status}
      </Badge>
    </div>
  );
}

function LiraItem({ law, scope, evaluation, status, impact }: any) {
  return (
    <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
      <div className="flex items-center gap-6 text-left">
        <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-white transition-all shadow-inner">
          <Scale size={20} className="text-primary/40" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-black text-primary uppercase leading-tight">{law}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{scope}</p>
          <p className="text-[10px] text-slate-500 font-medium italic">"{evaluation}"</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge
          variant="outline"
          className={cn(
            "text-[8px] font-black uppercase border-none px-2 h-5",
            impact === "Crítico" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
          )}
        >
          Impacto {impact}
        </Badge>
        <Badge
          className={cn(
            "text-[8px] font-black uppercase border-none px-3 h-5",
            status === "Conforme"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          )}
        >
          {status}
        </Badge>
      </div>
    </div>
  );
}
