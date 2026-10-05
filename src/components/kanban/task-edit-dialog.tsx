"use client";

import * as React from "react";
import { OpsTask, TaskStatus, Priority, TaskType } from "@/types/schema";
import {
  X,
  Save,
  Loader2,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  UserCheck,
  FileUp,
  FileText,
  History,
  ExternalLink,
  Paperclip,
  Pencil,
  Bot,
  Zap,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useStorage, useUser } from "@/firebase";
import { updatePgrTask } from "@/hooks/use-pgr-workspace";
import { doc, collection, query, orderBy, where } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";
import { STORAGE_PATHS } from "@/lib/storage-paths";
import { PgrAgentReview } from "@/components/pgr-agent-review";

interface TaskEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  task: OpsTask;
}

export function TaskEditDialog({ isOpen, onOpenChange, task }: TaskEditDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const db = useFirestore();
  const storage = useStorage();
  const [isSaving, setIsSaving] = React.useState(false);
  const [editedTask, setEditedTask] = React.useState<OpsTask>(task);
  const [newChecklistItem, setNewChecklistItem] = React.useState("");

  const [isUploadingOld, setIsUploadingOld] = React.useState(false);
  const [isUploadingNew, setIsUploadingNew] = React.useState(false);

  React.useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const { isGlobalStaff, authorizedCompanies } = useSgi();

  const companiesQuery = useMemoFirebase(() => {
    if (!db || task.sourceType === "pgr") return null;
    if (isGlobalStaff) {
      return query(collection(db, "companies"), orderBy("name", "asc"));
    }
    if (authorizedCompanies && authorizedCompanies.length > 0) {
      return query(collection(db, "companies"), where("__name__", "in", authorizedCompanies));
    }
    return null;
  }, [db, isGlobalStaff, authorizedCompanies, task.sourceType]);
  const { data: companies } = useCollection(companiesQuery);

  const providersQuery = useMemoFirebase(() => {
    if (!db || task.sourceType === "pgr") return null;
    return query(collection(db, "providers"), orderBy("name", "asc"));
  }, [db, task.sourceType]);
  const { data: providers } = useCollection(providersQuery);

  const handleUpdateField = (field: keyof OpsTask, value: any) => {
    setEditedTask((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (type: "old" | "new", file: File) => {
    if (!storage || !task.companyId) return;

    const isOld = type === "old";
    isOld ? setIsUploadingOld(true) : setIsUploadingNew(true);

    try {
      const path = STORAGE_PATHS.CLIENT_SST_NR(
        task.companyId,
        "nr01_pgr",
        `${isOld ? "antigo_" : "novo_"}${Date.now()}_${file.name}`
      );

      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      const field = isOld ? "oldPgrUrl" : "newPgrUrl";
      handleUpdateField(field, url);

      toast({
        title: "Documento Carregado",
        description: `O ${isOld ? "PGR Antigo" : "PGR Novo"} foi sincronizado com o storage do cliente.`,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no Upload" });
    } finally {
      isOld ? setIsUploadingOld(false) : setIsUploadingNew(false);
    }
  };

  const toggleChecklistItem = (index: number) => {
    const newChecklist = [...(editedTask.checklist || [])];
    newChecklist[index].checked = !newChecklist[index].checked;

    const checkedCount = newChecklist.filter((item) => item.checked).length;
    const progress = Math.round((checkedCount / newChecklist.length) * 100);

    setEditedTask((prev) => ({
      ...prev,
      checklist: newChecklist,
      progress: progress,
    }));
  };

  const updateChecklistItemText = (index: number, text: string) => {
    const newChecklist = [...(editedTask.checklist || [])];
    newChecklist[index].text = text;
    setEditedTask((prev) => ({ ...prev, checklist: newChecklist }));
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const newItem = { text: newChecklistItem, checked: false };
    const newChecklist = [...(editedTask.checklist || []), newItem];

    const checkedCount = newChecklist.filter((item) => item.checked).length;
    const progress = Math.round((checkedCount / newChecklist.length) * 100);

    setEditedTask((prev) => ({
      ...prev,
      checklist: newChecklist,
      progress: progress,
    }));
    setNewChecklistItem("");
  };

  const removeChecklistItem = (index: number) => {
    const newChecklist = editedTask.checklist?.filter((_, i) => i !== index) || [];
    const checkedCount = newChecklist.filter((item) => item.checked).length;
    const progress =
      newChecklist.length > 0 ? Math.round((checkedCount / newChecklist.length) * 100) : 0;

    setEditedTask((prev) => ({
      ...prev,
      checklist: newChecklist,
      progress: progress,
    }));
  };

  const handleSave = async () => {
    if (!db || !task.companyId) return;
    setIsSaving(true);
    try {
      const taskRef = doc(db, "companies", task.companyId, "tasks", task.id);
      const responsible = providers?.find((p) => p.id === editedTask.responsibleId);

      const updateData = {
        title: editedTask.title,
        type: editedTask.type,
        status: editedTask.status,
        priority: editedTask.priority,
        companyId: editedTask.companyId,
        companyName:
          companies?.find((c) => c.id === editedTask.companyId)?.name || editedTask.companyName,
        responsibleId: editedTask.responsibleId || "",
        responsibleName: responsible?.name || editedTask.responsibleName || "A definir",
        dueDate: editedTask.dueDate,
        cnae: editedTask.cnae || "",
        riskDegree: Number(editedTask.riskDegree) || 1,
        location: editedTask.location || "",
        checklist: editedTask.checklist || [],
        progress: editedTask.progress || 0,
        lastComment: editedTask.lastComment || "",
        oldPgrUrl: editedTask.oldPgrUrl || "",
        newPgrUrl: editedTask.newPgrUrl || "",
        agentEnabled: editedTask.agentEnabled || false,
      };

      if (task.sourceType === "pgr") {
        if (!user) throw new Error("Entre novamente para salvar este card.");
        if (editedTask.companyId !== task.companyId)
          throw new Error("O cliente do card é definido pelo PGR e não pode ser trocado aqui.");
        await updatePgrTask(user, task.companyId, task.id, {
          title: updateData.title,
          status: updateData.status,
          priority: updateData.priority,
          responsibleId: updateData.responsibleId,
          responsibleName: updateData.responsibleName,
          dueDate: updateData.dueDate,
          checklist: updateData.checklist,
          lastComment: updateData.lastComment,
        });
      } else updateDocumentNonBlocking(taskRef, updateData);
      toast({ title: "Task Atualizada", description: "Alterações protocoladas no SGI." });
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: e instanceof Error ? e.message : "A alteração não foi confirmada.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!db || !task.companyId) return;
    if (confirm("Deseja excluir permanentemente esta tarefa?")) {
      const taskRef = doc(db, "companies", task.companyId, "tasks", task.id);
      deleteDocumentNonBlocking(taskRef);
      toast({ title: "Task Removida" });
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0 border-none shadow-2xl flex flex-col bg-white">
        <SheetHeader className="p-8 bg-[#001F3F] text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ClipboardList className="size-32 text-accent" />
          </div>
          <div className="relative z-10 text-left space-y-2">
            <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em]">
              Editor de Atividade v2.7
            </Badge>
            <SheetTitle className="text-2xl font-headline font-black uppercase tracking-tight text-white leading-tight">
              {editedTask.title || "Nova Atividade"}
            </SheetTitle>
            <SheetDescription className="text-white/60 font-medium italic text-xs">
              ID: {task.id} | Edição multi-tenant ativa.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-8 scrollbar-thin">
          {task.sourceType === "pgr" && task.pgrCardId && task.agentRole && (
            <PgrAgentReview
              companyId={task.companyId}
              cardId={task.pgrCardId}
              role={task.agentRole}
            />
          )}
          <div className="space-y-8 pb-20 text-left">
            {/* AGENTE AUTÔNOMO NAI */}
            <Card className="border-none bg-accent/5 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "p-3 rounded-2xl shadow-inner transition-all",
                    editedTask.agentEnabled ? "bg-accent text-white" : "bg-white text-slate-300"
                  )}
                >
                  <Bot className="size-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-primary uppercase">
                    Agente NAI (Autônomo)
                  </h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    Monitoramento via WhatsApp
                  </p>
                </div>
              </div>
              <Switch
                checked={!!editedTask.agentEnabled}
                onCheckedChange={(v) => handleUpdateField("agentEnabled", v)}
              />
            </Card>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Título da Atividade
                </label>
                <Input
                  value={editedTask.title}
                  onChange={(e) => handleUpdateField("title", e.target.value)}
                  className="h-12 bg-slate-50 border-none rounded-xl font-bold text-primary shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Unidade / Cliente
                  </label>
                  <Select
                    value={editedTask.companyId}
                    disabled={task.sourceType === "pgr"}
                    onValueChange={(v) => handleUpdateField("companyId", v)}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {task.sourceType === "pgr" && (
                        <SelectItem value={task.companyId || ""}>{task.companyName}</SelectItem>
                      )}
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
                    Tipo de Tarefa
                  </label>
                  <Select
                    value={editedTask.type}
                    disabled={task.sourceType === "pgr"}
                    onValueChange={(v) => handleUpdateField("type", v)}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pgr">PGR (NR-01)</SelectItem>
                      <SelectItem value="pcmso">PCMSO (NR-07)</SelectItem>
                      <SelectItem value="ltcat">LTCAT / Laudo</SelectItem>
                      <SelectItem value="treinamento">Treinamento</SelectItem>
                      <SelectItem value="esocial">eSocial / Burocracia</SelectItem>
                      <SelectItem value="comercial">Operação Comercial</SelectItem>
                      <SelectItem value="faturamento">Faturamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Responsável (Prestador)
                </label>
                {task.sourceType === "pgr" ? (
                  <Input
                    value={editedTask.responsibleName || ""}
                    maxLength={180}
                    placeholder="Defina o responsável da equipe"
                    onChange={(e) => handleUpdateField("responsibleName", e.target.value)}
                  />
                ) : (
                  <Select
                    value={editedTask.responsibleId}
                    onValueChange={(v) => handleUpdateField("responsibleId", v)}
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
                )}
              </div>
            </div>

            {task.sourceType !== "pgr" && (
              <div className="p-6 bg-slate-900 text-white rounded-[2rem] space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Paperclip className="size-16" />
                </div>
                <p className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2 relative z-10">
                  <ShieldCheck className="size-3" /> Dossiê Documental
                </p>

                <div className="grid grid-cols-1 gap-4 relative z-10">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/40 uppercase ml-1">
                      PGR Histórico (Antigo)
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 h-11 rounded-xl border-2 border-dashed bg-white/5 gap-2 text-[10px] font-black uppercase",
                          editedTask.oldPgrUrl
                            ? "border-emerald-500 text-emerald-400"
                            : "border-white/10 text-white/40"
                        )}
                        disabled={isUploadingOld}
                        onClick={() => document.getElementById("pgr-old-up")?.click()}
                      >
                        {isUploadingOld ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <History className="size-3" />
                        )}
                        {editedTask.oldPgrUrl ? "Substituir Antigo" : "Subir PGR Antigo"}
                      </Button>
                      {editedTask.oldPgrUrl && (
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20"
                        >
                          <a href={editedTask.oldPgrUrl} target="_blank">
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <input
                      id="pgr-old-up"
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={(e) =>
                        e.target.files?.[0] && handleFileUpload("old", e.target.files[0])
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-white/40 uppercase ml-1">
                      Novo PGR (Entrega 2026)
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 h-11 rounded-xl border-2 border-dashed bg-white/5 gap-2 text-[10px] font-black uppercase",
                          editedTask.newPgrUrl
                            ? "border-accent text-accent"
                            : "border-white/10 text-white/40"
                        )}
                        disabled={isUploadingNew}
                        onClick={() => document.getElementById("pgr-new-up")?.click()}
                      >
                        {isUploadingNew ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <FileUp className="size-3" />
                        )}
                        {editedTask.newPgrUrl ? "Substituir Novo" : "Subir PGR Novo"}
                      </Button>
                      {editedTask.newPgrUrl && (
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-xl bg-white/10 hover:bg-white/20"
                        >
                          <a href={editedTask.newPgrUrl} target="_blank">
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    <input
                      id="pgr-new-up"
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={(e) =>
                        e.target.files?.[0] && handleFileUpload("new", e.target.files[0])
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
              <p className="text-[9px] font-black uppercase text-primary/40 tracking-widest flex items-center gap-2">
                <Layers className="size-3" /> Metadados de Conformidade
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                    CNAE Fiscal
                  </label>
                  <Input
                    value={editedTask.cnae || ""}
                    disabled={task.sourceType === "pgr"}
                    onChange={(e) => handleUpdateField("cnae", e.target.value)}
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
                    value={editedTask.riskDegree || ""}
                    disabled={task.sourceType === "pgr"}
                    onChange={(e) => handleUpdateField("riskDegree", e.target.value)}
                    className="h-10 bg-white border-none rounded-lg text-xs font-bold text-center"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                    Localidade / Site
                  </label>
                  <Input
                    value={editedTask.location || ""}
                    disabled={task.sourceType === "pgr"}
                    onChange={(e) => handleUpdateField("location", e.target.value)}
                    placeholder="Ex: Galpão de Pintura"
                    className="h-10 bg-white border-none rounded-lg text-xs font-bold"
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
                  value={editedTask.priority}
                  onValueChange={(v) => handleUpdateField("priority", v)}
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
                  Data SLA (Vencimento)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 size-4 text-slate-300" />
                  <Input
                    type="date"
                    value={editedTask.dueDate?.split("T")[0]}
                    onChange={(e) =>
                      handleUpdateField(
                        "dueDate",
                        e.target.value ? new Date(e.target.value).toISOString() : ""
                      )
                    }
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold pl-12 shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <ClipboardList className="size-3.5 text-accent" /> Checklist de Execução (POP)
                </label>
                <Badge className="bg-primary text-white border-none text-[9px] h-5">
                  {editedTask.progress || 0}%
                </Badge>
              </div>

              <div className="space-y-2">
                {editedTask.checklist?.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group transition-all hover:border-primary/20"
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleChecklistItem(idx)}
                      className="size-5 rounded-md border-slate-300"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={item.text}
                        onChange={(e) => updateChecklistItemText(idx, e.target.value)}
                        className={cn(
                          "h-8 bg-transparent border-none p-0 text-xs font-bold shadow-none focus-visible:ring-0",
                          item.checked ? "text-slate-300 line-through" : "text-slate-700"
                        )}
                      />
                    </div>
                    <button
                      onClick={() => removeChecklistItem(idx)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-50 transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 mt-4">
                  <Input
                    placeholder="Adicionar etapa ao processo..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                    className="h-11 bg-slate-50 border-none rounded-xl text-xs"
                  />
                  <Button
                    size="icon"
                    onClick={addChecklistItem}
                    className="h-11 w-11 bg-primary text-white rounded-xl shadow-lg shrink-0"
                  >
                    <Plus className="size-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-8 bg-slate-50 border-t shrink-0 flex flex-col gap-4">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={task.sourceType === "pgr"}
              title={
                task.sourceType === "pgr"
                  ? "Arquive o card no quadro para preservar as evidências do PGR."
                  : undefined
              }
              className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] border-red-200 text-red-500 hover:bg-red-50 gap-2"
            >
              <Trash2 size={16} /> Excluir Registro
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-3"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4 text-accent" />
              )}
              Protocolar Alterações
            </Button>
          </div>
          <p className="text-[8px] text-slate-300 font-black uppercase text-center tracking-[0.4em]">
            SGI Secure Multi-Tenant • NAI Intelligence
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
