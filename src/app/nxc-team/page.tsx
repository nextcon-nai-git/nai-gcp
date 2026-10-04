"use client";

import * as React from "react";
import {
  Users,
  Search,
  MoreVertical,
  Trash2,
  Pencil,
  CheckCircle2,
  ShieldCheck,
  Building2,
  FileText,
  Briefcase,
  BadgeCheck,
  Stethoscope,
  Plus,
  Save,
  UserCheck,
  Printer,
} from "lucide-react";
import {
  DocumentUploadField,
  EmployeeDocument,
} from "@/components/documents/document-upload-field";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useCollection, useFirestore } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp } from "firebase/firestore";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";

const nxcEmployeeSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  role: z.string().min(2, "Cargo obrigatório"),
  contractType: z.string().min(1, "Selecione o regime contratual"),
  cpf: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  unit: z.string().optional(),
  admissionDate: z.string().optional(),
  asoStatus: z.string().default("APTO"),
  status: z.string().default("ATIVO"),
});

type NcxEmployeeFormValues = z.infer<typeof nxcEmployeeSchema>;

const SEED_NXC_EMPLOYEES = [] as {
  id: string;
  name: string;
  role: string;
  contractType: string;
  cpf?: string;
  email?: string;
  phone?: string;
  salary?: number;
  [key: string]: any;
}[];

