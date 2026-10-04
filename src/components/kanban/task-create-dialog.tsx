"use client";

import * as React from "react";
import { TaskStatus, Priority, TaskType } from "@/types/schema";
import {
  Save,
  Loader2,
  Plus,
  ClipboardList,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  UserCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, where } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

interface TaskCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus: TaskStatus;
}

export function TaskCreateDialog({ isOpen, onOpenChange, initialStatus }: TaskCreateDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [isSaving, setIsSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    title: "",
    type: "pgr" as TaskType,
    status: initialStatus,
    priority: "medium" as Priority,
    companyId: "",
    responsibleId: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    cnae: "",
    riskDegree: 1,
    location: "",
  });

  React.useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({ ...prev, status: initialStatus, title: "", responsibleId: "" }));
    }
  }, [isOpen, initialStatus]);

  const { isGlobalStaff, authorizedCompanies } = useSgi();

  const companiesQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isGlobalStaff) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (authorizedCompanies && authorizedCompanies.length > 0) {
      return query(collection(db, "companies"), where("__name__", "in", authorizedCompanies));
    }
    return null;
  }, [db, isGlobalStaff, authorizedCompanies]);
  const { data: companies } = useCollection(companiesQuery);

  const providersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "providers"), orderBy("name", "asc"));
  }, [db]);
  const { data: providers } = useCollection(providersQuery);

  const handleSave = async () => {
    if (!db || !formData.companyId || !formData.title) {
      toast({
        variant: "destructive",
        title: "Campos Obrigatórios",
        description: "Informe o título e selecione a unidade.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const company = companies?.find((c) => c.id === formData.companyId);
      const responsible = providers?.find((p) => p.id === formData.responsibleId);
      const tasksRef = collection(db, "companies", formData.companyId, "tasks");

      await addDocumentNonBlocking(tasksRef, {
        ...formData,
        companyName: company?.name || "Unidade Técnica",
        responsibleName: responsible?.name || "A definir",
        createdAt: serverTimestamp(),
        progress: 0,
        checklist: [],
      });

      toast({ title: "Atividade Protocolada", description: "OS registrada com sucesso no SGI." });
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao Salvar" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0 border-none shadow-2xl flex flex-col bg-white">
        <SheetHeader className="p-8 bg-primary text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Sparkles className="size-32 text-accent" />
          </div>
          <div className="relative z-10 text-left space-y-2">
            <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em]">
              Nova Atividade SGI v2.7
            </Badge>
            <SheetTitle className="text-2xl font-headline font-black uppercase tracking-tight text-white leading-tight">
              Abertura de OS Técnica
            </SheetTitle>
            <SheetDescription className="text-white/60 font-medium italic text-xs">
              Preencha os dados técnicos para iniciar o workflow ágil.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-8 scrollbar-thin">
          <div className="space-y-8 pb-20 text-left">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Título da OS
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Renovação PGR - Setor A"
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold text-primary shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Unidade / Cliente
                  </label>
                  <Select
                    value={formData.companyId}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, companyId: v }))}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue placeholder="Selecione..." />
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
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Tipo
                  </label>
                  <Select
                    value={formData.type}
                    onValueChange={(v: TaskType) => setFormData((prev) => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pgr">PGR (NR-01)</SelectItem>
                      <SelectItem value="pcmso">PCMSO (NR-07)</SelectItem>
                      <SelectItem value="ltcat">LTCAT / Laudo</SelectItem>
                      <SelectItem value="treinamento">Treinamento</SelectItem>
                      <SelectItem value="esocial">eSocial</SelectItem>
                      <SelectItem value="comercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Responsável (Prestador)
                </label>
                <Select
                  value={formData.responsibleId}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, responsibleId: v }))}
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                    <div className="flex items-center gap-2">
                      <UserCheck className="size-3.5 text-primary/40" />
                      <SelectValue placeholder="Delegar para prestador..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {providers?.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
              <p className="text-[9px] font-black uppercase text-primary/40 tracking-widest flex items-center gap-2">
                <Layers className="size-3" /> Parâmetros de Conformidade
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                    CNAE Fiscal
                  </label>
                  <Input
                    value={formData.cnae}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cnae: e.target.value }))}
                    placeholder="00.00-0/00"
                    className="h-10 bg-white border-none rounded-lg text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                    Grau de Risco
                  </label>
                  <Input
                    type="number"
                    value={formData.riskDegree}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, riskDegree: Number(e.target.value) }))
                    }
                    className="h-10 bg-white border-none rounded-lg text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Prioridade
                </label>
                <Select
                  value={formData.priority}
                  onValueChange={(v: Priority) => setFormData((prev) => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Gargalo Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Data SLA
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 size-4 text-slate-300" />
                  <Input
                    type="date"
                    value={formData.dueDate.split("T")[0]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dueDate: new Date(e.target.value).toISOString(),
                      }))
                    }
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12 shadow-inner"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-8 bg-slate-50 border-t shrink-0">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
          >
            {isSaving ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Save className="size-5 text-accent" />
            )}
            Abrir Registro OS
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
