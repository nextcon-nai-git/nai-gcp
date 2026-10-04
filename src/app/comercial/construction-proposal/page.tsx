"use client";

import * as React from "react";
import {
  HardHat,
  Zap,
  FileText,
  Loader2,
  Construction,
  Sparkles,
  TrendingDown,
  Activity,
  HeartPulse,
  Box,
  Scale,
  CheckCircle2,
  CalendarDays,
  UserCheck,
  Stethoscope,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { collection } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SCENARIOS = {
  standard: {
    id: "standard",
    label: "Standard (1+1)",
    description: "Cenário 1: Presença fixa para suporte técnico administrativo.",
    professionals: "2 especialistas (1 TST + 1 Enf.)",
    prices: {
      sst: 11900.0,
      health: 11900.0,
      specialized: 0,
      infra: 6500.0,
    },
    scaleText: "Presença diária em horário administrativo (Seg-Sáb).",
  },
  full: {
    id: "full",
    label: "Full (2+2)",
    description: "Cenário 2: Cobertura total 12x36h para alta produtividade.",
    professionals: "4 especialistas (2 TST + 2 Enf.)",
    prices: {
      sst: 22400.0,
      health: 22400.0,
      specialized: 0,
      infra: 6500.0,
    },
    scaleText: "Regime 12x36h garantindo 100% de cobertura operacional.",
  },
  elite: {
    id: "elite",
    label: "Elite (Full + Especialistas)",
    description: "Cenário 3: Gestão de alta performance com suporte clínico e mental.",
    professionals: "4 especialistas fixos + 3 consultores semanais",
    prices: {
      sst: 22400.0,
      health: 22400.0,
      specialized: 12000.0, // 4800 (Med) + 3600 (Fisio) + 3600 (Psico)
      infra: 6500.0,
    },
    scaleText: "Regime 12x36h + Visitas semanais de Médico, Fisio e Psicólogo.",
  },
};

const ROI_BASE = {
  payroll: 5000000,
  currentFap: 1.2,
  targetFap: 0.5,
  rat: 0.03,
};

export default function ConstructionProposalPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeScenario, setActiveScenario] = React.useState<"standard" | "full" | "elite">(
    "standard"
  );

  const current = SCENARIOS[activeScenario];
  const totalMonthly =
    current.prices.sst + current.prices.health + current.prices.specialized + current.prices.infra;

  const currentTax = ROI_BASE.payroll * ROI_BASE.rat * ROI_BASE.currentFap;
  const targetTax =
    ROI_BASE.payroll * ROI_BASE.rat * (activeScenario === "elite" ? 0.4 : ROI_BASE.targetFap);
  const annualSaving = currentTax - targetTax;

  const handleSendToClient = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      const proposalRef = collection(db, "companies", "leads", "tasks");
      await addDocumentNonBlocking(proposalRef, {
        title: `Proposta Técnica: ${current.label}`,
        companyName: "Prospect Setor Construção",
        type: "comercial",
        status: "sent",
        priority: "critical",
        totalValue: totalMonthly,
        createdAt: new Date().toISOString(),
        metadata: {
          project: "Unidade Operacional",
          scenario: activeScenario,
          roi_saving: annualSaving,
        },
        checklist: [
          { id: "1", text: "Confirmar mobilização técnica", checked: false, mandatory: true },
          { id: "2", text: "Validar escala com RH do cliente", checked: false, mandatory: true },
        ],
      });
      toast({
        title: "Proposta Enviada!",
        description: `Plano ${current.label} protocolado no funil comercial.`,
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
              <Construction className="size-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase font-headline tracking-tight leading-none">
                Proposta Setor Construção
              </h1>
              <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em] mt-1">
                Gestão de Risco & Saúde de Canteiro
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
            onClick={handleSendToClient}
            disabled={isSaving}
            className="gradient-nextcon text-white font-black uppercase text-[10px] h-12 px-8 rounded-xl shadow-2xl gap-2"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4 text-accent" />
            )}
            Gerar Proposta
          </Button>
        </div>
      </header>

      {/* Seletor de Plano */}
      <Card className="card-shadow border-none bg-slate-100 p-2 rounded-[2rem] max-w-3xl mx-auto">
        <Tabs
          value={activeScenario}
          onValueChange={(v: any) => setActiveScenario(v)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-3 bg-transparent h-14">
            <TabsTrigger
              value="standard"
              className="rounded-2xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black uppercase text-[10px] tracking-widest"
            >
              Standard (1+1)
            </TabsTrigger>
            <TabsTrigger
              value="full"
              className="rounded-2xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black uppercase text-[10px] tracking-widest"
            >
              Full (2+2)
            </TabsTrigger>
            <TabsTrigger
              value="elite"
              className="rounded-2xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md font-black uppercase text-[10px] tracking-widest text-accent"
            >
              Elite (2+2 + Esp.)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Célula Segurança */}
            <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
              <div className="flex flex-col md:flex-row">
                <div className="p-8 flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                      <HardHat className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-primary uppercase text-sm">
                        {activeScenario === "standard"
                          ? "Célula de Segurança (1 TST)"
                          : "Célula de Segurança (2 TSTs)"}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {activeScenario === "standard"
                          ? "01 Técnico de Segurança dedicado."
                          : "02 Técnicos de Segurança em revezamento."}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Liberações PET/APR
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Engenheiro (Bonificado)
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Treinamentos In Loco
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Presença Diária
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-8 flex flex-col items-center justify-center border-l md:w-64">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Investimento
                  </p>
                  <h4 className="text-xl font-black text-primary">
                    {current.prices.sst.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </h4>
                </div>
              </div>
            </Card>

            {/* Célula Enfermagem */}
            <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
              <div className="flex flex-col md:flex-row">
                <div className="p-8 flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                      <HeartPulse className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-primary uppercase text-sm">
                        {activeScenario === "standard"
                          ? "Célula de Enfermagem (1 Enf.)"
                          : "Célula de Enfermagem (2 Enf.)"}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {activeScenario === "standard"
                          ? "01 Técnico de Enfermagem dedicado."
                          : "02 Técnicos de Enfermagem (12x36h)."}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Primeiros Socorros
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Controle Absenteísmo
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Prontuário Digital
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <CheckCircle2 className="size-3 text-emerald-500" /> Gestão de Queixas
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-8 flex flex-col items-center justify-center border-l md:w-64">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Investimento
                  </p>
                  <h4 className="text-xl font-black text-primary">
                    {current.prices.health.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </h4>
                </div>
              </div>
            </Card>

            {/* ESPECIALISTAS (Somente no Elite) */}
            {activeScenario === "elite" && (
              <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-accent/20 transition-all border-2 border-accent/5">
                <div className="flex flex-col md:flex-row">
                  <div className="p-8 flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 rounded-2xl bg-accent/5 text-accent shadow-inner">
                        <Stethoscope className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-primary uppercase text-sm">
                          Corpo Clínico Especializado
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          Suporte Semanal Multidisciplinar (Meio Período).
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary">
                          <UserCheck className="size-3 text-blue-500" /> Médico do Trabalho
                          (1x/Semana)
                        </div>
                        <span className="text-[10px] font-black text-primary">
                          R$ 1.200,00/Per.
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary">
                          <Activity className="size-3 text-emerald-500" /> Fisioterapeuta Ergon.
                          (1x/Semana)
                        </div>
                        <span className="text-[10px] font-black text-primary">R$ 900,00/Per.</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary">
                          <Brain className="size-3 text-purple-500" /> Psicólogo do Trabalho
                          (1x/Semana)
                        </div>
                        <span className="text-[10px] font-black text-primary">R$ 900,00/Per.</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-accent/5 p-8 flex flex-col items-center justify-center border-l md:w-64">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Especialistas
                    </p>
                    <h4 className="text-xl font-black text-primary">R$ 12.000,00</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                      4 Semanas/Mês
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Infraestrutura */}
            <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/5 transition-all">
              <div className="flex flex-col md:flex-row">
                <div className="p-8 flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-2xl bg-slate-50 text-primary shadow-inner">
                      <Box className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-primary uppercase text-sm">
                        Infraestrutura e Insumos
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        Locação de DEA, Maca, Oxigênio e Reposição.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Badge variant="outline" className="text-[8px] font-black uppercase">
                      Equipamentos de Ponta
                    </Badge>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">
                      Manutenção Inclusa
                    </Badge>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">
                      Reposição Mensal
                    </Badge>
                  </div>
                </div>
                <div className="bg-slate-50 p-8 flex flex-col items-center justify-center border-l md:w-64">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Fixo
                  </p>
                  <h4 className="text-xl font-black text-primary">R$ 6.500,00</h4>
                </div>
              </div>
            </Card>
          </div>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-8">
              <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                <CalendarDays className="size-4" /> Logística de Escala
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700 font-bold text-sm italic">
                &quot;{current.scaleText}&quot;
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                *Dimensionamento garantindo a conformidade legal e o bem-estar da equipe técnica em
                obra.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="card-shadow border-none bg-[#090e24] text-white rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-1000">
              <TrendingDown className="size-48 text-accent" />
            </div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent rounded-xl text-primary shadow-lg shadow-accent/20">
                  <Scale className="size-5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-accent">
                  Análise de ROI (FAP)
                </h3>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase text-white/40 mb-2">
                    Economia Anual Estimada
                  </p>
                  <h2 className="text-3xl font-black text-emerald-400 font-headline">
                    {annualSaving.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <TrendingDown className="size-3 text-emerald-400" />
                    <span className="text-[9px] font-bold uppercase text-white/60">
                      {activeScenario === "elite" ? "FAP Estimado: 0.40" : "FAP Estimado: 0.50"}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] leading-relaxed italic text-white/40 border-t border-white/5 pt-4">
                  &quot;A economia gerada no FAP cobre cerca de{" "}
                  {Math.round((annualSaving / (totalMonthly * 12)) * 100)}% do investimento anual
                  total nesta proposta.&quot;
                </p>
              </div>
            </div>
          </Card>

          <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-primary text-white p-8">
              <CardTitle className="text-xs font-black uppercase tracking-widest">
                Resumo {current.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">{current.professionals}</span>
                  <span className="text-primary">
                    {(current.prices.sst + current.prices.health).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                {current.prices.specialized > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-accent">
                    <span>Corpo Clínico Semanal</span>
                    <span>
                      {current.prices.specialized.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">Infra e Insumos Full</span>
                  <span className="text-primary">R$ 6.500,00</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">Supervisão e IA</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px]">
                    INCLUSO
                  </Badge>
                </div>
              </div>

              <div className="pt-6 border-t border-dashed">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Investimento Total
                    </p>
                    <h2 className="text-2xl font-black text-primary font-headline">
                      {totalMonthly.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </h2>
                  </div>
                  <Badge className="bg-primary text-white h-6 font-black text-[8px] uppercase">
                    Mensal
                  </Badge>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3 items-start">
                <Sparkles className="size-4 text-primary shrink-0" />
                <p className="text-[9px] font-medium text-primary/70 leading-relaxed italic">
                  Próximos Passos: Assinatura do contrato e mobilização técnica em até 15 dias após
                  aprovação.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
