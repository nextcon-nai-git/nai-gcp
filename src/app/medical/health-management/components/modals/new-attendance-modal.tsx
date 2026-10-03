"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HeartPulse, Loader2, Save, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { collection, addDoc, doc, serverTimestamp } from "firebase/firestore";
import { REAL_EMPLOYEES, REAL_PATIENTS } from "@/lib/real-data";

// --- Schema de Validação ---
const attendanceSchema = z.object({
  employeeId: z.string().min(1, "Selecione um colaborador."),
  coren: z
    .string()
    .min(1, "Registro COREN é obrigatório.")
    .regex(/^\d{4,7}-[A-Z]{2,3}\/[A-Z]{2}$/, "Formato inválido. Use: 123456-TE/PR"),
  bp_sys: z
    .string()
    .regex(/^\d{2,3}$/, "Use apenas números (ex: 120)")
    .or(z.literal("")),
  bp_dia: z
    .string()
    .regex(/^\d{2,3}$/, "Use apenas números (ex: 80)")
    .or(z.literal("")),
  heart_rate: z
    .string()
    .regex(/^\d{2,3}$/, "FC entre 30-220")
    .or(z.literal("")),
  temperature: z
    .string()
    .regex(/^\d{2}(\.\d)?$/, "Ex: 36.5")
    .or(z.literal("")),
  spo2: z
    .string()
    .regex(/^\d{2,3}$/, "SpO2 entre 70-100")
    .or(z.literal("")),
  complaint: z.string().optional(),
  conduct: z.string().default("observation"),
  medication: z.string().optional(),
});

type AttendanceFormData = z.infer<typeof attendanceSchema>;

interface NewAttendanceModalProps {
  onAttendanceSaved?: (patientId: string) => void;
}

export function NewAttendanceModal({ onAttendanceSaved }: NewAttendanceModalProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceFormData>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      employeeId: "",
      coren: "",
      bp_sys: "",
      bp_dia: "",
      heart_rate: "",
      temperature: "",
      spo2: "",
      complaint: "",
      conduct: "observation",
      medication: "",
    },
  });

  async function onSubmit(data: AttendanceFormData) {
    if (!db) return;
    try {
      const emp = REAL_EMPLOYEES.find((e) => e.id === data.employeeId);
      await addDoc(collection(db, "nursing_attendances"), {
        ...data,
        employeeName: emp?.name || "Colaborador",
        companyId: emp?.companyId || "CLI_NATIVA",
        nurseId: user?.uid,
        nurseName: profile?.name || user?.email,
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
      });
      toast({ title: "Atendimento Registrado" });
      setIsCreateOpen(false);
      reset();

      const patientMatch = REAL_PATIENTS.find(
        (p) => p.cpf === emp?.cpf || (emp && p.name.includes(emp.name.split(" ")[0]))
      );
      if (patientMatch && onAttendanceSaved) {
        onAttendanceSaved(patientMatch.id);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Verifique sua conexão e tente novamente.",
      });
    }
  }

  /** Helper to render inline field errors */
  function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="text-[9px] font-bold text-destructive mt-1 ml-1">{message}</p>;
  }

  return (
    <Dialog
      open={isCreateOpen}
      onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-transform">
          <Plus className="size-4" /> Novo Atendimento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
        <div className="p-8 bg-primary text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-lg text-accent">
              <HeartPulse className="size-5" />
            </div>
            <DialogTitle className="text-xl font-headline font-black uppercase">
              Ficha de Triagem Técnica
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/60 font-medium italic">
            Registro auditável de intercorrência em unidade operacional.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
            {/* --- Colaborador + COREN --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="att-employeeId"
                  className="text-[9px] font-black uppercase text-slate-400"
                >
                  Colaborador
                </label>
                <Controller
                  name="employeeId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="att-employeeId"
                        className="h-11 bg-slate-50 border-none rounded-xl font-bold"
                      >
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {REAL_EMPLOYEES.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.employeeId?.message} />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="att-coren"
                  className="text-[9px] font-black uppercase text-slate-400"
                >
                  COREN-UF
                </label>
                <Input
                  id="att-coren"
                  placeholder="Ex: 123456-TE/PR"
                  {...register("coren")}
                  className="h-11 bg-slate-50 border-none rounded-xl font-bold"
                  aria-invalid={!!errors.coren}
                />
                <FieldError message={errors.coren?.message} />
              </div>
            </div>

            {/* --- Sinais Vitais --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="att-bp-sys"
                  className="text-[9px] font-black uppercase text-slate-400"
                >
                  PA Sistólica
                </label>
                <Input
                  id="att-bp-sys"
                  placeholder="120"
                  {...register("bp_sys")}
                  className="h-11 bg-slate-50 border-none rounded-xl font-bold text-center"
                  aria-invalid={!!errors.bp_sys}
                />
                <FieldError message={errors.bp_sys?.message} />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="att-bp-dia"
                  className="text-[9px] font-black uppercase text-slate-400"
                >
                  PA Diastólica
                </label>
                <Input
                  id="att-bp-dia"
                  placeholder="80"
                  {...register("bp_dia")}
                  className="h-11 bg-slate-50 border-none rounded-xl font-bold text-center"
                  aria-invalid={!!errors.bp_dia}
                />
                <FieldError message={errors.bp_dia?.message} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="att-hr" className="text-[9px] font-black uppercase text-slate-400">
                  FC (bpm)
                </label>
                <Input
                  id="att-hr"
                  placeholder="72"
                  {...register("heart_rate")}
                  className="h-11 bg-slate-50 border-none rounded-xl font-bold text-center"
                  aria-invalid={!!errors.heart_rate}
                />
                <FieldError message={errors.heart_rate?.message} />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="att-temp"
                  className="text-[9px] font-black uppercase text-slate-400"
                >
                  Temp (°C)
                </label>
                <Input
                  id="att-temp"
                  placeholder="36.5"
                  {...register("temperature")}
                  className="h-11 bg-slate-50 border-none rounded-xl font-bold text-center"
                  aria-invalid={!!errors.temperature}
                />
                <FieldError message={errors.temperature?.message} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="att-spo2"
                  className="text-[9px] font-black uppercase text-slate-400"
                >
                  SpO2 (%)
                </label>
                <Input
                  id="att-spo2"
                  placeholder="98"
                  {...register("spo2")}
                  className="h-11 bg-slate-50 border-none rounded-xl font-bold text-center"
                  aria-invalid={!!errors.spo2}
                />
                <FieldError message={errors.spo2?.message} />
              </div>
            </div>

            {/* --- Queixa --- */}
            <div className="space-y-1.5">
              <label
                htmlFor="att-complaint"
                className="text-[9px] font-black uppercase text-slate-400"
              >
                Queixa / Relato
              </label>
              <Textarea
                id="att-complaint"
                placeholder="Descreva os sintomas..."
                {...register("complaint")}
                className="min-h-[80px] bg-slate-50 border-none rounded-xl p-3 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-8 bg-slate-50">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-xl gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Save className="size-5 text-accent" />
              )}
              Salvar Prontuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
