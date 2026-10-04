"use client";

import * as React from "react";
import {
  Scale,
  ShieldCheck,
  DollarSign,
  FileText,
  Sparkles,
  Copy,
  Check,
  Download,
  AlertTriangle,
  BrainCircuit,
  UserCheck,
  Building2,
  RefreshCw,
  TrendingUp,
  FileBadge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSgi } from "@/contexts/sgi-context";
import { REAL_COMPANIES } from "@/lib/real-data";
import {
  generateNtepContestation,
  NtepContestationOutput,
} from "@/ai/flows/ntep-contestation-generator";
import { useToast } from "@/hooks/use-toast";

export default function NtepContestationPage() {
  const { activeClientId } = useSgi();
  const { toast } = useToast();

  const currentCompany = React.useMemo(() => {
    if (!activeClientId || activeClientId === "all") {
      return (
        REAL_COMPANIES[0] || {
          name: "CONSTRUFAM ENGENHARIA E CONSTRUÇÕES LTDA",
          cnpj: "44.882.110/0001-92",
          cnae: "41.20-4-00",
        }
      );
    }
    const found = REAL_COMPANIES.find((c) => c.id === activeClientId);
    return found || { name: activeClientId, cnpj: "44.882.110/0001-92", cnae: "41.20-4-00" };
  }, [activeClientId]);

  const [employeeName, setEmployeeName] = React.useState("Cleberson Ricardo dos Santos");
  const [jobRole, setJobRole] = React.useState("Montador de Estruturas Metálicas");
  const [cid, setCid] = React.useState("M75.1 (Síndrome do Manguito Rotador / Tendinopatia)");
  const [benefitNumber, setBenefitNumber] = React.useState("NB 91/982.110.450-1");
  const [workEnvironment, setWorkEnvironment] = React.useState(
    "Atividades em altura com rodízio de tarefas, sem posturas estáticas prolongadas de elevação de braço acima dos ombros. Ferramentas elétricas com peso compensado por balancim."
  );

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [result, setResult] = React.useState<NtepContestationOutput | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await generateNtepContestation({
        companyName: currentCompany.name,
        cnpj: currentCompany.cnpj,
        cnae: (currentCompany as any).cnae || "41.20-4-00",
        employeeName,
        jobRole,
        cid,
        benefitNumber,
        workEnvironment,
      });

      setResult(res);
      toast({
        title: "Petição de Contestação Gerada!",
        description: `Probabilidade: ${res.successProbability} | Economia FAP estimada: R$ ${res.estimatedTaxSavings.toLocaleString("pt-BR")}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar contestação",
        description: err.message || "Falha ao processar com Gemini 3.8.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.fullPetitionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({
      title: "Petição Copiada!",
      description: "O texto formal completo foi copiado para sua área de transferência.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono">
            <BrainCircuit className="size-3.5 mr-1" /> Inteligência Jurídica Gemini 3.8
          </Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs">
            B91 ➔ B31 • Redução de FAP/RAT
          </Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <Scale className="size-8 text-amber-400" />
          Contestação Jurídico-Tributária de FAP & NTEP
        </h1>
        <p className="text-slate-400 text-xs md:text-sm mt-1">
          Descaracterização de benefícios acidentários indevidos concedidos pelo INSS com base
          estatística no CNAE.
        </p>
      </div>

      {/* Formulário do Caso */}
      <Card className="bg-slate-900 border-slate-800 rounded-3xl shadow-xl">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="size-5 text-sky-400" />
              Empresa Requerente: {currentCompany.name}
            </CardTitle>
            <Badge variant="outline" className="text-slate-400 border-slate-700 text-xs font-mono">
              CNPJ: {currentCompany.cnpj || "44.882.110/0001-92"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">
                Nome do Colaborador Afastado:
              </label>
              <Input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs h-10"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">Cargo / Função:</label>
              <Input
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-xs h-10"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">
                CID-10 Concedido pelo Perito do INSS:
              </label>
              <Input
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                className="bg-slate-950 border-slate-800 text-amber-300 font-mono text-xs h-10"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">
                Número do Benefício (NB):
              </label>
              <Input
                value={benefitNumber}
                onChange={(e) => setBenefitNumber(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono text-xs h-10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-bold block mb-1">
              Contraprova Técnica do Ambiente (PGR, LTCAT e Ergonomia):
            </label>
            <Textarea
              value={workEnvironment}
              onChange={(e) => setWorkEnvironment(e.target.value)}
              rows={3}
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg gap-2"
          >
            <Sparkles className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating
              ? "Gemini 3.8 Redigindo Petição e Calculando FAP..."
              : "Gerar Petição Administrativa via Gemini 3.8"}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado da Contestação */}
      {result && (
        <div className="space-y-6">
          {/* Card de Indicadores de Sucesso & Economia */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                Probabilidade de Deferimento
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    result.successProbability === "ALTA"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-sm font-black"
                      : result.successProbability === "MEDIA"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40 text-sm font-black"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40 text-sm font-black"
                  }
                >
                  {result.successProbability} PROBABILIDADE
                </Badge>
              </div>
              <p className="text-xs text-slate-400 pt-1">
                Fundamentada na presunção relativa da Lei 8.213/91.
              </p>
            </div>

            <div className="space-y-1 md:border-l border-slate-800 md:pl-6">
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                Economia Tributária FAP Anual
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                R${" "}
                {result.estimatedTaxSavings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-400 pt-1">
                Impacto evitado na alíquota RAT da folha de pagamento.
              </p>
            </div>

            <div className="space-y-1 md:border-l border-slate-800 md:pl-6">
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                Tese Jurídica Central
              </span>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {result.primaryDefenseStrategy}
              </p>
            </div>
          </div>

          {/* Argumentos Técnicos do PGR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-400" />
                Fundamentos Técnicos do PGR / LTCAT
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {result.technicalArguments.map((arg, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{arg}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileBadge className="size-4 text-sky-400" />
                Dispositivos Legais Citados
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {result.legalGrounds.map((lg, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-sky-400 font-bold">•</span>
                    <span>{lg}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Petição Formatada Pronta para Protocolo */}
          <Card className="bg-slate-900 border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <CardHeader className="bg-slate-800/60 border-b border-slate-700/60 p-4 px-6 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-amber-400" />
                <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                  Minuta da Petição Administrativa ao CRPS / INSS
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold gap-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copiado!" : "Copiar Petição"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto border-t border-slate-800">
              {result.fullPetitionText}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
