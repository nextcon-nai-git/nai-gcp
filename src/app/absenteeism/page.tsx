"use client";

import * as React from "react";
import {
  AlertTriangle,
  ShieldCheck,
  History,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Sparkles,
  TrendingUp,
  Gavel,
  ClipboardList,
  ArrowRight,
  ShieldAlert,
  User,
  FileText,
  Scale,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { useSgi } from "@/contexts/sgi-context";
import {
  collection,
  query,
  orderBy,
  collectionGroup,
  doc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { MedicalReferralReport } from "@/components/documents/medical-referral-report";
import { NtepContestationReport } from "@/components/documents/ntep-contestation-report";

// Desativa SSR para o componente de PDF para evitar erros de resolução de módulos (canvas/fs)
const PDFDownloadLink = dynamic(() => import("@/components/documents/pdf-download-link"), {
  ssr: false,
});

const recordFormSchema = z.object({
  employeeName: z.string().min(3, "Nome obrigatório"),
  cpf: z.string().optional(),
  admissionDate: z.string().optional(),
  dut: z.string().optional(),
  cid: z.string().min(3, "CID é obrigatório"),
  disease: z.string().min(3, "Descrição da doença obrigatória"),
  companyId: z.string().min(1, "Selecione uma unidade"),
  jobRole: z.string().optional(),
  caseNumber: z.string().optional(),
  benefitNumber: z.string().optional(),
  knowledgeDate: z.string().optional(),
  value: z.string().optional(),
  status: z.enum(["Pendente", "Em Análise", "Concluído"]),
});

type RecordFormValues = z.infer<typeof recordFormSchema>;

const NTEP_WORKFLOW_STEPS = [
  {
    id: "phase1",
    title: "Fase 1: Recebimento e Triagem",
    role: "RH / Departamento Pessoal",
    items: [
      { id: "p1_1", label: "Recepção: Validar se > 15 dias ou soma > 15 em 60 dias." },
      { id: "p1_2", label: "Identificação do CID: Verificar se consta informação clínica." },
      { id: "p1_3", label: "Alerta de Risco: CID Ortopédico (M) ou Trauma (S/T) identificado?" },
      { id: "p1_4", label: "Agendamento Prévio: Marcar consulta com Médico do Trabalho." },
      { id: "p1_5", label: "Comunicação Imediata: Notificar SESMT e Jurídico/FAP." },
    ],
  },
  {
    id: "phase2",
    title: "Fase 2: Investigação e Parecer",
    role: "SESMT e Medicina do Trabalho",
    items: [
      { id: "p2_1", label: "Entrevista: Investigar origem (Fim de semana, esporte, trânsito?)." },
      { id: "p2_2", label: "Busca de Evidências: Relatos de quase-acidente, EPIs e AET/PGR." },
      { id: "p2_3", label: "Relatório de Encaminhamento: Médico emite laudo técnico." },
    ],
  },
  {
    id: "phase3",
    title: "Fase 3: Preparação do Dossiê",
    role: "RH / Comitê FAP",
    items: [
      { id: "p3_1", label: "Pasta do Perito: Montar pasta com DUT, Laudo, Exames e AET/EPI." },
      { id: "p3_2", label: "Orientação: Instruir o colaborador de forma empática." },
    ],
  },
  {
    id: "phase4",
    title: "Fase 4: Monitoramento Pós-Perícia",
    role: "RH / Jurídico",
    items: [
      { id: "p4_1", label: "Consulta Resultado: Verificar espécie do benefício no portal." },
      { id: "p4_2", label: "Ação B31 (Sucesso): Acompanhar exame de retorno." },
      { id: "p4_3", label: "Ação B91 (Crítico): Iniciar contestação administrativa FAP/NTEP." },
    ],
  },
];

interface MedicalLeaveRecord {
  id: string;
  companyId: string;
  employeeName: string;
  cid?: string;
  ntepWorkflow?: Record<string, boolean>;
  createdAt?: string | number | Date | { seconds: number };
  [key: string]: unknown;
}

export default function AbsenteeismPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user, role, companyId: userCompanyId } = useUser();
  const { activeClientId, isGlobalStaff, authorizedCompanies } = useSgi();
  const isGlobalAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeWorkflowRecord, setActiveWorkflowRecord] = React.useState<any>(null);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: {
      status: "Pendente",
      employeeName: "",
      cid: "",
      disease: "",
      companyId: "",
    },
  });

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

  const expertisesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    if (isGlobalAdmin) {
      return query(collectionGroup(db, "legalExpertises"), orderBy("createdAt", "desc"));
    }
    if (userCompanyId) {
      return query(
        collection(db, "companies", userCompanyId, "legalExpertises"),
        orderBy("createdAt", "desc")
      );
    }
    return null;
  }, [db, user, isGlobalAdmin, userCompanyId]);

  const { data: expertises, isLoading } = useCollection(expertisesQuery);

  const checkNTEP = (cid: string) => {
    if (!cid) return false;
    const dangerousPrefixes = ["M75", "M54", "F33", "M77", "M65", "S", "T"];
    return dangerousPrefixes.some((p) => cid.toUpperCase().startsWith(p));
  };

  const formatDate = (date: unknown) => {
    if (!date) return "---";
    try {
      if (typeof date === "object" && date !== null && "seconds" in date) {
        return new Date((date as { seconds: number }).seconds * 1000).toLocaleDateString("pt-BR");
      }
      if (typeof date === "string" || typeof date === "number" || date instanceof Date) {
        return new Date(date).toLocaleDateString("pt-BR");
      }
      return "---";
    } catch {
      return "---";
    }
  };

  async function handleCreateRecord(values: RecordFormValues) {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const colRef = collection(db, "companies", values.companyId, "legalExpertises");
      await addDocumentNonBlocking(colRef, {
        ...values,
        createdAt: serverTimestamp(),
        type: "Afastamento Previdenciário",
        ntepWorkflow: {},
      });
      toast({ title: "Registro Criado", description: "O caso foi inserido no radar Sentinela." });
      setIsCreateOpen(false);
      form.reset();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao Salvar" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleDeleteRecord = (record: MedicalLeaveRecord) => {
    if (!db || !record.companyId) return;
    if (window.confirm(`Deseja remover o registro de ${record.employeeName}?`)) {
      deleteDocumentNonBlocking(
        doc(db, "companies", record.companyId, "legalExpertises", record.id)
      );
      toast({ title: "Registro Removido" });
    }
  };

  const toggleChecklistItem = (record: MedicalLeaveRecord, stepId: string) => {
    if (!db || !record.companyId) return;
    const docRef = doc(db, "companies", record.companyId, "legalExpertises", record.id);
    const currentWorkflow = record.ntepWorkflow || {};
    const newValue = !currentWorkflow[stepId];

    updateDocumentNonBlocking(docRef, {
      [`ntepWorkflow.${stepId}`]: newValue,
      updatedAt: serverTimestamp(),
    });
  };

  const getWorkflowProgress = (record: MedicalLeaveRecord) => {
    if (!record?.ntepWorkflow) return 0;
    const totalItems = NTEP_WORKFLOW_STEPS.reduce((acc, phase) => acc + phase.items.length, 0);
    const checkedItems = Object.values(record.ntepWorkflow).filter((v) => v === true).length;
    return Math.round((checkedItems / totalItems) * 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase">
            Sentinela do Limbo (NTEP) 2026
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <ShieldAlert className="size-4 text-accent" /> Vigilância ativa de afastamentos
            ortopédicos e traumáticos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 h-11 border-primary text-primary font-bold uppercase text-[10px]"
          >
            <History className="size-4" /> Histórico
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white gap-2 h-11 px-6 shadow-lg font-black uppercase text-[10px] tracking-widest rounded-xl">
                <Plus className="size-4" /> Novo Registro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <DialogHeader className="p-8 bg-primary text-white space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <AlertTriangle className="size-5 text-accent" />
                  </div>
                  <DialogTitle className="text-xl font-headline font-black uppercase text-left">
                    Registrar Afastamento
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/70 font-medium italic text-left">
                  Insira os dados do colaborador para análise técnica de nexo causal e NTEP.
                </DialogDescription>
              </DialogHeader>

              <div className="p-8 max-h-[70vh] overflow-y-auto text-left">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateRecord)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="employeeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                            Nome do Colaborador
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: NOME COMPLETO"
                              {...field}
                              className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              CPF
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="000.000.000-00"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="jobRole"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Cargo
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: OPERADOR"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="admissionDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Data Admissão
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="dut"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Último Dia Trab. (DUT)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="benefitNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Número do Benefício (NB)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="91/000.000.000-0"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="knowledgeDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Data Ciência B91
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold text-red-600"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cid"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              CID (Código)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: M75.1"
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Unidade Cliente
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              disabled={!isGlobalAdmin && !!userCompanyId}
                            >
                              <FormControl>
                                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {companies?.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="disease"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                            Doença Alegada (Descrição)
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Descrição clínica..."
                              {...field}
                              className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
                    >
                      {isSubmitting ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-5 text-accent" />
                      )}
                      Salvar Registro
                    </Button>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden text-left">
          <CardHeader className="bg-slate-50 border-b py-6 px-8">
            <CardTitle className="text-lg font-black text-primary uppercase">
              Gestão de Casos Críticos
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
              Acompanhamento de fluxos NTEP e contestações.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-8">Colaborador</TableHead>
                  <TableHead>CID / Doença</TableHead>
                  <TableHead>Workflow NTEP</TableHead>
                  <TableHead className="text-right pr-8">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="size-10 animate-spin text-primary opacity-20" />
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          Sincronizando Base Jurídica...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : expertises?.length ? (
                  expertises.map((record) => {
                    const isNtep = checkNTEP(record.cid);
                    const progress = getWorkflowProgress(record);

                    return (
                      <TableRow
                        key={record.id}
                        className={cn(
                          "hover:bg-slate-50 transition-colors",
                          isNtep && "bg-red-50/20"
                        )}
                      >
                        <TableCell className="pl-8 py-5">
                          <div>
                            <p className="font-black text-xs text-primary uppercase">
                              {record.employeeName}
                            </p>
                            <p className="text-[9px] text-slate-400 font-black uppercase">
                              {record.jobRole || "Não informado"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono text-[10px] border-none",
                                isNtep ? "bg-red-100 text-red-700" : "bg-white text-slate-400"
                              )}
                            >
                              {record.cid || "N/I"}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[180px] font-medium">
                              {record.disease}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-48 space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase">
                              <span className="text-slate-400">Progresso</span>
                              <span className="text-primary">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 border-primary text-primary h-9 px-4 text-[10px] font-black uppercase tracking-tight rounded-xl hover:bg-primary hover:text-white transition-all"
                                  onClick={() => setActiveWorkflowRecord(record)}
                                >
                                  <ClipboardList className="size-3.5" /> Gestão Nexo
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-[2.5rem] text-left">
                                <DialogHeader className="p-8 bg-primary text-white shrink-0 space-y-2">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <DialogTitle className="text-2xl font-headline font-black uppercase flex items-center gap-3">
                                        <ShieldCheck className="size-8 text-accent" /> Workflow de
                                        Gestão NTEP
                                      </DialogTitle>
                                      <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-[0.2em] text-left">
                                        Colaborador: {record.employeeName} | CID: {record.cid} |
                                        Monitoramento do dossiê preventivo.
                                      </DialogDescription>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-black uppercase text-white/40 mb-1">
                                        Status do Dossiê
                                      </p>
                                      <h2 className="text-3xl font-black text-accent">
                                        {progress}%
                                      </h2>
                                    </div>
                                  </div>
                                  <Progress value={progress} className="h-2 mt-2 bg-white/10" />
                                </DialogHeader>

                                <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
                                  <Tabs defaultValue="phase1" className="w-full">
                                    <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1.5 rounded-2xl h-16 mb-8">
                                      {NTEP_WORKFLOW_STEPS.map((phase) => (
                                        <TabsTrigger
                                          key={phase.id}
                                          value={phase.id}
                                          className="rounded-xl text-[9px] font-black uppercase tracking-widest leading-none"
                                        >
                                          {phase.id.replace("phase", "Fase ")}
                                        </TabsTrigger>
                                      ))}
                                    </TabsList>

                                    {NTEP_WORKFLOW_STEPS.map((phase) => (
                                      <TabsContent
                                        key={phase.id}
                                        value={phase.id}
                                        className="animate-in slide-in-from-bottom-4 duration-500"
                                      >
                                        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                                          <CardHeader className="bg-white border-b py-6">
                                            <CardTitle className="text-lg font-black text-primary uppercase text-left">
                                              {phase.title}
                                            </CardTitle>
                                            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-2 text-left">
                                              <User className="size-3" /> Responsável: {phase.role}
                                            </CardDescription>
                                          </CardHeader>
                                          <CardContent className="p-8 space-y-4">
                                            {phase.items.map((item) => {
                                              const isChecked =
                                                record.ntepWorkflow?.[item.id] === true;
                                              return (
                                                <div
                                                  key={item.id}
                                                  className={cn(
                                                    "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group",
                                                    isChecked
                                                      ? "bg-emerald-50 border-emerald-100"
                                                      : "bg-white border-slate-50 hover:border-primary/10"
                                                  )}
                                                  onClick={() =>
                                                    toggleChecklistItem(record, item.id)
                                                  }
                                                >
                                                  <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={() =>
                                                      toggleChecklistItem(record, item.id)
                                                    }
                                                    className="size-5 rounded-md border-slate-300"
                                                  />
                                                  <span
                                                    className={cn(
                                                      "text-xs font-bold leading-relaxed",
                                                      isChecked
                                                        ? "text-emerald-800"
                                                        : "text-slate-600"
                                                    )}
                                                  >
                                                    {item.label}
                                                  </span>
                                                  {isChecked && (
                                                    <CheckCircle2 className="size-4 text-emerald-500 ml-auto" />
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </CardContent>
                                        </Card>
                                      </TabsContent>
                                    ))}
                                  </Tabs>
                                </div>

                                <DialogFooter className="p-6 bg-white border-t shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
                                  <div className="text-[10px] font-black uppercase text-slate-400 italic flex items-center gap-2">
                                    <ArrowRight className="size-3 text-accent" /> "Dossiês blindados
                                    com AET e PGR geram êxito de 91% no INSS."
                                  </div>
                                  <div className="flex gap-2">
                                    {isClient && (
                                      <>
                                        <PDFDownloadLink
                                          document={
                                            <MedicalReferralReport
                                              data={record}
                                              company={companies?.find(
                                                (c) => c.id === record.companyId
                                              )}
                                              doctor={user}
                                            />
                                          }
                                          fileName={`Relatorio_INSS_${record.employeeName}.pdf`}
                                        >
                                          {({ loading }: { loading: boolean }) => (
                                            <Button
                                              variant="outline"
                                              className="border-primary text-primary h-12 rounded-xl gap-2 font-black uppercase text-[10px]"
                                              disabled={loading}
                                            >
                                              {loading ? (
                                                <Loader2 className="size-4 animate-spin" />
                                              ) : (
                                                <FileText className="size-4" />
                                              )}
                                              Laudo Médico
                                            </Button>
                                          )}
                                        </PDFDownloadLink>

                                        <PDFDownloadLink
                                          document={
                                            <NtepContestationReport
                                              data={record}
                                              company={companies?.find(
                                                (c) => c.id === record.companyId
                                              )}
                                              currentUser={user}
                                            />
                                          }
                                          fileName={`Contestacao_NTEP_${record.employeeName}.pdf`}
                                        >
                                          {({ loading }: { loading: boolean }) => (
                                            <Button
                                              className="bg-primary text-white h-12 rounded-xl gap-2 font-black uppercase text-[10px] shadow-xl"
                                              disabled={loading}
                                            >
                                              {loading ? (
                                                <Loader2 className="size-4 animate-spin" />
                                              ) : (
                                                <Scale className="size-4 text-accent" />
                                              )}
                                              Peça de Contestação NTEP
                                            </Button>
                                          )}
                                        </PDFDownloadLink>
                                      </>
                                    )}
                                  </div>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-slate-300 hover:text-red-600"
                              onClick={() => handleDeleteRecord(record)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-32 opacity-20 text-center">
                      <ShieldAlert className="size-16 mx-auto mb-4" />
                      <p className="font-black uppercase text-sm tracking-widest">
                        Nenhum registro no radar
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6 text-left">
          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <TrendingUp className="size-32 text-accent" />
            </div>
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="size-4" /> Insight Sentinela
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                <p className="text-3xl font-black text-accent mb-1">
                  {expertises?.filter((e) => checkNTEP(e.cid)).length || 0}
                </p>
                <p className="text-[10px] font-bold uppercase text-white/40 tracking-widest">
                  Casos sob Alerta de Nexo
                </p>
              </div>
              <p className="text-[11px] leading-relaxed italic text-white/60">
                "O monitoramento preventivo nas fases 1 e 2 do workflow reduz significativamente a
                aplicação indevida de benefícios acidentários."
              </p>
            </CardContent>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-4">
            <div className="size-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
              <Gavel className="size-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-primary uppercase">Efeito Jurídico</h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                "Contestações fundamentadas com laudos técnicos garantem a correta caracterização
                dos benefícios no INSS."
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
