"use client";

import * as React from "react";
import { Scale, Calculator, Landmark, Loader2, Gavel } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useCollection, useUser, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy, collectionGroup, doc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSgi } from "@/contexts/sgi-context";

import { parseExtratoToDre, DreFinancialStatement } from "@/actions/dre-excel-parser";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Sparkles,
  Upload,
} from "lucide-react";

export default function LegalFinancial() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { activeClientId } = useSgi();
  const [fapValue, setFapValue] = React.useState([0.74]);
  const [payroll, setPayroll] = React.useState(150000);
  const [dreData, setDreData] = React.useState<DreFinancialStatement | null>(null);
  const [isProcessingDre, setIsProcessingDre] = React.useState(false);

  React.useEffect(() => {
    // Carrega DRE inicial demonstrativa
    parseExtratoToDre(
      "Receita ASO CETESB;125800\nClinica Credenciada Exames;-28400\nElaboração PGR DW Montec;-14200\nHonorarios Medicos;-18600"
    ).then((res) => {
      if (res.sucesso && res.dados) setDreData(res.dados);
    });
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingDre(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = (event.target?.result as string) || "";
        const res = await parseExtratoToDre(text, file.name);
        if (res.sucesso && res.dados) {
          setDreData(res.dados);
          toast({
            title: "DRE Gerada com Sucesso!",
            description: `Extrato ${file.name} processado com EBITDA de R$ ${res.dados.ebitda.toLocaleString("pt-BR")}.`,
          });
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na Leitura", description: err.message });
    } finally {
      setIsProcessingDre(false);
      if (e.target) e.target.value = "";
    }
  };

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  // Busca perícias reais do Firestore protegendo a hierarquia multi-tenant
  const expertisesQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (activeClientId === "all") {
      return query(collectionGroup(db, "legalExpertises"), orderBy("date", "desc"));
    }
    return query(
      collection(db, "companies", activeClientId, "legalExpertises"),
      orderBy("date", "desc")
    );
  }, [db, activeClientId]);

  const { data: expertises, isLoading: loadingExpertises } = useCollection(expertisesQuery);

  const totalRiskValue = React.useMemo(() => {
    if (!expertises) return 0;
    return expertises.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [expertises]);

  const potentialSavings = (payroll * 0.02 * (1 - fapValue[0])).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight uppercase">
            Financeiro & ROI Estratégico
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1 flex items-center gap-2">
            <Landmark className="size-3 text-accent" />{" "}
            {activeClientId === "all" ? "Rede Global Consolidada" : "Unidade Técnica Ativa"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/legal-financial/pericias">
            <Button className="h-10 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg">
              <Gavel size={14} className="text-accent" /> Perícias Britânia (Martinelli)
            </Button>
          </Link>

          <label className="inline-flex items-center gap-2 h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-lg transition-all hover:scale-105">
            {isProcessingDre ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4 text-accent" />
            )}
            <span>Importar Extrato Excel / CSV</span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessingDre}
            />
          </label>

          <Badge className="bg-[#090e24] text-[#f59e0b] font-black uppercase text-[10px] tracking-widest px-4 h-10 flex items-center border border-[#f59e0b]/20 shadow-lg">
            Risco em Monitoramento:{" "}
            {totalRiskValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </Badge>
        </div>
      </div>

      {/* DRE GERENCIAL OCUPACIONAL DASHBOARD */}
      {dreData && (
        <Card className="card-shadow border-none rounded-[2.5rem] bg-white overflow-hidden text-left">
          <CardHeader className="bg-slate-900 text-white p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <Badge className="bg-emerald-500 text-slate-950 border-none text-[8px] font-black uppercase tracking-widest px-3 h-5 mb-1">
                  <Sparkles size={12} className="mr-1" /> DRE GERENCIAL IA SGI
                </Badge>
                <CardTitle className="text-2xl font-headline font-black uppercase tracking-tight">
                  Demonstrativo do Resultado do Exercício (DRE)
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs font-medium">
                  {dreData.periodo} • Análise Gerencial Ocupacional Nextcon
                </CardDescription>
              </div>

              <div className="p-4 bg-white/10 rounded-2xl border border-white/10 flex items-center gap-4">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Margem EBITDA</p>
                  <p className="text-2xl font-black text-emerald-400">
                    {dreData.margemEbitdaPercentual}%
                  </p>
                </div>
                <PieChart className="size-8 text-accent opacity-80" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 bg-slate-50 border rounded-3xl space-y-1">
                <span className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-between">
                  Receita Bruta <ArrowUpRight size={14} className="text-emerald-500" />
                </span>
                <p className="text-xl font-black text-primary">
                  R$ {dreData.receitaBrutaSst.toLocaleString("pt-BR")}
                </p>
                <p className="text-[9px] text-slate-400">
                  Deduções ISS: R$ {dreData.deducoesImpostos.toLocaleString("pt-BR")}
                </p>
              </div>

              <div className="p-5 bg-slate-50 border rounded-3xl space-y-1">
                <span className="text-[9px] font-black uppercase text-slate-400 flex items-center justify-between">
                  Custos Serviços (CSP) <ArrowDownRight size={14} className="text-red-500" />
                </span>
                <p className="text-xl font-black text-red-600">
                  R$ {dreData.custosServicosPrestados.totalCustos.toLocaleString("pt-BR")}
                </p>
                <p className="text-[9px] text-slate-400">Exames + Laudos + Redes</p>
              </div>

              <div className="p-5 bg-slate-50 border rounded-3xl space-y-1">
                <span className="text-[9px] font-black uppercase text-slate-400">
                  Lucro Bruto Operacional
                </span>
                <p className="text-xl font-black text-slate-800">
                  R$ {dreData.lucroBruto.toLocaleString("pt-BR")}
                </p>
                <p className="text-[9px] text-slate-400">Após custos diretos</p>
              </div>

              <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-3xl space-y-1">
                <span className="text-[9px] font-black uppercase text-emerald-800">
                  EBITDA / Resultado Líquido
                </span>
                <p className="text-2xl font-black text-emerald-700">
                  R$ {dreData.ebitda.toLocaleString("pt-BR")}
                </p>
                <p className="text-[9px] text-emerald-600 font-bold">Lucratividade Gerencial SST</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-accent" /> Lançamentos Analisados
              </h4>
              <div className="divide-y divide-slate-200">
                {dreData.lançamentosSugeridos.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.descricao}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-mono">
                        {item.categoria}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-mono font-black",
                        item.tipo === "RECEITA" ? "text-emerald-600" : "text-slate-700"
                      )}
                    >
                      {item.tipo === "RECEITA" ? "+" : "-"} R$ {item.valor.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-shadow border-none rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-primary text-white p-8">
            <div className="flex items-center gap-2">
              <Calculator className="size-5 text-accent" />
              <CardTitle className="text-lg uppercase font-headline">Calculadora FAP</CardTitle>
            </div>
            <CardDescription className="text-white/60">
              Simule reduções tributárias via Gestão NAI.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8 text-left">
            <div className="space-y-4">
              <div className="flex justify-between">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Folha Mensal Estimada
                </label>
                <span className="text-sm font-bold text-primary">
                  R$ {payroll.toLocaleString("pt-BR")}
                </span>
              </div>
              <Input
                type="number"
                value={payroll}
                onChange={(e) => setPayroll(Number(e.target.value))}
                className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Fator FAP Alvo
                </label>
                <span className="text-sm font-bold text-accent">{fapValue[0].toFixed(2)}</span>
              </div>
              <Slider value={fapValue} onValueChange={setFapValue} max={2} min={0.5} step={0.01} />
            </div>

            <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-primary/10 flex flex-col items-center gap-2 shadow-inner">
              <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">
                Economia Anual Estimada
              </p>
              <h2 className="text-4xl font-headline font-black text-primary">{potentialSavings}</h2>
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50 border-b p-8">
            <div className="flex items-center gap-2">
              <Scale className="size-5 text-primary" />
              <CardTitle className="text-lg font-black uppercase text-primary">
                Controle de Perícias (Real)
              </CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
              Monitoramento real-time de processos multi-tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin">
            {loadingExpertises ? (
              <div className="flex flex-col items-center py-20 gap-2 opacity-20">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  Sincronizando Base Jurídica...
                </p>
              </div>
            ) : expertises && expertises.length > 0 ? (
              <div className="divide-y">
                {expertises.map((item) => (
                  <div
                    key={item.id}
                    className="p-6 hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/5 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                          <Gavel className="size-4" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400">
                            Processo {item.caseNumber}
                          </p>
                          <p className="text-sm font-black text-primary uppercase">
                            {item.employeeName}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "text-[8px] font-black uppercase",
                          item.status === "Concluído"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">
                          Alegado
                        </p>
                        <p className="text-[10px] font-bold text-primary truncate italic">
                          &quot;{item.disease}&quot;
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">
                          Custo Estimado
                        </p>
                        <p className="text-[11px] font-black text-red-600">
                          {(Number(item.value) || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 text-center opacity-30 flex flex-col items-center gap-4">
                <Landmark size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">
                  Aguardando Registros Reais
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
