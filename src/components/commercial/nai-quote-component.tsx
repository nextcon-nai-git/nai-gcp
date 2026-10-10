"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import {
  Bot,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Zap,
  Save,
  Download,
  History,
  FileCheck,
  ChevronRight,
  User,
  MapPin,
  Mail,
  Phone,
  LayoutGrid,
  TrendingDown,
  Scale,
  Calendar,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import { gerarOrcamentoComNai } from "@/actions/nai-quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useStorage, useDoc, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { NaiSalesPitch } from "./nai-sales-pitch";

type OrcamentoGerado = {
  propostaExecutiva: {
    apresentacao: string;
    justificativaNormativa: string;
    analiseImpactoFinanceiro: string;
  };
  roiEstimado: {
    valorEconomiaAnual: number;
    descricaoBeneficio: string;
  };
  cronograma: {
    fase: string;
    prazo: string;
    atividades: string[];
  }[];
  pacotes: {
    nome: string;
    servicosInclusos: string[];
    valorImplementacao: number;
    valorMensal?: number;
    destaque: string;
  }[];
  dicaEstrategica: string;
};

export function NaiQuoteComponent() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();

  const [formData, setFormData] = React.useState({
    nomeEmpresa: "",
    nomeSolicitante: "",
    setor: "",
    cidade: "",
    estado: "",
    email: "",
    telefone: "",
    quantidadeFuncionarios: "",
    grauDeRisco: "1",
    necessidades: "",
  });

  const [loading, setLoading] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [orcamento, setOrcamento] = React.useState<OrcamentoGerado | null>(null);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOrcamento(null);

    try {
      const res = await gerarOrcamentoComNai(
        {
          ...formData,
          quantidadeFuncionarios: Number(formData.quantidadeFuncionarios),
          grauDeRisco: Number(formData.grauDeRisco) as 1 | 2 | 3 | 4,
        },
        await getActionIdToken()
      );

      if (res.sucesso && res.orcamento) {
        setOrcamento(res.orcamento as unknown as OrcamentoGerado);

        if (db && profile) {
          const taskData = {
            title: `Proposta de Elite: ${formData.nomeEmpresa}`,
            companyId: profile.companyId || "leads",
            companyName: formData.nomeEmpresa,
            type: "comercial",
            status: "to_review",
            priority: "high",
            origin: "commercial_ai",
            createdAt: new Date().toISOString(),
            totalValue:
              (res.orcamento as unknown as OrcamentoGerado).pacotes[1]?.valorImplementacao || 0,
          };

          const tasksRef = collection(db, "companies", profile.companyId || "leads", "tasks");
          await addDocumentNonBlocking(tasksRef, taskData);

          toast({
            title: "Dossiê Gerado!",
            description: "A NAI estruturou a proposta e criou o card no Funil de Vendas.",
          });
        }
      } else {
        toast({ variant: "destructive", title: "Falha na NAI", description: res.mensagem });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erro de Processamento" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in fade-in duration-500">
        <div className="lg:col-span-1 space-y-8">
          <NaiSalesPitch />
          <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden h-fit">
            <div className="p-8 bg-primary text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Sparkles className="size-5 text-accent" />
                </div>
                <h3 className="text-xl font-headline font-black uppercase">Ficha Prospect</h3>
              </div>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-tight">
                Configuração de Proposta Comercial.
              </p>
            </div>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Razão Social
                    </label>
                    <Input
                      required
                      className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                      value={formData.nomeEmpresa}
                      onChange={(e) => setFormData({ ...formData, nomeEmpresa: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Setor / Atividade
                    </label>
                    <Input
                      required
                      placeholder="Ex: Construção Civil"
                      className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                      value={formData.setor}
                      onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Vidas
                      </label>
                      <Input
                        required
                        type="number"
                        className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                        value={formData.quantidadeFuncionarios}
                        onChange={(e) =>
                          setFormData({ ...formData, quantidadeFuncionarios: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Grau de Risco
                      </label>
                      <select
                        className="w-full h-11 bg-slate-50 border-none rounded-xl px-4 text-[11px] font-bold shadow-inner"
                        value={formData.grauDeRisco}
                        onChange={(e) => setFormData({ ...formData, grauDeRisco: e.target.value })}
                      >
                        <option value="1">Grau 1</option>
                        <option value="2">Grau 2</option>
                        <option value="3">Grau 3</option>
                        <option value="4">Grau 4</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Necessidades / Dores
                    </label>
                    <Textarea
                      required
                      placeholder="Ex: Auditoria eSocial pendente, renovação PGR..."
                      className="min-h-[80px] bg-slate-50 border-none rounded-xl p-3 text-xs font-medium shadow-inner"
                      value={formData.necessidades}
                      onChange={(e) => setFormData({ ...formData, necessidades: e.target.value })}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
                >
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Zap className="size-5 text-accent" />
                  )}
                  Gerar Proposta de Elite
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!orcamento && !loading && (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-6 opacity-20 border-2 border-dashed rounded-[3rem] p-20 bg-white shadow-inner">
              <Bot className="size-32 text-primary mb-4" />
              <div className="space-y-2 max-w-sm">
                <p className="text-2xl font-black uppercase text-primary tracking-widest leading-tight">
                  Configurador de Propostas
                </p>
                <p className="text-sm font-bold text-slate-400">
                  Preencha os dados à esquerda para que a NAI elabore a melhor estratégia de
                  blindagem.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-8 bg-white rounded-[3rem] shadow-inner border">
              <Loader2 className="size-24 animate-spin text-primary opacity-20" />
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-primary animate-pulse">
                  NAI Estruturando ROI e Cronograma...
                </p>
              </div>
            </div>
          )}

          {orcamento && !loading && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              {/* ROI & ECONOMIA */}
              <Card className="border-none shadow-2xl bg-[#090e24] text-white rounded-[2.5rem] p-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                  <TrendingDown className="size-48 text-accent" />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-accent rounded-2xl text-primary shadow-xl shadow-accent/20">
                      <Scale className="size-6" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-accent font-headline">
                      Impacto e ROI Estimado
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-sm">
                      <p className="text-[10px] font-black uppercase text-white/40 mb-2">
                        Saving Anual Projetado
                      </p>
                      <h2 className="text-4xl font-black text-emerald-400 font-headline">
                        {orcamento.roiEstimado.valorEconomiaAnual.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </h2>
                      <div className="flex items-center gap-2 mt-3">
                        <ShieldCheck className="size-3 text-emerald-400" />
                        <span className="text-[9px] font-bold uppercase text-white/60">
                          Baseado em Redução de RAT/FAP
                        </span>
                      </div>
                    </div>
                    <p className="text-sm italic text-slate-300 leading-relaxed font-medium">
                      "{orcamento.roiEstimado.descricaoBeneficio}"
                    </p>
                  </div>
                </div>
              </Card>

              {/* PACOTES DE SERVIÇO */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-4 flex items-center gap-2">
                  <LayoutGrid className="size-3" /> Opções de Investimento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {orcamento.pacotes.map((pacote, i) => (
                    <Card
                      key={i}
                      className={cn(
                        "border-none shadow-sm rounded-[2rem] overflow-hidden transition-all hover:scale-[1.02]",
                        i === 1
                          ? "ring-2 ring-primary bg-white shadow-xl"
                          : "bg-slate-50 opacity-90"
                      )}
                    >
                      <CardHeader
                        className={cn(
                          "p-6 text-center",
                          i === 1 ? "bg-primary text-white" : "bg-slate-100"
                        )}
                      >
                        <CardTitle className="text-xs font-black uppercase tracking-widest">
                          {pacote.nome}
                        </CardTitle>
                        <p className="text-[10px] font-bold mt-1 opacity-70">{pacote.destaque}</p>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="space-y-2 min-h-[120px]">
                          {pacote.servicosInclusos.map((s, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 items-start text-[10px] font-bold text-slate-600"
                            >
                              <CheckCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-4 border-t border-dashed text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">
                            Implementação
                          </p>
                          <h4 className="text-xl font-black text-primary">
                            {pacote.valorImplementacao.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </h4>
                          {pacote.valorMensal && (
                            <Badge className="bg-accent text-primary font-black text-[8px] mt-2">
                              +{" "}
                              {pacote.valorMensal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}{" "}
                              / mês
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* CRONOGRAMA */}
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="size-5 text-primary" />
                    <CardTitle className="text-sm font-black uppercase text-primary">
                      Fluxo de Implantação 2026
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {orcamento.cronograma.map((item, i) => (
                      <div key={i} className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                          <div className="size-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-[10px] shadow-lg group-hover:scale-110 transition-transform">
                            {i + 1}
                          </div>
                          {i < orcamento.cronograma.length - 1 && (
                            <div className="w-0.5 flex-1 bg-slate-100 my-2" />
                          )}
                        </div>
                        <div className="pb-8">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-black text-primary uppercase text-sm">
                              {item.fase}
                            </h4>
                            <Badge
                              variant="outline"
                              className="text-[8px] font-black border-slate-200"
                            >
                              {item.prazo}
                            </Badge>
                          </div>
                          <ul className="space-y-2">
                            {(item.atividades || (item as any).atactivities || []).map(
                              (act: string, idx: number) => (
                                <li
                                  key={idx}
                                  className="text-[11px] text-slate-500 font-medium flex items-center gap-2"
                                >
                                  <ChevronRight className="size-3 text-accent" /> {act}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* INSIGHT ESTRATÉGICO */}
              <div className="p-6 bg-accent text-primary rounded-[2rem] border-2 border-primary/5 flex gap-4 items-start shadow-xl">
                <Sparkles className="size-6 shrink-0 mt-1" />
                <div className="space-y-1">
                  <h4 className="font-black uppercase text-xs tracking-widest">
                    Dica Estratégica NAI:
                  </h4>
                  <p className="text-sm italic font-medium leading-relaxed">
                    "{orcamento.dicaEstrategica}"
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 h-14 rounded-2xl font-black uppercase text-[10px] border-primary text-primary"
                >
                  Ajustar Escopo
                </Button>
                <Button className="flex-1 h-14 rounded-2xl bg-primary text-white font-black uppercase text-[10px] shadow-2xl gap-2">
                  <Download className="size-4 text-accent" /> Exportar Dossiê PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
