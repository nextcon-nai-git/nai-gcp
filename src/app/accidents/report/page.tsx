"use client";

import * as React from "react";
import { Camera, Send, Loader2, MapPin, ShieldAlert, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * @fileOverview Formulário de Reporte de Incidentes v1.0.
 */
export default function IncidentReportPage() {
  const { toast } = useToast();
  const { user, companyId } = useUser();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    type: "QUASE_ACIDENTE",
    description: "",
    location: "",
    photoUrl: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;

    setLoading(true);
    try {
      const response = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          companyId,
          reporterId: user?.uid,
        }),
      });

      const data = await response.json();

      if (data.sucesso) {
        toast({ title: "Incidente Reportado", description: "O Auditor NAI foi notificado." });
        router.push("/accidents");
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no Envio", description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="space-y-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-primary -ml-2 gap-2"
        >
          <Link href="/accidents">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-2xl text-red-600 shadow-inner">
            <ShieldAlert className="size-8" />
          </div>
          <div>
            <h1 className="text-3xl font-headline font-black text-primary uppercase leading-tight">
              Reportar Incidente
            </h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
              Canal de Segurança Imediata v1.0
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8 md:p-10 space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Tipo de Ocorrência
              </label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUASE_ACIDENTE">QUASE-ACIDENTE (Near-miss)</SelectItem>
                  <SelectItem value="ACIDENTE">ACIDENTE COM AFASTAMENTO</SelectItem>
                  <SelectItem value="DESVIO_EPI">NÃO USO DE EPI / DESVIO</SelectItem>
                  <SelectItem value="RISCO_AMBIENTAL">CONDIÇÃO AMBIENTAL INSEGURA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Local da Ocorrência
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3.5 size-4 text-slate-300" />
                <Input
                  placeholder="Ex: Galpão de Pintura - Linha B"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="pl-12 h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Descrição dos Fatos
              </label>
              <Textarea
                placeholder="Descreva o que ocorreu e quais os riscos imediatos observados..."
                className="min-h-[150px] bg-slate-50 border-none rounded-2xl p-5 text-sm font-medium shadow-inner"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>

            <div className="p-8 border-4 border-dashed border-slate-100 rounded-[2rem] text-center space-y-4 hover:bg-slate-50 transition-all cursor-pointer">
              <Camera className="size-12 text-slate-200 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-black text-primary uppercase">Evidência Fotográfica</p>
                <p className="text-[10px] text-slate-400 font-bold">
                  Obrigatório para Auditoria Neural
                </p>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Send className="size-5 text-accent" />
            )}
            Enviar Reporte à NAI
          </Button>
        </Card>
      </form>
    </div>
  );
}
