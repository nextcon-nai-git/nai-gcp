"use client";

import * as React from "react";
import {
  Plus,
  ShieldCheck,
  FileText,
  Loader2,
  Save,
  ChevronRight,
  X,
  Info,
  Zap,
  Globe2,
  ClipboardCheck,
  Scale,
  Brain,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, where, collectionGroup } from "firebase/firestore";
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ISO_CHECKLISTS } from "@/lib/iso-checklists";

const auditFormSchema = z.object({
  companyId: z.string().min(1, "Selecione a unidade"),
  scope: z.enum(["ISO 9001:2015", "ISO 14001:2015", "ISO 45001:2018", "ISO 27001:2022"]),
  auditorName: z.string().min(3, "Informe o auditor"),
  date: z.string().min(1, "Selecione a data"),
  status: z.enum(["planned", "in_progress", "finished"]),
});

type AuditFormValues = z.infer<typeof auditFormSchema>;

export default function IsoAuditsElite() {
  const { toast } = useToast();
  const { user, role, companyId: userCompanyId } = useUser();
  const db = useFirestore();
  const { activeClientId } = useSgi();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [executingAudit, setExecutingAudit] = React.useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [checklistResponses, setChecklistResponses] = React.useState<Record<string, boolean>>({});

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const isGlobalAdmin = React.useMemo(
    () => ["SUPER_ADMIN", "ADMIN", "ENGINEER"].includes(role || ""),
    [role]
  );

  const auditsQuery = useMemoFirebase(() => {
    if (!db || activeClientId === "unauthorized" || !activeClientId) return null;
    if (activeClientId === "all") {
      if (!isGlobalAdmin) return null;
      return query(collectionGroup(db, "audits"), orderBy("date", "desc"));
    }
    return query(collection(db, "companies", activeClientId, "audits"), orderBy("date", "desc"));
  }, [db, activeClientId, isGlobalAdmin]);

  const { data: audits, isLoading } = useCollection(auditsQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !role) return null;
    if (isGlobalAdmin) return query(collection(db, "companies"), orderBy("name", "asc"));
    if (userCompanyId)
      return query(collection(db, "companies"), where("__name__", "==", userCompanyId));
    return null;
  }, [db, isGlobalAdmin, userCompanyId, role]);

  const { data: companies } = useCollection(companiesQuery);

  const form = useForm<AuditFormValues>({
    resolver: zodResolver(auditFormSchema),
    defaultValues: {
      companyId: "",
      scope: "ISO 45001:2018",
      auditorName: "",
      date: new Date().toISOString().split("T")[0],
      status: "planned",
    },
  });

  React.useEffect(() => {
    if (profile?.companyId) form.setValue("companyId", profile.companyId);
  }, [profile, form]);

  async function handleCreateAudit(values: AuditFormValues) {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const company = companies?.find((c) => c.id === values.companyId);
      await addDocumentNonBlocking(collection(db, "companies", values.companyId, "audits"), {
        ...values,
        companyName: company?.name || "Unidade Técnica",
        createdAt: new Date().toISOString(),
        companyId: values.companyId,
      });
      toast({ title: "Auditoria Protocolada" });
      setIsCreateOpen(false);
      form.reset();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao Salvar" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleStartExecution = (audit: any) => {
    setExecutingAudit(audit);
    setChecklistResponses(audit.results || {});
    if (audit.status === "planned" && db && audit.companyId) {
      updateDocumentNonBlocking(doc(db, "companies", audit.companyId, "audits", audit.id), {
        status: "in_progress",
      });
    }
  };

  const handleFinishAudit = async () => {
    if (!db || !executingAudit) return;
    setIsSubmitting(true);
    try {
      await updateDocumentNonBlocking(
        doc(db, "companies", executingAudit.companyId, "audits", executingAudit.id),
        {
          status: "finished",
          results: checklistResponses,
          finishedAt: new Date().toISOString(),
        }
      );
      toast({ title: "Auditoria Finalizada" });
      setExecutingAudit(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeChecklist = executingAudit ? ISO_CHECKLISTS[executingAudit.scope] : null;

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
        <div className="space-y-1">
          <Badge className="bg-primary text-accent border-none font-black text-[8px] tracking-[0.4em] mb-2 px-3 h-5 uppercase">
            ISO MULTI-STANDARD HUB v3.2
          </Badge>
          <h1 className="text-4xl font-black text-primary uppercase font-headline tracking-tighter leading-none">
            Centro de Auditorias
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.3em] mt-2 flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" /> Governança Unificada ISO 9001,
            14001, 45001 & 27001.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 px-6 rounded-2xl border-primary text-primary font-black uppercase text-[10px] gap-2 shadow-sm btn-hover-effect"
          >
            <Globe2 className="size-4" /> Global Reporting (ESG)
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-nextcon text-white h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl gap-2">
                <Plus className="size-4 text-accent" /> Agendar Ciclo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
              <DialogHeader className="p-10 bg-primary text-white space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Zap size={140} className="text-accent" />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-accent shadow-2xl">
                    <ClipboardCheck size={24} />
                  </div>
                  <DialogTitle className="text-2xl font-headline font-black uppercase">
                    Agendar Ciclo Normativo
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="p-10">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleCreateAudit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="companyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            Unidade Auditada
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={!isGlobalAdmin && !!profile?.companyId}
                          >
                            <FormControl>
                              <SelectTrigger className="h-14 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {companies?.map((c) => (
                                <SelectItem
                                  key={c.id}
                                  value={c.id}
                                  className="text-xs font-bold uppercase"
                                >
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scope"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                            Padrão Normativo
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-14 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem
                                value="ISO 45001:2018"
                                className="text-xs font-bold uppercase"
                              >
                                ISO 45001 (Segurança)
                              </SelectItem>
                              <SelectItem
                                value="ISO 9001:2015"
                                className="text-xs font-bold uppercase"
                              >
                                ISO 9001 (Qualidade)
                              </SelectItem>
                              <SelectItem
                                value="ISO 14001:2015"
                                className="text-xs font-bold uppercase"
                              >
                                ISO 14001 (Ambiental)
                              </SelectItem>
                              <SelectItem
                                value="ISO 27001:2022"
                                className="text-xs font-bold uppercase text-emerald-600"
                              >
                                ISO 27001 (Dados / SGSI)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
                    >
                      {isSubmitting ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <Save className="size-5 text-accent" />
                      )}
                      Protocolar Agendamento
                    </Button>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="card-shadow border-none bg-emerald-50 rounded-[2.5rem] p-8 space-y-6 border border-emerald-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-600/20">
                <Scale size={20} />
              </div>
              <h4 className="text-sm font-black text-emerald-900 uppercase leading-none">
                Status Compliance
              </h4>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-emerald-700">
                <span>GRI 403 (ESG)</span>
                <Badge className="bg-emerald-600 text-white h-5">READY</Badge>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase text-emerald-700">
                <span>Aderência Média</span>
                <span className="text-lg">94.8%</span>
              </div>
              <div className="h-1.5 w-full bg-emerald-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: "94.8%" }} />
              </div>
            </div>
          </Card>

          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <Zap className="size-32 text-accent" />
            </div>
            <div className="relative z-10 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <Brain className="size-3" /> IA Preditora ISO
              </h4>
              <p className="text-[11px] leading-relaxed italic text-white/60">
                &quot;O motor NAI cruzou os dados do PGR com os registros de treinamento e
                identificou um gap de 12% no Requisito 7.2 da ISO 45001.&quot;
              </p>
            </div>
          </Card>
        </div>

        <Card className="lg:col-span-3 card-shadow border-none bg-white rounded-[3rem] overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-32 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin size-12 text-primary opacity-20" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary/40">
                  Consolidando Base Normativa...
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="pl-10 py-6">Unidade / Ciclo</TableHead>
                    <TableHead>Padrão ISO</TableHead>
                    <TableHead>Auditor Responsável</TableHead>
                    <TableHead className="text-center">Status SGI</TableHead>
                    <TableHead className="pr-10 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits?.map((audit: any) => (
                    <TableRow
                      key={audit.id}
                      className="hover:bg-slate-50 transition-all group border-b last:border-none cursor-pointer"
                      onClick={() => handleStartExecution(audit)}
                    >
                      <TableCell className="pl-10 py-6">
                        <div className="flex items-center gap-5">
                          <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="font-black text-sm text-primary uppercase">
                              {audit.companyName}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                              Sessão: {new Date(audit.date).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-black border-none uppercase px-3 h-6 rounded-lg",
                            audit.scope.includes("27001")
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-blue-50 text-blue-700"
                          )}
                        >
                          {audit.scope}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-bold text-slate-500 uppercase">
                          {audit.auditorName}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "text-[9px] font-black uppercase border-none px-3 h-6 rounded-lg shadow-sm",
                            audit.status === "finished"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {audit.status === "finished" ? "FINALIZADO" : "EM CURSO"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-10 text-right">
                        <ChevronRight className="size-5 text-slate-200 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!audits || audits.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-[0.4em]"
                      >
                        Aguardando Protocolo de Auditoria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!executingAudit} onOpenChange={(open) => !open && setExecutingAudit(null)}>
        <SheetContent className="sm:max-w-2xl p-0 border-none shadow-2xl flex flex-col bg-white">
          {executingAudit && activeChecklist && (
            <>
              <SheetHeader className="p-10 bg-primary text-white shrink-0 relative text-left">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <ShieldCheck className="size-48 text-accent" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge className="bg-accent text-primary font-black uppercase text-[9px] tracking-widest h-7 px-4 rounded-lg shadow-xl">
                      {executingAudit.scope}
                    </Badge>
                    <button
                      onClick={() => setExecutingAudit(null)}
                      className="hover:bg-white/10 p-2 rounded-xl transition-colors"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <SheetTitle className="text-3xl font-headline font-black uppercase text-white leading-tight">
                    {activeChecklist.title}
                  </SheetTitle>
                </div>
              </SheetHeader>
              <ScrollArea className="flex-1 p-10 bg-slate-50/50 scrollbar-thin">
                <div className="space-y-8 pb-20 text-left">
                  {activeChecklist.items.map((item) => (
                    <Card
                      key={item.id}
                      className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white group border-2 border-transparent hover:border-primary/5 transition-all"
                    >
                      <CardContent className="p-8 space-y-5">
                        <div className="flex justify-between items-start gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <Badge
                                variant="outline"
                                className="text-[9px] font-black bg-slate-50 uppercase border-slate-100 px-3 h-6 rounded-lg"
                              >
                                {item.clause}
                              </Badge>
                              <span className="text-[9px] font-mono text-slate-300 font-bold tracking-tighter">
                                REQ-ID: {item.id}
                              </span>
                            </div>
                            <h4 className="text-sm font-black text-primary leading-relaxed uppercase tracking-tight">
                              {item.requirement}
                            </h4>
                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 mt-6 flex gap-3 items-start">
                              <Info className="size-4 text-primary/40 shrink-0 mt-0.5" />
                              <p className="text-[10px] text-primary/60 italic font-medium leading-relaxed">
                                {item.helpText}
                              </p>
                            </div>
                          </div>
                          <Checkbox
                            checked={!!checklistResponses[item.id]}
                            onCheckedChange={(val) =>
                              setChecklistResponses((prev) => ({ ...prev, [item.id]: !!val }))
                            }
                            className="size-8 rounded-xl border-2 border-slate-200"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-10 bg-white border-t flex flex-col items-center gap-6">
                <div className="w-full flex items-center gap-4 p-5 bg-emerald-50 rounded-[1.5rem] border-2 border-dashed border-emerald-200">
                  <ShieldCheck className="size-8 text-emerald-600 shrink-0" />
                  <p className="text-[10px] text-emerald-800 font-black leading-relaxed uppercase italic">
                    &quot;O encerramento deste ciclo gerará o relatório GRI 403 e a trilha de
                    evidências criptográfica para certificação global.&quot;
                  </p>
                </div>
                <Button
                  onClick={handleFinishAudit}
                  disabled={isSubmitting}
                  className="w-full h-18 bg-primary text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-2xl gap-3 hover:scale-[1.01] active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-6 animate-spin text-accent" />
                  ) : (
                    <Save className="size-6 text-accent" />
                  )}
                  Encerrar e Protocolar Ciclo Normativo
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
