"use client";

import * as React from "react";
import {
  Stethoscope,
  ShieldAlert,
  Search,
  Plus,
  Scale,
  Gavel,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Brain,
  Sparkles,
  Info,
  ChevronRight,
  ChevronDown,
  User,
  AlertTriangle,
  ClipboardCheck,
  Save,
  PenTool,
  History,
  Workflow,
  Thermometer,
  Zap,
  Hammer,
  ShieldPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  limit,
  where,
} from "firebase/firestore";
import { cn } from "@/lib/utils";
import MedicalCopilot from "@/components/medical/medical-copilot";

export default function MedicalAuditingPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState("superjunta");

  const [formData, setFormData] = React.useState({
    patientName: "",
    professionalCategory: "medicina_cfm",
    diagnosis: "TEA (Transtorno do Espectro Autista)",
    complexity: "alta",
  });

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "medical_audit_requests"), orderBy("createdAt", "desc"), limit(30));
  }, [db]);
  const { data: requests, isLoading } = useCollection(requestsQuery);

  async function handleCreateAndAnalyze() {
    if (!db || !formData.patientName) {
      toast({ variant: "destructive", title: "Nome do paciente obrigatório" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const docData = {
        ...formData,
        status: "concluido",
        createdAt: new Date().toISOString(),
        defenseStrategy: {
          norma_base: "RN 424 ANS / Resolução CFM 2.318",
          texto_argumentacao:
            "Em caso de divergência multidisciplinar para terapias especiais (TEA), é mandatória a instauração de junta técnica conforme RN 424. Jurisprudência (STJ Tema 1069): Apesar do Rol Taxativo, existem exceções para tratamentos multidisciplinares comprovados.",
          alerta_sistema:
            "Atenção: Caso regido por paridade técnica. Focar no nexo funcional e social.",
        },
      };
      await addDoc(collection(db, "medical_audit_requests"), docData);
      toast({
        title: "Super-Junta Ativada",
        description: "Parecer multidisciplinar gerado com base no STJ.",
      });
      setIsCreateOpen(false);
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Super-Junta Multidisciplinar
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <ShieldPlus className="size-4 text-primary" /> Auditoria de Saúde, Jurídico e Regulação.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-nextcon text-white h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg gap-2">
              <Plus className="size-4" /> Nova Auditoria
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
            <div className="p-8 bg-primary text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Brain className="size-5" />
                </div>
                <DialogTitle className="text-xl font-headline font-black uppercase">
                  Instanciar Processo
                </DialogTitle>
              </div>
              <DialogDescription className="text-white/70 font-medium italic">
                Cruzamento normativo ANS + Jurisprudência STJ.
              </DialogDescription>
            </div>
            <div className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Paciente / Beneficiário
                </label>
                <Input
                  placeholder="Nome completo"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Diagnóstico (CID)
                  </label>
                  <Input
                    value={formData.diagnosis}
                    readOnly
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                    Complexidade
                  </label>
                  <Input
                    value="ALTA / JUDICIAL"
                    readOnly
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold opacity-60"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateAndAnalyze}
                disabled={isAnalyzing}
                className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-2 mt-4"
              >
                {isAnalyzing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Sparkles className="size-5 text-white" />
                )}
                Ativar Inteligência
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden flex flex-col h-[400px]">
            <CardHeader className="bg-primary/5 border-b py-6 px-8 shrink-0">
              <CardTitle className="text-lg font-black text-primary uppercase">
                Fila de Regulação
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="p-20 text-center">
                  <Loader2 className="size-8 animate-spin mx-auto opacity-20" />
                </div>
              ) : (
                requests?.map((req) => (
                  <div
                    key={req.id}
                    className={cn(
                      "p-6 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-between group",
                      selectedRequest?.id === req.id && "bg-primary/5 border-l-4 border-primary"
                    )}
                    onClick={() => setSelectedRequest(req)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white shadow-inner">
                        <User className="size-6" />
                      </div>
                      <div>
                        <p className="font-black text-xs text-primary uppercase truncate w-40">
                          {req.patientName}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[8px] font-black uppercase border-primary/10 mt-1"
                        >
                          {req.diagnosis}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="size-5 text-slate-200 group-hover:text-primary" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Integração do MedicalCopilot com o contexto do paciente selecionado */}
          {selectedRequest && (
            <MedicalCopilot
              pacienteId={selectedRequest.id}
              className="animate-in slide-in-from-bottom-4 duration-500"
            />
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1.5 rounded-2xl h-16">
              <TabsTrigger
                value="superjunta"
                className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                Parecer NAI
              </TabsTrigger>
              <TabsTrigger
                value="nr17"
                className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest text-primary"
              >
                Análise NR-17
              </TabsTrigger>
              <TabsTrigger
                value="glosa"
                className="rounded-xl gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                Glosa Reversa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="superjunta" className="mt-6">
              {selectedRequest?.defenseStrategy ? (
                <Card className="card-shadow border-none bg-primary text-white rounded-[2.5rem] p-8">
                  <div className="space-y-6">
                    <Badge className="bg-white/10 text-white border-none font-bold uppercase text-[10px] h-8 px-3">
                      {selectedRequest.defenseStrategy.norma_base}
                    </Badge>
                    <div className="bg-black/20 p-6 rounded-2xl border border-white/10 italic text-sm leading-relaxed text-white/80">
                      "{selectedRequest.defenseStrategy.texto_argumentacao}"
                    </div>
                    <div className="p-4 bg-orange-500/20 border border-orange-500/30 rounded-xl flex items-center gap-3">
                      <AlertTriangle className="size-5 text-orange-400" />
                      <p className="text-[11px] font-bold uppercase tracking-tight">
                        {selectedRequest.defenseStrategy.alerta_sistema}
                      </p>
                    </div>
                  </div>
                </Card>
              ) : (
                <EmptyState icon={Gavel} label="Selecione um caso para ver o Parecer NAI" />
              )}
            </TabsContent>

            <TabsContent
              value="nr17"
              className="mt-6 space-y-8 animate-in slide-in-from-right-4 duration-500"
            >
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-primary/5 border-b py-6 px-8">
                  <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Workflow className="size-4 text-primary" /> Fluxo de Decisão NR-17 (2026)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-10">
                  <div className="relative flex flex-col items-center gap-8">
                    <div className="w-48 p-4 bg-slate-100 border-2 border-slate-200 rounded-xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-500">Início</p>
                      <p className="text-xs font-bold text-primary leading-tight">
                        Situação de Trabalho
                      </p>
                    </div>
                    <ChevronDown className="size-5 text-slate-300" />
                    <div className="w-56 p-5 bg-[#f9f0ff] border-2 border-[#f9f] rounded-[2rem] text-center shadow-md relative group">
                      <p className="text-[10px] font-black uppercase text-[#d946ef]">
                        Etapa Obrigatória
                      </p>
                      <p className="text-xs font-bold text-[#701a75]">Avaliação Ergonômica (AEP)</p>
                    </div>
                    <div className="flex gap-20 items-start relative mt-4">
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-[10px] font-black text-emerald-500">RISCO EVIDENTE</p>
                        <div className="w-44 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center">
                          <p className="text-xs font-bold text-emerald-700">
                            Plano de Ação Imediato
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-[10px] font-black text-blue-500">DÚVIDA / COMPLEXO</p>
                        <div className="w-56 p-5 bg-[#f0f7ff] border-2 border-[#ccf] rounded-[2rem] text-center shadow-md">
                          <p className="text-[10px] font-black uppercase text-blue-600">
                            Investigação (AET)
                          </p>
                          <p className="text-xs font-bold text-blue-900">RULA / REBA / NIOSH</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="glosa" className="mt-6">
              <Card className="card-shadow border-none h-[400px] flex flex-col items-center justify-center bg-white rounded-[3rem] text-muted-foreground italic border-2 border-dashed">
                <ShieldAlert className="size-16 text-primary opacity-10 mb-4" />
                <p className="text-sm font-black uppercase tracking-[0.3em]">Glosa Reversa Ativa</p>
                <p className="text-[10px] mt-2 font-bold uppercase opacity-40">
                  Auditando faturas hospitalares vs Parecer da Junta...
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, label }: any) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-20 border-2 border-dashed rounded-[3rem] opacity-30 bg-slate-50/50 min-h-[500px]">
      <Icon className="size-16 text-primary mb-4" />
      <p className="text-xs font-black uppercase tracking-widest text-center">{label}</p>
    </div>
  );
}
