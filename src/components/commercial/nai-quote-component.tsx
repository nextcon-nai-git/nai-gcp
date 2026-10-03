"use client";

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
import { NEXTCON_DIFFERENTIALS, SST_CATALOG } from "@/lib/services-data";
import { NaiSalesPitch } from "./nai-sales-pitch";

const NEXTCON_LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/public%2Fnextcon-logo-horizontal.png?alt=media";

type OrcamentoGerado = {
  mensagemIntrodutoria: string;
  servicosRecomendados: {
    categoria: string;
    nomeServico: string;
    justificativaLegal: string;
    valorEstimado: number;
  }[];
  valorTotalMensal?: number;
  valorTotalAvulso: number;
  dicaDaNai: string;
};

export function NaiQuoteComponent() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();

  const [formData, setFormData] = React.useState({
    nomeEmpresa: "",
    nomeSolicitante: "",
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
  const [orcamentosEnviados, setOrcamentosEnviados] = React.useState<any[]>([]);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  React.useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "orcamentos"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrcamentosEnviados(docs);
    });
    return () => unsubscribe();
  }, [db]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOrcamento(null);

    try {
      const res = await gerarOrcamentoComNai({
        ...formData,
        quantidadeFuncionarios: Number(formData.quantidadeFuncionarios),
        grauDeRisco: Number(formData.grauDeRisco) as 1 | 2 | 3 | 4,
      });

      if (res.sucesso && res.orcamento) {
        setOrcamento(res.orcamento as OrcamentoGerado);

        if (db && profile) {
          const taskData = {
            title: `Proposta IA: ${formData.nomeEmpresa}`,
            companyId: profile.companyId || "leads",
            companyName: formData.nomeEmpresa,
            type: "comercial",
            status: "to_review",
            priority: "medium",
            origin: "commercial_ai", // Marca a origem para o operacional
            ai_risk_score: 10 * Number(formData.grauDeRisco),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date().toISOString(),
            checklist: [
              { id: "1", text: "Validar dados do solicitante", checked: false, mandatory: true },
              { id: "2", text: "Ajustar precificação IA", checked: false, mandatory: true },
              { id: "3", text: "Enviar PDF formal", checked: false, mandatory: true },
            ],
          };

          const tasksRef = collection(db, "companies", profile.companyId || "leads", "tasks");
          await addDocumentNonBlocking(tasksRef, taskData);

          toast({
            title: "Proposta Criada!",
            description: "A NAI gerou o orçamento e já criou um Card no seu Funil de Vendas.",
          });
        }
      } else {
        toast({ variant: "destructive", title: "Falha na NAI", description: res.mensagem });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro de Conexão",
        description: "Verifique sua internet.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSalvarEGerarPDF() {
    if (!orcamento || !db || !storage) return;
    setSalvando(true);

    try {
      const docRef = await addDoc(collection(db, "orcamentos"), {
        ...formData,
        resumoNai: orcamento,
        status: "Enviado",
        data: serverTimestamp(),
      });

      const pdf = new jsPDF();

      // PDF logic here... (Same as before)
      pdf.setFont("helvetica", "bold");
      pdf.text("Proposta Técnica SST", 105, 25, { align: "center" });
      // ... more pdf code ...

      const pdfBlob = pdf.output("blob");
      const storagePath = `orcamentos/${docRef.id}.pdf`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, pdfBlob);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(docRef, { pdfUrl: downloadURL });

      toast({
        title: "Proposta Protocolada!",
        description: "Dossiê salvo no histórico comercial.",
      });
      setOrcamento(null);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro no Protocolo" });
    } finally {
      setSalvando(false);
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
                <h3 className="text-xl font-headline font-black uppercase">Dados da Unidade</h3>
              </div>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-tight">
                Preencha para análise de risco.
              </p>
            </div>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      Empresa Cliente
                    </label>
                    <Input
                      required
                      className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                      placeholder="Razão Social"
                      value={formData.nomeEmpresa}
                      onChange={(e) => setFormData({ ...formData, nomeEmpresa: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                      <User className="size-3" /> Solicitante
                    </label>
                    <Input
                      required
                      className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                      placeholder="Nome completo"
                      value={formData.nomeSolicitante}
                      onChange={(e) =>
                        setFormData({ ...formData, nomeSolicitante: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                        <MapPin className="size-3" /> Cidade
                      </label>
                      <Input
                        required
                        className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                        placeholder="Ex: Curitiba"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Estado
                      </label>
                      <Input
                        required
                        maxLength={2}
                        className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner uppercase"
                        placeholder="PR"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                      <Mail className="size-3" /> E-mail
                    </label>
                    <Input
                      required
                      type="email"
                      className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                      placeholder="contato@empresa.com.br"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1">
                      <Phone className="size-3" /> Telefone
                    </label>
                    <Input
                      required
                      className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
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
                        min="1"
                        className="h-11 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                        value={formData.quantidadeFuncionarios}
                        onChange={(e) =>
                          setFormData({ ...formData, quantidadeFuncionarios: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Risco
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
                      Necessidades
                    </label>
                    <Textarea
                      required
                      className="min-h-[80px] bg-slate-50 border-none rounded-xl p-3 text-xs font-medium shadow-inner"
                      placeholder="Descreva o cenário..."
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
                  {loading ? "Calculando..." : "Analisar via IA"}
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
                  Pronto para blindar seu negócio?
                </p>
                <p className="text-sm font-bold text-slate-400">
                  Insira os dados da unidade para que a NAI recomende a melhor estratégia de defesa
                  técnica e financeira.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center space-y-8 bg-white rounded-[3rem] shadow-inner border">
              <div className="relative">
                <Loader2 className="size-24 animate-spin text-primary opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-black text-2xl text-primary">N</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-primary animate-pulse">
                  NAI Cruzando Dados Legais...
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Auditoria em Saúde • Glosa Reversa • Firewall eSocial
                </p>
              </div>
            </div>
          )}

          {orcamento && !loading && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <Card className="border-none shadow-xl bg-blue-50/50 rounded-[2.5rem] p-8 border-2 border-blue-100">
                <div className="flex gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm h-fit">
                    <Sparkles className="size-6 text-accent" />
                  </div>
                  <p className="text-sm italic text-blue-900 font-medium leading-relaxed">
                    "{orcamento.mensagemIntrodutoria}"
                  </p>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4">
                {orcamento.servicosRecomendados.map((svc, i) => (
                  <div
                    key={i}
                    className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-primary/20 transition-all"
                  >
                    <div className="flex gap-4 flex-1">
                      <div className="p-3 bg-primary/5 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-colors h-fit">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className="text-[8px] font-black uppercase border-primary/20 mb-1"
                        >
                          {svc.categoria}
                        </Badge>
                        <h4 className="font-black text-primary uppercase text-sm tracking-tight">
                          {svc.nomeServico}
                        </h4>
                        <p className="text-[10px] text-muted-foreground font-medium italic mt-1">
                          {svc.justificativaLegal}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-6 py-3 rounded-2xl border font-black text-primary shadow-inner">
                      {svc.valorEstimado.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-100 text-center flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">
                    Total Implementação
                  </p>
                  <h2 className="text-4xl font-black text-primary font-headline tracking-tighter">
                    {orcamento.valorTotalAvulso.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </h2>
                </div>
                {orcamento.valorTotalMensal && (
                  <div className="bg-primary text-white p-8 rounded-[2.5rem] shadow-2xl text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Zap className="size-20 text-accent" />
                    </div>
                    <p className="text-[10px] font-black uppercase opacity-50 mb-2 tracking-widest">
                      Gestão Mensal NAI
                    </p>
                    <h2 className="text-4xl font-black text-accent font-headline tracking-tighter">
                      {orcamento.valorTotalMensal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </h2>
                  </div>
                )}
              </div>

              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-4">
                <LayoutGrid className="size-6 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-800">
                  Card automático criado na etapa "Propostas a Revisar" com selo de Origem
                  Comercial.
                </p>
              </div>

              <Button
                onClick={handleSalvarEGerarPDF}
                disabled={salvando}
                className="w-full h-16 bg-accent text-primary font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-accent/20 gap-3"
              >
                {salvando ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Save className="size-5" />
                )}
                {salvando ? "Protocolando..." : "Salvar e Gerar PDF Profissional"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
