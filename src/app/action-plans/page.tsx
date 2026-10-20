"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { usePgrCollection, usePgrCompanies } from "@/hooks/use-pgr-workspace";
import { Plus, LayoutGrid, Brain, Activity, Building2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpsTask } from "@/types/schema";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { OPERATIONAL_COLUMNS } from "@/types/kanban";

export default function EnterpriseOpsHub() {
  const { user, role, companyId, tenantId } = useUser();
  return (
    <React.Suspense fallback={<div className="p-6">Carregando cards…</div>}>
      <EnterpriseOpsContent key={JSON.stringify([user?.uid, role, companyId, tenantId])} />
    </React.Suspense>
  );
}
function EnterpriseOpsContent() {
  const params = useSearchParams();
  const pgrSource = params.get("source") === "pgr";
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const creationLock = React.useRef(false),
    active = React.useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>(
    params.get("company") || "all"
  );
  const pgrTasks = usePgrCollection<OpsTask>(
    "tasks",
    selectedCompanyId === "all" ? null : selectedCompanyId,
    pgrSource
  );
  const pgrCompanies = usePgrCompanies(pgrSource);

  const [taskForm, setTaskForm] = React.useState<Partial<OpsTask>>({
    title: "",
    companyId: "",
    type: "vistoria",
    priority: "medium",
    status: "todo",
    assigneeId: "",
    dueDate: "",
  });

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile, error: profileError } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    return (
      role === "SUPER_ADMIN" ||
      (["ADMIN", "OPERATIONS"].includes(role) &&
        !profile.tenantId &&
        (!profile.companyId || profile.companyId === "nextcon"))
    );
  }, [profile]);

  const isProvider = React.useMemo(() => {
    if (!profile) return false;
    const role = (profile.role || "").toUpperCase();
    return ["PROVIDER", "ENGINEER", "DOCTOR"].includes(role);
  }, [profile]);

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !profile || pgrSource) return null;
    if (isGlobalAdmin) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (isProvider && profile.servedCompanies && profile.servedCompanies.length > 0) {
      return query(
        collection(db, "companies"),
        where("__name__", "in", profile.servedCompanies.slice(0, 10))
      );
    }
    if (profile.companyId) {
      return query(collection(db, "companies"), where("__name__", "==", profile.companyId));
    }
    return null;
  }, [db, profile, isGlobalAdmin, isProvider, pgrSource]);
  const {
    data: legacyCompanies,
    isLoading: legacyLoadingCompanies,
    error: companiesError,
  } = useCollection(companiesQuery);
  const companies = pgrSource ? pgrCompanies.data : legacyCompanies;
  const loadingCompanies = pgrSource ? pgrCompanies.loading : legacyLoadingCompanies;

  const tasksQuery = useMemoFirebase(() => {
    if (!db || !profile || pgrSource) return null;

    if (selectedCompanyId === "all" && isGlobalAdmin) {
      return query(collectionGroup(db, "tasks"), orderBy("dueDate", "asc"));
    }

    if (selectedCompanyId !== "all") {
      return query(
        collection(db, "companies", selectedCompanyId, "tasks"),
        orderBy("dueDate", "asc")
      );
    }

    if (isProvider && profile.servedCompanies && profile.servedCompanies.length > 0) {
      return query(
        collectionGroup(db, "tasks"),
        where("companyId", "in", profile.servedCompanies.slice(0, 10)),
        orderBy("dueDate", "asc")
      );
    }

    if (profile.companyId) {
      return query(
        collection(db, "companies", profile.companyId, "tasks"),
        orderBy("dueDate", "asc")
      );
    }

    return null;
  }, [db, profile, selectedCompanyId, isGlobalAdmin, isProvider, pgrSource]);

  const {
    data: legacyTasks,
    isLoading: legacyLoadingTasks,
    error: tasksError,
  } = useCollection<OpsTask>(tasksQuery);
  const tasks = pgrSource ? pgrTasks.data : legacyTasks;
  const loadingTasks = pgrSource ? pgrTasks.loading : legacyLoadingTasks;

  const operationalTasks = React.useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => ["started", "todo", "doing", "review", "done"].includes(t.status));
  }, [tasks]);

  const handleCreateTask = async () => {
    if (creationLock.current) return;
    if (
      !db ||
      !user ||
      !isGlobalAdmin ||
      !taskForm.title?.trim() ||
      !taskForm.companyId ||
      companiesError
    ) {
      toast({
        variant: "destructive",
        title: "Dados Incompletos",
        description: "Preencha o título e a unidade responsável.",
      });
      return;
    }
    const company = companies?.find((c) => c.id === taskForm.companyId);
    if (!company) return;
    const colRef = collection(db, "companies", taskForm.companyId, "tasks");

    const newTask: Partial<OpsTask> = {
      ...taskForm,
      companyName: company?.name || "Unidade Técnica",
      checklist: [
        { id: "1", text: "Realizar Check-in GPS", checked: false, mandatory: true },
        { id: "2", text: "Coletar Evidências de Risco", checked: false, mandatory: true },
      ],
    };
    creationLock.current = true;
    setIsCreating(true);
    try {
      await addDoc(colRef, {
        ...newTask,
        title: taskForm.title.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      if (!active.current) return;
      setIsCreateOpen(false);
      setTaskForm((previous) => ({ ...previous, title: "", companyId: "" }));
      toast({
        title: "Atividade Designada",
        description: `Gravação confirmada para ${company.name}. Defina o prazo e o responsável no card.`,
      });
    } catch {
      if (active.current)
        toast({
          variant: "destructive",
          title: "Gravação não confirmada",
          description:
            "Confira o quadro antes de repetir a criação. Os dados do formulário foram preservados.",
        });
    } finally {
      creationLock.current = false;
      if (active.current) setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-xl text-accent shadow-lg shadow-primary/20">
              <Activity className="size-6" />
            </div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tight font-headline">
              Cards Operação
            </h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <Brain className="size-4 text-accent" /> Gestão tática e designação de ordens de serviço
            externas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="bg-white border-muted h-11 text-xs">
                <Building2 className="size-4 mr-2" />
                <SelectValue placeholder={loadingCompanies ? "Carregando..." : "Filtrar Unidade"} />
              </SelectTrigger>
              <SelectContent>
                {!pgrSource && (isGlobalAdmin || isProvider) && (
                  <SelectItem value="all">Todas as Minhas Unidades</SelectItem>
                )}
                {companies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isGlobalAdmin && !pgrSource && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-nextcon text-white gap-2 h-14 px-8 font-black uppercase text-[10px] tracking-widest shadow-2xl rounded-2xl">
                  <Plus className="size-5" /> Designar OS
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] glass-panel border-none rounded-[2.5rem] p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-primary uppercase font-headline">
                    Nova Ordem de Serviço
                  </DialogTitle>
                  <DialogDescription className="font-bold text-[10px] uppercase tracking-[0.2em] text-accent">
                    Inteligência Operacional Nextcon
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Descrição da Vistoria
                    </label>
                    <Input
                      disabled={isCreating}
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      className="bg-slate-50 border-none h-14 text-sm font-bold rounded-2xl shadow-inner"
                      placeholder="Ex: Auditoria Técnica Unidade X"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Unidade Cliente
                    </label>
                    <Select
                      disabled={isCreating}
                      value={taskForm.companyId}
                      onValueChange={(v) => setTaskForm({ ...taskForm, companyId: v })}
                    >
                      <SelectTrigger className="bg-slate-50 border-none h-14 text-xs font-bold rounded-2xl">
                        <SelectValue placeholder="Selecione o cliente..." />
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
                </div>
                <Button
                  onClick={handleCreateTask}
                  disabled={isCreating || !!companiesError}
                  className="w-full h-16 gradient-nextcon font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl"
                >
                  <Zap className="size-5 text-accent mr-2" />{" "}
                  {isCreating ? "Confirmando gravação…" : "Criar ordem de serviço"}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      {!pgrSource && (profileError || companiesError || tasksError) && (
        <p role="alert" className="rounded border border-destructive p-4 text-sm">
          Não foi possível consultar a operação. Verifique sua permissão e atualize antes de
          continuar.
        </p>
      )}
      {pgrSource && (pgrTasks.error || pgrCompanies.error) && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {pgrTasks.error || pgrCompanies.error}
        </p>
      )}
      <div className="min-h-[600px] glass-panel rounded-[3rem] p-8 relative flex flex-col items-center justify-center">
        {loadingTasks ? (
          <div className="flex flex-col items-center justify-center gap-6 py-20">
            <div className="size-20 rounded-4xl bg-[#090e24] flex items-center justify-center text-white font-black text-4xl shadow-2xl animate-bounce">
              N
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 animate-pulse">
              Sincronizando Operações...
            </p>
          </div>
        ) : !pgrSource && (profileError || tasksError) ? (
          <p>O quadro está indisponível enquanto a consulta não for confirmada.</p>
        ) : operationalTasks.length > 0 ? (
          <div className="w-full h-full">
            <KanbanBoard
              tasks={operationalTasks}
              columns={OPERATIONAL_COLUMNS}
              boardType="operational"
            />
          </div>
        ) : (
          <div className="text-center opacity-30 space-y-4">
            <LayoutGrid className="size-16 mx-auto" />
            <p className="font-black uppercase text-xs tracking-widest">
              Nenhuma intervenção designada
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