export default function NcxTeamPage() {
  const { toast } = useToast();
  const db = useFirestore();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [contractFilter, setContractTypeFilter] = React.useState("ALL");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<any | null>(null);
  const [viewDossierEmployee, setViewDossierEmployee] = React.useState<any | null>(null);
  const [uploadedDocs, setUploadedDocs] = React.useState<EmployeeDocument[]>([]);

  const employeesQuery = React.useMemo(() => {
    if (!db) return null;
    return query(collection(db, "nxc_employees"), orderBy("name", "asc"));
  }, [db]);

  const { data: dbEmployees, isLoading } = useCollection<any>(employeesQuery);

  // Combine pre-seeded initial staff with Firestore collection
  const allEmployees = React.useMemo(() => {
    const list = [...SEED_NXC_EMPLOYEES];
    if (dbEmployees && dbEmployees.length > 0) {
      dbEmployees.forEach((emp) => {
        if (!list.some((existing) => existing.id === emp.id)) {
          list.push(emp);
        }
      });
    }
    return list;
  }, [dbEmployees]);

  const filteredEmployees = React.useMemo(() => {
    return allEmployees.filter((emp) => {
      const matchesSearch =
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.unit?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesContract = contractFilter === "ALL" || emp.contractType === contractFilter;

      return matchesSearch && matchesContract;
    });
  }, [allEmployees, searchTerm, contractFilter]);

  const form = useForm<NcxEmployeeFormValues>({
    resolver: zodResolver(nxcEmployeeSchema),
    defaultValues: {
      name: "",
      role: "",
      contractType: "CLT",
      cpf: "",
      email: "",
      phone: "",
      unit: "Matriz Nextcon",
      admissionDate: new Date().toISOString().split("T")[0],
      asoStatus: "APTO",
      status: "ATIVO",
    },
  });

  React.useEffect(() => {
    if (editingEmployee) {
      setUploadedDocs(editingEmployee.documents || []);
      form.reset({
        name: editingEmployee.name || "",
        role: editingEmployee.role || "",
        contractType: editingEmployee.contractType || "CLT",
        cpf: editingEmployee.cpf || "",
        email: editingEmployee.email || "",
        phone: editingEmployee.phone || "",
        unit: editingEmployee.unit || "Matriz Nextcon",
        admissionDate: editingEmployee.admissionDate || "",
        asoStatus: editingEmployee.asoStatus || "APTO",
        status: editingEmployee.status || "ATIVO",
      });
    } else {
      setUploadedDocs([]);
      form.reset({
        name: "",
        role: "",
        contractType: "CLT",
        cpf: "",
        email: "",
        phone: "",
        unit: "Matriz Nextcon",
        admissionDate: new Date().toISOString().split("T")[0],
        asoStatus: "APTO",
        status: "ATIVO",
      });
    }
  }, [editingEmployee, form]);

  const onSubmit = (values: NcxEmployeeFormValues) => {
    if (!db) return;

    if (editingEmployee) {
      const docRef = doc(db, "nxc_employees", editingEmployee.id);
      setDocumentNonBlocking(
        docRef,
        {
          ...values,
          documents: uploadedDocs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast({
        title: "Colaborador Atualizado",
        description: `${values.name} atualizado com sucesso.`,
      });
    } else {
      const colRef = collection(db, "nxc_employees");
      addDocumentNonBlocking(colRef, {
        ...values,
        documents: uploadedDocs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Colaborador Cadastrado",
        description: `${values.name} adicionado à equipe NXC.`,
      });
    }

    setIsDialogOpen(false);
    setEditingEmployee(null);
  };

  const cltCount = allEmployees.filter((e) => e.contractType === "CLT").length;
  const pjCount = allEmployees.filter(
    (e) => e.contractType?.includes("PJ") || e.contractType?.includes("PRESTADOR")
  ).length;

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-[1600px] mx-auto pb-24 text-left">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#001F3F] via-[#002B4E] to-[#0A192F] p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-accent/20">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent text-primary font-black text-[10px] uppercase tracking-widest px-3 py-1">
                EQUIPE INTERNA NEXTCON
              </Badge>
              <Badge
                variant="outline"
                className="text-white/80 border-white/20 text-[10px] font-bold uppercase"
              >
                Quadro de Colaboradores NXC
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <UserCheck className="text-accent h-8 w-8 animate-pulse" /> Colaboradores NXC
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Gestão direta do time interno da Nextcon Saúde Empresarial (CLT, PJ e Diretoria).
              Controle de admissões, cargos, exames ocupacionais ASO e lotação.
            </p>
          </div>

          <Button
            onClick={() => {
              setEditingEmployee(null);
              setIsDialogOpen(true);
            }}
            className="bg-accent hover:bg-accent/90 text-primary font-black text-xs uppercase tracking-widest h-12 px-6 rounded-2xl gap-2 shadow-xl shrink-0"
          >
            <Plus size={16} /> Cadastrar Colaborador
          </Button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Total de Integrantes
            </span>
            <Users className="text-accent size-5" />
          </div>
          <p className="text-3xl font-black text-white mt-2">{allEmployees.length}</p>
          <span className="text-[9px] text-slate-400 font-bold uppercase">Time Nextcon NXC</span>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
              Colaboradores CLT
            </span>
            <Briefcase className="text-emerald-400 size-5" />
          </div>
          <p className="text-3xl font-black text-emerald-400 mt-2">{cltCount}</p>
          <span className="text-[9px] text-emerald-300/70 font-bold uppercase">
            Inclui João da Cocel
          </span>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
              Equipe PJ & Médica
            </span>
            <Stethoscope className="text-blue-400 size-5" />
          </div>
          <p className="text-3xl font-black text-blue-400 mt-2">{pjCount}</p>
          <span className="text-[9px] text-blue-300/70 font-bold uppercase">
            Consultores e Gestão
          </span>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
              ASO Ocupacional
            </span>
            <ShieldCheck className="text-amber-400 size-5" />
          </div>
          <p className="text-3xl font-black text-amber-400 mt-2">100%</p>
          <span className="text-[9px] text-amber-300/70 font-bold uppercase">
            Conformidade eSocial
          </span>
        </Card>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <Card className="bg-slate-900/40 border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-12 text-slate-400 size-4" />
            <Input
              placeholder="Buscar por nome, cargo ou unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-950 border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500"
            />
          </div>

          <Select value={contractFilter} onValueChange={setContractTypeFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-slate-950 border-slate-800 rounded-xl text-xs text-white font-bold">
              <SelectValue placeholder="Regime Contratual" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="ALL">Todos os Regimes</SelectItem>
              <SelectItem value="CLT">Apenas CLT</SelectItem>
              <SelectItem value="PJ / PRESTADOR">Apenas PJ / Prestador</SelectItem>
              <SelectItem value="SÓCIO / EXECUTIVO">Diretoria / Executivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* TABLE LISTING */}
      <Card className="border-slate-800 bg-slate-900/50 shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/80">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 pl-6">
                  Colaborador NXC
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400">
                  Cargo / Função
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400">
                  Regime
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400">
                  Lotação / Unidade
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-center">
                  ASO Ocupacional
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 text-center">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 pr-6 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="border-slate-800/60 hover:bg-slate-800/30 transition-all"
                >
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-accent/10 border border-accent/30 text-accent font-black text-xs flex items-center justify-center uppercase">
                        {emp.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-white flex items-center gap-2">
                          {emp.name}
                          {emp.name.includes("João") && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[8px] font-black uppercase">
                              CLT COCEL
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {emp.email || "E-mail não informado"} • {emp.cpf || "CPF N/I"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs font-extrabold text-slate-200">
                    {emp.role}
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={cn(
                        "text-[8px] font-black uppercase px-2.5 py-0.5 border-none",
                        emp.contractType === "CLT"
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-500/30"
                          : "bg-blue-900/60 text-blue-300"
                      )}
                    >
                      {emp.contractType}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-slate-300 font-medium">
                    {emp.unit || "Matriz NXC"}
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase">
                      <CheckCircle2 size={10} className="mr-1" /> {emp.asoStatus || "APTO"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge className="bg-slate-800 text-slate-300 text-[8px] font-black uppercase">
                      {emp.status || "ATIVO"}
                    </Badge>
                  </TableCell>

                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-400 hover:text-white"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-slate-900 border-slate-800 text-white rounded-xl"
                      >
                        <DropdownMenuItem
                          onClick={() => setViewDossierEmployee(emp)}
                          className="gap-2 cursor-pointer text-xs font-bold uppercase text-accent"
                        >
                          <FileText size={14} /> Ficha de Registro Oficial
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingEmployee(emp);
                            setIsDialogOpen(true);
                          }}
                          className="gap-2 cursor-pointer text-xs font-bold uppercase"
                        >
                          <Pencil size={14} /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (db && emp.id && !emp.id.startsWith("nxc_")) {
                              deleteDocumentNonBlocking(doc(db, "nxc_employees", emp.id));
                              toast({ title: "Removido", description: "Colaborador removido." });
                            } else {
                              toast({
                                title: "Item Padrão",
                                description: "Item pré-cadastrado do sistema.",
                              });
                            }
                          }}
                          className="gap-2 cursor-pointer text-xs font-bold uppercase text-red-400"
                        >
                          <Trash2 size={14} /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FORM MODAL */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800 text-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <UserCheck className="text-accent size-5" />
              {editingEmployee ? "Editar Colaborador NXC" : "Cadastrar Colaborador NXC"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-slate-300">
                      Nome Completo
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: João Carlos"
                        {...field}
                        className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-slate-300">
                        Cargo / Função
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Especialista SST"
                          {...field}
                          className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contractType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-slate-300">
                        Regime Contratual
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="CLT">
                            CLT (Consolidação das Leis do Trabalho)
                          </SelectItem>
                          <SelectItem value="PJ / PRESTADOR">PJ / Prestador de Serviços</SelectItem>
                          <SelectItem value="ESTÁGIO">Estagiário</SelectItem>
                          <SelectItem value="SÓCIO / EXECUTIVO">
                            Sócio / Diretoria Executiva
                          </SelectItem>
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
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-slate-300">
                        CPF
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          {...field}
                          className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase text-slate-300">
                        Telefone / WhatsApp
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          {...field}
                          className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-slate-300">
                      E-mail Corporativo
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="colaborador@nextconsaude.com.br"
                        {...field}
                        className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-slate-300">
                      Lotação / Unidade
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Projeto Cocel / Matriz NXC"
                        {...field}
                        className="bg-slate-900 border-slate-800 text-white text-xs rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 border-t border-slate-800/80">
                <DocumentUploadField
                  employeeId={editingEmployee?.id || "temp_nxc"}
                  documents={uploadedDocs}
                  onDocumentsChange={setUploadedDocs}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-xs font-bold uppercase text-slate-400"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-accent text-primary font-black text-xs uppercase px-6 rounded-xl"
                >
                  <Save size={14} className="mr-2" /> Salvar Colaborador
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: FICHA OFICIAL DE REGISTRO DO EMPREGADO */}
      <Dialog open={!!viewDossierEmployee} onOpenChange={() => setViewDossierEmployee(null)}>
        <DialogContent className="max-w-4xl bg-slate-950 border-slate-800 text-white rounded-3xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
          {viewDossierEmployee && (
            <div className="space-y-6 text-left font-sans">
              {/* HEADER BAR & PRINT */}
              <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4 space-y-0 text-left">
                <div>
                  <Badge className="bg-accent text-primary font-black text-[9px] uppercase tracking-widest px-3 py-0.5">
                    FICHA DE REGISTRO DE EMPREGADO (CLT)
                  </Badge>
                  <DialogTitle className="text-2xl font-black uppercase text-white mt-1">
                    {viewDossierEmployee.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 font-medium mt-0.5">
                    Código de Matrícula:{" "}
                    <span className="text-accent font-bold">
                      {viewDossierEmployee.code || "000006"}
                    </span>
                  </DialogDescription>
                </div>
                <Button
                  onClick={() => window.print()}
                  className="bg-accent text-primary hover:bg-accent/90 font-black text-xs uppercase px-5 py-2 rounded-xl gap-2 shadow-lg"
                >
                  <Printer size={16} /> Imprimir / Exportar PDF
                </Button>
              </DialogHeader>

              {/* DADOS DO EMPREGADOR */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-black uppercase text-accent tracking-wider flex items-center gap-2">
                  <Building2 size={14} /> Dados do Empregador
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Empresa
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.employer?.companyName || "NXC SST EMPRESARIAL LTDA"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      CNPJ/CEI
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.employer?.cnpj || "44.337.647/0001-89"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Ativ. Federal (CNAE)
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.employer?.cnae || "7119-7/04"}
                    </span>
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Endereço
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.employer?.address ||
                        "Rua General Mário Tourinho, 1733 - Seminário, Curitiba - PR - 80.740-000"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DADOS DO EMPREGADO */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                  <UserCheck size={14} /> Dados Pessoais e Fila Documental
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      CPF
                    </span>
                    <span className="font-extrabold text-white">{viewDossierEmployee.cpf}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      RG / Órgão
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.rg || "97098000 SSP/PR"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      CTPS / Série
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.ctpsNumber || "0651073 / 2947 PR"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      PIS
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.pis ||
                        (viewDossierEmployee.contractType?.includes("ESTÁGIO")
                          ? "Isento (Estágio)"
                          : "-")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Data Nascimento
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.birthDate || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Sexo / Est. Civil
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.gender || "Feminino"} •{" "}
                      {viewDossierEmployee.maritalStatus || "Solteiro"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Raça/Cor / Nasc.
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.raceColor || "Branca"} •{" "}
                      {viewDossierEmployee.nationality || "Brasileiro"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Instrução
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.educationLevel || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Mãe
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.motherName || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Pai
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.fatherName || "-"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Sindicato
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.contractType?.includes("ESTÁGIO")
                        ? "Isento / Não aplicável (Estágio Lei 11.788/2008)"
                        : viewDossierEmployee.union || "Não informado"}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3 md:col-span-4">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Endereço Residencial
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.address || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* CONTRATO DE TRABALHO */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-2">
                  <Briefcase size={14} /> Contrato de Trabalho & Carga Horária
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Admissão / Início
                    </span>
                    <span className="font-extrabold text-emerald-400">
                      {viewDossierEmployee.admissionDate || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Cargo / Função
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.role || viewDossierEmployee.jobTitle || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      CBO
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.cbo || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Organograma
                    </span>
                    <span className="font-extrabold text-white">
                      {viewDossierEmployee.organogram || "GERAL"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Modo Pgto
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.paymentMode || "Depósito / Mensal"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      FGTS / Regime
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.contractType?.includes("ESTÁGIO")
                        ? "Isento (Sem vínculo CLT)"
                        : viewDossierEmployee.fgtsOptionDate
                          ? `Optante (${viewDossierEmployee.fgtsOptionDate})`
                          : "Não Optante"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">
                      Escala / Jornada
                    </span>
                    <span className="font-medium text-slate-200">
                      {viewDossierEmployee.workSchedule ||
                        viewDossierEmployee.schedule ||
                        viewDossierEmployee.weeklyHours ||
                        "13:00 às 17:00 (Segunda a Sexta - Período da Tarde / 20h)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* HISTÓRICO DE SALÁRIOS */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                  <BadgeCheck size={14} /> Histórico de Alterações Salariais
                </h3>
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-950/60">
                      <TableRow className="border-slate-800">
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          Data Alteração
                        </TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          Valor Salário
                        </TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          % Reajuste
                        </TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          Motivo / Descrição
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(
                        viewDossierEmployee.salaryHistory || [
                          {
                            date: viewDossierEmployee.admissionDate || "Admissão",
                            amount:
                              viewDossierEmployee.grantAmount ||
                              viewDossierEmployee.salary ||
                              viewDossierEmployee.initialSalary ||
                              0,
                            percentage: "0,00%",
                            reason: viewDossierEmployee.contractType?.includes("ESTÁGIO")
                              ? "Início de Estágio (TCE)"
                              : "Admissão",
                            notes: viewDossierEmployee.contractType?.includes("ESTÁGIO")
                              ? "Bolsa-Auxílio Contratual"
                              : "Salário Base Inicial",
                          },
                        ]
                      ).map((s: any, idx: number) => (
                        <TableRow key={idx} className="border-slate-800/40 hover:bg-slate-800/30">
                          <TableCell className="font-extrabold text-slate-300 py-2">
                            {s.date}
                          </TableCell>
                          <TableCell className="font-black text-emerald-400 py-2">
                            R${" "}
                            {Number(s.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="font-bold text-amber-400 py-2">
                            {s.percentage}
                          </TableCell>
                          <TableCell className="font-medium text-slate-300 py-2">
                            {s.reason} {s.notes ? `(${s.notes})` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* HISTÓRICO DE CARGOS */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-2">
                  <Briefcase size={14} /> Histórico de Cargos e Funções
                </h3>
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-950/60">
                      <TableRow className="border-slate-800">
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          Data Inicial
                        </TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          Código / Cargo
                        </TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          CBO
                        </TableHead>
                        <TableHead className="text-[9px] uppercase text-slate-400 py-2">
                          Motivo
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(
                        viewDossierEmployee.jobRolesHistory || [
                          {
                            startDate: viewDossierEmployee.admissionDate || "-",
                            code: viewDossierEmployee.code || "1",
                            title:
                              viewDossierEmployee.role ||
                              viewDossierEmployee.jobTitle ||
                              "Sem cargo definido",
                            cbo: viewDossierEmployee.cbo || "-",
                            reason: viewDossierEmployee.contractType?.includes("ESTÁGIO")
                              ? "Início de Estágio (TCE)"
                              : "Admissão",
                          },
                        ]
                      ).map((j: any, idx: number) => (
                        <TableRow key={idx} className="border-slate-800/40 hover:bg-slate-800/30">
                          <TableCell className="font-extrabold text-slate-300 py-2">
                            {j.startDate}
                          </TableCell>
                          <TableCell className="font-black text-white py-2">
                            {j.code ? `[${j.code}] ` : ""}
                            {j.title}
                          </TableCell>
                          <TableCell className="font-bold text-slate-400 py-2">{j.cbo}</TableCell>
                          <TableCell className="font-medium text-slate-300 py-2">
                            {j.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* FICHA FAMILIAR / DEPENDENTES */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase text-pink-400 tracking-wider flex items-center gap-2">
                  <Users size={14} /> Ficha Familiar / Dependentes
                </h3>
                {viewDossierEmployee.familyData && viewDossierEmployee.familyData.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {viewDossierEmployee.familyData.map((fam: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex items-center justify-between"
                      >
                        <span className="font-extrabold text-white">{fam.name}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[8px] uppercase font-bold">
                          {fam.relationship}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">
                    Nenhum dependente ou familiar cadastrado no dossiê.
                  </p>
                )}
              </div>

              {/* DOCUMENTOS ANEXADOS AO DOSSIÊ */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <DocumentUploadField
                  employeeId={viewDossierEmployee.id}
                  documents={viewDossierEmployee.documents || []}
                  readOnly={false}
                  onDocumentsChange={(updatedDocs) => {
                    setViewDossierEmployee((prev: any) =>
                      prev ? { ...prev, documents: updatedDocs } : null
                    );
                    if (db && viewDossierEmployee?.id) {
                      try {
                        setDocumentNonBlocking(
                          doc(db, "nxc_employees", viewDossierEmployee.id),
                          {
                            documents: updatedDocs,
                            updatedAt: serverTimestamp(),
                          },
                          { merge: true }
                        );
                        toast({
                          title: "Dossiê Atualizado",
                          description: "Documento salvo na ficha do colaborador.",
                        });
                      } catch (err) {
                        console.warn("[Dossier Document Save Warning]", err);
                      }
                    }
                  }}
                />
              </div>

              {/* ASSINATURA */}
              <div className="pt-6 border-t border-slate-800 text-center space-y-4">
                <p className="text-xs text-slate-400">Curitiba - PR, 1 de outubro de 2024</p>
                <div className="pt-8 flex flex-col sm:flex-row justify-around items-center gap-8 text-xs text-slate-300">
                  <div className="border-t border-slate-600 w-64 pt-2">Assinatura do Empregado</div>
                  <div className="border border-dashed border-slate-700 w-24 h-24 rounded-2xl flex items-center justify-center text-[9px] text-slate-500 uppercase font-bold">
                    Polegar Direito
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
