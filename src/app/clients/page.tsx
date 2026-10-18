"use client";

import { Company } from "@/types/schema";
type ClientCompanyItem = Partial<Company> & Record<string, any>;

import * as React from "react";
import {
  Building2,
  Plus,
  Search,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Globe,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  CloudLightning,
  Target,
  Database,
  Sparkles,
  Phone,
  Mail,
  MoveRight,
  MoveLeft,
  MessageCircle,
  ArrowRight,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  where,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { enriquecerDadosEmpresa } from "@/actions/company-enrichment";
import { REAL_COMPANIES } from "@/lib/real-data";
import { getActionIdToken } from "@/lib/auth/action-token";
import { sortCompaniesByName } from "@/lib/company-order";

const companySchema = z.object({
  name: z.string().min(3, "Nome ou Razão Social obrigatória"),
  cnpj: z.string().min(11, "CNPJ inválido"),
  segment: z.string().min(1, "Segmento obrigatório"),
  cnae: z.string().optional().or(z.literal("")),
  cnaeDescricao: z.string().optional().or(z.literal("")),
  risk_degree: z.string().min(1, "Grau de risco obrigatório"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().min(2, "Estado obrigatório"),
  address: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  active: z.boolean().default(true),
  esocial_enabled: z.boolean().default(false),
});

type CompanyFormValues = z.infer<typeof companySchema>;

export default function ClientsManagement() {
  const profile = useUser();
  if (profile.isUserLoading) return <p role="status">Verificando acesso…</p>;
  if (!profile.user || profile.userError || !profile.role)
    return <p role="alert">Entre no NAI com uma sessão válida.</p>;
  return (
    <ClientsSession
      key={JSON.stringify([profile.user.uid, profile.role, profile.companyId, profile.tenantId])}
    />
  );
}
function ClientsSession() {
  const router = useRouter();
  const { toast } = useToast();
  const { role, companyId: userCompanyId } = useUser();
  const db = useFirestore();
  const { activeClientId, setActiveClientId, isGlobalStaff } = useSgi();

  const navigateToCockpit = React.useCallback(
    (cId: string) => {
      setActiveClientId(cId);
      const lower = cId.toLowerCase();
      if (lower === "cassi_matriz" || lower.includes("cassi")) {
        router.push("/clients/cassi");
      } else if (lower === "grupo_avp" || lower.includes("grupo-avp") || lower.includes("avp")) {
        router.push("/clients/grupo-avp");
      } else {
        router.push(`/clients/${encodeURIComponent(cId)}`);
      }
    },
    [router, setActiveClientId]
  );

  const [searchTerm, setSearchTerm] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState<any>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isFetchingReceita, setIsFetchingReceita] = React.useState(false);
  const mounted = React.useRef(true);
  const mutating = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const canManage =
    (isGlobalStaff && ["SUPER_ADMIN", "ADMIN"].includes(role || "")) ||
    (!!userCompanyId && ["ADMIN", "CLIENT_ADMIN"].includes(role || ""));
  const companiesQuery = useMemoFirebase(() => {
    if (!db || !role) return null;
    if (isGlobalStaff) return query(collection(db, "companies"), orderBy("name", "asc"));
    if (userCompanyId)
      return query(collection(db, "companies"), where("__name__", "==", userCompanyId));
    return null;
  }, [db, isGlobalStaff, userCompanyId, role]);

  const { data: companies, isLoading, error: loadError } = useCollection(companiesQuery);

  const activeCompaniesList = React.useMemo(
    () =>
      sortCompaniesByName(
        (companies || []).filter(
          (company) => company.isDeleted !== true && (isGlobalStaff || company.id === userCompanyId)
        )
      ),
    [companies, isGlobalStaff, userCompanyId]
  );

  const filteredCompanies = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    return activeCompaniesList.filter(
      (c: ClientCompanyItem) =>
        (showInactive || c.active !== false) &&
        ((c.name || c.companyName || "").toLowerCase().includes(term) ||
          (c.cnpj || "").includes(term) ||
          (c.segment || "").toLowerCase().includes(term) ||
          (c.city || "").toLowerCase().includes(term))
    );
  }, [activeCompaniesList, searchTerm, showInactive]);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      cnpj: "",
      segment: "GENERAL",
      cnae: "",
      cnaeDescricao: "",
      risk_degree: "1",
      city: "",
      state: "",
      address: "",
      email: "",
      phone: "",
      website: "",
      active: true,
      esocial_enabled: false,
    },
  });

  // Efeito para sincronizar os dados da empresa selecionada no formulário de edição
  React.useEffect(() => {
    if (editingCompany) {
      form.reset({
        name: editingCompany.name || editingCompany.razaoSocial || "",
        cnpj: editingCompany.cnpj || "",
        segment: editingCompany.segment || editingCompany.cnaeDescricao || "GENERAL",
        cnae: editingCompany.cnae || "",
        cnaeDescricao: editingCompany.cnaeDescricao || "",
        risk_degree: String(editingCompany.risk_degree || editingCompany.grauDeRisco || "1"),
        city: editingCompany.city || editingCompany.municipio || "",
        state: editingCompany.state || editingCompany.uf || "",
        address:
          editingCompany.address ||
          (editingCompany.logradouro
            ? `${editingCompany.logradouro}, ${editingCompany.numero || ""}`
            : ""),
        email: editingCompany.email || "",
        phone: editingCompany.phone || editingCompany.telefone || "",
        website: editingCompany.website || "",
        active: editingCompany.active ?? true,
        esocial_enabled: editingCompany.esocial_enabled ?? false,
      });
    } else {
      form.reset({
        name: "",
        cnpj: "",
        segment: "GENERAL",
        cnae: "",
        cnaeDescricao: "",
        risk_degree: "1",
        city: "",
        state: "",
        address: "",
        email: "",
        phone: "",
        website: "",
        active: true,
        esocial_enabled: false,
      });
    }
  }, [editingCompany, form]);

  // Consulta automática Receita Federal e Website via CNPJ
  async function handleFetchReceita() {
    const rawCnpj = form.getValues("cnpj");
    if (!rawCnpj || rawCnpj.replace(/\D/g, "").length !== 14) {
      toast({
        variant: "destructive",
        title: "CNPJ Inválido",
        description: "Digite um CNPJ válido com 14 dígitos.",
      });
      return;
    }

    setIsFetchingReceita(true);
    try {
      const res = await enriquecerDadosEmpresa(rawCnpj);
      if (!mounted.current) return;
      if (res.sucesso && res.dados) {
        const d = res.dados;
        form.setValue("name", d?.razaoSocial || d?.nomeFantasia || "");
        form.setValue("segment", d?.cnaeDescricao || "INDUSTRIA");
        form.setValue("cnae", d?.cnae || "");
        form.setValue("cnaeDescricao", d?.cnaeDescricao || "");
        form.setValue("risk_degree", String(d?.grauDeRisco || 1));
        form.setValue("city", d?.municipio || "");
        form.setValue("state", d?.uf || "");
        form.setValue("address", d?.enderecoFormatado || "");
        if (d?.email) form.setValue("email", d.email);
        if (d?.telefone) form.setValue("phone", d.telefone);
        if (d?.website) form.setValue("website", d.website);

        toast({
          title: "Dados Receita Federal Capturados",
          description: `Empresa ${d?.razaoSocial || "Consultada"} carregada com Grau de Risco ${d?.grauDeRisco || 1} (NR-04).`,
        });
      } else {
        toast({ variant: "destructive", title: "Erro na Consulta", description: res.mensagem });
      }
    } catch (e: any) {
      if (!mounted.current) return;
      toast({ variant: "destructive", title: "Erro na Consulta", description: e.message });
    } finally {
      if (mounted.current) setIsFetchingReceita(false);
    }
  }

  async function handleSave(values: CompanyFormValues) {
    if (!canManage || mutating.current || (!isGlobalStaff && editingCompany?.id !== userCompanyId))
      return;
    mutating.current = true;
    setIsSubmitting(true);
    try {
      const cleanCnpj = values.cnpj.replace(/\D/g, "");
      const targetId = editingCompany?.id || cleanCnpj || `comp_${Date.now()}`;

      const data = {
        ...values,
        id: targetId,
        risk_degree: Number(values.risk_degree) as 1 | 2 | 3 | 4,
        updatedAt: serverTimestamp(),
        version: "2.8",
        isDeleted: false,
        ...(!editingCompany ? { createdAt: serverTimestamp() } : {}),
      };

      if (isGlobalStaff) {
        const token = await getActionIdToken();
        if (!mounted.current) return;
        const response = await fetch("/api/admin/company-master", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...values,
            id: targetId,
            risk_degree: Number(values.risk_degree),
          }),
        });
        const result = await response.json();
        if (!response.ok || result.saved !== true)
          throw new Error(result.error || "Não foi possível confirmar o cadastro.");
      } else {
        if (!db) throw new Error("Conexão indisponível. Os dados não foram salvos.");
        const companyRef = doc(db, "companies", targetId);
        await runTransaction(db, async (tx) => {
          const current = await tx.get(companyRef);
          if (editingCompany && !current.exists())
            throw new Error("O cadastro não existe mais. Recarregue a lista.");
          tx.set(
            companyRef,
            {
              ...data,
              ...(!current.exists() || !current.data().createdAt
                ? { createdAt: serverTimestamp() }
                : {}),
            },
            { merge: true }
          );
        });
      }

      if (!mounted.current) return;
      toast({
        title: "Dados Mestre Atualizados",
        description: `Unidade ${values.name} sincronizada com sucesso.`,
      });
      setIsCreateOpen(false);
      setEditingCompany(null);
      form.reset();
    } catch (err: unknown) {
      if (!mounted.current) return;
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      mutating.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  }

  async function mutateCompany(action: () => Promise<void>, title: string) {
    if (!canManage || mutating.current) return;
    mutating.current = true;
    setIsSubmitting(true);
    try {
      if (!db) throw new Error("Conexão indisponível. Nenhuma alteração foi confirmada.");
      await action();
      if (mounted.current) toast({ title });
    } catch {
      if (mounted.current)
        toast({
          variant: "destructive",
          title: "Alteração não confirmada",
          description: "O cadastro foi mantido. Confira sua conexão e permissão e tente novamente.",
        });
    } finally {
      mutating.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  }
  async function handleDeleteCompany(companyId: string, _companyName: string) {
    await mutateCompany(async () => {
      await deleteDoc(doc(db!, "companies", companyId));
      if (mounted.current && activeClientId === companyId) setActiveClientId("all");
    }, "Cliente Excluído");
  }
  async function handleToggleActiveCompany(companyId: string, currentActive: boolean) {
    await mutateCompany(
      async () => {
        await updateDoc(doc(db!, "companies", companyId), {
          active: !currentActive,
          updatedAt: serverTimestamp(),
        });
      },
      currentActive ? "Cliente Inativado" : "Cliente Ativado"
    );
  }

  async function handleSyncCompanies() {
    if (!db || !canManage || !isGlobalStaff || mutating.current) return;
    mutating.current = true;
    setIsSubmitting(true);
    try {
      let created = 0;
      for (const comp of REAL_COMPANIES) {
        if (!mounted.current) return;
        const ref = doc(db, "companies", comp.id);
        const added = await runTransaction(db, async (tx) => {
          const current = await tx.get(ref);
          if (current.exists()) return false;
          tx.set(ref, { ...comp, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          return true;
        });
        if (added) created++;
      }
      if (!mounted.current) return;
      toast({
        title: "Clientes Sincronizados com Sucesso",
        description: `${created} cadastros ausentes foram criados. Os cadastros existentes foram preservados.`,
      });
    } catch (e: any) {
      if (!mounted.current) return;
      toast({ variant: "destructive", title: "Erro na Sincronização", description: e.message });
    } finally {
      mutating.current = false;
      if (mounted.current) setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5">
            MASTER DATA MANAGEMENT
          </Badge>
          <h1 className="text-3xl font-headline font-black text-primary uppercase leading-none text-left">
            Cadastro de Unidades
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2 flex items-center gap-2">
            <Database size={14} className="text-accent" /> Gestão Estratégica de Clientes & Gestos
            Touch.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleSyncCompanies}
            disabled={isSubmitting || !canManage}
            variant="outline"
            className="border-accent text-accent hover:bg-accent/10 h-12 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
          >
            <RefreshCw className={cn("size-4", isSubmitting && "animate-spin")} /> Sincronizar
            Clientes ({REAL_COMPANIES.length})
          </Button>
          <Button
            disabled={!canManage || !isGlobalStaff || isSubmitting}
            onClick={() => {
              setEditingCompany(null);
              setIsCreateOpen(true);
            }}
            className="gradient-nextcon text-white h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl"
          >
            <Plus size={16} className="mr-2" /> Nova Unidade
          </Button>
        </div>
      </header>

      <label className="flex items-center gap-3 rounded-xl border bg-white p-4">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
        />{" "}
        Mostrar também cadastros inativos
      </label>

      {/* DICA DE GESTOS SWIPE */}
      <div className="p-4 bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-bold text-slate-600">
        <div className="flex items-center gap-2">
          <MoveRight className="size-4 text-red-600" />
          <span>
            Arrastar para a Direita: <strong>Excluir Cliente (Sim / Não)</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MoveLeft className="size-4 text-amber-600" />
          <span>
            Arrastar para a Esquerda: <strong>Ativar / Inativar Cliente</strong>
          </span>
        </div>
      </div>

      {/* NOVO CLIENTE NACIONAL EM DESTAQUE: GRUPO AVP */}
      <Link href="/clients/grupo-avp" className="block group">
        <Card className="rounded-3xl border-2 border-blue-200/80 bg-gradient-to-br from-[#00172e] via-[#002244] to-[#0a325c] text-white p-6 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                  NOVA OPERAÇÃO ATIVA (01/09/2026)
                </Badge>
                <Badge className="bg-white/10 text-white font-black text-[9px] uppercase tracking-wider px-2.5 h-6 border-white/20">
                  300 POLOS • 5.079 VIDAS
                </Badge>
              </div>
              <h3 className="text-xl font-black font-headline uppercase text-white tracking-tight flex items-center gap-2">
                Grupo AVP — Centralização Nacional SST
              </h3>
              <p className="text-xs text-slate-300 font-medium max-w-2xl">
                Canais oficiais ativados: WhatsApp (41) 98716-8938 e e-mail oficial. SLA de
                agendamento em até 4h úteis e ASO no portal em 24-48h.
              </p>
            </div>

            <Button className="rounded-2xl bg-accent text-slate-950 font-black text-xs uppercase tracking-wider h-11 px-5 gap-2 shadow-lg group-hover:bg-emerald-400 shrink-0">
              <span>Abrir Portal Grupo AVP</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      </Link>

      {/* CLIENTE ESTRATÉGICO CONTRATUAL: CASSI BANCO DO BRASIL */}
      <Link href="/clients/cassi" className="block group">
        <Card className="rounded-3xl border-2 border-amber-400/40 bg-gradient-to-br from-[#002244] via-[#003366] to-[#0d223a] text-white p-6 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 h-6">
                  CONTRATO OFICIAL CASSI • PCMSO BB (2026/2027)
                </Badge>
                <Badge className="bg-white/10 text-white font-black text-[9px] uppercase tracking-wider px-2.5 h-6 border-white/20">
                  ANS Nº 34665-9 • AUTOGESTÃO
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase tracking-wider px-2.5 h-6 border border-emerald-500/40">
                  SLA RETORNO D0 • PAVAS • EPS BB
                </Badge>
              </div>
              <h3 className="text-xl font-black font-headline uppercase text-white tracking-tight flex items-center gap-2">
                CASSI — Caixa de Assistência dos Funcionários do Banco do Brasil
              </h3>
              <p className="text-xs text-slate-300 font-medium max-w-2xl">
                Operação médico-ambulatorial em saúde: EPS, Retorno ao Trabalho (SLA D0 no mesmo
                dia), atendimento PAVAS a vítimas de assalto, kit ambulatorial in company e
                faturamento TISS.
              </p>
            </div>

            <Button className="rounded-2xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider h-11 px-5 gap-2 shadow-lg group-hover:bg-amber-300 shrink-0">
              <span>Abrir Cockpit CASSI (Cards)</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </Card>
      </Link>

      <Link
        href="/financial/monthly-billing"
        className="inline-flex rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-primary"
      >
        Importar CNPJs e faturamento mensal por grupo
      </Link>
      <div className="relative group">
        <Search className="absolute left-4 top-3.5 size-5 text-slate-300 group-focus-within:text-primary transition-all" />
        <Input
          placeholder="Pesquisar por Unidade, Razão Social, CNPJ ou Cidade..."
          className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loadError && (
        <p role="alert">
          Não foi possível carregar os clientes autorizados. Recarregue para tentar novamente.
        </p>
      )}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-24 text-center bg-white rounded-[2.5rem] shadow-sm">
            <Loader2 className="size-12 animate-spin mx-auto opacity-20 text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">
              Carregando Clientes...
            </p>
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <SwipeableCompanyRow
              key={company.id}
              company={company}
              disabled={!canManage || isSubmitting}
              activeClientId={activeClientId}
              onSelect={() => navigateToCockpit(company.id)}
              onOpenCockpit={() => navigateToCockpit(company.id)}
              onEdit={() => {
                setEditingCompany(company);
                setIsCreateOpen(true);
              }}
              onDelete={() => handleDeleteCompany(company.id, company.name)}
              onToggleActive={() => handleToggleActiveCompany(company.id, company.active ?? true)}
            />
          ))
        )}

        {(!filteredCompanies || filteredCompanies.length === 0) && !isLoading && (
          <div className="py-24 text-center bg-white rounded-[2.5rem] shadow-sm opacity-40">
            <Building2 className="size-12 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
              Nenhum cliente cadastrado ou encontrado na busca
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (isSubmitting || isFetchingReceita) return;
          setIsCreateOpen(open);
          if (!open) setEditingCompany(null);
        }}
      >
        <DialogContent className="max-w-[94vw] sm:max-w-[750px] max-h-[92vh] rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white text-left flex flex-col">
          <DialogHeader className="p-6 sm:p-10 bg-primary text-white space-y-3 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Target size={120} className="text-accent" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-accent">
                <Building2 size={24} />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-headline font-black uppercase tracking-tight">
                {editingCompany ? "Editar Master Data do Cliente" : "Registrar Nova Unidade"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 font-medium italic text-xs sm:text-sm">
              Preenchimento com inteligência de dados da Receita Federal e conformidade eSocial.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 sm:p-10 max-h-[72vh] overflow-y-auto scrollbar-thin space-y-6 flex-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 w-full">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            CNPJ do Cliente (14 dígitos)
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ex: 00.000.000/0001-00"
                              className="h-12 bg-white border-none rounded-xl font-mono font-bold shadow-inner"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleFetchReceita}
                    disabled={isFetchingReceita}
                    className="h-12 px-6 bg-primary text-accent font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg gap-2 shrink-0"
                  >
                    {isFetchingReceita ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Buscar na Receita Federal
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Razão Social / Nome Fantasia
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase shadow-inner"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="segment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Atividade Principal / CNAE
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase shadow-inner"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="risk_degree"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Grau de Risco (NR-04)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            max="4"
                            className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner text-center text-red-600"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Cidade / Município
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase shadow-inner"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          UF (Estado)
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            maxLength={2}
                            className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase shadow-inner text-center"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Endereço Completo
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Logradouro, número, bairro..."
                          className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase shadow-inner"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          E-mail Comercial
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="contato@empresa.com.br"
                            className="h-12 bg-slate-50 border-none rounded-xl font-medium shadow-inner"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Telefone Comercial
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="(00) 0000-0000"
                            className="h-12 bg-slate-50 border-none rounded-xl font-medium shadow-inner"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                          Website Oficial
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://www.empresa.com.br"
                            className="h-12 bg-slate-50 border-none rounded-xl font-medium shadow-inner"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-[2.5rem] flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-xl">
                      <CloudLightning size={20} className="text-accent" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-primary uppercase leading-none mb-1">
                        eSocial Persistence API
                      </h4>
                      <p className="text-[9px] text-slate-500 font-medium italic">
                        Sincronização mestre de dados de SST e NR-04.
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="esocial_enabled"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !canManage}
                  className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-[1.01] active:scale-95"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ShieldCheck size={20} className="text-accent mr-3" />
                  )}
                  {editingCompany ? "Salvar Alterações Mestre" : "Protocolar Registro Mestre"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Componente com suporte a gestos Swipe (Touch & Mouse Drag)
 * Arrastar para a Direita ➔ Opção Excluir (Sim / Não)
 * Arrastar para a Esquerda ⬅ Opção Ativar / Inativar
 */
function SwipeableCompanyRow({
  disabled = false,
  company,
  activeClientId,
  onSelect,
  onOpenCockpit,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  disabled?: boolean;
  company: ClientCompanyItem;
  activeClientId: string;
  onSelect: () => void;
  onOpenCockpit: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startXRef = React.useRef(0);
  const [activeAction, setActiveAction] = React.useState<"none" | "delete" | "toggle">("none");

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startXRef.current;
    const clamped = Math.max(-240, Math.min(260, diff));
    setDragOffset(clamped);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset > 65) {
      setActiveAction("delete");
      setDragOffset(260);
    } else if (dragOffset < -65) {
      setActiveAction("toggle");
      setDragOffset(-220);
    } else {
      setActiveAction("none");
      setDragOffset(0);
    }
  };

  const resetSwipe = () => {
    setActiveAction("none");
    setDragOffset(0);
  };

  const isCompanyActive = company.active ?? true;

  return (
    <div className="relative overflow-hidden rounded-2xl my-2 border bg-slate-50/50 shadow-sm transition-all select-none">
      {/* BACKGROUND SWIPE DIREITA -> EXCLUIR (SIM / NÃO) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={cn(
          "absolute inset-y-0 left-0 bg-red-600 text-white flex items-center justify-between px-6 transition-all font-black text-xs uppercase z-20 pointer-events-auto",
          dragOffset > 0 ? "w-full opacity-100" : "w-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3">
          <Trash2 size={20} className="animate-pulse text-white" />
          <span className="truncate max-w-[200px]">Excluir "{company.name}"?</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            className="bg-white text-red-700 hover:bg-red-50 font-black text-xs uppercase h-9 px-5 rounded-xl shadow-lg cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) onDelete();
              resetSwipe();
            }}
          >
            SIM
          </Button>
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            variant="outline"
            className="border-white/40 text-white hover:bg-white/20 font-black text-xs uppercase h-9 px-4 rounded-xl cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              resetSwipe();
            }}
          >
            NÃO
          </Button>
        </div>
      </div>

      {/* BACKGROUND SWIPE ESQUERDA -> ATIVAR / INATIVAR */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={cn(
          "absolute inset-y-0 right-0 text-white flex items-center justify-between px-6 transition-all font-black text-xs uppercase z-20 pointer-events-auto",
          isCompanyActive ? "bg-amber-600" : "bg-emerald-600",
          dragOffset < 0 ? "w-full opacity-100" : "w-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 ml-auto pr-1">
          <span className="text-[10px] text-white/90">
            Status: <strong className="underline">{isCompanyActive ? "ATIVO" : "INATIVO"}</strong>
          </span>
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            className="bg-white text-slate-900 hover:bg-slate-100 font-black text-xs uppercase h-9 px-5 rounded-xl shadow-lg cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) onToggleActive();
              resetSwipe();
            }}
          >
            {isCompanyActive ? "INATIVAR" : "ATIVAR"}
          </Button>
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            variant="outline"
            className="border-white/40 text-white hover:bg-white/20 font-black text-xs uppercase h-9 px-4 rounded-xl cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              resetSwipe();
            }}
          >
            FECHAR
          </Button>
        </div>
      </div>

      {/* CARD CONTEÚDO PRINCIPAL */}
      <div
        style={{ transform: `translateX(${dragOffset}px)` }}
        className={cn(
          "relative z-10 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-grab active:cursor-grabbing transition-transform duration-150 border-none",
          isDragging && "transition-none",
          activeClientId === company.id && "bg-blue-50/40 border-l-8 border-l-primary"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => {
          if (activeAction === "none" && Math.abs(dragOffset) < 5) {
            onSelect();
          }
        }}
      >
        <div className="flex items-center gap-4 flex-1 text-left">
          <div
            className={cn(
              "size-12 rounded-[1.25rem] flex items-center justify-center font-black text-sm shadow-inner shrink-0",
              activeClientId === company.id
                ? "bg-primary text-white shadow-lg"
                : "bg-primary/5 text-primary"
            )}
          >
            {activeClientId === company.id ? (
              <ShieldCheck size={20} />
            ) : (
              (company.name || "UN").substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-primary uppercase">{company.name}</h3>
              <Badge
                className={cn(
                  "text-[8px] font-black uppercase border-none px-2 h-4",
                  isCompanyActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {isCompanyActive ? "ATIVO" : "INATIVO"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase flex-wrap">
              <span>CNPJ: {company.cnpj || "Sem CNPJ"}</span>
              {company.city && (
                <span>
                  • {company.city} - {company.state}
                </span>
              )}
              {company.email && (
                <span className="text-slate-500 flex items-center gap-1">
                  <Mail size={10} /> {company.email}
                </span>
              )}
              {company.phone && (
                <span className="text-slate-500 flex items-center gap-1">
                  <Phone size={10} /> {company.phone}
                </span>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 font-bold flex items-center gap-1 hover:underline"
                >
                  <Globe size={10} /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[9px] font-black uppercase border-red-100 text-red-700 bg-red-50 px-2.5 h-6"
            >
              GRAU {company.risk_degree || company.grauDeRisco || 1}
            </Badge>
            <Badge
              variant="outline"
              className="text-[8px] font-bold uppercase border-slate-200 text-slate-500 bg-slate-50 px-2 h-6 truncate max-w-[130px]"
            >
              {company.segment || "Geral"}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-primary border-primary/20 hover:bg-primary hover:text-white transition-all gap-1 shadow-sm shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCockpit();
              }}
              title="Abrir Cockpit de Engenharia e Saúde do Cliente"
            >
              <Activity size={12} className="text-amber-500" /> Cockpit
            </Button>
            {company.phone && (
              <a
                href={`https://wa.me/55${company.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Falo em nome da Nextcon Saúde Empresarial NAI. Como posso ajudar com a gestão de SST e eSocial da empresa ${company.name}?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all hover:scale-105 shrink-0"
              >
                <MessageCircle size={12} /> WhatsApp
              </a>
            )}
            <Button
              disabled={disabled}
              aria-label={`Editar ${company.name}`}
              size="icon"
              variant="ghost"
              className="size-9 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-100"
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onEdit();
              }}
            >
              <Pencil size={16} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-100"
                >
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border-none shadow-2xl p-2"
              >
                <DropdownMenuItem
                  className="gap-3 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCockpit();
                  }}
                >
                  <Activity size={14} className="text-amber-500" /> Abrir Cockpit do Cliente
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-3 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onEdit();
                  }}
                >
                  <Pencil size={14} /> Editar Dados Mestre
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-3 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onToggleActive();
                  }}
                >
                  <RefreshCw size={14} />{" "}
                  {isCompanyActive ? "Inativar Cadastro" : "Ativar Cadastro"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-3 py-3 text-[10px] font-black uppercase tracking-widest cursor-pointer text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled) onDelete();
                  }}
                >
                  <Trash2 size={14} /> Excluir Registro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
