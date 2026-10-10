"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  MoreVertical,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Globe,
  Stethoscope,
  Calendar,
  AlertTriangle,
  HeartPulse,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  Activity,
  FileText,
  Clock,
  Building2,
  TrendingUp,
  BarChart3,
  Plus,
  Save,
  Paperclip,
} from "lucide-react";
import { DocumentUploadField } from "@/components/documents/document-upload-field";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCollection, useUser, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  collectionGroup,
  doc,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { extractEmployeesFromText } from "@/ai/flows/employee-extraction-flow";
import { extractDocumentAutofillData } from "@/ai/flows/document-ocr-autofill-flow";
import { useSearchParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSgi } from "@/contexts/sgi-context";
import { ExamHistoryChart } from "@/components/medical/exam-history-chart";
import { EXAM_REFERENCES } from "@/lib/exams-reference";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const employeeFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF deve estar no formato 000.000.000-00"),
  companyId: z.string().min(1, "Selecione uma unidade"),
  jobTitle: z.string().min(2, "Informe o cargo"),
  jobCbo: z.string().optional(),
  status: z.enum(["active", "leave", "fired"]),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

function EmployeesList() {
  const { user, role, companyId: userCompanyId, servedCompanies } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { activeClientId, isGlobalStaff, isAuthorizedProvider } = useSgi();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") || "";

  const [searchTerm, setSearchTerm] = React.useState(queryFromUrl);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isAiImportOpen, setIsAiImportOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [aiRawText, setAiRawText] = React.useState("");
  const [selectedEmployee, setSelectedEmployee] = React.useState<any | null>(null);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = React.useState<string[]>([]);

  const [isAddExamOpen, setIsAddExamOpen] = React.useState(false);
  const [newExam, setNewExam] = React.useState({
    code: "GLI",
    value: "",
    date: new Date().toISOString().split("T")[0],
  });

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !role) return null;
    if (isGlobalStaff) return query(collection(db, "companies"), orderBy("name", "asc"));
    if (isAuthorizedProvider && servedCompanies.length > 0)
      return query(collection(db, "companies"), where("__name__", "in", servedCompanies));
    if (userCompanyId)
      return query(collection(db, "companies"), where("__name__", "==", userCompanyId));
    return null;
  }, [db, userCompanyId, role, isGlobalStaff, isAuthorizedProvider, servedCompanies]);
  const { data: companies } = useCollection(companiesQuery);

  const employeesQuery = useMemoFirebase(() => {
    if (!db || !role || activeClientId === "unauthorized") return null;
    if (activeClientId === "all") {
      if (!isGlobalStaff) return null;
      return query(collectionGroup(db, "employees"));
    }
    return query(collection(db, "companies", activeClientId, "employees"), orderBy("name", "asc"));
  }, [db, activeClientId, role, isGlobalStaff]);

  const { data: employees, isLoading: loadingEmployees } = useCollection(employeesQuery);

  // Query para buscar exames do funcionário selecionado
  const examsQuery = useMemoFirebase(() => {
    if (!db || !selectedEmployee || !selectedEmployee.companyId) return null;
    return query(
      collection(
        db,
        "companies",
        selectedEmployee.companyId,
        "employees",
        selectedEmployee.id,
        "exams"
      ),
      orderBy("date", "desc")
    );
  }, [db, selectedEmployee]);
  const { data: employeeExams, isLoading: loadingExams } = useCollection(examsQuery);

  const handleAddExam = async () => {
    if (!db || !selectedEmployee || !newExam.value) return;

    try {
      const ref = EXAM_REFERENCES[newExam.code];
      const val = Number(newExam.value);
      const isAbnormal = val < ref.min || val > ref.max;

      const examsRef = collection(
        db,
        "companies",
        selectedEmployee.companyId,
        "employees",
        selectedEmployee.id,
        "exams"
      );
      await addDoc(examsRef, {
        examCode: newExam.code,
        examName: ref.name,
        value: val,
        unit: ref.unit,
        date: newExam.date,
        isAbnormal,
        referenceMin: ref.min,
        referenceMax: ref.max,
        createdAt: serverTimestamp(),
      });

      toast({ title: "Exame Registrado", description: `${ref.name} salvo no histórico.` });
      setIsAddExamOpen(false);
      setNewExam((prev) => ({ ...prev, value: "" }));
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    }
  };

  const getHealthStatus = (nextAsoDate?: string) => {
    if (!nextAsoDate) return { label: "Pendente", color: "text-slate-400 bg-slate-100" };
    const today = new Date();
    const nextDate = new Date(nextAsoDate);
    const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0)
      return { label: "Vencido", color: "text-red-700 bg-red-100", icon: AlertTriangle };
    if (diffDays <= 30)
      return { label: "A Vencer", color: "text-amber-700 bg-amber-100", icon: Clock };
    return { label: "Regular", color: "text-emerald-700 bg-emerald-100", icon: CheckCircle2 };
  };

  const handleDeleteEmployee = async (emp: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!db) return;

    const confirmDelete = window.confirm(
      `Deseja realmente excluir o colaborador ${emp.name}? Esta ação removerá o registro do Quadro de Vidas.`
    );
    if (!confirmDelete) return;

    // Optimistic removal from state
    setOptimisticDeletedIds((prev) => [...prev, emp.id]);

    try {
      const companyId = emp.companyId || activeClientId;
      if (!companyId || companyId === "all" || companyId === "unauthorized") {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: "Empresa do colaborador não identificada.",
        });
        return;
      }

      const empRef = doc(db, "companies", companyId, "employees", emp.id);
      await deleteDocumentNonBlocking(empRef);

      toast({
        title: "Colaborador Excluído! 🗑️",
        description: `${emp.name} foi removido do Quadro de Vidas.`,
      });
      if (selectedEmployee?.id === emp.id) {
        setSelectedEmployee(null);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível excluir o colaborador.",
      });
    }
  };

  const undefinedRoleEmployees = React.useMemo(() => {
    if (!employees) return [];
    return employees.filter((emp) => {
      if (optimisticDeletedIds.includes(emp.id)) return false;
      const rawRole = (emp.job_role?.title || emp.jobRole || emp.role || emp.cargo || "")
        .toLowerCase()
        .trim();
      return (
        !rawRole ||
        rawRole === "não definido" ||
        rawRole === "nao definido" ||
        rawRole === "não informado" ||
        rawRole === "cargo não definido" ||
        rawRole === "sem cargo"
      );
    });
  }, [employees, optimisticDeletedIds]);

  const handlePurgeUndefinedRoles = async () => {
    if (!db || undefinedRoleEmployees.length === 0) return;
    const confirmPurge = window.confirm(
      `Deseja realmente excluir todos os ${undefinedRoleEmployees.length} colaboradores com cargo não definido do Quadro de Vidas?`
    );
    if (!confirmPurge) return;

    const idsToPurge = undefinedRoleEmployees.map((e) => e.id);
    setOptimisticDeletedIds((prev) => [...prev, ...idsToPurge]);

    try {
      for (const emp of undefinedRoleEmployees) {
        const companyId = emp.companyId || activeClientId;
        if (companyId && companyId !== "all" && companyId !== "unauthorized") {
          const empRef = doc(db, "companies", companyId, "employees", emp.id);
          deleteDocumentNonBlocking(empRef);
        }
      }
      toast({
        title: "Limpeza de Cargos Concluída! 🗑️",
        description: `${idsToPurge.length} colaboradores sem cargo foram excluídos do Quadro de Vidas.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro ao limpar",
        description: "Ocorreu um problema ao excluir os colaboradores sem cargo.",
      });
    }
  };

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    const term = searchTerm.toLowerCase();
    return employees
      .filter((emp) => {
        if (optimisticDeletedIds.includes(emp.id)) return false;

        if (activeClientId && activeClientId !== "all" && activeClientId !== "unauthorized") {
          if (emp.companyId && emp.companyId !== activeClientId) return false;
        }

        // Excluir colaboradores com cargo não definido por padrão do quadro de vidas
        const rawRole = (emp.job_role?.title || emp.jobRole || emp.role || emp.cargo || "")
          .toLowerCase()
          .trim();
        const isRoleUndefined =
          !rawRole ||
          rawRole === "não definido" ||
          rawRole === "nao definido" ||
          rawRole === "não informado" ||
          rawRole === "cargo não definido" ||
          rawRole === "sem cargo";
        if (isRoleUndefined) {
          return false;
        }

        return (emp.name || "").toLowerCase().includes(term) || (emp.cpf || "").includes(term);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [employees, searchTerm, activeClientId, optimisticDeletedIds]);

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Quadro de Vidas
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest mt-2 flex items-center gap-2">
            <Stethoscope className="size-3 text-accent" /> Vigilância Médica e eSocial Compliance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {undefinedRoleEmployees.length > 0 && (
            <Button
              variant="outline"
              onClick={handlePurgeUndefinedRoles}
              className="border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-black uppercase text-[10px] tracking-widest h-12 px-5 rounded-xl gap-2 cursor-pointer shadow-sm"
            >
              <Trash2 className="size-4 text-red-500" /> Excluir ({undefinedRoleEmployees.length})
              Sem Cargo
            </Button>
          )}

          {isGlobalStaff && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsAiImportOpen(true)}
                className="border-primary text-primary font-black uppercase text-[10px] tracking-widest h-12 px-6 rounded-xl gap-2"
              >
                <Sparkles className="size-4 text-accent" /> Captura NAI (CNH/RG/ASO)
              </Button>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-primary text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl shadow-lg gap-2"
              >
                <UserPlus className="size-4 text-accent" /> Novo Colaborador
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-3.5 size-4 text-slate-300 group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Pesquisar por nome ou CPF..."
          className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-5 pl-8 text-left">
                  Colaborador
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-left">
                  Vencimento ASO
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">
                  Status Saúde
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-center">
                  Aptidão
                </TableHead>
                <TableHead className="text-right pr-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEmployees ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="pl-8 py-6">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const healthStatus = getHealthStatus(emp.nextAsoDate);
                  const StatusIcon = healthStatus.icon;

                  return (
                    <Sheet key={`${emp.companyId}_${emp.id}`}>
                      <SheetTrigger asChild>
                        <TableRow
                          className="hover:bg-slate-50/50 transition-colors group cursor-pointer border-b last:border-none"
                          onClick={() => setSelectedEmployee(emp)}
                        >
                          <TableCell className="pl-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="size-11 rounded-2xl bg-primary/5 flex items-center justify-center text-primary font-black text-sm shadow-inner shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                                {emp.name?.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-xs text-primary uppercase leading-tight">
                                  {emp.name}
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                                  Cargo: {emp.job_role?.title || "Não definido"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-black text-primary">
                              {emp.nextAsoDate
                                ? new Date(emp.nextAsoDate).toLocaleDateString("pt-BR")
                                : "---"}
                            </p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase border-none px-3 h-6",
                                healthStatus.color
                              )}
                            >
                              {StatusIcon && <StatusIcon className="size-2.5 mr-1" />}
                              {healthStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase border-none px-3 h-6",
                                emp.fitnessStatus === "Apto"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : emp.fitnessStatus === "Inapto"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-slate-100 text-slate-400"
                              )}
                            >
                              {emp.fitnessStatus || "PENDENTE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteEmployee(emp, e)}
                                title="Excluir Colaborador"
                                className="size-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                              <ChevronRight className="size-5 text-slate-200 group-hover:text-primary transition-colors" />
                            </div>
                          </TableCell>
                        </TableRow>
                      </SheetTrigger>

                      <SheetContent className="sm:max-w-2xl p-0 border-none shadow-2xl flex flex-col bg-white">
                        {emp && (
                          <>
                            <SheetHeader className="p-10 bg-primary text-white relative shrink-0">
                              <div className="absolute top-0 right-0 p-8 opacity-10">
                                <HeartPulse className="size-32 text-accent" />
                              </div>
                              <div className="relative z-10 text-left space-y-4">
                                <div className="flex items-center justify-between">
                                  <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em]">
                                    Prontuário Digital v2.8
                                  </Badge>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={(e) => handleDeleteEmployee(emp, e)}
                                    className="h-7 text-[9px] font-black uppercase tracking-widest gap-1 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md"
                                  >
                                    <Trash2 className="size-3" /> Excluir Colaborador
                                  </Button>
                                </div>
                                <div className="flex items-center gap-5">
                                  <div className="size-16 rounded-[1.5rem] bg-white/10 flex items-center justify-center text-3xl font-black border border-white/20 shadow-2xl">
                                    {emp.name?.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <SheetTitle className="text-2xl font-headline font-black uppercase tracking-tight text-white">
                                      {emp.name}
                                    </SheetTitle>
                                    <SheetDescription className="text-white/60 font-bold uppercase text-[10px] mt-1 tracking-widest">
                                      {emp.job_role?.title || "Não definido"} | CPF: {emp.cpf}
                                    </SheetDescription>
                                  </div>
                                </div>
                              </div>
                            </SheetHeader>

                            <Tabs
                              defaultValue="clinical"
                              className="flex-1 flex flex-col overflow-hidden"
                            >
                              <div className="px-10 pt-4 bg-slate-50/50 border-b">
                                <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 rounded-xl p-1">
                                  <TabsTrigger
                                    value="clinical"
                                    className="rounded-lg text-[10px] font-black uppercase tracking-widest"
                                  >
                                    Checklist Clínico
                                  </TabsTrigger>
                                  <TabsTrigger
                                    value="analytics"
                                    className="rounded-lg text-[10px] font-black uppercase tracking-widest gap-2"
                                  >
                                    <TrendingUp className="size-3" /> Histórico
                                  </TabsTrigger>
                                  <TabsTrigger
                                    value="docs"
                                    className="rounded-lg text-[10px] font-black uppercase tracking-widest gap-1.5"
                                  >
                                    <Paperclip className="size-3" /> Documentos CLT
                                  </TabsTrigger>
                                </TabsList>
                              </div>

                              <ScrollArea className="flex-1 p-10 text-left">
                                <TabsContent value="clinical" className="m-0 space-y-10 pb-20">
                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                                      <ClipboardList className="size-4 text-accent" /> Protocolo de
                                      Exame
                                    </h4>
                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                                      {/* ... Checklist existente ... */}
                                      <p className="text-[9px] text-slate-400 italic">
                                        Mapeamento de riscos e condutas clínicas.
                                      </p>
                                    </div>
                                  </div>
                                </TabsContent>

                                <TabsContent value="analytics" className="m-0 space-y-10 pb-20">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                                      <BarChart3 className="size-4 text-accent" /> Vigilância
                                      Analítica
                                    </h4>
                                    <Button
                                      size="sm"
                                      onClick={() => setIsAddExamOpen(true)}
                                      className="h-8 rounded-lg bg-primary text-white font-black uppercase text-[8px] gap-1.5"
                                    >
                                      <Plus className="size-3" /> Lançar Exame
                                    </Button>
                                  </div>

                                  {loadingExams ? (
                                    <div className="py-10 text-center opacity-20">
                                      <Loader2 className="animate-spin mx-auto" />
                                    </div>
                                  ) : employeeExams && employeeExams.length > 0 ? (
                                    <div className="space-y-12">
                                      {/* Gráficos Agrupados por Tipo */}
                                      {Array.from(
                                        new Set(employeeExams.map((e) => e.examCode))
                                      ).map((code) => (
                                        <ExamHistoryChart
                                          key={code}
                                          examCode={code}
                                          data={employeeExams.filter((e) => e.examCode === code)}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="py-20 text-center opacity-20 border-2 border-dashed rounded-3xl">
                                      <HeartPulse size={48} className="mx-auto mb-2" />
                                      <p className="text-[10px] font-black uppercase tracking-widest">
                                        Nenhum dado analítico protocolado
                                      </p>
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="docs" className="m-0 space-y-6 pb-20">
                                  <div className="p-2">
                                    <DocumentUploadField
                                      employeeId={emp.id}
                                      documents={emp.documents || []}
                                      onDocumentsChange={(updatedDocs) => {
                                        if (db && emp.id) {
                                          const targetCompanyId =
                                            emp.companyId ||
                                            userCompanyId ||
                                            activeClientId ||
                                            "c1";
                                          setDocumentNonBlocking(
                                            doc(
                                              db,
                                              "companies",
                                              targetCompanyId,
                                              "employees",
                                              emp.id
                                            ),
                                            {
                                              documents: updatedDocs,
                                            },
                                            { merge: true }
                                          );
                                        }
                                      }}
                                    />
                                  </div>
                                </TabsContent>
                              </ScrollArea>
                            </Tabs>

                            <SheetFooter className="p-10 bg-slate-50 border-t shrink-0">
                              <div className="flex gap-3 w-full">
                                <Button
                                  variant="outline"
                                  className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] border-primary text-primary"
                                >
                                  Editar Cadastro
                                </Button>
                                <Button className="flex-1 h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-2">
                                  <FileText className="size-4 text-accent" /> Abrir ASO Atual
                                </Button>
                              </div>
                            </SheetFooter>
                          </>
                        )}
                      </SheetContent>
                    </Sheet>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-24 text-center opacity-30 font-black uppercase text-[10px] tracking-widest"
                  >
                    Nenhum registro localizado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG DE LANÇAMENTO DE EXAME */}
      <Dialog open={isAddExamOpen} onOpenChange={setIsAddExamOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-8 bg-primary text-white">
            <DialogTitle className="text-xl font-headline font-black uppercase">
              Lançar Resultado
            </DialogTitle>
            <DialogDescription className="text-white/60 font-medium italic">
              Insira os valores técnicos do laudo recebido.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Tipo de Exame
              </label>
              <Select
                value={newExam.code}
                onValueChange={(v) => setNewExam((prev) => ({ ...prev, code: v }))}
              >
                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(EXAM_REFERENCES).map((ref) => (
                    <SelectItem
                      key={ref.code}
                      value={ref.code}
                      className="text-xs font-bold uppercase"
                    >
                      {ref.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Resultado ({EXAM_REFERENCES[newExam.code]?.unit})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={newExam.value}
                  onChange={(e) => setNewExam((prev) => ({ ...prev, value: e.target.value }))}
                  className="h-12 bg-slate-50 border-none rounded-xl font-black text-lg text-center shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Data da Coleta
                </label>
                <Input
                  type="date"
                  value={newExam.date}
                  onChange={(e) => setNewExam((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                />
              </div>
            </div>

            <Button
              onClick={handleAddExam}
              disabled={!newExam.value}
              className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
            >
              <Save className="size-4 text-accent" /> Salvar no Histórico Analítico
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG CAPTURA NAI CNH / RG / DOCUMENTOS */}
      <Dialog open={isAiImportOpen} onOpenChange={setIsAiImportOpen}>
        <DialogContent className="sm:max-w-[650px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-8 bg-primary text-white relative">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl text-accent">
                <Sparkles className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-headline font-black uppercase">
                  Pré-cadastro Neural (CNH / RG / ASO)
                </DialogTitle>
                <DialogDescription className="text-white/60 text-xs mt-1">
                  Cole ou envie o texto/dados do documento para extração automática via IA.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Conteúdo do Documento / CNH / RG
              </label>
              <Textarea
                placeholder="Cole o texto da CNH, RG ou Ficha de Registro aqui (Nome, CPF, CNH, Cargo, Validade...)..."
                className="min-h-[160px] bg-slate-50 border-none rounded-2xl p-4 font-mono text-xs shadow-inner"
                value={aiRawText}
                onChange={(e) => setAiRawText(e.target.value)}
              />
            </div>

            <Button
              disabled={isSubmitting || !aiRawText.trim()}
              onClick={async () => {
                if (!aiRawText.trim() || !db) return;
                setIsSubmitting(true);
                try {
                  const result = await extractDocumentAutofillData(
                    aiRawText,
                    "CNH",
                    await getActionIdToken()
                  );
                  if (result.nomeCompleto) {
                    const targetCompanyId =
                      activeClientId !== "all" && activeClientId !== "unauthorized"
                        ? activeClientId
                        : companies?.[0]?.id || "emp_default";
                    const cleanCpf = result.cpfCnpj.replace(/\D/g, "") || `cpf_${Date.now()}`;
                    const formattedCpf =
                      cleanCpf.length === 11
                        ? cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                        : result.cpfCnpj;

                    await addDoc(collection(db, "companies", targetCompanyId, "employees"), {
                      name: result.nomeCompleto,
                      cpf: formattedCpf,
                      companyId: targetCompanyId,
                      job_role: { title: result.cargoOuServico || "Não definido" },
                      status: "active",
                      cnhCategory: result.categoriaCnh,
                      cnhExpiration: result.dataValidade,
                      birthDate: result.dataNascimentoOuEmissao,
                      fitnessStatus: "Apto",
                      createdAt: serverTimestamp(),
                    });

                    toast({
                      title: "Pré-cadastro Realizado com Sucesso",
                      description: `Colaborador ${result.nomeCompleto} (${result.categoriaCnh ? `CNH ${result.categoriaCnh}` : "Documento Processado"}) registrado.`,
                    });
                    setIsAiImportOpen(false);
                    setAiRawText("");
                  } else {
                    toast({
                      variant: "destructive",
                      title: "Falha na Extração",
                      description: "Não foram encontrados dados de colaborador no texto.",
                    });
                  }
                } catch (e: any) {
                  toast({
                    variant: "destructive",
                    title: "Erro no Pré-cadastro",
                    description: e.message,
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
            >
              {isSubmitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5 text-accent" />
              )}
              Executar Pré-cadastro com Inteligência Artificial
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-20 text-center">
          <Loader2 className="animate-spin mx-auto opacity-20" />
        </div>
      }
    >
      <div className="pb-20 animate-in fade-in duration-500">
        <EmployeesList />
      </div>
    </React.Suspense>
  );
}
