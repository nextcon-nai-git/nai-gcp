"use client";

import * as React from "react";
import {
  HeartPulse,
  Plus,
  Loader2,
  Save,
  Brain,
  ShieldCheck,
  Accessibility,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, where } from "firebase/firestore";
import { useSgi } from "@/contexts/sgi-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const attendanceSchema = z.object({
  companyId: z.string().min(1, "Selecione a unidade"),
  employeeId: z.string().min(1, "Selecione um colaborador"),
  complaint: z.string().min(3, "Descreva a queixa"),
  conduct: z.enum(["observation", "work", "emergency"]),
  care_lines: z.array(z.string()).default([]),
  coren: z.string().default("808295"),
});

type AttendanceFormValues = z.infer<typeof attendanceSchema>;

const CARE_LINE_GROUPS = [
  {
    category: "Ergonomia & NR-17",
    icon: Accessibility,
    items: [
      { id: "ginastica_laboral", label: "Ginástica Laboral" },
      { id: "alongamento", label: "Alongamento Direcionado" },
      { id: "pausa_ativa", label: "Pausa Ativa (10 min)" },
      { id: "ajuste_posto", label: "Ajuste de Mobiliário" },
    ],
  },
  {
    category: "Saúde Mental & Psicossocial",
    icon: Brain,
    items: [
      { id: "escuta_ativa", label: "Escuta Ativa / Acolhimento" },
      { id: "higiene_sono", label: "Orientações Higiene do Sono" },
      { id: "manejo_estresse", label: "Manejo de Estresse" },
    ],
  },
  {
    category: "Higiene Ocupacional",
    icon: ShieldCheck,
    items: [
      { id: "repouso_acustico", label: "Repouso Acústico" },
      { id: "uso_epi", label: "Reforço no uso de EPI" },
      { id: "lavagem_nasal", label: "Lavagem Nasal" },
    ],
  },
];

export function NewAttendanceModal() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const { isGlobalStaff, authorizedCompanies } = useSgi();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      companyId: "",
      employeeId: "",
      complaint: "",
      care_lines: [],
      conduct: "observation",
      coren: "808295",
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
    return null;
  }, [db, isGlobalStaff, authorizedCompanies]);
  const { data: companies } = useCollection(companiesQuery);

  const employeesQuery = useMemoFirebase(
    () =>
      !db || !form.watch("companyId")
        ? null
        : query(
            collection(db, "companies", form.watch("companyId"), "employees"),
            orderBy("name", "asc")
          ),
    [db, form.watch("companyId")]
  );
  const { data: employees } = useCollection(employeesQuery);

  async function onFormSubmit(values: AttendanceFormValues) {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const emp = employees?.find((e) => e.id === values.employeeId);
      await addDoc(collection(db, "nursing_attendances"), {
        ...values,
        employeeName: emp?.name || "Colaborador",
        nurseName: user?.displayName || "Enfermeira NAI",
        status_esocial: "Pendente",
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });
      toast({ title: "Atendimento Protocolado" });
      setIsOpen(false);
      form.reset();
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao Salvar" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] shadow-lg gap-2">
          <Plus className="size-4" /> Novo Atendimento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[950px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
        <DialogHeader className="p-8 bg-[#001F3F] text-white shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles className="size-32 text-accent" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl">
              <HeartPulse className="size-8 text-accent" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-headline font-black uppercase tracking-tight">
                Prontuário & Triagem NAI
              </DialogTitle>
              <DialogDescription className="text-white/60 font-bold uppercase text-[10px] mt-1 tracking-widest">
                Abertura de evolução clínica e social v2.7.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onFormSubmit)}
            className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10"
          >
            <div className="lg:col-span-7 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Unidade
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold shadow-inner">
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
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Paciente
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!form.watch("companyId")}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold shadow-inner">
                            <SelectValue placeholder="Selecione o paciente..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees?.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="complaint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Queixa do Paciente
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Relate os sintomas e queixas apresentadas pelo colaborador..."
                        {...field}
                        className="min-h-[180px] bg-slate-50 border-none rounded-[2rem] p-6 text-sm font-medium shadow-inner"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Conduta Inicial
                </label>
                <div className="flex gap-2">
                  {["observation", "work", "emergency"].map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={form.watch("conduct") === c ? "default" : "outline"}
                      onClick={() => form.setValue("conduct", c as any)}
                      className={cn(
                        "flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        form.watch("conduct") === c ? "bg-primary" : "border-slate-100 bg-slate-50"
                      )}
                    >
                      {c === "observation" ? "Observação" : c === "work" ? "Retorno" : "Emergência"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 flex flex-col h-full">
                <h4 className="text-xs font-black text-primary uppercase mb-6 flex items-center gap-2">
                  <Brain className="size-4 text-accent" /> Linhas de Cuidado NAI
                </h4>
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-8">
                    {CARE_LINE_GROUPS.map((group) => (
                      <div key={group.category} className="space-y-3">
                        <div className="flex items-center gap-2 text-primary/40">
                          <group.icon size={12} />
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            {group.category}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {group.items.map((item) => (
                            <FormField
                              key={item.id}
                              control={form.control}
                              name="care_lines"
                              render={({ field }) => (
                                <FormItem
                                  className="flex items-center space-x-3 space-y-0 p-4 bg-white border border-white rounded-2xl shadow-sm hover:border-primary/10 transition-all cursor-pointer"
                                  onClick={() => {
                                    const current = field.value || [];
                                    const next = current.includes(item.id)
                                      ? current.filter((v) => v !== item.id)
                                      : [...current, item.id];
                                    field.onChange(next);
                                  }}
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.id)}
                                      className="size-5 rounded-md border-slate-300"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-[11px] font-bold text-slate-600 uppercase cursor-pointer leading-tight">
                                    {item.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="lg:col-span-12 pt-8 border-t flex flex-col items-center gap-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-5 text-accent" />
                )}
                Salvar Atendimento e Protocolar PEP
              </Button>
              <p className="text-[8px] text-slate-300 font-black uppercase tracking-[0.4em]">
                Sincronização Segura HIPAA v2.7
              </p>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
