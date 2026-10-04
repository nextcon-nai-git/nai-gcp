"use client";

import * as React from "react";
import {
  Stethoscope,
  Brain,
  Activity,
  ShieldCheck,
  TrendingDown,
  Clock,
  FileText,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Info,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";

export default function MultidisciplinaryProposalPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isSaving, setIsSaving] = React.useState(false);

  const MONTHLY_INVESTMENT = 12000.0;

  const specialists = [
    {
      title: "Médico do Trabalho",
      icon: Stethoscope,
      color: "text-blue-600",
      bg: "bg-blue-50",
      tasks: [
        "Gestão de atestados",
        "ASOs no local",
        "Avaliação de nexo causal",
        "Comitês de saúde",
      ],
    },
    {
      title: "Fisioterapeuta Ergonomista",
      icon: Activity,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      tasks: [
        "Blitz postural",
        "Pausas ativas",
        "Ajustes microergonômicos",
        "Triagem osteomuscular",
      ],
    },
    {
      title: "Psicólogo do Trabalho",
      icon: Brain,
      color: "text-purple-600",
      bg: "bg-purple-50",
      tasks: [
        "Plantão de escuta",
        "Mediação de conflitos",
        "Riscos psicossociais",
        "Clima organizacional",
      ],
    },
  ];

  const handleCreateCard = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      const colRef = collection(db, "companies", "leads", "tasks");
      await addDocumentNonBlocking(colRef, {
        title: "Proposta: Gestão Multidisciplinar In Company",
        companyName: "Prospect Operação Estratégica",
        type: "comercial",
        status: "to_review",
        priority: "high",
        totalValue: MONTHLY_INVESTMENT,
        createdAt: new Date().toISOString(),
        metadata: {
          scope: "1 período semanal (4h)",
          specialists: "Médico, Fisio, Psico",
          city: "Unidade Operacional",
        },
      });
      toast({
        title: "Proposta Protocolada",
        description: "Card comercial gerado no Funil de Vendas.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary text-accent rounded-2xl shadow-xl">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase font-headline tracking-tight leading-none">
                Gestão In Company
              </h1>
              <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em] mt-1">
                Atendimento Multidisciplinar • Unidade Operacional
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-primary text-primary font-black uppercase text-[10px] h-12 px-6 rounded-xl"
          >
            <FileText className="size-4 mr-2" /> PDF Executivo
          </Button>
          <Button
            onClick={handleCreateCard}
            disabled={isSaving}
            className="gradient-nextcon text-white font-black uppercase text-[10px] h-12 px-8 rounded-xl shadow-2xl gap-2"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4 text-accent" />
            )}
            Gerar Proposta
          </Button>
        </div>
      </header>

      {/* 1. O Desafio Atual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] p-10">
            <div className="space-y-6">
              <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-2xl">
                <ShieldCheck className="size-6" />
              </div>
              <h2 className="text-2xl font-black text-primary uppercase font-headline">
                O Desafio Atual
              </h2>
              <p className="text-slate-600 leading-relaxed font-medium">
                Sabemos que empresas do setor{" "}
                <span className="text-primary font-bold">logístico, portuário e industrial</span>{" "}
                lidam com uma operação de alta intensidade. Isso gera desafios diretos na saúde do
                trabalhador, impactando indicadores como absenteísmo (faltas por atestados),
                presenteísmo (queda de produtividade) e o aumento da carga tributária (FAP/RAT)
                devido a afastamentos.
              </p>
              <div className="p-6 bg-slate-50 rounded-3xl border-l-4 border-primary italic text-primary/70 font-medium">
                &quot;Nosso objetivo não é apenas cumprir a legislação (NRs), mas atuar de forma
                estratégica para proteger o principal ativo da sua empresa: as pessoas.&quot;
              </div>
            </div>
          </Card>

          {/* 2. A Nossa Solução */}
          <div className="space-y-6">
            <h2 className="text-xl font-headline font-black text-primary uppercase ml-4">
              Solução: Tripé de Excelência
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {specialists.map((s) => (
                <Card
                  key={s.title}
                  className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all"
                >
                  <div className={cn("p-6 flex flex-col items-center text-center gap-4", s.bg)}>
                    <div className={cn("p-3 rounded-2xl bg-white shadow-sm", s.color)}>
                      <s.icon className="size-6" />
                    </div>
                    <h3 className="font-black text-primary uppercase text-[11px] leading-tight">
                      {s.title}
                    </h3>
                  </div>
                  <CardContent className="p-6">
                    <ul className="space-y-3">
                      {s.tasks.map((task, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[10px] font-bold text-slate-500"
                        >
                          <CheckCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* 3. Retorno sobre Investimento */}
          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <TrendingDown className="size-32 text-accent" />
            </div>
            <div className="relative z-10 space-y-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <DollarSign className="size-4" /> ROI Estratégico
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[9px] font-black uppercase text-white/40 mb-1">
                    Redução de FAP
                  </p>
                  <p className="text-[11px] font-medium leading-relaxed">
                    Diminuição de afastamentos B91 e impacto na folha.
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[9px] font-black uppercase text-white/40 mb-1">
                    Blindagem Jurídica
                  </p>
                  <p className="text-[11px] font-medium leading-relaxed">
                    Prontuários unificados e gestão ativa de riscos.
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[9px] font-black uppercase text-white/40 mb-1">
                    Otimização de Tempo
                  </p>
                  <p className="text-[11px] font-medium leading-relaxed">
                    Fim do deslocamento para clínicas externas.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* 4. Investimento */}
          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-primary text-white p-8">
              <CardTitle className="text-xs font-black uppercase tracking-widest">
                Investimento Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-dashed pb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Frequência</p>
                    <p className="text-xs font-bold text-primary">01 Período Semanal (4h)</p>
                  </div>
                  <Clock className="size-5 text-slate-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Equipe Alocada</p>
                  <p className="text-xs font-bold text-primary">01 Médico + 01 Fisio + 01 Psico</p>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Valor do Plano
                </p>
                <h2 className="text-3xl font-black text-primary font-headline">
                  {MONTHLY_INVESTMENT.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </h2>
                <Badge className="bg-accent text-primary font-black uppercase text-[8px] mt-2">
                  Faturamento via Nota Fiscal
                </Badge>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                <p className="text-[9px] font-black text-primary uppercase flex items-center gap-2">
                  <Info className="size-3" /> Condições Gerais
                </p>
                <p className="text-[10px] text-primary/70 italic leading-relaxed">
                  Documentos macro (PCMSO, AET, LTCAT) orçados à parte com{" "}
                  <span className="font-bold">15% de desconto</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
