"use client";

import * as React from "react";
import {
  Users,
  UserPlus,
  Search,
  Building2,
  Loader2,
  MoreVertical,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Copy,
  Zap,
  Globe,
} from "lucide-react";
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
  deleteDoc,
  where,
} from "firebase/firestore";
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { extractEmployeesFromText } from "@/ai/flows/employee-extraction-flow";

// Schema de validação eSocial Ready
const employeeFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF deve estar no formato 000.000.000-00"),
  companyId: z.string().min(1, "Selecione uma unidade"),
  jobTitle: z.string().min(2, "Informe o cargo"),
  jobCbo: z.string().optional(),
  status: z.enum(["active", "leave", "fired"]),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export default function EmployeesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isAiImportOpen, setIsAiImportOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiRawText, setAiRawText] = React.useState("");

  // 1. Perfil do Usuário para RBAC rigoroso
  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    const companyId = profile.companyId;
    return (
      ["SUPER_ADMIN", "ENGINEER", "DOCTOR", "ADMIN"].includes(role) &&
      (!companyId || companyId === "")
    );
  }, [profile]);

  // 2. Formulário de Cadastro
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
      cpf: "",
      companyId: "",
      jobTitle: "",
      jobCbo: "",
      status: "active",
    },
  });

  // Sincroniza empresa no formulário caso o usuário não seja Admin Global
  React.useEffect(() => {
    if (profile && !isGlobalAdmin && profile.companyId) {
      setSelectedCompanyId(profile.companyId);
      form.setValue("companyId", profile.companyId);
    }
  }, [profile, isGlobalAdmin, form]);

  // 3. Consultas Firestore protegidas
  const companiesQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;
    if (isGlobalAdmin) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (profile.companyId) {
      return query(collection(db, "companies"), where("__name__", "==", profile.companyId));
    }
    if (profile.servedCompanies && profile.servedCompanies.length > 0) {
      return query(
        collection(db, "companies"),
        where("__name__", "in", profile.servedCompanies.slice(0, 10))
      );
    }
    return null;
  }, [db, profile, isGlobalAdmin]);
  const { data: companies } = useCollection(companiesQuery);

  const employeesQuery = useMemoFirebase(() => {
    if (!db || !profile) return null;

    // Visão Global: Consulta por Collection Group (todos os funcionários de todos os clientes)
    if (isGlobalAdmin && selectedCompanyId === "all") {
      return query(collectionGroup(db, "employees"));
    }

    const companyIdToFilter = selectedCompanyId !== "all" ? selectedCompanyId : profile.companyId;

    if (companyIdToFilter === "all" && !isGlobalAdmin) return null;

    if (companyIdToFilter) {
      return query(
        collection(db, "companies", companyIdToFilter, "employees"),
        orderBy("name", "asc")
      );
    }

    return null;
  }, [db, profile, selectedCompanyId, isGlobalAdmin]);

  const { data: employees, isLoading: loadingEmployees } = useCollection(employeesQuery);

  // 4. Ações
  async function onSubmit(values: EmployeeFormValues) {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const targetColRef = collection(db, "companies", values.companyId, "employees");
      const newEmployee = {
        name: values.name.toUpperCase(),
        cpf: values.cpf,
        companyId: values.companyId,
        job_role: { title: values.jobTitle, cbo: values.jobCbo || "" },
        status: values.status,
        createdAt: new Date().toISOString(),
      };
      await addDocumentNonBlocking(targetColRef, newEmployee);
      toast({
        title: "Colaborador Cadastrado",
        description: `${values.name} foi inserido na base.`,
      });
      setIsCreateOpen(false);
      form.reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao Salvar" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAiImport() {
    if (!aiRawText.trim() || !db || !selectedCompanyId || selectedCompanyId === "all") {
      toast({
        variant: "destructive",
        title: "Configuração Incompleta",
        description: "Selecione uma unidade e cole o texto do documento.",
      });
      return;
    }

    setIsAiLoading(true);
    try {
      const result = await extractEmployeesFromText({ rawText: aiRawText });

      const targetColRef = collection(db, "companies", selectedCompanyId, "employees");

      for (const emp of result.employees) {
        await addDocumentNonBlocking(targetColRef, {
          name: emp.name,
          cpf: emp.cpf,
          companyId: selectedCompanyId,
          job_role: { title: emp.jobTitle, cbo: "" },
          status: "active",
          createdAt: new Date().toISOString(),
        });
      }

      toast({
        title: "Importação Concluída",
        description: `NAI processou ${result.count} colaboradores com ${result.qualityScore}% de precisão.`,
      });
      setIsAiImportOpen(false);
      setAiRawText("");
    } catch (e) {
      toast({ variant: "destructive", title: "Falha na Extração IA" });
    } finally {
      setIsAiLoading(false);
    }
  }

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    const term = searchTerm.toLowerCase();

    // Filtra por termo de busca
    let results = employees.filter(
      (emp) => (emp.name || "").toLowerCase().includes(term) || (emp.cpf || "").includes(term)
    );

    // Se estiver na visão global, ordena em memória para garantir consistência
    if (isGlobalAdmin && selectedCompanyId === "all") {
      results = [...results].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return results;
  }, [employees, searchTerm, isGlobalAdmin, selectedCompanyId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-black text-primary tracking-tight uppercase leading-none">
            Quadro de Vidas
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[9px] tracking-widest mt-2 flex items-center gap-2">
            <Users className="size-3 text-accent" /> Gestão consolidada de vidas sob vigilância
            SESMT.
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isAiImportOpen} onOpenChange={setIsAiImportOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5 font-black uppercase text-[10px] tracking-widest h-12 px-6 rounded-xl gap-2"
              >
                <Sparkles className="size-4 text-accent" /> Captura via NAI
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <div className="p-8 bg-primary text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Zap className="size-5 text-accent" />
                  </div>
                  <DialogTitle className="text-xl font-headline font-black uppercase">
                    Importação sem Certificado
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/70 font-medium">
                  Cole o texto de um PDF, Planilha ou Documento de RH para cadastro massivo.
                </DialogDescription>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Unidade Destino:
                  </label>
                  <Select
                    value={selectedCompanyId}
                    onValueChange={setSelectedCompanyId}
                    disabled={!isGlobalAdmin && !!profile?.companyId}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Conteúdo do Documento:
                  </label>
                  <Textarea
                    placeholder="Cole aqui a lista de nomes, CPFs e cargos..."
                    className="min-h-[200px] bg-slate-50 border-none rounded-2xl p-4 text-xs font-medium shadow-inner"
                    value={aiRawText}
                    onChange={(e) => setAiRawText(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAiImport}
                  disabled={isAiLoading || !aiRawText || selectedCompanyId === "all"}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
                >
                  {isAiLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Sparkles className="size-5 text-accent" />
                  )}
                  Ativar Extração Inteligente
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-primary hover:bg-accent/90 font-black uppercase text-[10px] tracking-widest h-12 px-8 rounded-xl shadow-lg shadow-accent/20 gap-2">
                <UserPlus className="size-4" /> Novo Individual
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <DialogHeader className="p-8 bg-primary text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <UserPlus className="size-5 text-accent" />
                  </div>
                  <DialogTitle className="text-xl font-headline font-black uppercase">
                    Admitir Colaborador
                  </DialogTitle>
                </div>
                <DialogDescription className="text-white/70 font-medium italic">
                  Preencha os dados básicos para iniciar a vigilância médica.
                </DialogDescription>
              </DialogHeader>
              <div className="p-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                            Nome Completo
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: JOÃO DA SILVA"
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
                        name="companyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Unidade
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              disabled={!isGlobalAdmin && !!profile?.companyId}
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
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="jobTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Cargo
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ex: PEDREIRO"
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
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400">
                              Status
                            </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="leave">Afastado</SelectItem>
                                <SelectItem value="fired">Desligado</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
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
                      Salvar Colaborador
                    </Button>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-3.5 size-4 text-slate-300 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Pesquisar por nome ou CPF..."
            className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {isGlobalAdmin && (
          <div className="w-full md:w-72">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="h-12 bg-white border-none shadow-sm rounded-xl font-bold uppercase text-[10px]">
                <Globe className="size-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Filtrar Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visão Global (Toda a Rede)</SelectItem>
                {companies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase py-5 pl-8">
                  Colaborador
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase">Cargo / CBO</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Unidade</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
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
                filteredEmployees.map((emp) => (
                  <TableRow
                    key={`${emp.companyId}_${emp.id}`}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                          {emp.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-xs uppercase leading-tight">
                            {emp.name}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                            {emp.cpf || "---"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-600 uppercase">
                          {emp.job_role?.title || "Não Definido"}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                          CBO: {emp.job_role?.cbo || "---"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] font-black text-slate-500 uppercase">
                        {companies?.find((c) => c.id === emp.companyId)?.name || "Nextcon Unidade"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase border-none px-3",
                          emp.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : emp.status === "leave"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        )}
                      >
                        {emp.status === "active"
                          ? "Ativo"
                          : emp.status === "leave"
                            ? "Afastado"
                            : "Desligado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full hover:bg-primary/5 text-slate-400"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-xl border-none shadow-2xl"
                        >
                          <DropdownMenuItem className="gap-2 text-xs font-bold py-3">
                            <Pencil className="size-3.5" /> Editar Cadastro
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!db || !emp.companyId) return;
                              if (window.confirm(`Remover ${emp.name}?`)) {
                                deleteDocumentNonBlocking(
                                  doc(db, "companies", emp.companyId, "employees", emp.id)
                                );
                                toast({ title: "Removido" });
                              }
                            }}
                            className="gap-2 text-xs font-bold text-red-600 py-3 focus:bg-red-50 focus:text-red-700"
                          >
                            <Trash2 className="size-3.5" /> Remover Vínculo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center opacity-30">
                    <AlertCircle className="size-16 mx-auto mb-4 text-primary" />
                    <p className="font-black uppercase text-sm tracking-widest">
                      Nenhum registro localizado
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
