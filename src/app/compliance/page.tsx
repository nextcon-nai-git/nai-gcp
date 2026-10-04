"use client";

import * as React from "react";
import {
  ShieldCheck,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Loader2,
  Send,
  UserCheck,
  UserX,
  Lock,
  ArrowRight,
  CheckCircle2,
  Scale,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { criarDenuncia, CATEGORIAS_COMPLIANCE } from "@/services/compliance-service";
import { cn } from "@/lib/utils";

export default function CompliancePublicPage() {
  const { toast } = useToast();
  const db = useFirestore();

  const [isAnonimo, setIsAnonimo] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [protocoloGerado, setProtocoloGerado] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    nome: "",
    email: "",
    categoria: "",
    descricao: "",
    dataFato: "",
    local: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setLoading(true);

    try {
      const protocolo = await criarDenuncia(db, { ...form, isAnonimo });
      setProtocoloGerado(protocolo);
      toast({
        title: "Relato Enviado",
        description: "Guarde seu número de protocolo para consulta.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro no Envio" });
    } finally {
      setLoading(false);
    }
  }

  if (protocoloGerado) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 animate-in zoom-in-95 duration-500">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[3rem] p-10 text-center space-y-8 bg-white">
          <div className="size-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-primary uppercase">Relato Protocolado</h2>
            <p className="text-slate-500 font-medium">
              Sua contribuição é vital para nossa integridade.
            </p>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">
              Seu Número de Protocolo:
            </p>
            <h3 className="text-2xl font-black text-primary font-mono tracking-widest">
              {protocoloGerado}
            </h3>
          </div>
          <p className="text-xs text-slate-400 italic">
            "Utilize este código para futuras consultas ao status do seu relato."
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl"
          >
            Novo Relato
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <header className="text-center space-y-4">
        <div className="inline-flex p-3 bg-primary/5 rounded-2xl mb-2">
          <Lock className="size-10 text-primary" />
        </div>
        <h1 className="text-4xl font-headline font-black text-primary uppercase tracking-tight leading-none">
          Canal de Ética & Compliance
        </h1>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">
          Este é um canal seguro e, se desejar, totalmente anônimo para relatar condutas que violem
          nossos princípios ou a legislação vigente.
        </p>
      </header>

      {/* SEÇÃO INFORMATIVA DE PILARES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8 flex flex-col gap-4 group hover:ring-2 ring-primary/5 transition-all">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl w-fit group-hover:bg-primary group-hover:text-white transition-all">
            <Scale className="size-6" />
          </div>
          <div>
            <h3 className="font-black text-primary uppercase text-sm mb-2">
              Independência e Imparcialidade
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Um site externo dedicado a denúncias oferece mais credibilidade perante ao mercado e
              sociedade em geral.
            </p>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8 flex flex-col gap-4 group hover:ring-2 ring-primary/5 transition-all">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit group-hover:bg-primary group-hover:text-white transition-all">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <h3 className="font-black text-primary uppercase text-sm mb-2">
              O processo de denúncias
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Para que você compreenda melhor quem fica responsável pela denúncia, confira a visão
              geral de cada função e suas respectivas atribuições.
            </p>
          </div>
        </Card>

        <Card className="border-none shadow-sm bg-white rounded-[2rem] p-8 flex flex-col gap-4 group hover:ring-2 ring-primary/5 transition-all">
          <div className="p-3 bg-accent/10 text-accent rounded-2xl w-fit group-hover:bg-primary group-hover:text-white transition-all">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="font-black text-primary uppercase text-sm mb-2">
              Garantia do sigilo e do anonimato
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Para que você compreenda melhor quem fica responsável pela denúncia, confira a visão
              geral de cada função e suas respectivas atribuições.
            </p>
          </div>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        <div className="lg:col-span-8 space-y-6">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-8 md:p-10 space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                <MessageSquare className="size-4 text-accent" /> Detalhes do Relato
              </h3>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Categoria do Incidente
                </label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v })}
                  required
                >
                  <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                    <SelectValue placeholder="Selecione uma categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIAS_COMPLIANCE).map(([id, cat]) => (
                      <SelectItem key={id} value={id} className="text-xs font-bold uppercase">
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Data Aproximada
                  </label>
                  <Input
                    type="date"
                    value={form.dataFato}
                    onChange={(e) => setForm({ ...form, dataFato: e.target.value })}
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                    Local / Unidade
                  </label>
                  <Input
                    placeholder="Ex: Galpão de Obras"
                    value={form.local}
                    onChange={(e) => setForm({ ...form, local: e.target.value })}
                    className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Descrição Detalhada
                </label>
                <Textarea
                  placeholder="Relate o ocorrido com o máximo de detalhes possível (quem, como, quando)..."
                  className="min-h-[150px] bg-slate-50 border-none rounded-2xl p-5 text-sm font-medium shadow-inner"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  required
                />
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
              Enviar Relato com Segurança
            </Button>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="card-shadow border-none bg-slate-900 text-white rounded-[2rem] p-8 space-y-6">
            <h4 className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-2">
              {isAnonimo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}{" "}
              Identificação
            </h4>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsAnonimo(true)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all text-left",
                  isAnonimo
                    ? "bg-white/10 border-accent"
                    : "bg-transparent border-white/5 opacity-40"
                )}
              >
                <p className="text-xs font-black uppercase">Relato Anônimo</p>
                <p className="text-[9px] font-medium text-white/50 mt-1">
                  Sua identidade será preservada integralmente.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIsAnonimo(false)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all text-left",
                  !isAnonimo
                    ? "bg-white/10 border-accent"
                    : "bg-transparent border-white/5 opacity-40"
                )}
              >
                <p className="text-xs font-black uppercase">Relato Identificado</p>
                <p className="text-[9px] font-medium text-white/50 mt-1">
                  Apenas o comitê de ética terá acesso aos seus dados.
                </p>
              </button>
            </div>

            {!isAnonimo && (
              <div className="space-y-3 animate-in slide-in-from-top-2">
                <Input
                  placeholder="Seu Nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="bg-white/5 border-none h-11 text-xs"
                />
                <Input
                  placeholder="Seu E-mail"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="bg-white/5 border-none h-11 text-xs"
                />
              </div>
            )}
          </Card>

          <Card className="border-none bg-blue-50 rounded-[2rem] p-8 space-y-4">
            <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px]">
              <ShieldCheck className="size-4" /> Garantias NAI
            </div>
            <ul className="space-y-3">
              {["Não retaliação garantida", "Criptografia de ponta a ponta", "Sigilo Absoluto"].map(
                (g) => (
                  <li
                    key={g}
                    className="flex items-center gap-2 text-[11px] font-bold text-slate-600"
                  >
                    <CheckCircle2 className="size-3 text-emerald-500" /> {g}
                  </li>
                )
              )}
            </ul>
          </Card>
        </div>
      </form>
    </div>
  );
}
