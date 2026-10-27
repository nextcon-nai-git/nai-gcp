"use client";

import * as React from "react";
import type { OpsTask, Priority, TaskType } from "@/types/schema";
import {
  X,
  Save,
  Loader2,
  Trash2,
  Plus,
  ClipboardList,
  Calendar,
  Layers,
  ShieldCheck,
  UserCheck,
  FileUp,
  History,
  ExternalLink,
  Paperclip,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase, useStorage, useUser } from "@/firebase";
import { updatePgrTask } from "@/hooks/use-pgr-workspace";
import {
  doc,
  collection,
  query,
  orderBy,
  where,
  updateDoc,
  deleteDoc,
  deleteField,
} from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
import { STORAGE_PATHS } from "@/lib/storage-paths";
import { OPERATIONAL_COLUMNS, COMMERCIAL_COLUMNS } from "@/types/kanban";
import { displayTaskDate, downloadTaskCalendar, taskDate } from "@/lib/task-workspace";
import { Textarea } from "@/components/ui/textarea";
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
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [editedTask, setEditedTask] = React.useState<OpsTask>(task);
  const [newChecklistItem, setNewChecklistItem] = React.useState("");

  const [isUploadingOld, setIsUploadingOld] = React.useState(false);
  const [isUploadingNew, setIsUploadingNew] = React.useState(false);
  const imported = task.sourceType === "pgr";
  const restrictedImport =
    imported &&
    (task.restricted === true ||
      ["PCMSO", "ASO", "PERICIA_MEDICA"].includes(task.documentType || ""));

  // Callers mount a fresh editor on open or record/scope change. A background
  // snapshot of the same record must not replace the user's unsaved draft.

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

  const handleUpdateField = <K extends keyof OpsTask>(field: K, value: OpsTask[K]) => {
    if (restrictedImport && ["title", "lastComment"].includes(field)) return;
    setEditedTask((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (type: "old" | "new", file: File) => {
    if (!storage || !task.companyId) return;

    const isOld = type === "old";
    if (isOld) {
      setIsUploadingOld(true);
    } else {
      setIsUploadingNew(true);
    }

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
    } catch {
      toast({ variant: "destructive", title: "Erro no Upload" });
    } finally {
      if (isOld) {
        setIsUploadingOld(false);
      } else {
        setIsUploadingNew(false);
      }
    }
  };

  const toggleChecklistItem = (index: number) => {
    const newChecklist = (editedTask.checklist || []).map((item, itemIndex) =>
      itemIndex === index ? { ...item, checked: !item.checked } : item
    );

    const checkedCount = newChecklist.filter((item) => item.checked).length;
    const progress = Math.round((checkedCount / newChecklist.length) * 100);

    setEditedTask((prev) => ({
      ...prev,
      checklist: newChecklist,
      progress: progress,
    }));
  };

  const updateChecklistItemText = (index: number, text: string) => {
    if (restrictedImport || (imported && editedTask.checklist?.[index]?.mandatory)) return;
    const newChecklist = (editedTask.checklist || []).map((item, itemIndex) =>
      itemIndex === index ? { ...item, text } : item
    );
    setEditedTask((prev) => ({ ...prev, checklist: newChecklist }));
  };

  const addChecklistItem = () => {
    if (restrictedImport || !newChecklistItem.trim()) return;
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
    if (restrictedImport || (imported && editedTask.checklist?.[index]?.mandatory)) return;
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
    if (!db || !task.companyId || isSaving || isDeleting) return;
    setIsSaving(true);
    try {
      if (editedTask.companyId !== task.companyId)
        throw new Error(
          "O vínculo do cliente pertence ao registro de origem e não pode ser trocado neste editor."
        );
      const taskRef = doc(db, "companies", task.companyId, "tasks", task.id);
      const responsible = providers?.find((p) => p.id === editedTask.responsibleId);

      if (!editedTask.title.trim()) throw new Error("Informe o título da atividade.");
      if (editedTask.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedTask.contactEmail))
        throw new Error("Confira o e-mail do contato.");
      if (
        editedTask.emailThreadUrl &&
        !/^https:\/\/(mail\.google\.com|outlook\.office\.com|outlook\.office365\.com|outlook\.live\.com)\//i.test(
          editedTask.emailThreadUrl
        )
      )
        throw new Error("Use um link HTTPS do Gmail ou Outlook.");
      for (const [coordinate, limit] of [
        [editedTask.latitude, 90],
        [editedTask.longitude, 180],
      ] as const) {
        if (
          coordinate !== undefined &&
          (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit)
        )
          throw new Error("Coordenadas inválidas.");
      }
      const updateData = {
        title: editedTask.title.trim(),
        description: editedTask.description || "",
        contactEmail: editedTask.contactEmail || "",
        emailThreadUrl: editedTask.emailThreadUrl || "",
        latitude: editedTask.latitude ?? deleteField(),
        longitude: editedTask.longitude ?? deleteField(),
        type: editedTask.type,
        status: editedTask.status,
        ...(editedTask.priority ? { priority: editedTask.priority } : {}),
        companyId: editedTask.companyId,
        companyName:
          companies?.find((c) => c.id === editedTask.companyId)?.name || editedTask.companyName,
        responsibleId: editedTask.responsibleId || "",
        responsibleName: responsible?.name || editedTask.responsibleName || "A definir",
        dueDate: editedTask.dueDate || "",
        cnae: editedTask.cnae || "",
        riskDegree: editedTask.riskDegree === undefined ? deleteField() : editedTask.riskDegree,
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
          throw new Error(
            "O cliente do card é definido pelo documento e não pode ser trocado aqui."
          );
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
      } else await updateDoc(taskRef, updateData);
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

  const handleDelete = async () => {
    if (!db || !task.companyId || imported || isSaving || isDeleting) return;
    if (confirm("Deseja excluir permanentemente esta tarefa?")) {
      setIsDeleting(true);
      try {
        const taskRef = doc(db, "companies", task.companyId, "tasks", task.id);
        await deleteDoc(taskRef);
        toast({ title: "Task Removida" });
        onOpenChange(false);
      } catch {
        toast({
          variant: "destructive",
          title: "Erro ao Excluir",
          description:
            "A exclusão não foi confirmada. Confira o registro antes de tentar novamente.",
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl p-0 border-none shadow-2xl flex flex-col bg-white">
        <SheetHeader className="p-5 bg-[#001F3F] text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ClipboardList className="size-32 text-accent" />
          </div>
          <div className="relative z-10 text-left space-y-2">
            <Badge className="bg-accent text-primary border-none text-[8px] font-black uppercase tracking-[0.3em]">
              Detalhes da atividade
            </Badge>
            <SheetTitle className="text-2xl font-headline font-black uppercase tracking-tight text-white leading-tight">
              {editedTask.title || "Nova Atividade"}
            </SheetTitle>
            <SheetDescription className="text-white/60 font-medium italic text-xs">
              {task.companyName}
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-5 scrollbar-thin">
          {task.sourceType === "client_request" && (
            <div className="mx-6 mt-4 rounded-xl border bg-slate-50 p-4 space-y-2">
              <p className="font-semibold">Solicitação da Central do Cliente</p>
              <p className="text-xs text-muted-foreground break-all">Protocolo: {task.id}</p>
              <p className="whitespace-pre-wrap text-sm">{task.description}</p>
            </div>
          )}
          {task.sourceType === "pgr" && task.pgrCardId && task.agentRole && (
            <PgrAgentReview
              companyId={task.companyId}
              cardId={task.pgrCardId}
              role={task.agentRole}
            />
          )}
          {restrictedImport && (
            <p className="my-4 rounded-xl bg-violet-50 p-4 text-xs leading-5 text-violet-900">
              Consulte o conteúdo clínico no registro restrito. Este card acompanha somente os
              encaminhamentos administrativos.
            </p>
          )}
          <div className="space-y-5 pb-8 text-left">
            <div className="space-y-2">
              <label htmlFor="task-stage" className="text-sm font-medium">
                Etapa
              </label>
              <select
                id="task-stage"
                value={editedTask.status}
                onChange={(e) => handleUpdateField("status", e.target.value as OpsTask["status"])}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
              >
                {[
                  ...OPERATIONAL_COLUMNS,
                  ...(imported ? [] : COMMERCIAL_COLUMNS),
                  { id: "archived", title: "Arquivado" },
                ].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="task-description" className="text-sm font-medium">
                Descrição e orientações
              </label>
              <Textarea
                id="task-description"
                value={
                  restrictedImport
                    ? "Conteúdo disponível somente no registro clínico restrito."
                    : editedTask.description || ""
                }
                readOnly={imported}
                onChange={(e) => handleUpdateField("description", e.target.value)}
                rows={4}
                placeholder="Escopo, contexto e critérios de entrega"
              />
            </div>
            {!imported && (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <h3 className="text-sm font-semibold">E-mail e agenda</h3>
                <label className="block text-xs" htmlFor="task-contact-email">
                  E-mail do contato
                </label>
                <Input
                  id="task-contact-email"
                  type="email"
                  value={editedTask.contactEmail || ""}
                  onChange={(e) => handleUpdateField("contactEmail", e.target.value)}
                  placeholder="contato@empresa.com.br"
                />
                <label className="block text-xs" htmlFor="task-email-thread">
                  Link da conversa (Gmail ou Outlook)
                </label>
                <Input
                  id="task-email-thread"
                  value={editedTask.emailThreadUrl || ""}
                  onChange={(e) => handleUpdateField("emailThreadUrl", e.target.value)}
                  placeholder="https://mail.google.com/…"
                />
                <div className="flex flex-wrap gap-2">
                  {editedTask.contactEmail &&
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedTask.contactEmail) && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`mailto:${encodeURIComponent(editedTask.contactEmail)}?subject=${encodeURIComponent(editedTask.title)}&body=${encodeURIComponent(`Olá,\n\nSobre a atividade: ${editedTask.title}\nCliente: ${editedTask.companyName}\nPrazo: ${displayTaskDate(editedTask.dueDate)}\n\n`)}`}
                        >
                          Preparar e-mail
                        </a>
                      </Button>
                    )}
                  {editedTask.emailThreadUrl &&
                    /^https:\/\/(mail\.google\.com|outlook\.office\.com|outlook\.office365\.com|outlook\.live\.com)\//i.test(
                      editedTask.emailThreadUrl
                    ) && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={editedTask.emailThreadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir conversa
                        </a>
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!taskDate(editedTask.dueDate)}
                    onClick={() => downloadTaskCalendar([editedTask])}
                  >
                    Exportar para agenda
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O e-mail abre para revisão no seu aplicativo. Nenhum envio automático. Agenda por
                  arquivo .ics, sem sincronização.
                </p>
              </div>
            )}
            {!restrictedImport && (
              <div className="space-y-2">
                <label htmlFor="task-update" className="text-sm font-medium">
                  Última atualização
                </label>
                <Textarea
                  id="task-update"
                  value={editedTask.lastComment || ""}
                  onChange={(e) => handleUpdateField("lastComment", e.target.value)}
                  placeholder="Registre o andamento e a próxima ação"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Título da Atividade
                </label>
                <Input
                  value={editedTask.title}
                  readOnly={restrictedImport}
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
                    disabled
                    onValueChange={(v) => handleUpdateField("companyId", v)}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {!companies?.some((company) => company.id === task.companyId) && (
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
                    onValueChange={(v) => handleUpdateField("type", v as TaskType)}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pgr">PGR (NR-01)</SelectItem>
                      <SelectItem value="pcmso">PCMSO (NR-07)</SelectItem>
                      <SelectItem value="aso">ASO (NR-07)</SelectItem>
                      <SelectItem value="pericia_medica">Perícia médica</SelectItem>
                      <SelectItem value="aep">AEP (NR-17)</SelectItem>
                      <SelectItem value="aet">AET (NR-17)</SelectItem>
                      <SelectItem value="ergonomia">Dados ergonômicos</SelectItem>
                      <SelectItem value="ltcat">LTCAT / Laudo</SelectItem>
                      <SelectItem value="treinamento">Treinamento</SelectItem>
                      <SelectItem value="esocial">eSocial / Burocracia</SelectItem>
                      <SelectItem value="comercial">Operação Comercial</SelectItem>
                      <SelectItem value="atendimento">Atendimento ao cliente</SelectItem>
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
                    value={editedTask.responsibleId || "unassigned"}
                    onValueChange={(v) => {
                      handleUpdateField("responsibleId", v === "unassigned" ? "" : v);
                      handleUpdateField(
                        "responsibleName",
                        v === "unassigned" ? "" : providers?.find((p) => p.id === v)?.name || ""
                      );
                    }}
                  >
                    <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-3.5 text-primary/40" />
                        <SelectValue placeholder="Delegar para prestador..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sem prestador designado</SelectItem>
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

            {!imported && !editedTask.responsibleId && (
              <div className="space-y-2">
                <label htmlFor="task-owner-name" className="text-sm font-medium">
                  Responsável interno / nome de referência
                </label>
                <Input
                  id="task-owner-name"
                  value={editedTask.responsibleName || ""}
                  onChange={(e) => handleUpdateField("responsibleName", e.target.value)}
                  placeholder="Nome de quem acompanha a entrega"
                />
                <p className="text-xs text-muted-foreground">
                  Este nome organiza o quadro; não cria usuário nem concede acesso.
                </p>
              </div>
            )}

            {task.sourceType !== "pgr" &&
              (editedTask.type === "pgr" || editedTask.oldPgrUrl || editedTask.newPgrUrl) && (
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
                    onChange={(e) =>
                      handleUpdateField(
                        "riskDegree",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
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
                    placeholder="Endereço, cidade e UF da atividade"
                    className="h-10 bg-white border-none rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {!imported && (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">
                  Latitude
                  <Input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={editedTask.latitude ?? ""}
                    onChange={(e) =>
                      handleUpdateField(
                        "latitude",
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </label>
                <label className="text-xs">
                  Longitude
                  <Input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={editedTask.longitude ?? ""}
                    onChange={(e) =>
                      handleUpdateField(
                        "longitude",
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Prioridade
                </label>
                <Select
                  value={editedTask.priority}
                  onValueChange={(v) => handleUpdateField("priority", v as Priority)}
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
                    value={taskDate(editedTask.dueDate)}
                    onChange={(e) => handleUpdateField("dueDate", e.target.value)}
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
                        readOnly={restrictedImport || (imported && item.mandatory)}
                        onChange={(e) => updateChecklistItemText(idx, e.target.value)}
                        className={cn(
                          "h-8 bg-transparent border-none p-0 text-xs font-bold shadow-none focus-visible:ring-0",
                          item.checked ? "text-slate-300 line-through" : "text-slate-700"
                        )}
                      />
                    </div>
                    {!(restrictedImport || (imported && item.mandatory)) && (
                      <button
                        onClick={() => removeChecklistItem(idx)}
                        aria-label="Remover item do checklist"
                        className="p-1.5 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-50 transition-all"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {!restrictedImport && (
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
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-5 bg-slate-50 border-t shrink-0 flex flex-col gap-4">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={task.sourceType === "pgr" || isSaving || isDeleting}
              title={
                task.sourceType === "pgr"
                  ? "Arquive o card no quadro para preservar as evidências do documento."
                  : undefined
              }
              className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] border-red-200 text-red-500 hover:bg-red-50 gap-2"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 size={16} />}{" "}
              Excluir Registro
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className="flex-1 h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl gap-3"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4 text-accent" />
              )}
              Salvar alterações
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
